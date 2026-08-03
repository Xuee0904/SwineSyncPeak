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
        guidelines:growth_program_guidelines(*),
        enrolled_batches:piglet_batches(batch_id)
      `)
      .eq('is_archived', isArchived)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten enrolled_batches to just a count for the card display
    const programsWithCount = programs.map(p => ({
      ...p,
      enrolled_batch_count: p.enrolled_batches?.length ?? 0,
      enrolled_batches: undefined, // strip the raw array, count is enough
    }));

    res.json(programsWithCount);
  } catch (error) {
    console.error('Error fetching growth programs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/growth/analytics
// Fetch analytics and DSS data for active batches assigned to a growth program
router.get('/api/growth/analytics', async (req, res) => {
  try {
    const { data: batches, error } = await db
      .from('piglet_batches')
      .select(`
        batch_id,
        batch_tag,
        date_of_birth,
        status,
        current_count,
        total_born_alive,
        assigned_program_id,
        growth_programs (
          name,
          target_weight,
          growth_program_guidelines (
            days_after_birth,
            activity_type,
            daily_consumption_per_head
          )
        )
      `)
      .not('assigned_program_id', 'is', null);

    if (error) throw error;

    const STANDARD_ADG = 0.75; // kg/day
    const BIRTH_WEIGHT = 1.5; // kg
    const today = new Date();

    const analytics = batches.map(batch => {
      const dob = new Date(batch.date_of_birth);
      const ageInDays = Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24)));
      
      const program = batch.growth_programs;
      const targetWeight = program.target_weight || 105;

      // DSS Math (S-Curve Approximation)
      const milestones = [
        { day: 0, weight: 1.5 },
        { day: 21, weight: 7.0 },
        { day: 49, weight: 20.0 },
        { day: 90, weight: 50.0 },
        { day: 150, weight: 105.0 }
      ];
      
      let rawEstWeight = 1.5;
      if (ageInDays >= 150) {
        rawEstWeight = 105.0 + ((ageInDays - 150) * 0.85); // 850g ADG in late finisher
      } else {
        for (let i = 0; i < milestones.length - 1; i++) {
          const start = milestones[i];
          const end = milestones[i+1];
          if (ageInDays >= start.day && ageInDays < end.day) {
            const fraction = (ageInDays - start.day) / (end.day - start.day);
            rawEstWeight = start.weight + fraction * (end.weight - start.weight);
            break;
          }
        }
      }
      
      // Scale based on the specific program's target weight
      const scaleFactor = targetWeight / 105.0;
      const estimatedCurrentWeight = rawEstWeight * scaleFactor;
      
      let cumulativeFeed = 0;
      if (program.growth_program_guidelines) {
        const sorted = [...program.growth_program_guidelines].sort((a,b) => a.days_after_birth - b.days_after_birth);
        for (let i = 0; i < sorted.length; i++) {
          const g = sorted[i];
          if (g.activity_type !== 'FEED') continue;
          
          const startDay = g.days_after_birth;
          if (startDay > ageInDays) break;

          let endDay = ageInDays;
          for (let j = i + 1; j < sorted.length; j++) {
            if (sorted[j].activity_type === 'FEED') {
              endDay = Math.min(ageInDays, sorted[j].days_after_birth);
              break;
            }
          }
          const daysOnFeed = endDay - startDay;
          cumulativeFeed += (daysOnFeed * g.daily_consumption_per_head * batch.current_count);
        }
      }

      // DSS Alerts
      const alerts = [];
      let status = 'on-track';
      
      if (estimatedCurrentWeight >= targetWeight) {
        alerts.push(`Market Ready: Estimated weight (${estimatedCurrentWeight.toFixed(1)}kg) has reached the target of ${targetWeight}kg. Schedule sale.`);
        status = 'alert';
      } else if (ageInDays > 160 && estimatedCurrentWeight < targetWeight) {
        alerts.push(`Slow Growth: Batch is ${ageInDays} days old but under target weight. Review feed quality or health.`);
        status = 'alert';
      }

      const totalBorn = batch.total_born_alive || batch.current_count || 1; // avoid division by 0
      const mortalityRate = Math.max(0, ((totalBorn - batch.current_count) / totalBorn) * 100);

      if (mortalityRate > 5) {
        alerts.push(`High Mortality: Batch has ${mortalityRate.toFixed(1)}% mortality rate.`);
        status = 'alert';
      }

      return {
        id: batch.batch_id,
        batchTag: batch.batch_tag,
        ageInDays,
        programName: program.name,
        targetWeight,
        estimatedCurrentWeight: Number(estimatedCurrentWeight.toFixed(2)),
        cumulativeFeed: Number(cumulativeFeed.toFixed(2)),
        mortalityRate: Number(mortalityRate.toFixed(2)),
        alerts,
        status,
        statusLabel: status === 'alert' ? 'Needs Attention' : 'On Track'
      };
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching growth analytics:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// POST /api/growth/programs
// Create a new growth program template with guidelines
router.post('/api/growth/programs', async (req, res) => {
  try {
    const { name, description, target_weight, guidelines, performed_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Program name is required.' });
    }

    // 1. Insert the program header
    const { data: program, error: programErr } = await db
      .from('growth_programs')
      .insert({ 
        name: name.trim(), 
        description: description?.trim() || null,
        target_weight: target_weight ? parseFloat(target_weight) : null
      })
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
    const { name, description, target_weight, guidelines, performed_by } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Program name is required.' });
    }

    // 1. Update the program header
    const { error: updateErr } = await db
      .from('growth_programs')
      .update({ 
        name: name.trim(), 
        description: description?.trim() || null,
        target_weight: target_weight ? parseFloat(target_weight) : null
      })
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

// GET /api/growth/programs/:id/batches
// Fetch piglet batches currently enrolled in a specific growth program
router.get('/api/growth/programs/:id/batches', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: batches, error } = await db
      .from('piglet_batches')
      .select(`
        batch_id,
        batch_tag,
        current_count,
        date_of_birth,
        status,
        pen:pens(pen_code)
      `)
      .eq('assigned_program_id', id)
      .order('date_of_birth', { ascending: false });

    if (error) throw error;

    // Calculate age in days for each batch
    const today = new Date();
    const enriched = batches.map(b => {
      const dob = b.date_of_birth ? new Date(b.date_of_birth) : null;
      const ageInDays = dob ? Math.floor((today - dob) / (1000 * 60 * 60 * 24)) : null;
      return { ...b, age_in_days: ageInDays };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching batches for program:', error.message);
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

    // Fetch the task name from the guideline if available
    let taskName = activity_type;
    if (guideline_id) {
      const { data: g } = await db.from('growth_program_guidelines').select('task_name, dosage_instructions').eq('guideline_id', guideline_id).single();
      if (g) taskName = g.task_name || activity_type;
    }

    // Integrate with Health & Vaccination modules
    if (activity_type === 'VACCINATION') {
      await db.from('vaccination_records').insert({
        batch_id,
        vaccine_name: taskName,
        dosage: amount_given > 0 ? `${amount_given}` : 'Standard',
        administered_by: performed_by || 'System',
        administered_date: new Date().toISOString()
      });
    } else if (activity_type === 'MEDICATION') {
      await db.from('health_logs').insert({
        batch_id,
        status: 'healthy',
        diagnosis: 'Routine Program Medication',
        treatment: taskName,
        symptoms: 'None observed',
        recorded_by: performed_by || 'System',
        log_date: new Date().toISOString()
      });
    }

    res.json({ success: true, log: data });
  } catch (error) {
    console.error('Error logging batch activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
