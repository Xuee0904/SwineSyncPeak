import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { deductInventoryStock } from '../helpers/inventoryDeduction.js';
import { verifyAuth, verifyAdmin } from '../middleware/auth.js';
import { createHttpError, queueApprovalRequest } from '../helpers/approvalQueue.js';

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
// LINEAGE HELPERS FOR PROMOTED BREEDER RECORDS
// ─────────────────────────────────────────────────────────────────────────────

function isOnOrBeforePromotion(recordDate, recordCreatedAt, promotedAt) {
  if (!promotedAt || !recordDate) return true;
  const promoMs = Date.parse(promotedAt);
  if (Number.isNaN(promoMs)) return true;

  const trimmed = typeof recordDate === 'string' ? recordDate.trim() : '';
  if (trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const recordDayStartUtc = Date.parse(`${trimmed}T00:00:00Z`);
    // Strictly after promotion date in any timezone up to UTC+14
    if (recordDayStartUtc > promoMs + 14 * 3600 * 1000) return false;

    // On the promotion calendar day window, use row creation time to exclude post-promotion batch logs
    if (Math.abs(recordDayStartUtc - promoMs) <= 24 * 3600 * 1000 && recordCreatedAt) {
      const createdMs = Date.parse(recordCreatedAt);
      if (!Number.isNaN(createdMs)) return createdMs <= promoMs;
    }
    return true;
  }

  const recMs = Date.parse(recordDate);
  return Number.isNaN(recMs) ? true : recMs <= promoMs;
}

async function fetchPigSourceBatch(pigId) {
  if (!pigId) return null;
  try {
    const db = supabaseAdmin || supabase;
    const { data, error } = await db
      .from('pigs')
      .select('source_batch_id, source_batch_tag, promoted_at')
      .eq('pig_id', pigId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

function sortMergedHealthRecords(records, dateField) {
  return [...records].sort((a, b) => {
    const dateA = Date.parse(a[dateField] || 0) || 0;
    const dateB = Date.parse(b[dateField] || 0) || 0;
    if (dateB !== dateA) return dateB - dateA;

    const aInherited = Boolean(a.inherited_from_batch);
    const bInherited = Boolean(b.inherited_from_batch);
    if (aInherited !== bInherited) return aInherited ? 1 : -1;

    const createdA = Date.parse(a.created_at || 0) || 0;
    const createdB = Date.parse(b.created_at || 0) || 0;
    return createdB - createdA;
  });
}

async function fetchInheritedBatchRecords({ table, select, pigId, archived, dateField, excludeDeceased = false }) {
  const lineage = await fetchPigSourceBatch(pigId);
  if (!lineage?.source_batch_id) return [];

  let batchQuery = supabase
    .from(table)
    .select(select)
    .eq('batch_id', lineage.source_batch_id);

  if (archived === 'true') {
    batchQuery = batchQuery.eq('is_archived', true);
  } else {
    batchQuery = batchQuery.or('is_archived.eq.false,is_archived.is.null');
  }

  batchQuery = batchQuery.order(dateField, { ascending: false });
  const { data, error } = await batchQuery;
  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      if (excludeDeceased && (row.status || '').toLowerCase() === 'deceased') return false;
      return isOnOrBeforePromotion(row[dateField], row.created_at, lineage.promoted_at);
    })
    .map((row) => ({
      ...row,
      inherited_from_batch: true,
      inherited_batch_tag: lineage.source_batch_tag || row.piglet_batches?.batch_tag || null,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH LOGS
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_LOG_SELECT = '*, pigs(pig_tag, pens(pen_code)), piglet_batches(batch_tag, current_count, total_born_alive, pens(pen_code)), inventory_items(item_id, item_name, unit_of_measure, category)';

// GET /api/health-logs
router.get('/api/health-logs', verifyAuth, async (req, res) => {
  try {
    const { pig_id, batch_id, archived, include_inherited } = req.query;

    let dbQuery = supabase.from('health_logs').select(HEALTH_LOG_SELECT);
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

    const directLogs = data ?? [];
    if (pig_id && !batch_id && include_inherited !== 'false') {
      const inheritedLogs = await fetchInheritedBatchRecords({
        table: 'health_logs',
        select: HEALTH_LOG_SELECT,
        pigId: pig_id,
        archived,
        dateField: 'log_date',
        excludeDeceased: true,
      });
      return res.json({
        data: sortMergedHealthRecords([...directLogs, ...inheritedLogs], 'log_date'),
      });
    }

    res.json({ data: directLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to map health log status to pig/batch status
const syncSwineStatus = async (healthStatus, pig_id, batch_id, mortality_count = 1, performed_by = 'Health Management') => {
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
  } else if (statusLower === 'deceased') {
    if (pig_id) {
      await supabaseAdmin
        .from('pigs')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archive_reasoning: 'Mortality - Clinical / Health Log',
          status: 'Inactive'
        })
        .eq('pig_id', pig_id);

      await logActivity({
        creator: performed_by,
        bg_color: 'bg-rose-100 text-rose-700',
        event_title: 'Swine Marked Deceased',
        event_desc: `Swine ${pig_id.substring(0, 8)} marked deceased and archived from active herd.`,
      });
      return;
    } else if (batch_id) {
      const { data: batch } = await supabaseAdmin
        .from('piglet_batches')
        .select('current_count, batch_tag, total_born_alive')
        .eq('batch_id', batch_id)
        .maybeSingle();

      if (batch) {
        const cur = Number(batch.current_count ?? batch.total_born_alive ?? 0);
        const lost = Math.max(1, parseInt(mortality_count) || 1);
        const newCount = Math.max(0, cur - lost);

        const updatePayload = { current_count: newCount };
        if (newCount === 0) {
          updatePayload.is_archived = true;
          updatePayload.archived_at = new Date().toISOString();
          updatePayload.archive_reasoning = 'Mortality - Total Batch Loss';
        }

        await supabaseAdmin
          .from('piglet_batches')
          .update(updatePayload)
          .eq('batch_id', batch_id);

        await logActivity({
          creator: performed_by,
          bg_color: 'bg-rose-100 text-rose-700',
          event_title: newCount === 0 ? 'Batch Fully Lost' : 'Batch Mortality Recorded',
          event_desc: `Recorded ${lost} head loss for batch ${batch.batch_tag || batch_id.substring(0, 8)}. Remaining: ${newCount} head.${newCount === 0 ? ' Batch has been archived.' : ''}`,
        });
      }
      return;
    }
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

async function resolveHealthDisplayMeta({ pig_id, batch_id, item_id }) {
  let targetTag = null;
  let itemName = null;
  let itemUnit = null;

  if (pig_id) {
    const { data } = await supabaseAdmin.from('pigs').select('pig_tag').eq('pig_id', pig_id).maybeSingle();
    targetTag = data?.pig_tag ? `#${data.pig_tag}` : null;
  } else if (batch_id) {
    const { data } = await supabaseAdmin.from('piglet_batches').select('batch_tag').eq('batch_id', batch_id).maybeSingle();
    targetTag = data?.batch_tag || null;
  }

  if (item_id) {
    const { data } = await supabaseAdmin.from('inventory_items').select('item_name, unit_of_measure').eq('item_id', item_id).maybeSingle();
    itemName = data?.item_name || null;
    itemUnit = data?.unit_of_measure || null;
  }

  return { targetTag, itemName, itemUnit };
}

async function completeLinkedGrowthTask(taskId, { linked_health_id = null, linked_vaccination_id = null, performed_by = 'Health Management' }) {
  if (!taskId) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('growth_tasks')
      .update({
        status: 'completed',
        linked_health_id: linked_health_id || null,
        linked_vaccination_id: linked_vaccination_id || null,
        completed_at: new Date().toISOString(),
      })
      .eq('task_id', taskId)
      .select();

    if (error || !data || data.length === 0) return;
    const task = data[0];
    if (task.batch_id) {
      await supabaseAdmin
        .from('batch_activity_logs')
        .insert({
          batch_id: task.batch_id,
          guideline_id: task.guideline_id || null,
          activity_type: task.activity_type,
          amount_given: 0,
          performed_by,
        })
        .then(() => {})
        .catch(() => {});
    }
  } catch (err) {
    console.warn('[Growth Task] Failed to complete linked task:', err.message);
  }
}

export async function executeCreateHealthLog(body = {}) {
  const {
    pig_id,
    batch_id,
    log_date,
    recorded_by,
    examined_by,
    symptoms,
    diagnosis,
    treatment,
    medication_name,
    dosage,
    status,
    notes,
    item_id,
    quantity_deducted,
    mortality_count,
    growth_task_id,
    creator,
  } = body;

  if (!pig_id && !batch_id) {
    throw createHttpError(400, 'Must provide pig_id or batch_id.');
  }
  if (!recorded_by) {
    throw createHttpError(400, 'recorded_by is required.');
  }

  const deductionQty = quantity_deducted ? parseFloat(quantity_deducted) : null;

  const { data, error } = await supabaseAdmin
    .from('health_logs')
    .insert([{
      pig_id,
      batch_id,
      log_date: log_date || new Date().toISOString(),
      recorded_by,
      examined_by: examined_by || null,
      symptoms,
      diagnosis,
      treatment,
      medication_name,
      dosage,
      status,
      notes,
      item_id: item_id || null,
      quantity_deducted: deductionQty && deductionQty > 0 ? deductionQty : null
    }])
    .select();

  if (error) throw error;

  if (item_id && deductionQty && deductionQty > 0) {
    await deductInventoryStock({
      db: supabaseAdmin,
      itemId: item_id,
      quantity: deductionQty,
      notes: `Health treatment: ${treatment || medication_name || 'Medication'}${pig_id ? ' (Individual Pig)' : ' (Batch)'} • By: ${creator || recorded_by}`,
      performedBy: creator || recorded_by
    }).catch(err => console.warn('[Health Log] Stock deduction warning:', err.message));
  }

  await logActivity({
    creator: creator || recorded_by,
    event_title: 'Health Log Added',
    event_desc: `Recorded new health log${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}. Diagnosis: ${diagnosis || 'N/A'}.${examined_by ? ` Examined by: ${examined_by}.` : ''}`,
  });

  if (status) {
    await syncSwineStatus(status, pig_id, batch_id, mortality_count, creator || recorded_by);
  }

  if (growth_task_id && data?.[0]?.health_id) {
    await completeLinkedGrowthTask(growth_task_id, {
      linked_health_id: data[0].health_id,
      performed_by: creator || recorded_by,
    });
  }

  return { data: data[0] };
}

// POST /api/health-logs
router.post('/api/health-logs', verifyAuth, async (req, res) => {
  try {
    const { pig_id, batch_id, diagnosis, status, item_id, quantity_deducted } = req.body;
    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id.' });
    }

    const effectiveRecordedBy = req.isAdmin ? (req.body.recorded_by || req.userName) : req.userName;
    if (!effectiveRecordedBy) {
      return res.status(400).json({ error: 'recorded_by is required.' });
    }

    if (req.isAdmin) {
      const result = await executeCreateHealthLog({
        ...req.body,
        recorded_by: effectiveRecordedBy,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const meta = await resolveHealthDisplayMeta({ pig_id, batch_id, item_id });
    const subjectLabel = meta.targetTag || (pig_id ? `Pig ${pig_id.substring(0, 8)}` : `Batch ${batch_id?.substring(0, 8)}`);
    const statusText = status ? ` (${status})` : '';
    const diagText = diagnosis ? `: ${diagnosis}` : '';
    const summary = `Health event for ${subjectLabel}${statusText}${diagText}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'health',
      action: 'create_health_log',
      actionLabel: 'Log Health Event',
      summary,
      targetId: pig_id || batch_id,
      payload: {
        ...req.body,
        recorded_by: req.userName,
        performed_by: req.userName,
        targetTag: meta.targetTag,
        itemName: meta.itemName,
        itemUnit: meta.itemUnit,
        quantity_deducted: quantity_deducted ? parseFloat(quantity_deducted) : null,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Health log submitted for administrator approval.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /api/health-logs/:id
router.patch('/api/health-logs/:id', verifyAdmin, async (req, res) => {
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
      event_desc: `Updated health log ${id.substring(0, 8)}.${updates.examined_by ? ` Examined by: ${updates.examined_by}.` : ''}`,
    });

    if (updates.status) {
      await syncSwineStatus(updates.status, data[0].pig_id, data[0].batch_id, updates.mortality_count, performed_by);
    }

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/health-logs/:id/archive
router.patch('/api/health-logs/:id/archive', verifyAdmin, async (req, res) => {
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

const VACCINATION_SELECT = '*, pigs(pig_tag, pens(pen_code)), piglet_batches(batch_tag, pens(pen_code)), inventory_items(item_id, item_name, unit_of_measure, category)';

// GET /api/vaccination-records
router.get('/api/vaccination-records', verifyAuth, async (req, res) => {
  try {
    const { pig_id, batch_id, archived, include_inherited } = req.query;

    let dbQuery = supabase.from('vaccination_records').select(VACCINATION_SELECT);
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

    const directVaccs = data ?? [];
    if (pig_id && !batch_id && include_inherited !== 'false') {
      const inheritedVaccs = await fetchInheritedBatchRecords({
        table: 'vaccination_records',
        select: VACCINATION_SELECT,
        pigId: pig_id,
        archived,
        dateField: 'administered_date',
      });
      return res.json({
        data: sortMergedHealthRecords([...directVaccs, ...inheritedVaccs], 'administered_date'),
      });
    }

    res.json({ data: directVaccs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export async function validateCreateVaccination(body = {}) {
  const { pig_id, batch_id, vaccine_name, administered_date, booster_due_date } = body;

  if (!pig_id && !batch_id) {
    throw createHttpError(400, 'Must provide pig_id or batch_id.');
  }
  if (!vaccine_name) throw createHttpError(400, 'vaccine_name is required.');
  if (!administered_date) throw createHttpError(400, 'administered_date is required.');

  if (booster_due_date) {
    if (new Date(booster_due_date) <= new Date(administered_date)) {
      throw createHttpError(400, 'Booster due date must be strictly after the administered date.');
    }
  }

  let birthDate = null;
  if (pig_id) {
    const { data: pig } = await supabaseAdmin.from('pigs').select('date_of_birth').eq('pig_id', pig_id).single();
    if (pig && pig.date_of_birth) birthDate = pig.date_of_birth;
  } else if (batch_id) {
    const { data: batch } = await supabaseAdmin.from('piglet_batches').select('date_of_birth').eq('batch_id', batch_id).single();
    if (batch && batch.date_of_birth) birthDate = batch.date_of_birth;
  }

  if (birthDate && new Date(administered_date) < new Date(birthDate)) {
    throw createHttpError(400, "Vaccination date cannot precede the swine's birthdate.");
  }
}

export async function executeCreateVaccination(body = {}) {
  const {
    pig_id,
    batch_id,
    vaccine_name,
    administered_date,
    dosage,
    lot_number,
    booster_due_date,
    administered_by,
    recorded_by,
    item_id,
    quantity_deducted,
    growth_task_id,
    creator,
  } = body;

  await validateCreateVaccination(body);

  const deductionQty = quantity_deducted ? parseFloat(quantity_deducted) : null;

  const { data, error } = await supabaseAdmin
    .from('vaccination_records')
    .insert([{
      pig_id,
      batch_id,
      vaccine_name,
      administered_date,
      dosage,
      lot_number,
      booster_due_date,
      administered_by,
      recorded_by,
      item_id: item_id || null,
      quantity_deducted: deductionQty && deductionQty > 0 ? deductionQty : null
    }])
    .select();

  if (error) throw error;

  if (item_id && deductionQty && deductionQty > 0) {
    await deductInventoryStock({
      db: supabaseAdmin,
      itemId: item_id,
      quantity: deductionQty,
      notes: `Vaccination: ${vaccine_name}${pig_id ? ' (Individual Pig)' : ' (Batch)'} • By: ${creator || administered_by || recorded_by}`,
      performedBy: creator || recorded_by || administered_by
    }).catch(err => console.warn('[Vaccination] Stock deduction warning:', err.message));
  }

  await logActivity({
    creator: creator || recorded_by || administered_by,
    event_title: 'Vaccination Recorded',
    event_desc: `Recorded ${vaccine_name} vaccination${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}.${administered_by ? ` Administered by: ${administered_by}.` : ''}`,
  });

  if (growth_task_id && data?.[0]?.vaccination_id) {
    await completeLinkedGrowthTask(growth_task_id, {
      linked_vaccination_id: data[0].vaccination_id,
      performed_by: creator || recorded_by || administered_by,
    });
  }

  return { data: data[0] };
}

// POST /api/vaccination-records
router.post('/api/vaccination-records', verifyAuth, async (req, res) => {
  try {
    await validateCreateVaccination(req.body);

    const effectiveRecordedBy = req.isAdmin ? (req.body.recorded_by || req.userName) : req.userName;
    const effectiveAdministeredBy = req.body.administered_by || req.userName;

    if (req.isAdmin) {
      const result = await executeCreateVaccination({
        ...req.body,
        recorded_by: effectiveRecordedBy,
        administered_by: effectiveAdministeredBy,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const { pig_id, batch_id, vaccine_name, item_id, quantity_deducted } = req.body;
    const meta = await resolveHealthDisplayMeta({ pig_id, batch_id, item_id });
    const subjectLabel = meta.targetTag || (pig_id ? `Pig ${pig_id.substring(0, 8)}` : `Batch ${batch_id?.substring(0, 8)}`);
    const summary = `Vaccination (${vaccine_name}) for ${subjectLabel}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'health',
      action: 'create_vaccination',
      actionLabel: 'Log Vaccination',
      summary,
      targetId: pig_id || batch_id,
      payload: {
        ...req.body,
        recorded_by: req.userName,
        administered_by: effectiveAdministeredBy,
        performed_by: req.userName,
        targetTag: meta.targetTag,
        itemName: meta.itemName,
        itemUnit: meta.itemUnit,
        quantity_deducted: quantity_deducted ? parseFloat(quantity_deducted) : null,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Vaccination record submitted for administrator approval.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /api/vaccination-records/:id
router.patch('/api/vaccination-records/:id', verifyAdmin, async (req, res) => {
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
      event_desc: `Updated vaccination record ${id.substring(0, 8)}.${updates.administered_by ? ` Administered by: ${updates.administered_by}.` : ''}`,
    });

    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/vaccination-records/:id/archive
router.patch('/api/vaccination-records/:id/archive', verifyAdmin, async (req, res) => {
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
router.get('/api/mortality-logs', verifyAuth, async (req, res) => {
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

export async function executeCreateMortality(body = {}) {
  const { pen_id, batch_id, pig_id, cause, action_taken, recorded_by, creator } = body;

  if (!pig_id && !batch_id) {
    throw createHttpError(400, 'Must provide pig_id or batch_id.');
  }
  if (!cause) throw createHttpError(400, 'cause is required.');

  const { data, error } = await supabaseAdmin
    .from('mortality_logs')
    .insert([{ pen_id, batch_id, pig_id, cause, action_taken, recorded_by }])
    .select();

  if (error) throw error;

  await logActivity({
    creator: creator || recorded_by,
    bg_color: 'bg-rose-100 text-rose-700',
    event_title: 'Mortality Log Added',
    event_desc: `Recorded mortality event${pig_id ? ` for pig ${pig_id.substring(0, 8)}` : ` for batch ${batch_id?.substring(0, 8)}`}. Cause: ${cause}.`,
  });

  return { data: data[0] };
}

// POST /api/mortality-logs
router.post('/api/mortality-logs', verifyAuth, async (req, res) => {
  try {
    const { batch_id, pig_id, cause } = req.body;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id.' });
    }
    if (!cause) return res.status(400).json({ error: 'cause is required.' });

    const effectiveRecordedBy = req.isAdmin ? (req.body.recorded_by || req.userName) : req.userName;

    if (req.isAdmin) {
      const result = await executeCreateMortality({
        ...req.body,
        recorded_by: effectiveRecordedBy,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const meta = await resolveHealthDisplayMeta({ pig_id, batch_id });
    const subjectLabel = meta.targetTag || (pig_id ? `Pig ${pig_id.substring(0, 8)}` : `Batch ${batch_id?.substring(0, 8)}`);
    const summary = `Mortality report for ${subjectLabel}: ${cause}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'health',
      action: 'create_mortality',
      actionLabel: 'Report Mortality',
      summary,
      targetId: pig_id || batch_id,
      payload: {
        ...req.body,
        recorded_by: req.userName,
        targetTag: meta.targetTag,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Mortality log submitted for administrator approval.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /api/mortality-logs/:id
router.patch('/api/mortality-logs/:id', verifyAdmin, async (req, res) => {
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
router.patch('/api/mortality-logs/:id/archive', verifyAdmin, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// GROWTH TASKS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/growth-tasks
router.get('/api/growth-tasks', verifyAuth, async (req, res) => {
  try {
    const { batch_id, status } = req.query;
    let dbQuery = supabaseAdmin
      .from('growth_tasks')
      .select('*, piglet_batches(batch_tag, current_count, is_archived), growth_programs(name), inventory_items(item_id, item_name, unit_of_measure, category, current_stock_level)');
    
    if (batch_id) dbQuery = dbQuery.eq('batch_id', batch_id);
    if (status) dbQuery = dbQuery.eq('status', status);
    
    dbQuery = dbQuery.order('due_date', { ascending: true });
    
    const { data, error } = await dbQuery;
    if (error) throw error;

    // Filter out tasks belonging to archived/liquidated batches unless specifically querying that batch
    const filtered = batch_id ? (data ?? []) : (data ?? []).filter(t => !t.piglet_batches?.is_archived);
    
    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/growth-tasks/:id
router.patch('/api/growth-tasks/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, linked_health_id, linked_vaccination_id, performed_by } = req.body;
    const actorName = req.isAdmin ? (performed_by || req.userName) : req.userName;

    const { data, error } = await supabaseAdmin
      .from('growth_tasks')
      .update({ 
        status, 
        linked_health_id: linked_health_id || null, 
        linked_vaccination_id: linked_vaccination_id || null,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('task_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const task = data[0];

    // When completing a task, also record it in batch_activity_logs so the
    // Growth Program timeline stays in sync (marks the milestone as "done").
    if (status === 'completed' && task.batch_id) {
      await supabaseAdmin.from('batch_activity_logs').insert({
        batch_id: task.batch_id,
        guideline_id: task.guideline_id || null,
        activity_type: task.activity_type,
        amount_given: 0,
        performed_by: actorName || 'Health Management',
      }).then(() => {}).catch(err => console.warn('[Growth Task] batch_activity_logs sync warning:', err.message));
    }

    await logActivity({
      creator: actorName,
      event_title: status === 'completed' ? 'Scheduled Task Completed' : 'Scheduled Task Updated',
      event_desc: `${task.task_name || 'Growth task'} (${task.activity_type || 'Task'}) marked ${status}.`,
    }).catch(() => {});

    res.json({ data: task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
