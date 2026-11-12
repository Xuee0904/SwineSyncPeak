import express from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { deductInventoryStock } from '../helpers/inventoryDeduction.js';

const router = express.Router();
const db = supabaseAdmin;

// Helper to compute deterministic start of "Today" in the farm's timezone (Asia/Manila, UTC+8)
function getStartOfTodayIso() {
  const manilaDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${manilaDateStr}T00:00:00+08:00`).toISOString();
}

// Helper to identify feeding transaction notes
function isFeedingTransactionNote(notes) {
  if (!notes) return false;
  return /(Used in Feeding|Program Feeding|Daily Feed)/i.test(notes);
}

// Helper to match batch tags within transaction notes without false positives on prefix substrings (e.g. BTC-20261107 matching BTC-20261107-3)
function matchesBatchTag(notes, batchTag) {
  if (!notes || !batchTag) return false;
  const regex = new RegExp(`(^|[^a-zA-Z0-9_-])${batchTag}([^a-zA-Z0-9_-]|$)`);
  return regex.test(notes);
}

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
        guidelines:growth_program_guidelines(
          *,
          inventory_items (item_id, item_name, unit_of_measure, category, current_stock_level)
        ),
        enrolled_batches:piglet_batches(batch_id, batch_tag, current_count, date_of_birth, status, is_archived)
      `)
      .eq('is_archived', isArchived)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const today = new Date();
    const startOfTodayIso = getStartOfTodayIso();

    // Fetch today's feeding logs for all active batches across these programs
    const allActiveBatchIds = [];
    programs.forEach(p => {
      (p.enrolled_batches || []).forEach(b => {
        if (!b.is_archived && b.status !== 'Archived') {
          allActiveBatchIds.push(b.batch_id);
        }
      });
    });

    let todayFeedBatchIds = new Set();
    if (allActiveBatchIds.length > 0) {
      try {
        const { data: bLogs } = await db
          .from('batch_activity_logs')
          .select('batch_id')
          .in('batch_id', allActiveBatchIds)
          .eq('activity_type', 'FEED')
          .gte('recorded_at', startOfTodayIso);
        if (bLogs) {
          bLogs.forEach(l => todayFeedBatchIds.add(l.batch_id));
        }
      } catch (err) {
        console.warn('[Growth API] batch_activity_logs lookup note:', err.message);
      }

      // Complementary check: completed FEED growth_tasks today
      try {
        const { data: gTasks } = await db
          .from('growth_tasks')
          .select('batch_id')
          .in('batch_id', allActiveBatchIds)
          .eq('activity_type', 'FEED')
          .eq('status', 'completed')
          .gte('completed_at', startOfTodayIso);
        if (gTasks) {
          gTasks.forEach(t => todayFeedBatchIds.add(t.batch_id));
        }
      } catch (tErr) {
        // ignore
      }

      // Complementary check: inventory_transactions today with batch tags
      try {
        const { data: txs } = await db
          .from('inventory_transactions')
          .select('notes')
          .gte('created_at', startOfTodayIso);
        if (txs) {
          const allActiveBatches = programs.flatMap(p => p.enrolled_batches || []).filter(b => !b.is_archived && b.status !== 'Archived');
          txs.forEach(tx => {
            if (tx.notes && isFeedingTransactionNote(tx.notes)) {
              allActiveBatches.forEach(b => {
                if (b.batch_tag && matchesBatchTag(tx.notes, b.batch_tag)) {
                  todayFeedBatchIds.add(b.batch_id);
                }
              });
            }
          });
        }
      } catch (txErr) {
        // ignore
      }
    }

    // Compute actionable metrics for each growth program
    const programsWithCount = programs.map(p => {
      const activeBatches = (p.enrolled_batches || []).filter(b => !b.is_archived && b.status !== 'Archived');
      const guidelines = (p.guidelines || []).sort((a, b) => a.days_after_birth - b.days_after_birth);
      const feedGuidelines = guidelines.filter(g => g.activity_type === 'FEED');
      const targetWeight = Number(p.target_weight) || 105;

      let estDailyFeed = 0;
      let readyWeanersHeads = 0;
      let readyWeanersBatches = 0;
      let readyFattenersHeads = 0;
      let readyFattenersBatches = 0;
      let unfedBatchesCount = 0;

      activeBatches.forEach(b => {
        const count = Number(b.current_count) || 0;
        const dob = b.date_of_birth ? new Date(b.date_of_birth) : null;
        const ageInDays = dob ? Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24))) : 0;

        if (!todayFeedBatchIds.has(b.batch_id)) {
          unfedBatchesCount++;
        }

        // Determine active feed guideline for current age
        if (feedGuidelines.length > 0 && count > 0) {
          let currentFeed = feedGuidelines[0];
          for (const fg of feedGuidelines) {
            if (ageInDays >= fg.days_after_birth) {
              currentFeed = fg;
            } else {
              break;
            }
          }
          const dailyConsumption = Number(currentFeed?.daily_consumption_per_head) || 0;
          estDailyFeed += (dailyConsumption * count);
        }

        // Birthdate-based market readiness:
        // Weaners: 28 to 89 days old (weaned from sow, ready for market/nursery sale)
        // Fatteners: 150+ days old (finished growing cycle, ready for market/slaughter)
        if (ageInDays >= 28 && ageInDays < 90) {
          readyWeanersHeads += count;
          readyWeanersBatches += 1;
        } else if (ageInDays >= 150) {
          readyFattenersHeads += count;
          readyFattenersBatches += 1;
        }
      });

      return {
        ...p,
        enrolled_batch_count: activeBatches.length,
        enrolled_head_count: activeBatches.reduce((sum, b) => sum + (Number(b.current_count) || 0), 0),
        est_daily_feed_kg: Number(estDailyFeed.toFixed(1)),
        unfed_batches_today_count: unfedBatchesCount,
        ready_weaners_heads: readyWeanersHeads,
        ready_weaners_batches: readyWeanersBatches,
        ready_fatteners_heads: readyFattenersHeads,
        ready_fatteners_batches: readyFattenersBatches,
        market_ready_batches_count: readyWeanersBatches + readyFattenersBatches,
        enrolled_batches: undefined,
      };
    });

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
    const [batchesRes, salesRes] = await Promise.all([
      db
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
        .not('assigned_program_id', 'is', null),
      db.from('sold_swine').select('batch_id, quantity_sold').not('batch_id', 'is', null)
    ]);

    if (batchesRes.error) throw batchesRes.error;
    const batches = batchesRes.data || [];

    const soldByBatch = new Map();
    (salesRes.data || []).forEach(s => {
      if (s.batch_id) {
        soldByBatch.set(s.batch_id, (soldByBatch.get(s.batch_id) || 0) + (Number(s.quantity_sold) || 0));
      }
    });

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
          const end = milestones[i + 1];
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
        const sorted = [...program.growth_program_guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);
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
        alerts.push(`Target Reached: Batch has achieved its target weight of ${targetWeight}kg (Estimated: ${estimatedCurrentWeight.toFixed(1)}kg).`);
        status = 'alert';
      } else if (ageInDays > 160 && estimatedCurrentWeight < targetWeight) {
        alerts.push(`Below Curve: Batch is ${ageInDays} days old and is tracking below its target growth curve.`);
        status = 'alert';
      }

      const totalBorn = Number(batch.total_born_alive || batch.current_count || 1); // avoid division by 0
      const currentCount = Number(batch.current_count ?? totalBorn);
      const soldCount = soldByBatch.get(batch.batch_id) || 0;
      const actualLosses = Math.max(0, totalBorn - currentCount - soldCount);
      const mortalityRate = Math.min(100, Math.max(0, (actualLosses / totalBorn) * 100));

      if (mortalityRate > 5) {
        alerts.push(`Elevated Mortality: Batch is showing an above-average mortality rate of ${mortalityRate.toFixed(1)}%.`);
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
        item_id: g.item_id || null,
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
    }).then(() => { }).catch(() => { }); // non-blocking

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

    let insertedGuidelines = [];
    if (guidelines && guidelines.length > 0) {
      const guidelineRows = guidelines.map(g => ({
        program_id: id,
        days_after_birth: g.days_after_birth,
        activity_type: g.activity_type,
        task_name: g.task_name,
        item_id: g.item_id || null,
        daily_consumption_per_head: g.daily_consumption_per_head || 0,
        dosage_instructions: g.dosage_instructions || null,
      }));

      const { data: gData, error: guidelinesErr } = await db
        .from('growth_program_guidelines')
        .insert(guidelineRows)
        .select();

      if (guidelinesErr) throw guidelinesErr;
      insertedGuidelines = gData || [];
    }

    // 2b. Regenerate pending growth_tasks for any active batches enrolled in this program
    if (insertedGuidelines.length > 0) {
      const { data: enrolledBatches } = await db
        .from('piglet_batches')
        .select('batch_id, date_of_birth, status, is_archived')
        .eq('assigned_program_id', id)
        .eq('is_archived', false);

      if (enrolledBatches && enrolledBatches.length > 0) {
        const newTasks = [];
        for (const batch of enrolledBatches) {
          if (!batch.date_of_birth || batch.status === 'Archived') continue;
          const dob = new Date(batch.date_of_birth);
          for (const g of insertedGuidelines) {
            const due = new Date(dob);
            due.setDate(due.getDate() + (Number(g.days_after_birth) || 0));
            const dueDateStr = due.toISOString().split('T')[0];
            newTasks.push({
              batch_id: batch.batch_id,
              program_id: id,
              guideline_id: g.guideline_id,
              item_id: g.item_id || null,
              activity_type: g.activity_type,
              task_name: g.task_name,
              due_date: dueDateStr,
              status: 'pending',
            });
          }
        }
        if (newTasks.length > 0) {
          await db.from('growth_tasks').insert(newTasks);
        }
      }
    }

    // 3. Log the activity
    await db.from('activity_logs').insert({
      user_name: performed_by || 'System',
      user_email: 'system@swinesync.ag',
      event_title: 'Growth Program Updated',
      event_desc: `Growth program template "${name.trim()}" was updated.`,
      status: 'SUCCESS',
    }).then(() => { }).catch(() => { });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating growth program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/growth/unlinked-guidelines
// Returns custom stocked supply guidelines (FEED, MEDICATION, SUPPLEMENT) from active programs where item_id is null.
// PROCEDURES and on-demand VACCINATIONS are excluded as they are not warehouse inventory.
router.get('/api/growth/unlinked-guidelines', async (req, res) => {
  try {
    const { data, error } = await db
      .from('growth_program_guidelines')
      .select(`
        guideline_id,
        program_id,
        days_after_birth,
        activity_type,
        task_name,
        item_id,
        growth_programs!inner (program_id, name, is_archived)
      `)
      .is('item_id', null)
      .neq('activity_type', 'PROCEDURE')
      .neq('activity_type', 'VACCINATION')
      .eq('growth_programs.is_archived', false)
      .order('days_after_birth', { ascending: true });

    if (error) throw error;

    const valid = (data || []).filter(g =>
      g.task_name &&
      g.task_name.trim() !== '' &&
      g.activity_type !== 'PROCEDURE' &&
      g.activity_type !== 'VACCINATION'
    );
    res.json(valid);
  } catch (error) {
    console.error('Error fetching unlinked guidelines:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/growth/guidelines/link-inventory
// Links a custom growth program guideline (and any matching unlinked guidelines/pending tasks) to a newly created inventory item
router.patch('/api/growth/guidelines/link-inventory', async (req, res) => {
  try {
    const { guideline_id, item_id, item_name, original_task_name, activity_type } = req.body;
    if (!item_id) {
      return res.status(400).json({ error: 'item_id is required.' });
    }

    const updatePayload = { item_id };
    if (item_name && item_name.trim()) {
      updatePayload.task_name = item_name.trim();
    }

    // 1. Link the specific guideline if guideline_id is provided
    if (guideline_id) {
      await db
        .from('growth_program_guidelines')
        .update(updatePayload)
        .eq('guideline_id', guideline_id);

      await db
        .from('growth_tasks')
        .update(updatePayload)
        .eq('guideline_id', guideline_id)
        .eq('status', 'pending');
    }

    // 2. Also link any other unlinked guidelines/pending tasks that share the exact custom task_name + activity_type
    const matchName = (original_task_name || item_name || '').trim();
    if (matchName) {
      let gQuery = db
        .from('growth_program_guidelines')
        .update(updatePayload)
        .is('item_id', null)
        .ilike('task_name', matchName);
      if (activity_type) gQuery = gQuery.eq('activity_type', activity_type);
      await gQuery;

      let tQuery = db
        .from('growth_tasks')
        .update(updatePayload)
        .is('item_id', null)
        .eq('status', 'pending')
        .ilike('task_name', matchName);
      if (activity_type) tQuery = tQuery.eq('activity_type', activity_type);
      await tQuery;
    }

    invalidateActiveFeedBatchesCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error linking guideline to inventory:', error.message);
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
    }).then(() => { }).catch(() => { });

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
    }).then(() => { }).catch(() => { });

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

    // Fetch the program target_weight and guidelines
    const { data: program } = await db
      .from('growth_programs')
      .select('target_weight, guidelines:growth_program_guidelines(*, inventory_items(item_id, item_name, unit_of_measure, current_stock_level))')
      .eq('program_id', id)
      .single();

    const { data: batches, error } = await db
      .from('piglet_batches')
      .select(`
        batch_id,
        batch_tag,
        current_count,
        date_of_birth,
        status,
        is_archived,
        pen:pens(pen_code)
      `)
      .eq('assigned_program_id', id)
      .eq('is_archived', false)
      .order('date_of_birth', { ascending: false });

    if (error) throw error;

    const today = new Date();
    const startOfTodayIso = getStartOfTodayIso();

    const batchIds = batches.map(b => b.batch_id);
    let todayLogs = [];
    if (batchIds.length > 0) {
      try {
        const { data: bLogs } = await db
          .from('batch_activity_logs')
          .select('batch_id, amount_given, recorded_at')
          .in('batch_id', batchIds)
          .eq('activity_type', 'FEED')
          .gte('recorded_at', startOfTodayIso);
        if (bLogs && bLogs.length > 0) todayLogs.push(...bLogs);
      } catch (err) {
        console.warn('[Growth Batches] batch_activity_logs note:', err.message);
      }

      // Check completed growth_tasks
      try {
        const { data: gTasks } = await db
          .from('growth_tasks')
          .select('batch_id, completed_at')
          .in('batch_id', batchIds)
          .eq('activity_type', 'FEED')
          .eq('status', 'completed')
          .gte('completed_at', startOfTodayIso);
        (gTasks || []).forEach(t => {
          if (!todayLogs.some(l => l.batch_id === t.batch_id)) {
            todayLogs.push({ batch_id: t.batch_id, amount_given: 0, created_at: t.completed_at });
          }
        });
      } catch (tErr) {
        // ignore
      }

      // Check inventory_transactions today
      try {
        const { data: txs } = await db
          .from('inventory_transactions')
          .select('notes, quantity, created_at')
          .gte('created_at', startOfTodayIso);
        (txs || []).forEach(tx => {
          if (tx.notes && isFeedingTransactionNote(tx.notes)) {
            batches.forEach(b => {
              if (b.batch_tag && matchesBatchTag(tx.notes, b.batch_tag)) {
                if (!todayLogs.some(l => l.batch_id === b.batch_id)) {
                  const matchKg = tx.notes.match(/\((\d+(?:\.\d+)?)\s*kg\s*fed\)/i);
                  const kgFed = matchKg ? parseFloat(matchKg[1]) : (Number(tx.quantity) || 0);
                  todayLogs.push({ batch_id: b.batch_id, amount_given: kgFed, created_at: tx.created_at });
                }
              }
            });
          }
        });
      } catch (txErr) {
        // ignore
      }
    }

    const guidelines = (program?.guidelines || []).sort((a, b) => a.days_after_birth - b.days_after_birth);
    const feedGuidelines = guidelines.filter(g => g.activity_type === 'FEED');
    const targetWeight = Number(program?.target_weight) || 105;

    const enriched = batches.map(b => {
      const dob = b.date_of_birth ? new Date(b.date_of_birth) : null;
      const ageInDays = dob ? Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24))) : 0;
      const count = Number(b.current_count) || 0;

      // Active feed guideline
      let activeFeed = null;
      if (feedGuidelines.length > 0) {
        activeFeed = feedGuidelines[0];
        for (const fg of feedGuidelines) {
          if (ageInDays >= fg.days_after_birth) {
            activeFeed = fg;
          } else {
            break;
          }
        }
      }

      // Next guideline on timeline
      const nextActivity = guidelines.find(g => g.days_after_birth > ageInDays) || null;

      // Check today's feed logs for this batch
      const batchFeedLogs = todayLogs.filter(l => l.batch_id === b.batch_id);
      const fedTodayKg = batchFeedLogs.reduce((sum, l) => sum + (Number(l.amount_given) || 0), 0);
      const fedToday = batchFeedLogs.length > 0;

      // Birthdate-based readiness classification:
      // Weaner: 28 to 89 days old
      // Fattener: 150+ days old
      let marketStatus = null; // null | 'weaner_ready' | 'fattener_ready'
      if (ageInDays >= 28 && ageInDays < 90) {
        marketStatus = 'weaner_ready';
      } else if (ageInDays >= 150) {
        marketStatus = 'fattener_ready';
      }

      const dailyRate = Number(activeFeed?.daily_consumption_per_head) || 0;
      const totalDailyFeed = Number((dailyRate * count).toFixed(1));

      return {
        ...b,
        age_in_days: ageInDays,
        target_weight: targetWeight,
        market_status: marketStatus,
        is_market_ready: marketStatus !== null,
        current_feed: activeFeed ? {
          guideline_id: activeFeed.guideline_id,
          item_id: activeFeed.item_id || null,
          inventory_items: activeFeed.inventory_items || null,
          task_name: activeFeed.task_name,
          daily_consumption_per_head: dailyRate,
          total_daily_feed_kg: totalDailyFeed,
          fed_today: fedToday,
          fed_today_kg: Number(fedTodayKg.toFixed(1)),
        } : null,
        next_activity: nextActivity ? {
          days_after_birth: nextActivity.days_after_birth,
          task_name: nextActivity.task_name,
          activity_type: nextActivity.activity_type,
        } : null,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching batches for program:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// In-memory micro-cache for active feed batches to accelerate repeat queries
let activeFeedBatchesCache = {
  data: null,
  timestamp: 0,
};

export function invalidateActiveFeedBatchesCache() {
  activeFeedBatchesCache = { data: null, timestamp: 0 };
}

// GET /api/growth/active-feed-batches
// Returns all active piglet batches along with their current estimated daily feed requirement and breeder herd summary
router.get('/api/growth/active-feed-batches', async (req, res) => {
  try {
    const now = Date.now();
    // Return cached data if fresh (15s TTL)
    if (activeFeedBatchesCache.data && now - activeFeedBatchesCache.timestamp < 15000) {
      return res.json(activeFeedBatchesCache.data);
    }

    const today = new Date();
    const startOfTodayIso = getStartOfTodayIso();

    // Parallelize all independent database queries simultaneously
    const [
      batchesResult,
      logsResult,
      tasksResult,
      txsResult,
      pigsResult,
      completedTasksResult,
    ] = await Promise.allSettled([
      // 1. Batches & active feeding guidelines
      db
        .from('piglet_batches')
        .select(`
          batch_id,
          batch_tag,
          current_count,
          date_of_birth,
          status,
          is_archived,
          assigned_program_id,
          pen:pens(pen_code),
          program:growth_programs(
            program_id,
            name,
            guidelines:growth_program_guidelines(
              guideline_id,
              days_after_birth,
              activity_type,
              task_name,
              item_id,
              dosage_instructions,
              daily_consumption_per_head,
              inventory_items(item_id, item_name, unit_of_measure, current_stock_level)
            )
          )
        `)
        .eq('is_archived', false)
        .order('date_of_birth', { ascending: false }),

      // 2. Today's feed activity logs
      db
        .from('batch_activity_logs')
        .select('batch_id, amount_given, recorded_at')
        .eq('activity_type', 'FEED')
        .gte('recorded_at', startOfTodayIso)
        .order('recorded_at', { ascending: true }),

      // 3. Today's completed feed growth tasks
      db
        .from('growth_tasks')
        .select('batch_id, completed_at')
        .eq('activity_type', 'FEED')
        .eq('status', 'completed')
        .gte('completed_at', startOfTodayIso),

      // 4. Single query for today's transactions (re-used for both batch feeds and breeder feeding)
      db
        .from('inventory_transactions')
        .select('notes, quantity, created_at')
        .gte('created_at', startOfTodayIso),

      // 5. Breeder pigs gender distribution
      db
        .from('pigs')
        .select('gender')
        .eq('is_archived', false),

      // 6. Completed milestone growth tasks (vaccines/supplements)
      db
        .from('growth_tasks')
        .select('batch_id, guideline_id, task_name')
        .eq('status', 'completed'),
    ]);

    if (batchesResult.status === 'rejected' || batchesResult.value?.error) {
      throw batchesResult.value?.error || new Error('Failed to load piglet batches');
    }

    const batches = batchesResult.value?.data || [];
    const bLogs = logsResult.status === 'fulfilled' && !logsResult.value?.error ? (logsResult.value?.data || []) : [];
    const gTasks = tasksResult.status === 'fulfilled' && !tasksResult.value?.error ? (tasksResult.value?.data || []) : [];
    const txs = txsResult.status === 'fulfilled' && !txsResult.value?.error ? (txsResult.value?.data || []) : [];
    const breederPigs = pigsResult.status === 'fulfilled' && !pigsResult.value?.error ? (pigsResult.value?.data || []) : [];
    const completedTasks = completedTasksResult?.status === 'fulfilled' && !completedTasksResult.value?.error ? (completedTasksResult.value?.data || []) : [];
    const completedMilestoneKeys = new Set(
      completedTasks.map(t => `${t.batch_id}::${t.guideline_id || ''}`)
    );

    const activeBatches = (batches || []).filter(b => b.status !== 'Archived' && Number(b.current_count) > 0);
    const batchIdSet = new Set(activeBatches.map(b => b.batch_id));

    // Collect today's feeding records for batches
    const fedBatchLogsMap = new Map();
    bLogs.forEach(l => {
      if (batchIdSet.has(l.batch_id)) {
        fedBatchLogsMap.set(l.batch_id, {
          kg: Number(l.amount_given) || 0,
          time: l.recorded_at,
        });
      }
    });

    gTasks.forEach(t => {
      if (batchIdSet.has(t.batch_id) && !fedBatchLogsMap.has(t.batch_id)) {
        fedBatchLogsMap.set(t.batch_id, { kg: null, time: t.completed_at || null });
      }
    });

    // Check inventory transactions for batch feed notes
    txs.forEach(tx => {
      if (!tx.notes || !isFeedingTransactionNote(tx.notes)) return;
      activeBatches.forEach(b => {
        if (b.batch_tag && matchesBatchTag(tx.notes, b.batch_tag)) {
          const matchKg = tx.notes.match(/\((\d+(?:\.\d+)?)\s*kg\s*fed\)/i);
          const kgFed = matchKg ? parseFloat(matchKg[1]) : (Number(tx.quantity) || 0);
          const existing = fedBatchLogsMap.get(b.batch_id);
          if (!existing || existing.kg === null || existing.kg === 0) {
            fedBatchLogsMap.set(b.batch_id, { kg: kgFed, time: tx.created_at });
          }
        }
      });
    });

    // Check breeder herd from the SAME inventory transactions result
    let breederFedToday = false;
    let breederFedTodayKg = 0;
    let breederFedTime = null;
    txs.forEach(tx => {
      if (tx.notes && (tx.notes.includes('Used in Feeding - Sows & Boars') || tx.notes.includes('Breeder Herd Feeding'))) {
        breederFedToday = true;
        const matchKg = tx.notes.match(/\((\d+(?:\.\d+)?)\s*kg\s*fed\)/i);
        if (matchKg) {
          breederFedTodayKg += parseFloat(matchKg[1]);
        }
        if (!breederFedTime) breederFedTime = tx.created_at;
      }
    });

    // Count breeder pigs
    let sowsCount = 0;
    let boarsCount = 0;
    breederPigs.forEach(p => {
      const g = String(p.gender || '').toUpperCase();
      if (g.startsWith('F')) sowsCount++;
      else if (g.startsWith('M')) boarsCount++;
    });
    const totalBreeders = sowsCount + boarsCount;

    const batchList = activeBatches.map(b => {
      const dob = b.date_of_birth ? new Date(b.date_of_birth) : null;
      const ageInDays = dob ? Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24))) : 0;
      const count = Number(b.current_count) || 0;
      const feedGuidelines = ((b.program?.guidelines) || [])
        .filter(g => g.activity_type === 'FEED')
        .sort((a, c) => a.days_after_birth - c.days_after_birth);

      let activeFeed = null;
      if (feedGuidelines.length > 0) {
        activeFeed = feedGuidelines[0];
        for (const fg of feedGuidelines) {
          if (ageInDays >= fg.days_after_birth) {
            activeFeed = fg;
          } else {
            break;
          }
        }
      }

      const dailyRate = Number(activeFeed?.daily_consumption_per_head) || 0;
      const totalDailyFeed = Number((dailyRate * count).toFixed(2));
      const isFed = fedBatchLogsMap.has(b.batch_id);
      const fedInfo = fedBatchLogsMap.get(b.batch_id);
      const fedKg = typeof fedInfo === 'object' && fedInfo?.kg !== null && fedInfo?.kg !== undefined
        ? Number(fedInfo.kg)
        : totalDailyFeed;
      const fedTime = typeof fedInfo === 'object' ? fedInfo?.time : null;
      const isAdjusted = isFed && Math.abs(fedKg - totalDailyFeed) > 0.05;

      const upcomingMilestones = ((b.program?.guidelines) || [])
        .filter(g => {
          const type = (g.activity_type || '').toUpperCase();
          if (type !== 'VACCINATION' && type !== 'SUPPLEMENT' && type !== 'MEDICATION' && type !== 'PROCEDURE') return false;
          const daysAway = g.days_after_birth - ageInDays;
          if (daysAway < 0 || daysAway > 14) return false;
          if (g.guideline_id && completedMilestoneKeys.has(`${b.batch_id}::${g.guideline_id}`)) return false;
          return true;
        })
        .map(g => ({
          guideline_id: g.guideline_id,
          activity_type: g.activity_type,
          task_name: g.task_name,
          item_id: g.item_id || g.inventory_items?.item_id || null,
          item_name: g.inventory_items?.item_name || null,
          unit_of_measure: g.inventory_items?.unit_of_measure || null,
          days_after_birth: g.days_after_birth,
          days_until_due: g.days_after_birth - ageInDays,
          dosage_instructions: g.dosage_instructions || null,
        }))
        .sort((a, c) => a.days_until_due - c.days_until_due);

      return {
        batch_id: b.batch_id,
        batch_tag: b.batch_tag,
        current_count: count,
        age_in_days: ageInDays,
        status: b.status || null,
        date_of_birth: b.date_of_birth || null,
        pen_code: b.pen?.pen_code || null,
        program_id: b.program?.program_id || b.assigned_program_id,
        program_name: b.program?.name || null,
        upcoming_milestones: upcomingMilestones,
        current_feed: activeFeed ? {
          guideline_id: activeFeed.guideline_id,
          item_id: activeFeed.item_id || null,
          inventory_items: activeFeed.inventory_items || null,
          task_name: activeFeed.task_name,
          daily_consumption_per_head: dailyRate,
          total_daily_feed_kg: totalDailyFeed,
          fed_today: isFed,
          fed_today_kg: Number(fedKg.toFixed(2)),
          fed_time: fedTime,
          is_adjusted: isAdjusted,
        } : null,
      };
    });

    const payload = {
      batches: batchList,
      breeder_summary: {
        sows_count: sowsCount,
        boars_count: boarsCount,
        total_breeders: totalBreeders,
        breeder_fed_today: breederFedToday,
        breeder_fed_today_kg: Number(breederFedTodayKg.toFixed(2)),
        breeder_fed_time: breederFedTime,
        est_daily_feed_kg: Number((totalBreeders * 2.5).toFixed(1)),
      }
    };

    activeFeedBatchesCache = {
      data: payload,
      timestamp: Date.now(),
    };

    res.json(payload);
  } catch (error) {
    console.error('Error fetching active feed batches:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/log-breeder-feed
// Log feeding for the breeding herd (sows & boars) and deduct from inventory
router.post('/api/growth/log-breeder-feed', async (req, res) => {
  try {
    const { item_id, amount_kg, head_count, performed_by } = req.body;
    const staffName = performed_by || 'Staff';
    const rawKg = parseFloat(amount_kg);

    if (!item_id) {
      return res.status(400).json({ error: 'Feed item is required.' });
    }
    if (isNaN(rawKg) || rawKg <= 0) {
      return res.status(400).json({ error: 'Valid feed amount in kg is required.' });
    }

    // 1. Fetch inventory item to check unit of measure
    const { data: invItem, error: invErr } = await db
      .from('inventory_items')
      .select('item_id, item_name, unit_of_measure, current_stock_level')
      .eq('item_id', item_id)
      .single();

    if (invErr || !invItem) {
      return res.status(404).json({ error: 'Inventory feed item not found.' });
    }

    // 2. Convert kg to container units (sacks/bags) if applicable
    const unitStr = String(invItem.unit_of_measure || '').trim();
    const sackMatch = unitStr.match(/^(?:sacks?|bags?)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*kg\s*\))?$/i);
    let deductionQty = rawKg;
    if (sackMatch) {
      const sackKg = sackMatch[1] ? Number(sackMatch[1]) : 25;
      deductionQty = Number((rawKg / sackKg).toFixed(4));
    }

    // 3. Deduct stock and record audit transaction
    const headsText = head_count ? ` (${head_count} heads)` : '';
    const deductionResult = await deductInventoryStock({
      db,
      itemId: item_id,
      quantity: deductionQty,
      notes: `Used in Feeding - Sows & Boars${headsText} (${rawKg} kg fed) • By: ${staffName}`,
      performedBy: staffName
    });

    invalidateActiveFeedBatchesCache();

    res.json({
      success: true,
      amount_kg: rawKg,
      quantity_deducted: deductionQty,
      unit_of_measure: invItem.unit_of_measure,
      new_stock_level: deductionResult?.newStockLevel ?? invItem.current_stock_level,
      message: `Logged ${rawKg} kg of ${invItem.item_name} for Breeder Herd.`
    });
  } catch (error) {
    console.error('Error logging breeder feed:', error.message);
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

// POST /api/growth/undo-feed
router.post('/api/growth/undo-feed', async (req, res) => {
  try {
    const { batch_id, is_breeder } = req.body;
    const startOfTodayIso = getStartOfTodayIso();

    if (is_breeder) {
      // Find today's breeder inventory transactions
      const { data: bTxs } = await db
        .from('inventory_transactions')
        .select('*')
        .gte('created_at', startOfTodayIso)
        .or('notes.ilike.%Sows & Boars%,notes.ilike.%Breeder Herd%');

      if (bTxs && bTxs.length > 0) {
        for (const tx of bTxs) {
          if (tx.item_id && tx.quantity > 0) {
            const { data: inv } = await db.from('inventory_items').select('current_stock_level').eq('item_id', tx.item_id).single();
            if (inv) {
              await db.from('inventory_items').update({
                current_stock_level: Number(inv.current_stock_level || 0) + Number(tx.quantity)
              }).eq('item_id', tx.item_id);
            }
          }
          await db.from('inventory_transactions').delete().eq('transaction_id', tx.transaction_id);
        }
      }
      invalidateActiveFeedBatchesCache();
      return res.json({ success: true, message: 'Breeder feeding undone' });
    }

    if (!batch_id) {
      return res.status(400).json({ error: 'batch_id required' });
    }

    // 1. Delete today's batch_activity_logs for this batch (activity_type = 'FEED')
    await db
      .from('batch_activity_logs')
      .delete()
      .eq('batch_id', batch_id)
      .eq('activity_type', 'FEED')
      .gte('recorded_at', startOfTodayIso);

    // 2. Revert today's growth_tasks for this batch
    await db
      .from('growth_tasks')
      .update({ status: 'pending', completed_at: null })
      .eq('batch_id', batch_id)
      .eq('activity_type', 'FEED')
      .gte('completed_at', startOfTodayIso);

    // 3. Find batch tag to locate and reverse inventory transaction
    const { data: bRow } = await db.from('piglet_batches').select('batch_tag').eq('batch_id', batch_id).single();
    if (bRow?.batch_tag) {
      const { data: rawTxs } = await db
        .from('inventory_transactions')
        .select('*')
        .gte('created_at', startOfTodayIso)
        .ilike('notes', `%${bRow.batch_tag}%`);

      const txs = (rawTxs || []).filter(tx => isFeedingTransactionNote(tx.notes) && matchesBatchTag(tx.notes, bRow.batch_tag));

      if (txs && txs.length > 0) {
        for (const tx of txs) {
          if (tx.item_id && tx.quantity > 0) {
            const { data: inv } = await db.from('inventory_items').select('current_stock_level').eq('item_id', tx.item_id).single();
            if (inv) {
              await db.from('inventory_items').update({
                current_stock_level: Number(inv.current_stock_level || 0) + Number(tx.quantity)
              }).eq('item_id', tx.item_id);
            }
          }
          await db.from('inventory_transactions').delete().eq('transaction_id', tx.transaction_id);
        }
      }
    }

    invalidateActiveFeedBatchesCache();
    return res.json({ success: true, message: 'Feeding undone' });
  } catch (err) {
    console.error('[undo-feed] error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/growth/logs
// Record an activity/feed for a batch
router.post('/api/growth/logs', async (req, res) => {
  try {
    const { batch_id, activity_type, guideline_id, amount_given, item_id, quantity_deducted, performed_by } = req.body;

    let logResult = null;
    try {
      const { data, error } = await db.from('batch_activity_logs').insert({
        batch_id,
        activity_type,
        guideline_id: guideline_id || null,
        amount_given: amount_given || 0,
        performed_by: performed_by || 'System'
      }).select().single();
      if (error) {
        console.warn('[Growth Log] batch_activity_logs insert warning:', error.message);
      } else {
        logResult = data;
      }
    } catch (insertErr) {
      console.warn('[Growth Log] batch_activity_logs insert skipped:', insertErr.message);
    }

    // Complete corresponding task in growth_tasks if present
    try {
      if (batch_id && activity_type) {
        await db
          .from('growth_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('batch_id', batch_id)
          .eq('activity_type', activity_type);
      }
    } catch (taskErr) {
      console.warn('[Growth Log] growth_tasks update note:', taskErr.message);
    }

    // Fetch the task name and item_id from the guideline if available
    let taskName = activity_type;
    let resolvedItemId = item_id || null;
    let resolvedDosage = null;

    if (guideline_id) {
      const { data: g } = await db
        .from('growth_program_guidelines')
        .select('task_name, item_id, dosage_instructions')
        .eq('guideline_id', guideline_id)
        .single();
      if (g) {
        taskName = g.task_name || activity_type;
        if (!resolvedItemId && g.item_id) resolvedItemId = g.item_id;
        resolvedDosage = g.dosage_instructions;

        // Auto-link guideline if it lacked an item_id but the caller supplied one
        if (!g.item_id && resolvedItemId) {
          await db
            .from('growth_program_guidelines')
            .update({ item_id: resolvedItemId })
            .eq('guideline_id', guideline_id)
            .catch(() => { });
        }
      }
    }

    // Fetch batch tag for readable inventory transaction notes
    let batchTag = 'Batch';
    if (batch_id) {
      const { data: bRow } = await db
        .from('piglet_batches')
        .select('batch_tag, current_count')
        .eq('batch_id', batch_id)
        .single();
      if (bRow?.batch_tag) {
        batchTag = `${bRow.batch_tag} (${bRow.current_count || 0} heads)`;
      }
    }

    // Determine deduction quantity (container units)
    let deductionAmount = quantity_deducted ? parseFloat(quantity_deducted) : null;
    if (!deductionAmount && resolvedItemId && amount_given > 0) {
      const rawKg = parseFloat(amount_given);
      const { data: invItem } = await db
        .from('inventory_items')
        .select('unit_of_measure')
        .eq('item_id', resolvedItemId)
        .single();
      const unitStr = String(invItem?.unit_of_measure || '').trim();
      const sackMatch = unitStr.match(/^(?:sacks?|bags?)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*kg\s*\))?$/i);
      if (sackMatch) {
        const sackKg = sackMatch[1] ? Number(sackMatch[1]) : 25;
        deductionAmount = Number((rawKg / sackKg).toFixed(4));
      } else {
        deductionAmount = rawKg;
      }
    }

    // Deduct from inventory if item is linked and quantity > 0
    if (resolvedItemId && deductionAmount && deductionAmount > 0) {
      const kgNote = amount_given > 0 ? ` (${amount_given} kg fed)` : '';
      await deductInventoryStock({
        db,
        itemId: resolvedItemId,
        quantity: deductionAmount,
        notes: `Used in Feeding - ${batchTag}${kgNote} • By: ${performed_by || 'Staff'}`,
        performedBy: performed_by || 'Staff'
      }).catch(err => console.warn('[Growth Log] Stock deduction skipped/failed:', err.message));
    }

    // Integrate with Health & Vaccination modules
    if (activity_type === 'VACCINATION') {
      await db.from('vaccination_records').insert({
        batch_id,
        vaccine_name: taskName,
        item_id: resolvedItemId,
        quantity_deducted: deductionAmount,
        dosage: resolvedDosage || (amount_given > 0 ? `${amount_given}` : 'Standard'),
        administered_by: performed_by || 'System',
        administered_date: new Date().toISOString().split('T')[0]
      });
    } else if (activity_type === 'MEDICATION') {
      await db.from('health_logs').insert({
        batch_id,
        status: 'healthy',
        diagnosis: 'Routine Program Medication',
        treatment: taskName,
        item_id: resolvedItemId,
        quantity_deducted: deductionAmount,
        dosage: resolvedDosage || (amount_given > 0 ? `${amount_given}` : null),
        symptoms: 'None observed',
        recorded_by: performed_by || 'System',
        log_date: new Date().toISOString()
      });
    }

    invalidateActiveFeedBatchesCache();
    res.json({ success: true, log: logResult || { batch_id, activity_type, amount_given }, quantity_deducted: deductionAmount });
  } catch (error) {
    console.error('Error logging batch activity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/programs/:id/log-daily-feed
// 1-Click Bulk Log for all active unfed batches in a growth program
router.post('/api/growth/programs/:id/log-daily-feed', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.body;
    const staffName = performed_by || 'Staff';

    // 1. Fetch program guidelines with inventory items
    const { data: program, error: pErr } = await db
      .from('growth_programs')
      .select('name, guidelines:growth_program_guidelines(*, inventory_items(item_id, item_name, unit_of_measure, current_stock_level))')
      .eq('program_id', id)
      .single();

    if (pErr) throw pErr;

    // 2. Fetch active batches
    const { data: batches, error: bErr } = await db
      .from('piglet_batches')
      .select('batch_id, batch_tag, current_count, date_of_birth, status')
      .eq('assigned_program_id', id)
      .eq('is_archived', false)
      .neq('status', 'Archived');

    if (bErr) throw bErr;
    if (!batches || batches.length === 0) {
      return res.json({ success: true, count: 0, message: 'No active batches enrolled in this program.' });
    }

    // 3. Find which batches have already been fed today
    const startOfTodayIso = getStartOfTodayIso();
    const batchIds = batches.map(b => b.batch_id);
    const fedBatchIds = new Set();

    try {
      const { data: todayLogs } = await db
        .from('batch_activity_logs')
        .select('batch_id')
        .in('batch_id', batchIds)
        .eq('activity_type', 'FEED')
        .gte('recorded_at', startOfTodayIso);
      (todayLogs || []).forEach(l => fedBatchIds.add(l.batch_id));
    } catch (err) {
      console.warn('[Bulk Feed] batch_activity_logs lookup note:', err.message);
    }

    try {
      const { data: gTasks } = await db
        .from('growth_tasks')
        .select('batch_id')
        .in('batch_id', batchIds)
        .eq('activity_type', 'FEED')
        .eq('status', 'completed')
        .gte('completed_at', startOfTodayIso);
      (gTasks || []).forEach(t => fedBatchIds.add(t.batch_id));
    } catch (tErr) {
      // ignore
    }

    try {
      const { data: txs } = await db
        .from('inventory_transactions')
        .select('notes')
        .gte('created_at', startOfTodayIso);
      (txs || []).forEach(tx => {
        if (tx.notes && isFeedingTransactionNote(tx.notes)) {
          batches.forEach(b => {
            if (b.batch_tag && matchesBatchTag(tx.notes, b.batch_tag)) {
              fedBatchIds.add(b.batch_id);
            }
          });
        }
      });
    } catch (txErr) {
      // ignore
    }

    const unfedBatches = batches.filter(b => !fedBatchIds.has(b.batch_id) && Number(b.current_count) > 0);

    if (unfedBatches.length === 0) {
      return res.json({ success: true, count: 0, message: 'All active batches have already been fed today!' });
    }

    const today = new Date();
    const guidelines = (program?.guidelines || []).sort((a, b) => a.days_after_birth - b.days_after_birth);
    const feedGuidelines = guidelines.filter(g => g.activity_type === 'FEED');

    let totalFedKg = 0;
    const newLogs = [];

    // Group deductions by item_id
    const deductionsByItem = {};

    for (const b of unfedBatches) {
      const dob = b.date_of_birth ? new Date(b.date_of_birth) : null;
      const ageInDays = dob ? Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24))) : 0;
      const count = Number(b.current_count) || 0;

      let activeFeed = null;
      if (feedGuidelines.length > 0) {
        activeFeed = feedGuidelines[0];
        for (const fg of feedGuidelines) {
          if (ageInDays >= fg.days_after_birth) {
            activeFeed = fg;
          } else {
            break;
          }
        }
      }

      if (!activeFeed) continue;

      const dailyRate = Number(activeFeed.daily_consumption_per_head) || 0;
      const batchFeedKg = Number((dailyRate * count).toFixed(2));
      if (batchFeedKg <= 0) continue;

      totalFedKg += batchFeedKg;
      newLogs.push({
        batch_id: b.batch_id,
        activity_type: 'FEED',
        guideline_id: activeFeed.guideline_id,
        amount_given: batchFeedKg,
        performed_by: staffName,
      });

      if (activeFeed.item_id) {
        if (!deductionsByItem[activeFeed.item_id]) {
          deductionsByItem[activeFeed.item_id] = {
            item_id: activeFeed.item_id,
            item_name: activeFeed.task_name,
            unit_of_measure: activeFeed.inventory_items?.unit_of_measure,
            total_kg: 0,
            batches: [],
          };
        }
        deductionsByItem[activeFeed.item_id].total_kg += batchFeedKg;
        deductionsByItem[activeFeed.item_id].batches.push(`${b.batch_tag} (${batchFeedKg}kg)`);
      }
    }

    if (newLogs.length > 0) {
      try {
        await db.from('batch_activity_logs').insert(newLogs);
      } catch (logErr) {
        console.warn('[Bulk Feed] batch_activity_logs insert warning:', logErr.message);
      }

      // Mark corresponding tasks in growth_tasks as completed
      try {
        const fedBatchIds = newLogs.map(l => l.batch_id);
        await db
          .from('growth_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .in('batch_id', fedBatchIds)
          .eq('activity_type', 'FEED');
      } catch (taskErr) {
        console.warn('[Bulk Feed] growth_tasks update note:', taskErr.message);
      }
    }

    // Process inventory deductions
    for (const itemKey of Object.keys(deductionsByItem)) {
      const itemInfo = deductionsByItem[itemKey];
      const rawKg = itemInfo.total_kg;
      const unitStr = String(itemInfo.unit_of_measure || '').trim();
      const sackMatch = unitStr.match(/^(?:sacks?|bags?)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*kg\s*\))?$/i);
      let deductionQty = rawKg;
      if (sackMatch) {
        const sackKg = sackMatch[1] ? Number(sackMatch[1]) : 25;
        deductionQty = Number((rawKg / sackKg).toFixed(4));
      }

      if (deductionQty > 0) {
        await deductInventoryStock({
          db,
          itemId: itemInfo.item_id,
          quantity: deductionQty,
          notes: `Program Feeding: ${program.name} - ${itemInfo.batches.join(', ')} (${rawKg.toFixed(1)} kg) • By: ${staffName}`,
          performedBy: staffName,
        }).catch(err => console.warn('[Bulk Feed] Stock deduction error:', err.message));
      }
    }

    invalidateActiveFeedBatchesCache();

    res.json({
      success: true,
      batches_fed_count: newLogs.length,
      total_kg_fed: Number(totalFedKg.toFixed(1)),
      message: `Successfully logged daily feed for ${newLogs.length} batches (${totalFedKg.toFixed(1)} kg total).`,
    });
  } catch (error) {
    console.error('Error logging program daily feed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
