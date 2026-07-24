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

// GET /api/sows — lightweight list of active sows for sow_id dropdown
router.get('/api/sows', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { data, error } = await db
      .from('pigs')
      .select('pig_id, pig_tag, pen_id, breeds(name)')
      .eq('gender', 'Female')
      .eq('is_archived', false)
      .neq('status', 'Pregnant')
      .neq('status', 'Inactive')
      .order('pig_tag', { ascending: true });

    if (error) throw error;

    const sows = (data || []).map(p => ({
      id: p.pig_id,
      tag: p.pig_tag,
      penId: p.pen_id || null,
      breed: p.breeds?.name || '—',
    }));

    res.json({ data: sows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/boars — lightweight list of active boars for boar_id dropdown
router.get('/api/boars', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { data, error } = await db
      .from('pigs')
      .select('pig_id, pig_tag, pen_id, breeds(name)')
      .eq('gender', 'Male')
      .eq('is_archived', false)
      .order('pig_tag', { ascending: true });

    if (error) throw error;

    const boars = (data || []).map(p => ({
      id: p.pig_id,
      tag: p.pig_tag,
      penId: p.pen_id || null,
      breed: p.breeds?.name || '—',
    }));

    res.json({ data: boars });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/breeding-logs — fetch all breeding log records for the dashboard
router.get('/api/breeding-logs', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;

    const { tab } = req.query;
    let query = db.from('breeding_logs').select('*').order('breeding_date', { ascending: false });

    if (tab === 'history') {
      query = query.or('is_archived.eq.true,breeding_status.in.(failed,farrowed)');
    } else {
      query = query.eq('is_archived', false).in('breeding_status', ['pending', 'pregnant']);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) throw logsError;
    if (!logs || logs.length === 0) {
      return res.json({ data: [] });
    }

    // 2. Gather sow IDs and boar IDs
    const pigIds = [...new Set(
      logs.flatMap(l => [l.sow_id, l.boar_id]).filter(Boolean)
    )];

    // 3. Fetch pigs metadata with breeds
    let pigsMap = {};
    if (pigIds.length > 0) {
      const { data: pigsData, error: pigsError } = await db
        .from('pigs')
        .select('pig_id, pig_tag, pen_id, parity_count, breeds(name)')
        .in('pig_id', pigIds);

      if (!pigsError && pigsData) {
        pigsData.forEach(p => {
          pigsMap[p.pig_id] = p;
        });
      }
    }

    // 4. Map into response structure expected by BreedingLogs.jsx
    const sows = logs.map(b => {
      const sowObj = pigsMap[b.sow_id];
      const boarObj = pigsMap[b.boar_id];

      const sowTag = sowObj?.pig_tag || 'Unknown';
      const breedName = sowObj?.breeds?.name || 'Crossbreed';
      const parity = sowObj?.parity_count || 1;
      const matingDateStr = b.breeding_date;
      const matingDate = new Date(matingDateStr);
      const today = new Date();
      const diffTime = Math.abs(today - matingDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let status = "pregnant";
      const bStatus = b.breeding_status; // 'pending', 'pregnant', 'failed', 'farrowed'
      
      if (b.is_archived) {
        status = "archived";
      } else if (bStatus === 'failed') {
        status = "failed";
      } else if (bStatus === 'farrowed') {
        status = "farrowed";
      } else if (bStatus === 'pending') {
        if (diffDays < 21) {
          status = "monitoring";
        } else if (diffDays >= 21 && diffDays < 30) {
          // Heat check window: if passed, back to monitoring until preg check
          if (b.heat_check_date) status = "monitoring";
          else status = "action";
        } else {
          // Days 30+: Pregnancy check overdue if still pending
          status = "action";
        }
      } else if (bStatus === 'pregnant') {
        if (diffDays > 114) status = "action"; // Overdue
      }

      const expDateStr = b.expected_farrowing_date;
      let dueDate = "Overdue";
      if (expDateStr) {
        const expDate = new Date(expDateStr + 'T00:00:00');
        dueDate = expDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      return {
        id: sowTag,
        breeding_id: b.breeding_id,
        sow_id: b.sow_id,
        pen_id: sowObj?.pen_id || null,
        boar_id: b.boar_id,
        tag: sowTag,
        parity,
        breed: breedName,
        day: diffDays,
        status,
        dueDate,
        matingDate: matingDateStr,
        breeding_method: b.breeding_method,
        boarTag: boarObj?.pig_tag || null,
        breeding_status: b.breeding_status,
        heat_check_date: b.heat_check_date,
        preg_check_date: b.preg_check_date,
        expected_farrowing_date: b.expected_farrowing_date,
        actual_farrowing_date: b.actual_farrowing_date,
        is_archived: b.is_archived,
        archive_reason: b.archive_reason,
      };
    });

    res.json({ data: sows });
  } catch (error) {
    console.error('GET /api/breeding-logs error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/breeding-logs — create a new breeding log record & record activity log
router.post('/api/breeding-logs', async (req, res) => {
  try {
    const {
      breeding_method,
      sow_id,
      boar_id,
      breeding_date,
      creator,
    } = req.body;

    if (!breeding_method) return res.status(400).json({ error: 'Breeding method is required.' });
    if (!sow_id) return res.status(400).json({ error: 'Sow is required.' });
    if (!breeding_date) return res.status(400).json({ error: 'Breeding date is required.' });
    if (breeding_method === 'natural_mating' && !boar_id) {
      return res.status(400).json({ error: 'Boar is required for Natural Mating.' });
    }

    // Auto-calculate expected farrowing date (gestation = 114 days)
    const breedingDateObj = new Date(breeding_date);
    const expectedFarrowingDate = new Date(breedingDateObj);
    expectedFarrowingDate.setDate(expectedFarrowingDate.getDate() + 114);
    const expectedFarrowingStr = expectedFarrowingDate.toISOString().split('T')[0];

    const payload = {
      breeding_method,
      sow_id,
      boar_id: breeding_method === 'natural_mating' ? (boar_id || null) : null,
      breeding_date,
      breeding_status: 'pending',
      expected_farrowing_date: expectedFarrowingStr,
      actual_farrowing_date: null,
    };

    const db = supabaseAdmin || supabase;
    const { data, error } = await db
      .from('breeding_logs')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Fetch sow tag for detailed activity log
    const { data: sowPig } = await db
      .from('pigs')
      .select('pig_tag')
      .eq('pig_id', sow_id)
      .maybeSingle();

    // Update sow status in pigs table to Pregnant
    await db
      .from('pigs')
      .update({ status: 'pregnant' })
      .eq('pig_id', sow_id);

    const sowTag = sowPig?.pig_tag || sow_id;
    const methodLabel = breeding_method === 'artificial_insemination' ? 'AI' : 'Natural Mating';

    // Record Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    const { error: logError } = await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Breeding Record Added',
      event_desc: `Logged breeding event for Sow #${sowTag} (${methodLabel}).`,
      status: 'SUCCESS',
    });
    if (logError) console.error('Error inserting activity log for breeding add:', logError);

    res.status(201).json({ data, message: 'Breeding log created successfully.' });
  } catch (error) {
    console.error('POST /api/breeding-logs error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/breeding-logs/:id/abort — report a miscarriage / abortion
router.post('/api/breeding-logs/:id/abort', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { id } = req.params;
    const creator = req.body?.creator;

    // 1. Fetch log to get sow_id
    const { data: log, error: fetchErr } = await db
      .from('breeding_logs')
      .select('sow_id')
      .eq('breeding_id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // 2. Mark breeding log as failed
    const { error: updErr } = await db
      .from('breeding_logs')
      .update({ breeding_status: 'failed' })
      .eq('breeding_id', id);
    if (updErr) throw updErr;

    // 3. Return sow to healthy status
    const { error: sowErr } = await db
      .from('pigs')
      .update({ status: 'healthy' })
      .eq('pig_id', log.sow_id);
    if (sowErr) throw sowErr;

    // 4. Fetch sow tag for log
    const { data: sowPig } = await db.from('pigs').select('pig_tag').eq('pig_id', log.sow_id).maybeSingle();
    const sowTag = sowPig?.pig_tag || log.sow_id;

    // 5. Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: 'bg-orange-100 text-orange-700',
      event_title: 'Miscarriage Reported',
      event_desc: `Reported miscarriage for Sow #${sowTag}. Status returned to Healthy.`,
      status: 'SUCCESS',
    });

    res.json({ message: 'Miscarriage reported successfully.' });
  } catch (error) {
    console.error('POST /api/breeding-logs/:id/abort error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/breeding-logs/:id — update a breeding log & record activity log
router.put('/api/breeding-logs/:id', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { id } = req.params;
    const {
      breeding_method,
      sow_id,
      boar_id,
      breeding_date,
      breeding_status,
      actual_farrowing_date,
      creator,
    } = req.body;

    const updatePayload = {};
    if (breeding_method) updatePayload.breeding_method = breeding_method;
    if (sow_id) updatePayload.sow_id = sow_id;
    if (boar_id !== undefined) updatePayload.boar_id = boar_id;
    if (breeding_date) {
      updatePayload.breeding_date = breeding_date;
      const d = new Date(breeding_date);
      d.setDate(d.getDate() + 114);
      updatePayload.expected_farrowing_date = d.toISOString().split('T')[0];
    }
    if (breeding_status) updatePayload.breeding_status = breeding_status;
    if (actual_farrowing_date !== undefined) updatePayload.actual_farrowing_date = actual_farrowing_date;
    if (req.body.heat_check_date !== undefined) updatePayload.heat_check_date = req.body.heat_check_date;
    if (req.body.preg_check_date !== undefined) updatePayload.preg_check_date = req.body.preg_check_date;

    const { data, error } = await db
      .from('breeding_logs')
      .update(updatePayload)
      .eq('breeding_id', id)
      .select()
      .single();

    if (error) throw error;

    // Fetch sow tag for log
    let sowTag = id;
    if (data?.sow_id) {
      const { data: sowPig } = await db
        .from('pigs')
        .select('pig_tag')
        .eq('pig_id', data.sow_id)
        .maybeSingle();
      if (sowPig?.pig_tag) sowTag = sowPig.pig_tag;
    }

    // Record Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    const { error: logError } = await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: 'bg-indigo-100 text-indigo-700',
      event_title: 'Breeding Record Updated',
      event_desc: `Updated breeding record for Sow #${sowTag}.`,
      status: 'SUCCESS',
    });
    if (logError) console.error('Error inserting activity log for breeding edit:', logError);

    res.json({ data, message: 'Breeding log updated successfully.' });
  } catch (error) {
    console.error('PUT /api/breeding-logs/:id error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/breeding-logs/:id — archive / remove a breeding log & record activity log
router.delete('/api/breeding-logs/:id', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { id } = req.params;
    const { creator, archive_reason } = req.body;

    // Fetch existing log before deleting to get sow_id for activity log
    const { data: existingLog } = await db
      .from('breeding_logs')
      .select('sow_id')
      .eq('breeding_id', id)
      .maybeSingle();

    let sowTag = id;
    if (existingLog?.sow_id) {
      const { data: sowPig } = await db
        .from('pigs')
        .select('pig_tag')
        .eq('pig_id', existingLog.sow_id)
        .maybeSingle();
      if (sowPig?.pig_tag) sowTag = sowPig.pig_tag;
    }

    const { error } = await db
      .from('breeding_logs')
      .update({ 
        is_archived: true,
        archive_reason: archive_reason || null,
        archived_at: new Date().toISOString()
      })
      .eq('breeding_id', id);

    if (error) throw error;

    // Revert sow status to healthy when cycle is archived
    if (existingLog?.sow_id) {
      const { error: sowErr } = await db
        .from('pigs')
        .update({ status: 'healthy' })
        .eq('pig_id', existingLog.sow_id);
      if (sowErr) console.error('Error reverting sow status on archive:', sowErr);
    }

    // Record Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    const { error: logError } = await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: 'bg-red-100 text-red-700',
      event_title: 'Breeding Record Archived',
      event_desc: `Archived breeding record for Sow #${sowTag}.`,
      status: 'SUCCESS',
    });
    if (logError) console.error('Error inserting activity log for breeding archive:', logError);

    res.json({ message: 'Breeding log archived successfully.' });
  } catch (error) {
    console.error('DELETE /api/breeding-logs/:id error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/breeding-logs/:id/check — log a heat or pregnancy check
router.post('/api/breeding-logs/:id/check', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { id } = req.params;
    const { type, outcome, creator } = req.body; // type: 'heat' | 'pregnancy', outcome: 'passed' | 'failed'
    
    // Get existing log
    const { data: log, error: logError } = await db
      .from('breeding_logs')
      .select('sow_id')
      .eq('breeding_id', id)
      .single();
      
    if (logError) throw logError;
    
    const sow_id = log.sow_id;
    const updatePayload = {};
    const today = new Date().toISOString().split('T')[0];
    
    let eventTitle = '';
    let eventDesc = '';

    if (outcome === 'failed') {
      updatePayload.breeding_status = 'failed';
      // Update sow status to 'Healthy'
      await db.from('pigs').update({ status: 'Healthy' }).eq('pig_id', sow_id);
      eventTitle = 'Breeding Check Failed';
      eventDesc = `Sow failed ${type === 'heat' ? 'Heat' : 'Pregnancy'} check. Status reverted.`;
    } else {
      // Passed
      if (type === 'heat') {
        updatePayload.heat_check_date = today;
        eventTitle = 'Heat Check Passed';
        eventDesc = `Sow passed heat check.`;
      } else if (type === 'pregnancy') {
        updatePayload.preg_check_date = today;
        updatePayload.breeding_status = 'pregnant';
        await db.from('pigs').update({ status: 'pregnant' }).eq('pig_id', sow_id);
        eventTitle = 'Pregnancy Confirmed';
        eventDesc = `Sow confirmed pregnant.`;
      }
    }

    const { data, error } = await db
      .from('breeding_logs')
      .update(updatePayload)
      .eq('breeding_id', id)
      .select()
      .single();

    if (error) throw error;
    
    // Fetch sow tag for log
    let sowTag = sow_id;
    const { data: sowPig } = await db
      .from('pigs')
      .select('pig_tag')
      .eq('pig_id', sow_id)
      .maybeSingle();
    if (sowPig?.pig_tag) sowTag = sowPig.pig_tag;

    // Record Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    const { error: aError } = await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: outcome === 'failed' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700',
      event_title: eventTitle,
      event_desc: `${eventDesc} (Sow #${sowTag})`,
      status: 'SUCCESS',
    });
    if (aError) console.error('Error inserting activity log for check:', aError);

    res.json({ data, message: 'Check logged successfully.' });
  } catch (error) {
    console.error('POST /api/breeding-logs/:id/check error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/breeding-logs/:id/farrow — report farrowing
router.post('/api/breeding-logs/:id/farrow', async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const { id } = req.params;
    const { creator, actual_farrowing_date } = req.body;

    if (!actual_farrowing_date) return res.status(400).json({ error: 'Farrowing date is required.' });

    // 1. Fetch log to get sow_id
    const { data: log, error: fetchErr } = await db
      .from('breeding_logs')
      .select('sow_id')
      .eq('breeding_id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // 2. Mark breeding log as farrowed
    const { error: updErr } = await db
      .from('breeding_logs')
      .update({ 
        breeding_status: 'farrowed',
        actual_farrowing_date 
      })
      .eq('breeding_id', id);
    if (updErr) throw updErr;

    // 3. Increment parity and return sow to Healthy status
    const { data: sowPig } = await db
      .from('pigs')
      .select('pig_tag, parity_count')
      .eq('pig_id', log.sow_id)
      .single();

    const currentParity = sowPig?.parity_count || 0;
    const sowTag = sowPig?.pig_tag || log.sow_id;

    const { error: sowErr } = await db
      .from('pigs')
      .update({ 
        status: 'healthy',
        parity_count: currentParity + 1
      })
      .eq('pig_id', log.sow_id);
    if (sowErr) throw sowErr;

    // 4. Activity Log
    const { name, email, initials } = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: name,
      user_email: email,
      user_initials: initials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Farrowing Reported',
      event_desc: `Sow #${sowTag} has successfully farrowed. Parity increased to ${currentParity + 1}.`,
      status: 'SUCCESS',
    });

    res.json({ message: 'Farrowing reported successfully.' });
  } catch (error) {
    console.error('POST /api/breeding-logs/:id/farrow error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
