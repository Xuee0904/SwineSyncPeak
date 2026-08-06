import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';

const router = express.Router();

function getCreatorDetails(creator) {
  let name = 'Caretaker';
  let email = 'caretaker@swinesync.com';

  if (typeof creator === 'string' && creator.trim() !== '') {
    name = creator;
    if (creator.includes('@')) email = creator;
  } else if (typeof creator === 'object' && creator !== null) {
    name = creator.name || creator.full_name || creator.user_metadata?.full_name || creator.email?.split('@')[0] || 'Caretaker';
    email = creator.email || 'caretaker@swinesync.com';
  }

  const parts = name.split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();

  return { name, email, initials };
}

async function logActivity({ creator, event_title, event_desc, status = 'SUCCESS', bg_color = 'bg-emerald-100 text-emerald-700' }) {
  const { name, email, initials } = getCreatorDetails(creator);
  await supabaseAdmin.from('activity_logs').insert({
    user_name: name,
    user_email: email,
    user_initials: initials,
    user_bg_color: bg_color,
    event_title,
    event_desc,
    status,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH LOGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/health-logs
router.get('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id, archived } = req.query;

    let dbQuery = supabase.from('health_logs').select('*, pigs(pig_tag), piglet_batches(batch_tag)');
    if (pig_id) dbQuery = dbQuery.eq('pig_id', pig_id);
    if (batch_id) dbQuery = dbQuery.eq('batch_id', batch_id);

    // Filter archived unless explicitly requested
    if (archived === 'true') {
      dbQuery = dbQuery.eq('is_archived', true);
    } else {
      dbQuery = dbQuery.or('is_archived.eq.false,is_archived.is.null');
    }

    dbQuery = dbQuery.order('log_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to map health log status to pig/batch status
const syncSwineStatus = async (healthStatus, pig_id, batch_id) => {
  if (!healthStatus) return;
  const statusLower = healthStatus.toLowerCase();
  
  let pigStatus = '';
  let batchStatus = '';
  
  if (statusLower === 'sick') {
    pigStatus = 'Sick';
    batchStatus = 'sick';
  } else if (statusLower === 'monitoring') {
    pigStatus = 'Quarantine';
    batchStatus = 'quarantine';
  } else if (statusLower === 'resolved') {
    pigStatus = 'Healthy';
    batchStatus = 'healthy';
  }

  try {
    if (pig_id && pigStatus) {
      await supabaseAdmin.from('pigs').update({ status: pigStatus }).eq('pig_id', pig_id);
    } else if (batch_id && batchStatus) {
      await supabaseAdmin.from('piglet_batches').update({ status: batchStatus }).eq('batch_id', batch_id);
    }
  } catch (err) {
    console.error('Failed to sync swine status from health log:', err);
  }
};

// POST /api/health-logs
router.post('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id, recorded_by, symptoms, diagnosis, treatment, medication_name, dosage, status, notes } = req.body;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id.' });
    }
    if (!recorded_by) {
      return res.status(400).json({ error: 'recorded_by is required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('health_logs')
      .insert([{ pig_id, batch_id, recorded_by, symptoms, diagnosis, treatment, medication_name, dosage, status, notes }])
      .select();

    if (error) throw error;

    await logActivity({
      creator: recorded_by,
      event_title: 'Health Log Added',
      event_desc: `Recorded new health log${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}. Diagnosis: ${diagnosis || 'N/A'}.`,
    });

    if (status) {
      await syncSwineStatus(status, pig_id, batch_id);
    }

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/health-logs/:id
router.patch('/api/health-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, ...updates } = req.body;

    const { data, error } = await supabaseAdmin
      .from('health_logs')
      .update(updates)
      .eq('health_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Health log not found.' });

    await logActivity({
      creator: performed_by,
      event_title: 'Health Log Updated',
      event_desc: `Updated health log ${id.substring(0, 8)}.`,
    });

    if (updates.status) {
      await syncSwineStatus(updates.status, data[0].pig_id, data[0].batch_id);
    }

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/health-logs/:id/archive
router.patch('/api/health-logs/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, archive_reasoning } = req.body;

    const { data, error } = await supabaseAdmin
      .from('health_logs')
      .update({ is_archived: true })
      .eq('health_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Health log not found.' });

    await logActivity({
      creator: performed_by,
      bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Health Log Archived',
      event_desc: archive_reasoning
        ? `Archived health log ${id.substring(0, 8)}. Reason: ${archive_reasoning}`
        : `Archived health log ${id.substring(0, 8)}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VACCINATION RECORDS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/vaccination-records
router.get('/api/vaccination-records', async (req, res) => {
  try {
    const { pig_id, batch_id, archived } = req.query;

    let dbQuery = supabase.from('vaccination_records').select('*, pigs(pig_tag), piglet_batches(batch_tag)');
    if (pig_id) dbQuery = dbQuery.eq('pig_id', pig_id);
    if (batch_id) dbQuery = dbQuery.eq('batch_id', batch_id);

    if (archived === 'true') {
      dbQuery = dbQuery.eq('is_archived', true);
    } else {
      dbQuery = dbQuery.or('is_archived.eq.false,is_archived.is.null');
    }

    dbQuery = dbQuery.order('administered_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vaccination-records
router.post('/api/vaccination-records', async (req, res) => {
  try {
    const { pig_id, batch_id, vaccine_name, administered_date, dosage, lot_number, booster_due_date, administered_by } = req.body;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id.' });
    }
    if (!vaccine_name) return res.status(400).json({ error: 'vaccine_name is required.' });
    if (!administered_date) return res.status(400).json({ error: 'administered_date is required.' });

    const { data, error } = await supabaseAdmin
      .from('vaccination_records')
      .insert([{ pig_id, batch_id, vaccine_name, administered_date, dosage, lot_number, booster_due_date, administered_by }])
      .select();

    if (error) throw error;

    await logActivity({
      creator: administered_by,
      event_title: 'Vaccination Recorded',
      event_desc: `Recorded ${vaccine_name} vaccination${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/vaccination-records/:id
router.patch('/api/vaccination-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, ...updates } = req.body;

    const { data, error } = await supabaseAdmin
      .from('vaccination_records')
      .update(updates)
      .eq('vaccination_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Vaccination record not found.' });

    await logActivity({
      creator: performed_by,
      event_title: 'Vaccination Record Updated',
      event_desc: `Updated vaccination record ${id.substring(0, 8)}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/vaccination-records/:id/archive
router.patch('/api/vaccination-records/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, archive_reasoning } = req.body;

    const { data, error } = await supabaseAdmin
      .from('vaccination_records')
      .update({ is_archived: true })
      .eq('vaccination_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Vaccination record not found.' });

    await logActivity({
      creator: performed_by,
      bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Vaccination Record Archived',
      event_desc: archive_reasoning
        ? `Archived vaccination record ${id.substring(0, 8)}. Reason: ${archive_reasoning}`
        : `Archived vaccination record ${id.substring(0, 8)}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MORTALITY LOGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/mortality-logs
router.get('/api/mortality-logs', async (req, res) => {
  try {
    const { pig_id, batch_id, pen_id, archived } = req.query;

    let dbQuery = supabase.from('mortality_logs').select('*');
    if (pig_id) dbQuery = dbQuery.eq('pig_id', pig_id);
    if (batch_id) dbQuery = dbQuery.eq('batch_id', batch_id);
    if (pen_id) dbQuery = dbQuery.eq('pen_id', pen_id);

    if (archived === 'true') {
      dbQuery = dbQuery.eq('is_archived', true);
    } else {
      dbQuery = dbQuery.or('is_archived.eq.false,is_archived.is.null');
    }

    dbQuery = dbQuery.order('log_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mortality-logs
router.post('/api/mortality-logs', async (req, res) => {
  try {
    const { pen_id, batch_id, pig_id, cause, action_taken, recorded_by } = req.body;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id.' });
    }
    if (!cause) return res.status(400).json({ error: 'cause is required.' });

    const { data, error } = await supabaseAdmin
      .from('mortality_logs')
      .insert([{ pen_id, batch_id, pig_id, cause, action_taken, recorded_by }])
      .select();

    if (error) throw error;

    await logActivity({
      creator: recorded_by,
      bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Mortality Log Added',
      event_desc: `Recorded mortality event${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}. Cause: ${cause}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/mortality-logs/:id
router.patch('/api/mortality-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, ...updates } = req.body;

    const { data, error } = await supabaseAdmin
      .from('mortality_logs')
      .update(updates)
      .eq('mortality_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Mortality log not found.' });

    await logActivity({
      creator: performed_by,
      event_title: 'Mortality Log Updated',
      event_desc: `Updated mortality log ${id.substring(0, 8)}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/mortality-logs/:id/archive
router.patch('/api/mortality-logs/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, archive_reasoning } = req.body;

    const { data, error } = await supabaseAdmin
      .from('mortality_logs')
      .update({ is_archived: true })
      .eq('mortality_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Mortality log not found.' });

    await logActivity({
      creator: performed_by,
      bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Mortality Log Archived',
      event_desc: archive_reasoning
        ? `Archived mortality log ${id.substring(0, 8)}. Reason: ${archive_reasoning}`
        : `Archived mortality log ${id.substring(0, 8)}.`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
