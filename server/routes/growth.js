import express from 'express';
import { supabaseAdmin } from '../supabaseClient.js';

const router = express.Router();
const db = supabaseAdmin;

// GET /api/growth/programs
// Fetch available growth program templates
router.get('/api/growth/programs', async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';

    const { data: programs, error } = await db
      .from('growth_programs')
      .select(`
        *,
        guidelines:growth_program_guidelines(*)
      `)
      .eq('is_archived', isArchived)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(programs);
  } catch (error) {
    console.error('Error fetching growth programs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/programs
// Create a new growth program template with guidelines
router.post('/api/growth/programs', async (req, res) => {
  try {
    const { name, description, guidelines, performed_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Program name is required.' });
    }

    // 1. Insert the program header
    const { data: program, error: programErr } = await db
      .from('growth_programs')
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select()
      .single();

    if (programErr) throw programErr;

    // 2. Insert guidelines if provided
    if (guidelines && guidelines.length > 0) {
      const guidelineRows = guidelines.map(g => ({
        program_id: program.program_id,
        days_after_birth: g.days_after_birth,
        activity_type: g.activity_type,
        task_name: g.task_name,
        daily_consumption_per_head: g.daily_consumption_per_head || 0,
        dosage_instructions: g.dosage_instructions || null,
      }));

      const { error: guidelinesErr } = await db
        .from('growth_program_guidelines')
        .insert(guidelineRows);

      if (guidelinesErr) throw guidelinesErr;
    }

    // 3. Log the activity
    await db.from('activity_logs').insert({
      user_name: performed_by || 'System',
      user_email: 'system@swinesync.ag',
      event_title: 'Growth Program Created',
      event_desc: `Growth program template "${name.trim()}" was created.`,
      status: 'SUCCESS',
    }).then(() => {}).catch(() => {}); // non-blocking

    res.status(201).json({ success: true, program_id: program.program_id });
  } catch (error) {
    console.error('Error creating growth program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/growth/programs/:id
// Update a growth program template (replaces all guidelines)
router.put('/api/growth/programs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, guidelines, performed_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Program name is required.' });
    }

    // 1. Update the program header
    const { error: updateErr } = await db
      .from('growth_programs')
      .update({ name: name.trim(), description: description?.trim() || null })
      .eq('program_id', id);

    if (updateErr) throw updateErr;

    // 2. Delete existing guidelines and re-insert
    const { error: deleteErr } = await db
      .from('growth_program_guidelines')
      .delete()
      .eq('program_id', id);

    if (deleteErr) throw deleteErr;

    if (guidelines && guidelines.length > 0) {
      const guidelineRows = guidelines.map(g => ({
        program_id: id,
        days_after_birth: g.days_after_birth,
        activity_type: g.activity_type,
        task_name: g.task_name,
        daily_consumption_per_head: g.daily_consumption_per_head || 0,
        dosage_instructions: g.dosage_instructions || null,
      }));

      const { error: guidelinesErr } = await db
        .from('growth_program_guidelines')
        .insert(guidelineRows);

      if (guidelinesErr) throw guidelinesErr;
    }

    // 3. Log the activity
    await db.from('activity_logs').insert({
      user_name: performed_by || 'System',
      user_email: 'system@swinesync.ag',
      event_title: 'Growth Program Updated',
      event_desc: `Growth program template "${name.trim()}" was updated.`,
      status: 'SUCCESS',
    }).then(() => {}).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating growth program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/growth/programs/:id/archive
// Archive a growth program template
router.patch('/api/growth/programs/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;

    // Fetch the program name for the activity log
    const { data: program, error: fetchErr } = await db
      .from('growth_programs')
      .select('name')
      .eq('program_id', id)
      .single();

    if (fetchErr) throw fetchErr;

    // Soft-delete by setting is_archived to true
    const { error: updateErr } = await db
      .from('growth_programs')
      .update({ is_archived: true })
      .eq('program_id', id);

    if (updateErr) throw updateErr;

    // Log the activity
    await db.from('activity_logs').insert({
      user_name: performed_by || 'System',
      user_email: 'system@swinesync.ag',
      event_title: 'Growth Program Archived',
      event_desc: `Growth program template "${program.name}" was archived/deleted.`,
      status: 'SUCCESS',
    }).then(() => {}).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving growth program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/growth/programs/:id/restore
// Restore an archived growth program template
router.patch('/api/growth/programs/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;

    const { data: program, error: fetchErr } = await db
      .from('growth_programs')
      .select('name')
      .eq('program_id', id)
      .single();

    if (fetchErr) throw fetchErr;

    // Restore by setting is_archived to false
    const { error: updateErr } = await db
      .from('growth_programs')
      .update({ is_archived: false })
      .eq('program_id', id);

    if (updateErr) throw updateErr;

    // Log the activity
    await db.from('activity_logs').insert({
      user_name: performed_by || 'System',
      user_email: 'system@swinesync.ag',
      event_title: 'Growth Program Restored',
      event_desc: `Growth program template "${program.name}" was restored to active status.`,
      status: 'SUCCESS',
    }).then(() => {}).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring growth program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/growth/batches
// Fetch enrolled batches and their progress
router.get('/api/growth/batches', async (req, res) => {
  try {
    // 1. Fetch all batches that have an assigned program
    const { data: batches, error } = await db
      .from('piglet_batches')
      .select(`
        batch_id,
        batch_tag,
        current_count,
        date_of_birth,
        assigned_program_id,
        status,
        pen:pens (pen_code),
        program:growth_programs (name)
      `)
      .not('assigned_program_id', 'is', null)
      .eq('is_archived', false)
      .order('date_of_birth', { ascending: false });

    if (error) throw error;

    if (!batches || batches.length === 0) {
      return res.json([]);
    }

    // 2. Fetch guidelines for the programs these batches are in
    const programIds = [...new Set(batches.map(b => b.assigned_program_id))];
    const { data: guidelines, error: guidelinesErr } = await db
      .from('growth_program_guidelines')
      .select('*')
      .in('program_id', programIds)
      .order('days_after_birth', { ascending: true });

    if (guidelinesErr) throw guidelinesErr;

    // 3. Fetch activity logs for these batches to calculate progress/feed consumed
    const batchIds = batches.map(b => b.batch_id);
    const { data: logs, error: logsErr } = await db
      .from('batch_activity_logs')
      .select('*')
      .in('batch_id', batchIds);

    if (logsErr) throw logsErr;

    // 4. Assemble the data for the frontend
    const result = batches.map(batch => {
      // Calculate age in days
      const dob = new Date(batch.date_of_birth);
      const today = new Date();
      const ageInDays = Math.floor((today - dob) / (1000 * 60 * 60 * 24));

      // Get program guidelines
      const programGuidelines = guidelines.filter(g => g.program_id === batch.assigned_program_id);
      const batchLogs = logs.filter(l => l.batch_id === batch.batch_id);

      // Determine stages/timeline mapping
      const stages = programGuidelines.map(g => {
        // Did we log an activity for this guideline?
        const isLogged = batchLogs.some(l => l.guideline_id === g.guideline_id);
        
        let state = 'upcoming';
        if (isLogged) {
          state = 'done';
        } else if (ageInDays >= g.days_after_birth + 3) {
          // If we passed the day by 3 days and it's not logged, it's flagged
          state = 'flagged';
        } else if (ageInDays >= g.days_after_birth) {
          state = 'active';
        }

        return {
          id: g.guideline_id,
          day: g.days_after_birth,
          label: `Day ${g.days_after_birth}`,
          sublabel: g.task_name,
          state: state,
          type: g.activity_type
        };
      });

      // Calculate total feed given vs target
      const feedGuidelines = programGuidelines.filter(g => g.activity_type === 'FEED');
      let targetFeedKg = 0;
      
      // Calculate how much they should have eaten by now
      for (let i = 0; i < feedGuidelines.length; i++) {
        const currentPhase = feedGuidelines[i];
        const nextPhase = feedGuidelines[i + 1];
        
        const startDay = currentPhase.days_after_birth;
        const endDay = nextPhase ? Math.min(nextPhase.days_after_birth, ageInDays) : ageInDays;
        
        if (ageInDays >= startDay) {
          const daysInPhase = endDay - startDay;
          targetFeedKg += (daysInPhase * currentPhase.daily_consumption_per_head * batch.current_count);
        }
      }

      // Actual feed consumed
      const actualFeedKg = batchLogs
        .filter(l => l.activity_type === 'FEED')
        .reduce((sum, log) => sum + (Number(log.amount_given) || 0), 0);

      // Program overall status logic
      let status = 'on-track';
      let statusLabel = 'On Track';
      let alertNote = null;
      
      const hasFlagged = stages.some(s => s.state === 'flagged');
      if (hasFlagged) {
        status = 'alert';
        statusLabel = 'Task Missed';
        alertNote = 'A scheduled task is overdue';
      }

      return {
        id: batch.batch_id,
        name: batch.program?.name || 'Unknown Program',
        phaseLabel: 'Growth Phase',
        phaseTone: 'steady',
        batch: batch.batch_tag || batch.batch_number,
        headCount: batch.current_count,
        startedOn: dob.toLocaleDateString(),
        targetFeedKg: Math.round(targetFeedKg),
        actualFeedKg: Math.round(actualFeedKg),
        ageInDays,
        status,
        statusLabel,
        alertNote,
        stages
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching enrolled batches:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/logs
// Record an activity/feed for a batch
router.post('/api/growth/logs', async (req, res) => {
  try {
    const { batch_id, activity_type, guideline_id, amount_given, performed_by } = req.body;

    const { data, error } = await db.from('batch_activity_logs').insert({
      batch_id,
      activity_type,
      guideline_id: guideline_id || null,
      amount_given: amount_given || 0,
      performed_by: performed_by || 'System'
    }).select().single();

    if (error) throw error;

    res.json({ success: true, log: data });
  } catch (error) {
    console.error('Error logging batch activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
