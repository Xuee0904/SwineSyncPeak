import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { getPenOccupancy } from '../helpers/occupancy.js';
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

async function resolveBreedId(breedInput, client = supabaseAdmin) {
  if (!breedInput || typeof breedInput !== 'string' || !breedInput.trim()) return null;
  const trimmed = breedInput.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (isUuid) return trimmed;

  // Format to Title Case, preserving crossbreed symbols and designations
  const formattedName = trimmed
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === 'x' || lower === '×') return '×';
      if (lower === 'f1') return 'F1';
      if (lower === 'f2') return 'F2';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // 1. Check case-insensitively using ilike
  const { data: existing } = await client
    .from('breeds')
    .select('breed_id, name')
    .ilike('name', formattedName)
    .maybeSingle();

  if (existing?.breed_id) return existing.breed_id;

  // 2. Insert new cleaned breed
  const { data: created, error } = await client
    .from('breeds')
    .insert([{ name: formattedName }])
    .select('breed_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: fallback } = await client
        .from('breeds')
        .select('breed_id')
        .ilike('name', formattedName)
        .maybeSingle();
      return fallback?.breed_id || null;
    }
    throw error;
  }
  return created?.breed_id || null;
}

const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Inactive', 'Cull'];

// GET /api/pigs/breeding-logs – legacy alias forwarding to breeding_logs
router.get('/api/pigs/breeding-logs', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pigs')
      .select('pig_id, pig_tag, parity_count, breeding_date, created_at, breeds(name)')
      .eq('status', 'pregnant')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const sows = (data || []).map(p => {
      // Use breeding_date if available, otherwise fallback to created_at
      const matingDateStr = p.breeding_date || p.created_at;
      const matingDate = new Date(matingDateStr);
      const today = new Date();
      const diffTime = Math.abs(today - matingDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let status = "pregnant";
      if (diffDays < 21) status = "monitoring";
      else if (diffDays > 114) status = "action";

      const dueDate = new Date(matingDate);
      dueDate.setDate(dueDate.getDate() + 114);

      const isOverdue = diffDays > 114;
      const dueStr = isOverdue ? "Overdue" : dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      return {
        id: p.pig_tag || p.pig_id,
        tag: p.pig_tag,
        parity: p.parity_count || 1,
        breed: p.breeds?.name || 'Unknown',
        day: diffDays,
        status,
        dueDate: dueStr,
        matingDate: matingDateStr.split('T')[0],
      };
    });

    res.json({ data: sows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getBatchHeads = (b) => {
  const c = Number(b.current_count);
  if (!isNaN(c) && c >= 0 && b.current_count !== null && b.current_count !== '') return c;
  const t = Number(b.total_born_alive);
  if (!isNaN(t) && t > 0) return t;
  return 0;
};

// GET /api/pigs/stats – aggregate counts for summary cards
router.get('/api/pigs/stats', verifyAuth, async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const [pigsRes, sickRes, quarRes, batchesRes] = await Promise.all([
      db.from('pigs').select('*').eq('is_archived', false),
      db.from('pigs').select('*', { count: 'exact' }).eq('status', 'sick').eq('is_archived', false),
      db.from('pigs').select('*', { count: 'exact' }).eq('status', 'quarantine').eq('is_archived', false),
      db.from('piglet_batches').select('*').eq('is_archived', false),
    ]);

    const pigsList = pigsRes.data || [];
    const batchesList = batchesRes.data || [];
    const pigsCount = pigsList.length;
    const batchesCount = batchesList.length;

    const pigletCount = batchesList.reduce((sum, b) => sum + getBatchHeads(b), 0);
    const sickBatchHeads = batchesList
      .filter(b => (b.status || '').toLowerCase() === 'sick')
      .reduce((sum, b) => sum + getBatchHeads(b), 0);
    const quarBatchHeads = batchesList
      .filter(b => (b.status || '').toLowerCase() === 'quarantine')
      .reduce((sum, b) => sum + getBatchHeads(b), 0);

    const sickCount = (sickRes.count ?? 0) + sickBatchHeads;
    const quarCount = (quarRes.count ?? 0) + quarBatchHeads;
    const totalCount = pigsCount + pigletCount;
    const femalePigs = pigsList.filter(p => {
      const g = (p.gender || '').toLowerCase();
      return g.startsWith('f') || g === 'female' || g === 'sow';
    }).length;
    const malePigs = pigsCount - femalePigs;

    res.json({
      total: totalCount,
      records: pigsCount + batchesCount,
      sows: femalePigs,
      boars: malePigs,
      piglets: pigletCount,
      batches: batchesCount,
      healthy: Math.max(0, totalCount - sickCount - quarCount),
      sick: sickCount,
      quarantine: quarCount,
      healthWatch: sickCount + quarCount,
      pregnant: femalePigs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs/analytics – structured herd composition, health, breed & batch survivability metrics
router.get('/api/pigs/analytics', verifyAuth, async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const [pigsRes, batchesRes, salesRes, soldSwineRes, promotedRes] = await Promise.all([
      db.from('pigs')
        .select('pig_id, pig_tag, gender, status, weight, date_of_birth, breed_id, created_at, breeds(name)')
        .eq('is_archived', false),
      db.from('piglet_batches')
        .select('batch_id, batch_tag, status, average_weight, date_of_birth, total_born_alive, current_count, stillborn_count, mummy_count, breed_id, created_at, breeds(name)')
        .eq('is_archived', false),
      db.from('growth_activities')
        .select('batch_id, amount_given')
        .eq('activity_type', 'SALE'),
      db.from('sold_swine')
        .select('batch_id, quantity_sold')
        .not('batch_id', 'is', null),
      db.from('pigs')
        .select('source_batch_id')
        .not('source_batch_id', 'is', null),
    ]);

    if (pigsRes.error) throw pigsRes.error;
    if (batchesRes.error) throw batchesRes.error;

    const pigsList = pigsRes.data || [];
    const batchesList = batchesRes.data || [];
    const salesList = salesRes.data || [];
    const soldSwineList = soldSwineRes.data || [];
    const promotedList = promotedRes.data || [];

    const soldSwineByBatch = {};
    for (const s of soldSwineList) {
      if (!s.batch_id) continue;
      soldSwineByBatch[s.batch_id] = (soldSwineByBatch[s.batch_id] || 0) + (Number(s.quantity_sold) || 0);
    }

    const activitySalesByBatch = {};
    for (const s of salesList) {
      if (!s.batch_id) continue;
      activitySalesByBatch[s.batch_id] = (activitySalesByBatch[s.batch_id] || 0) + (Number(s.amount_given) || 0);
    }

    const salesByBatch = { ...activitySalesByBatch, ...soldSwineByBatch };

    const promotedByBatch = {};
    for (const p of promotedList) {
      if (!p.source_batch_id) continue;
      promotedByBatch[p.source_batch_id] = (promotedByBatch[p.source_batch_id] || 0) + 1;
    }

    // 1. Composition by Production Stage (in heads)
    let sowHeads = 0;
    let boarHeads = 0;
    const stageCounts = {};

    for (const p of pigsList) {
      const g = (p.gender || '').toLowerCase();
      if (g.startsWith('f') || g === 'female' || g === 'sow') sowHeads += 1;
      else boarHeads += 1;
    }

    for (const b of batchesList) {
      const heads = getBatchHeads(b);
      const rawStage = (b.status || 'suckling').trim().toLowerCase();
      const stageKey = ['sick', 'quarantine', 'healthy', 'inactive', 'cull'].includes(rawStage)
        ? 'piglets_other'
        : rawStage;
      stageCounts[stageKey] = (stageCounts[stageKey] || 0) + heads;
    }

    const STAGE_META = {
      sow: { label: 'Sows', color: '#059669', filterCat: 'sow' },
      boar: { label: 'Boars', color: '#0284c7', filterCat: 'boar' },
      suckling: { label: 'Suckling Piglets', color: '#f59e0b', filterCat: 'piglet_batch' },
      weaned: { label: 'Weaned Piglets', color: '#8b5cf6', filterCat: 'piglet_batch' },
      nursery: { label: 'Nursery', color: '#0d9488', filterCat: 'piglet_batch' },
      grower: { label: 'Grower', color: '#6366f1', filterCat: 'piglet_batch' },
      fattening: { label: 'Fattening', color: '#ec4899', filterCat: 'piglet_batch' },
      finisher: { label: 'Finisher', color: '#ec4899', filterCat: 'piglet_batch' },
      piglets_other: { label: 'Other Batches', color: '#64748b', filterCat: 'piglet_batch' },
    };

    const composition = [];
    if (sowHeads > 0) composition.push({ key: 'sow', count: sowHeads, ...STAGE_META.sow });
    if (boarHeads > 0) composition.push({ key: 'boar', count: boarHeads, ...STAGE_META.boar });

    const stageFallbackColors = ['#f59e0b', '#8b5cf6', '#0d9488', '#6366f1', '#64748b'];
    Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, count], idx) => {
        if (count <= 0) return;
        const meta = STAGE_META[key] || {
          label: `${key.charAt(0).toUpperCase() + key.slice(1)} Piglets`,
          color: stageFallbackColors[idx % stageFallbackColors.length],
          filterCat: 'piglet_batch',
        };
        composition.push({ key, count, ...meta });
      });

    // 2. Health Status Breakdown (in heads)
    const healthBuckets = {
      healthy: 0,
      pregnant: 0,
      sick: 0,
      quarantine: 0,
      other: 0,
    };

    for (const p of pigsList) {
      const st = (p.status || 'healthy').toLowerCase();
      if (st === 'sick') healthBuckets.sick += 1;
      else if (st === 'quarantine') healthBuckets.quarantine += 1;
      else if (st === 'pregnant') healthBuckets.pregnant += 1;
      else if (st === 'inactive' || st === 'cull') healthBuckets.other += 1;
      else healthBuckets.healthy += 1;
    }

    for (const b of batchesList) {
      const heads = getBatchHeads(b);
      const st = (b.status || 'suckling').toLowerCase();
      if (st === 'sick') healthBuckets.sick += heads;
      else if (st === 'quarantine') healthBuckets.quarantine += heads;
      else if (st === 'inactive' || st === 'cull') healthBuckets.other += heads;
      else healthBuckets.healthy += heads;
    }

    const healthBreakdown = [
      { key: 'healthy', label: 'Healthy', count: healthBuckets.healthy, color: '#059669', filterStatus: 'healthy' },
      { key: 'pregnant', label: 'Pregnant', count: healthBuckets.pregnant, color: '#6366f1', filterStatus: 'all' },
      { key: 'sick', label: 'Sick', count: healthBuckets.sick, color: '#f59e0b', filterStatus: 'sick' },
      { key: 'quarantine', label: 'Quarantine', count: healthBuckets.quarantine, color: '#e11d48', filterStatus: 'quarantine' },
      { key: 'other', label: 'Inactive / Cull', count: healthBuckets.other, color: '#64748b', filterStatus: 'all' },
    ].filter((item) => item.count > 0 || ['healthy', 'sick', 'quarantine'].includes(item.key));

    // 3. Breed Distribution & Weight Averages
    const breedMap = {};
    const addToBreed = (breedName, heads, weightVal) => {
      const name = (breedName || '').trim() || 'Unassigned';
      if (!breedMap[name]) {
        breedMap[name] = { breed: name, heads: 0, records: 0, weightSum: 0, weightCount: 0 };
      }
      breedMap[name].heads += heads;
      breedMap[name].records += 1;
      const w = Number(weightVal);
      if (!isNaN(w) && w > 0) {
        breedMap[name].weightSum += w;
        breedMap[name].weightCount += 1;
      }
    };

    for (const p of pigsList) addToBreed(p.breeds?.name, 1, p.weight);
    for (const b of batchesList) addToBreed(b.breeds?.name, getBatchHeads(b), b.average_weight);

    const sortedBreeds = Object.values(breedMap)
      .sort((a, b) => b.heads - a.heads || b.records - a.records);

    const topBreeds = sortedBreeds.slice(0, 6).map((b) => ({
      breed: b.breed,
      heads: b.heads,
      records: b.records,
      avgWeight: b.weightCount > 0 ? Math.round((b.weightSum / b.weightCount) * 10) / 10 : null,
      filterable: b.breed !== 'Unassigned',
    }));

    if (sortedBreeds.length > 6) {
      const rest = sortedBreeds.slice(6);
      const restWeightSum = rest.reduce((s, r) => s + r.weightSum, 0);
      const restWeightCount = rest.reduce((s, r) => s + r.weightCount, 0);
      topBreeds.push({
        breed: 'Other Breeds',
        heads: rest.reduce((s, r) => s + r.heads, 0),
        records: rest.reduce((s, r) => s + r.records, 0),
        avgWeight: restWeightCount > 0 ? Math.round((restWeightSum / restWeightCount) * 10) / 10 : null,
        filterable: false,
      });
    }

    // 4. Batch Survivability & Loss Overview (up to 6 most recent batches)
    let totalBornAliveAll = 0;
    let totalSurvivedAll = 0;
    let totalLossAll = 0;
    let weighedBatchCount = 0;
    let batchWeightSum = 0;

    const batchPerformanceAll = batchesList
      .map((b) => {
        const currentCount = getBatchHeads(b);
        const soldCount = salesByBatch[b.batch_id] || 0;
        const promotedCount = promotedByBatch[b.batch_id] || 0;
        const accountedHeads = currentCount + soldCount + promotedCount;
        const rawBorn = Number(b.total_born_alive);
        const bornAlive = !isNaN(rawBorn) && rawBorn > 0 ? rawBorn : accountedHeads;
        const mortalityLoss = Math.max(0, bornAlive - accountedHeads);
        const survivabilityRate = bornAlive > 0
          ? Math.min(100, Math.round((accountedHeads / bornAlive) * 1000) / 10)
          : 100;

        totalBornAliveAll += bornAlive;
        totalSurvivedAll += accountedHeads;
        totalLossAll += mortalityLoss;

        const avgW = Number(b.average_weight);
        if (!isNaN(avgW) && avgW > 0) {
          weighedBatchCount += 1;
          batchWeightSum += avgW;
        }

        const refDate = b.date_of_birth || b.created_at;
        const ageWeeks = b.date_of_birth
          ? Math.max(0, Math.floor((Date.now() - new Date(b.date_of_birth)) / 604800000))
          : null;

        return {
          batchId: b.batch_id,
          batchTag: b.batch_tag,
          status: b.status || 'suckling',
          bornAlive,
          currentCount,
          soldCount,
          promotedCount,
          mortalityLoss,
          stillborn: Number(b.stillborn_count) || 0,
          mummy: Number(b.mummy_count) || 0,
          survivabilityRate,
          ageWeeks,
          averageWeight: !isNaN(avgW) && avgW > 0 ? Math.round(avgW * 10) / 10 : null,
          _sortTime: refDate ? new Date(refDate).getTime() : 0,
        };
      })
      .sort((a, b) => b._sortTime - a._sortTime);

    const recentBatches = batchPerformanceAll
      .slice(0, 6)
      .reverse()
      .map(({ _sortTime, ...rest }) => rest);

    const pigletHeads = batchesList.reduce((sum, b) => sum + getBatchHeads(b), 0);
    const totalHeads = pigsList.length + pigletHeads;

    res.json({
      summary: {
        totalHeads,
        breedingHeads: sowHeads + boarHeads,
        pigletHeads,
        activeRecords: pigsList.length + batchesList.length,
        avgSurvivabilityRate: totalBornAliveAll > 0
          ? Math.min(100, Math.round((totalSurvivedAll / totalBornAliveAll) * 1000) / 10)
          : 100,
        totalMortalityLoss: totalLossAll,
        avgBatchWeight: weighedBatchCount > 0
          ? Math.round((batchWeightSum / weighedBatchCount) * 10) / 10
          : null,
        weighedBatches: weighedBatchCount,
      },
      composition,
      healthBreakdown,
      breedDistribution: topBreeds,
      batchPerformance: recentBatches,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs
router.get('/api/pigs', verifyAuth, async (req, res) => {
  try {
    const { search, status, pen, category, breed, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = parseInt(limit) || 10;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let pigData = [], batchData = [];
    const queryPigs = !category || ['all', 'sow', 'boar', 'breeding'].includes(category);
    const queryBatches = !category || ['all', 'piglet_batch'].includes(category);

    const isHealthWatch = (status || '').toLowerCase() === 'health_watch';

    if (queryPigs) {
      // Join breeds so we get the breed name, not just the breed_id UUID stored on pigs.
      let q = supabase.from('pigs').select('*, breeds(name), pens(pen_code)').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') {
        if (isHealthWatch) {
          q = q.in('status', ['sick', 'quarantine']);
        } else {
          q = q.eq('status', status.toLowerCase());
        }
      }
      if (search) q = q.ilike('pig_tag', `%${search}%`);
      const { data } = await q;
      pigData = data || [];
    }

    if (queryBatches) {
      let q = supabase.from('piglet_batches').select('*, breeds(name), pens(pen_code)').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') {
        if (isHealthWatch) {
          q = q.in('status', ['sick', 'quarantine']);
        } else {
          q = q.eq('status', status.toLowerCase());
        }
      }
      if (search) q = q.ilike('batch_tag', `%${search}%`);
      const { data } = await q;
      batchData = data || [];
    }

    const unifiedPigs = pigData.map(pig => ({
      id: pig.pig_id,
      pig_tag: pig.pig_tag,
      breed: pig.breeds?.name || '',
      breed_id: pig.breed_id,
      date_of_birth: pig.date_of_birth || null,
      age_weeks: pig.date_of_birth ? Math.floor((Date.now() - new Date(pig.date_of_birth)) / 604800000) : '',
      current_weight: pig.weight,
      pen_id: pig.pen_id || null,
      pen_code: pig.pens?.pen_code || '',
      category: (pig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      status: pig.status || 'healthy',
      source_origin: pig.source_origin || 'born_in_farm',
      supplier_name: pig.supplier_name || null,
      arrival_date: pig.arrival_date || null,
      source_batch_id: pig.source_batch_id || null,
      source_batch_tag: pig.source_batch_tag || null,
      parity_count: pig.parity_count ?? null,
      is_archived: pig.is_archived || false,
      archived_at: pig.archived_at || null,
      archive_reasoning: pig.archive_reasoning || null,
      created_at: pig.created_at || null,
    }));

    const unifiedBatches = batchData.map(batch => ({
      id: batch.batch_id,
      pig_tag: batch.batch_tag,
      batch_tag: batch.batch_tag,
      breed: batch.breeds?.name || '',
      breed_id: batch.breed_id,
      date_of_birth: batch.date_of_birth || null,
      age_weeks: batch.date_of_birth
        ? Math.floor((Date.now() - new Date(batch.date_of_birth)) / 604800000)
        : '',
      current_weight: batch.average_weight,
      average_weight: batch.average_weight,
      pen_id: batch.pen_id || null,
      pen_code: batch.pens?.pen_code || '',
      sow_id: batch.sow_id || null,
      category: 'Piglet Batch',
      status: batch.status || 'suckling',
      source_origin: batch.source_origin || 'born_in_farm',
      supplier_name: batch.supplier_name || null,
      arrival_date: batch.arrival_date || null,
      total_born_alive: batch.total_born_alive || 0,
      current_count: batch.current_count || 0,
      stillborn_count: batch.stillborn_count || 0,
      mummy_count: batch.mummy_count || 0,
      is_archived: batch.is_archived || false,
      archived_at: batch.archived_at || null,
      archive_reasoning: batch.archive_reasoning || null,
      created_at: batch.created_at || null,
    }));

    let merged = [...unifiedPigs, ...unifiedBatches];
    if (category && category !== 'all') {
      if (category === 'breeding') {
        merged = merged.filter(i => i.category === 'Sow' || i.category === 'Boar');
      } else {
        const map = { sow: 'Sow', boar: 'Boar', piglet_batch: 'Piglet Batch' };
        merged = merged.filter(i => i.category === map[category]);
      }
    }
    if (breed && breed !== 'all') {
      merged = merged.filter(i => (i.breed_id && i.breed_id === breed) || (i.breed && i.breed.toLowerCase() === breed.toLowerCase()));
    }

    // Default Order: Most Recently Added First (created_at DESC, then date DESC, tie-break by tag)
    merged.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      const dateA = a.arrival_date ? new Date(a.arrival_date).getTime() : (a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0);
      const dateB = b.arrival_date ? new Date(b.arrival_date).getTime() : (b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0);
      if (dateB !== dateA) return dateB - dateA;

      return (b.pig_tag || '').localeCompare(a.pig_tag || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({ data: merged.slice(from, to + 1), count: merged.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs/archived – fetch archived pig & batch records
router.get('/api/pigs/archived', verifyAuth, async (req, res) => {
  try {
    const { search, category, breed, pen, status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = parseInt(limit) || 10;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let pigData = [], batchData = [];
    const queryPigs = !category || ['all', 'sow', 'boar'].includes(category);
    const queryBatches = !category || ['all', 'piglet_batch'].includes(category);

    if (queryPigs) {
      let q = supabase.from('pigs').select('*, breeds(name), pens(pen_code)').eq('is_archived', true);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (search) q = q.ilike('pig_tag', `%${search}%`);
      const { data } = await q;
      pigData = data || [];
    }

    if (queryBatches) {
      let q = supabase.from('piglet_batches').select('*, breeds(name), pens(pen_code)').eq('is_archived', true);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (search) q = q.ilike('batch_tag', `%${search}%`);
      const { data } = await q;
      batchData = data || [];
    }

    const unifiedPigs = pigData.map(pig => ({
      id: pig.pig_id,
      pig_tag: pig.pig_tag,
      breed: pig.breeds?.name || '',
      breed_id: pig.breed_id,
      date_of_birth: pig.date_of_birth || null,
      age_weeks: pig.date_of_birth ? Math.floor((Date.now() - new Date(pig.date_of_birth)) / 604800000) : '',
      current_weight: pig.weight,
      pen_id: pig.pen_id || null,
      pen_code: pig.pens?.pen_code || '',
      category: (pig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      status: pig.status || 'healthy',
      is_archived: true,
      archived_at: pig.archived_at || null,
      archive_reasoning: pig.archive_reasoning || null,
      created_at: pig.created_at || null,
    }));

    const unifiedBatches = batchData.map(batch => ({
      id: batch.batch_id,
      pig_tag: batch.batch_tag,
      breed: batch.breeds?.name || '',
      breed_id: batch.breed_id,
      date_of_birth: batch.date_of_birth || null,
      age_weeks: batch.date_of_birth ? Math.floor((Date.now() - new Date(batch.date_of_birth)) / 604800000) : '',
      current_weight: batch.average_weight,
      pen_id: batch.pen_id || null,
      pen_code: batch.pens?.pen_code || '',
      category: 'Piglet Batch',
      status: batch.status || 'suckling',
      is_archived: true,
      archived_at: batch.archived_at || null,
      archive_reasoning: batch.archive_reasoning || null,
      created_at: batch.created_at || null,
    }));

    let merged = [...unifiedPigs, ...unifiedBatches];
    if (category && category !== 'all') {
      if (category === 'breeding') {
        merged = merged.filter(i => i.category === 'Sow' || i.category === 'Boar');
      } else {
        const map = { sow: 'Sow', boar: 'Boar', piglet_batch: 'Piglet Batch' };
        merged = merged.filter(i => i.category === map[category]);
      }
    }
    if (breed && breed !== 'all') {
      merged = merged.filter(i => (i.breed_id && i.breed_id === breed) || (i.breed && i.breed.toLowerCase() === breed.toLowerCase()));
    }
    if (status && status !== 'all') {
      const s = status.toLowerCase();
      merged = merged.filter(i => {
        const r = (i.archive_reasoning || '').toLowerCase();
        if (s === 'promoted') return r.includes('promot');
        if (s === 'sold') return r.includes('sold');
        if (s === 'culled') return r.includes('cull');
        if (s === 'mortality') return r.includes('mortal') || r.includes('died') || r.includes('death') || r.includes('loss');
        if (s === 'transferred') return r.includes('transfer');
        return (i.status || '').toLowerCase() === s;
      });
    }

    // Default Order for Archived: Most Recently Archived First (archived_at DESC, then created_at DESC)
    merged.sort((a, b) => {
      const archA = a.archived_at ? new Date(a.archived_at).getTime() : 0;
      const archB = b.archived_at ? new Date(b.archived_at).getTime() : 0;
      if (archB !== archA) return archB - archA;

      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      return (b.pig_tag || '').localeCompare(a.pig_tag || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({ data: merged.slice(from, to + 1), count: merged.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// GET /api/pigs/:id – single pig record with full detail, for the Edit modal.
router.get('/api/pigs/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('pigs')
      .select('*, breeds(name), pens(pen_code)')
      .eq('pig_id', id)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return res.json({
        data: {
          id: data.pig_id,
          pig_tag: data.pig_tag,
          date_of_birth: data.date_of_birth,
          breed: data.breeds?.name || '',
          breed_id: data.breed_id,
          current_weight: data.weight,
          pen_id: data.pen_id,
          pen_code: data.pens?.pen_code || '',
          status: data.status || 'healthy',
          gender: data.gender,
          category: (data.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
          parity_count: data.parity_count ?? '',
          source_origin: data.source_origin || 'born_in_farm',
          supplier_name: data.supplier_name || null,
          arrival_date: data.arrival_date || null,
          source_batch_id: data.source_batch_id || null,
          source_batch_tag: data.source_batch_tag || null,
          promoted_at: data.promoted_at || null,
          dam_id: data.dam_id || null,
          is_archived: data.is_archived || false,
          archived_at: data.archived_at || null,
          archive_reasoning: data.archive_reasoning || null,
        },
      });
    }

    // Check piglet_batches if not found in pigs
    const { data: batchData, error: batchError } = await supabase
      .from('piglet_batches')
      .select('*, breeds(name), pens(pen_code)')
      .eq('batch_id', id)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batchData) return res.status(404).json({ error: 'Record not found.' });

    let sowTag = null;
    if (batchData.sow_id) {
      const { data: sowData } = await supabase
        .from('pigs')
        .select('pig_tag')
        .eq('pig_id', batchData.sow_id)
        .maybeSingle();
      sowTag = sowData?.pig_tag || null;
    }

    let soldCount = 0;
    let promotedCount = 0;
    try {
      const db = supabaseAdmin || supabase;
      const [soldRes, saleLogRes, promotedRes] = await Promise.all([
        db.from('sold_swine').select('quantity_sold').eq('batch_id', batchData.batch_id),
        db.from('batch_activity_logs').select('amount_given').eq('batch_id', batchData.batch_id).eq('activity_type', 'SALE'),
        db.from('pigs').select('pig_id').eq('source_batch_id', batchData.batch_id),
      ]);
      const soldRows = soldRes.data || [];
      const saleLogs = saleLogRes.data || [];
      if (soldRows.length > 0) {
        soldCount = soldRows.reduce((sum, r) => sum + (Number(r.quantity_sold) || 0), 0);
      } else if (saleLogs.length > 0) {
        soldCount = saleLogs.reduce((sum, r) => sum + (Number(r.amount_given) || 0), 0);
      }
      promotedCount = (promotedRes.data || []).length;
    } catch (_) {}

    return res.json({
      data: {
        id: batchData.batch_id,
        pig_tag: batchData.batch_tag,
        batch_tag: batchData.batch_tag,
        date_of_birth: batchData.date_of_birth,
        breed: batchData.breeds?.name || '',
        breed_id: batchData.breed_id,
        current_weight: batchData.average_weight,
        average_weight: batchData.average_weight,
        pen_id: batchData.pen_id,
        pen_code: batchData.pens?.pen_code || '',
        sow_id: batchData.sow_id || null,
        sow_tag: sowTag,
        status: batchData.status || 'suckling',
        source_origin: batchData.source_origin || 'born_in_farm',
        supplier_name: batchData.supplier_name || null,
        arrival_date: batchData.arrival_date || null,
        total_born_alive: batchData.total_born_alive,
        current_count: batchData.current_count,
        sold_count: soldCount,
        promoted_count: promotedCount,
        stillborn_count: batchData.stillborn_count,
        mummy_count: batchData.mummy_count,
        category: 'Piglet Batch',
        is_archived: batchData.is_archived || false,
        archived_at: batchData.archived_at || null,
        archive_reasoning: batchData.archive_reasoning || null,
      },
    });
  } catch (error) {
    console.error('Error fetching pig detail:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export async function validateCreatePig(body = {}) {
  const { tagNumber, status, gender, penId } = body;
  if (!tagNumber || !String(tagNumber).trim()) {
    throw createHttpError(400, 'Tag number is required.');
  }
  if (!gender) {
    throw createHttpError(400, 'Gender is required.');
  }

  let penCode = '';
  if (penId) {
    const { data: pen, error: penError } = await supabase
      .from('pens')
      .select('pen_code, pen_type, max_capacity')
      .eq('pen_id', penId)
      .single();

    if (penError || !pen) {
      throw createHttpError(400, 'Selected pen not found.');
    }
    penCode = pen.pen_code || '';

    const occ = await getPenOccupancy(penId);
    const occupied = typeof occ === 'number' ? occ : occ.total;
    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');

    if (gender === 'Female' && (penSection === 'B' || penSection === 'BOAR')) {
      throw createHttpError(400, `Cannot assign a female sow to boar pen ${pen.pen_code}.`);
    }
    if (gender === 'Male' && penSection !== 'B' && penSection !== 'BOAR') {
      throw createHttpError(400, `Cannot assign a male boar to ${pen.pen_code}. Boars must be housed alone in a Boar pen.`);
    }
    const isSickOrQ = status?.toLowerCase() === 'sick' || status?.toLowerCase() === 'quarantine';
    const isQPen = penSection === 'Q' || penSection === 'QUARANTINE';
    if (!isSickOrQ && isQPen) {
      throw createHttpError(400, `Cannot assign a ${status || 'Healthy'} pig to Quarantine pen ${pen.pen_code}. Quarantine pens are reserved for sick or quarantined pigs.`);
    }
    if (isSickOrQ && !isQPen) {
      throw createHttpError(400, `Cannot assign a ${status} pig to ${pen.pen_code}. Sick or quarantined pigs must be placed in a Quarantine housing unit.`);
    }
    if (gender === 'Female' && !isQPen && penSection !== 'S' && penSection !== 'SOW') {
      throw createHttpError(400, `Cannot assign a female sow to ${pen.pen_code}. Sows must be housed in Sow/Farrowing pens.`);
    }
    if ((penSection === 'S' || penSection === 'SOW') && (occ.hasSow || occ.sowCount >= 1 || occ.pigCount >= 1)) {
      throw createHttpError(400, `Sow pen ${pen.pen_code} already houses 1 sow. The farm can only house 1 sow per sow pen.`);
    }
    if ((penSection === 'B' || penSection === 'BOAR') && (occ.hasBoar || occ.boarCount >= 1 || occ.pigCount >= 1)) {
      throw createHttpError(400, `Boar pen ${pen.pen_code} already houses 1 boar. The farm can only house 1 boar per boar pen.`);
    }
    if (occupied >= (pen.max_capacity ?? 0)) {
      throw createHttpError(400, `Pen ${pen.pen_code} is already at full capacity (${pen.max_capacity}). Please choose another pen.`);
    }
  }

  return { penCode };
}

export async function executeCreatePig(body = {}) {
  const { tagNumber, dateOfBirth, breed, weight, penId, status, gender, creator, sourceOrigin, source_origin, supplierName, supplier_name, arrivalDate, arrival_date } = body;
  const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

  await validateCreatePig(body);
  const finalBreedId = await resolveBreedId(breed, supabaseAdmin);

  const { data, error } = await supabaseAdmin
    .from('pigs')
    .insert([{
      pig_tag: tagNumber,
      date_of_birth: dateOfBirth,
      breed_id: finalBreedId,
      weight: (weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight))) ? parseFloat(weight) : null,
      pen_id: penId,
      status: (status || 'healthy').toLowerCase(),
      gender: gender,
      source_origin: sourceOrigin || source_origin || 'born_in_farm',
      supplier_name: supplierName || supplier_name || null,
      arrival_date: arrivalDate || arrival_date || null,
      is_archived: false
    }])
    .select();

  if (error) throw error;

  const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
    user_name: creatorName,
    user_email: creatorEmail,
    user_initials: creatorInitials,
    user_bg_color: 'bg-emerald-100 text-emerald-700',
    event_title: 'Swine Record Added',
    event_desc: `Added new ${gender.toLowerCase()} swine with tag ${tagNumber}.`,
    status: 'SUCCESS'
  });
  if (logError) console.error("Error inserting activity log:", logError);

  return { message: 'Pig added successfully', data };
}

// POST /api/pigs - Create an individual pig (Sow/Boar)
router.post('/api/pigs', verifyAuth, async (req, res) => {
  try {
    const { penCode } = await validateCreatePig(req.body);

    if (req.isAdmin) {
      const result = await executeCreatePig({
        ...req.body,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const { tagNumber, gender, status, breed } = req.body;
    const roleLabel = String(gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar';
    const penNote = penCode ? ` in Pen ${penCode}` : '';
    const summary = `Register ${roleLabel} #${tagNumber}${breed ? ` (${breed})` : ''}${penNote}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'swine',
      action: 'create_pig',
      actionLabel: 'Register Swine',
      summary,
      payload: {
        ...req.body,
        status: status || 'Healthy',
        penCode,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Swine registration submitted for administrator approval.',
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export async function validateCreateBatch(body = {}) {
  const {
    batchTag, penId, sowId, dateOfBirth,
    currentCount, status,
    batchId, penLocation, totalHerdCount,
  } = body;

  const resolvedPenId = penId || penLocation;
  const resolvedTag = batchTag || batchId;
  const resolvedCount = parseInt(currentCount ?? totalHerdCount) || 0;

  if (!resolvedTag || !String(resolvedTag).trim()) {
    throw createHttpError(400, 'Batch tag is required.');
  }

  let penCode = '';
  if (resolvedPenId) {
    const { data: pen, error: penError } = await supabase
      .from('pens')
      .select('pen_code, max_capacity, pen_type')
      .eq('pen_id', resolvedPenId)
      .single();

    if (penError || !pen) {
      throw createHttpError(400, 'Selected pen not found.');
    }
    penCode = pen.pen_code || '';

    const occupied = await getPenOccupancy(resolvedPenId);
    const incoming = resolvedCount;
    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');

    if (penSection === 'B' || penSection === 'BOAR') {
      throw createHttpError(400, `Piglet batches cannot be assigned to Boar pen ${pen.pen_code}.`);
    }

    const currentOccupied = typeof occupied === 'number' ? occupied : occupied.total;
    const maxCap = pen.max_capacity ?? 20;
    const remaining = Math.max(0, maxCap - currentOccupied);
    if (incoming > remaining) {
      throw createHttpError(
        400,
        `Pen ${pen.pen_code} only has ${remaining} slot(s) left (capacity ${maxCap}), but this batch has ${incoming} piglet(s).`
      );
    }

    const statusStr = (status || '').toLowerCase();
    let ageInDays = null;
    if (dateOfBirth) {
      ageInDays = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24));
    }
    const isBatchWeaned = statusStr === 'weaned' || (statusStr !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isBatchNursing = statusStr === 'suckling' || (statusStr !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    if (sowId && resolvedPenId && isBatchNursing) {
      const { data: motherSow } = await supabase.from('pigs').select('pen_id, pig_tag').eq('pig_id', sowId).single();
      if (motherSow && motherSow.pen_id && String(motherSow.pen_id) !== String(resolvedPenId)) {
        throw createHttpError(
          400,
          `Piglet batch is linked to Mother Sow #${motherSow.pig_tag}, but assigned to a different pen (${pen.pen_code}). Nursing piglet batches must be placed in their Mother Sow's pen.`
        );
      }
    }

    if (dateOfBirth) {
      if (ageInDays <= 28 && statusStr === 'weaned') {
        throw createHttpError(400, `Too young for Weaned (${ageInDays}d old). Keep as Suckling until day 29.`);
      }
      if (ageInDays > 28 && statusStr === 'suckling') {
        throw createHttpError(400, `Batch is ${ageInDays}d old (> 28 days). Mark as Weaned.`);
      }

      if (isBatchNursing && penSection !== 'S' && penSection !== 'SOW') {
        throw createHttpError(400, `Nursing piglet batches (<=28 days old) must be assigned to a Sow/Farrowing pen (${pen.pen_code} is ${penSection}).`);
      }
      if (isBatchWeaned && penSection !== 'W' && penSection !== 'WEANED') {
        throw createHttpError(400, `Weaned piglet batches (>28 days old) must be assigned to a Weaned/Fattening pen (${pen.pen_code} is ${penSection}).`);
      }
    }
  }

  return { penCode, resolvedTag, resolvedCount };
}

export async function executeCreateBatch(body = {}) {
  const {
    batchTag, penId, sowId, dateOfBirth, breed,
    totalBornAlive, currentCount, stillbornCount, mummyCount,
    averageWeight, status, creator,
    sourceOrigin, source_origin, supplierName, supplier_name, arrivalDate, arrival_date,
    assignedProgramId,
    batchId, penLocation, totalHerdCount,
  } = body;

  const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

  const resolvedPenId = penId || penLocation;
  const resolvedTag = batchTag || batchId;
  const resolvedCount = parseInt(currentCount ?? totalHerdCount) || 0;

  await validateCreateBatch(body);

  const resolvedBreedId = await resolveBreedId(breed, supabaseAdmin);

  const record = {
    batch_tag: resolvedTag,
    pen_id: resolvedPenId || null,
    sow_id: sowId || null,
    date_of_birth: dateOfBirth || null,
    breed_id: resolvedBreedId,
    total_born_alive: parseInt(totalBornAlive) || null,
    current_count: resolvedCount,
    stillborn_count: parseInt(stillbornCount) || 0,
    mummy_count: parseInt(mummyCount) || 0,
    average_weight: averageWeight ? parseFloat(averageWeight) : null,
    status: status || 'suckling',
    assigned_program_id: assignedProgramId || null,
    source_origin: sourceOrigin || source_origin || 'born_in_farm',
    supplier_name: supplierName || supplier_name || null,
    arrival_date: arrivalDate || arrival_date || null,
    is_archived: false,
  };

  const { data, error } = await supabaseAdmin
    .from('piglet_batches')
    .insert([record])
    .select();

  if (error) throw error;

  const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
    user_name: creatorName,
    user_email: creatorEmail,
    user_initials: creatorInitials,
    user_bg_color: 'bg-emerald-100 text-emerald-700',
    event_title: 'Batch Created',
    event_desc: `Created piglet batch ${resolvedTag} (${resolvedCount} heads).`,
    status: 'SUCCESS'
  });
  if (logError) console.error("Error inserting activity log:", logError);

  return { message: 'Batch added successfully', data };
}

// POST /api/pigs/batch - Create a piglet batch
router.post('/api/pigs/batch', verifyAuth, async (req, res) => {
  try {
    const { penCode, resolvedTag, resolvedCount } = await validateCreateBatch(req.body);

    if (req.isAdmin) {
      const result = await executeCreateBatch({
        ...req.body,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const penNote = penCode ? ` in Pen ${penCode}` : '';
    const summary = `Register piglet batch ${resolvedTag} (${resolvedCount} head${resolvedCount === 1 ? '' : 's'})${penNote}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'swine',
      action: 'create_batch',
      actionLabel: 'Register Piglet Batch',
      summary,
      payload: {
        ...req.body,
        penCode,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Batch registration submitted for administrator approval.',
    });
  } catch (error) {
    console.error("Error inserting batch:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export async function executeUpdatePig(id, body = {}) {
  const {
    tagNumber, dateOfBirth, breed, weight,
    penId, status, parityCount, creator, gender,
    totalBornAlive, stillbornCount, mummyCount, category, isBatch,
    sourceOrigin, source_origin, supplierName, supplier_name, arrivalDate, arrival_date,
    staffRestrictedUpdate,
  } = body;

  const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);
  const checkIsBatch = category === 'Piglet Batch' || isBatch === true;

  if (staffRestrictedUpdate) {
    if (checkIsBatch) {
      const { data: existingBatch } = await supabaseAdmin
        .from('piglet_batches')
        .select('batch_id, batch_tag, is_archived')
        .eq('batch_id', id)
        .maybeSingle();
      if (!existingBatch) {
        throw createHttpError(404, 'Piglet batch not found.');
      }
      if (existingBatch.is_archived) {
        throw createHttpError(400, 'Cannot modify details of an archived piglet batch.');
      }
      const patch = {};
      if (status) patch.status = String(status).toLowerCase();
      if (weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight))) {
        patch.average_weight = parseFloat(weight);
      } else if (body.averageWeight !== undefined && body.averageWeight !== null && body.averageWeight !== '' && !isNaN(parseFloat(body.averageWeight))) {
        patch.average_weight = parseFloat(body.averageWeight);
      }
      const { data, error } = await supabaseAdmin
        .from('piglet_batches')
        .update(patch)
        .eq('batch_id', id)
        .select();
      if (error) throw error;
      await supabaseAdmin.from('activity_logs').insert({
        user_name: creatorName,
        user_email: creatorEmail,
        user_initials: creatorInitials,
        user_bg_color: 'bg-emerald-100 text-emerald-700',
        event_title: 'Batch Updated',
        event_desc: `Updated piglet batch ${existingBatch.batch_tag || tagNumber}.`,
        status: 'SUCCESS'
      }).then(() => {}).catch(() => {});
      return { message: 'Piglet batch updated successfully', data: data[0] };
    }

    const { data: existingPig } = await supabaseAdmin
      .from('pigs')
      .select('pig_id, pig_tag, is_archived')
      .eq('pig_id', id)
      .maybeSingle();
    if (!existingPig) {
      throw createHttpError(404, 'Pig not found.');
    }
    if (existingPig.is_archived) {
      throw createHttpError(400, 'Cannot modify details of an archived swine record.');
    }
    const patch = {};
    if (status) patch.status = String(status).toLowerCase();
    if (weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight))) {
      patch.weight = parseFloat(weight);
    }
    const { data, error } = await supabaseAdmin
      .from('pigs')
      .update(patch)
      .eq('pig_id', id)
      .select();
    if (error) throw error;
    await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: creatorEmail,
      user_initials: creatorInitials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Swine Record Updated',
      event_desc: `Updated swine record for tag ${existingPig.pig_tag || tagNumber}.`,
      status: 'SUCCESS'
    }).then(() => {}).catch(() => {});
    return { message: 'Pig updated successfully', data: data[0] };
  }

  if (!tagNumber || !breed || !penId) {
    throw createHttpError(400, 'Tag number, breed, and pen are required.');
  }

  let existingBatchRecord = null;
  if (checkIsBatch) {
    const { data: existingBatch } = await supabaseAdmin
      .from('piglet_batches')
      .select('is_archived, total_born_alive, current_count')
      .eq('batch_id', id)
      .maybeSingle();
    if (existingBatch && existingBatch.is_archived) {
      throw createHttpError(400, 'Cannot modify details of an archived piglet batch.');
    }
    existingBatchRecord = existingBatch;
  } else {
    const { data: existingPig } = await supabaseAdmin
      .from('pigs')
      .select('is_archived')
      .eq('pig_id', id)
      .maybeSingle();
    if (existingPig && existingPig.is_archived) {
      throw createHttpError(400, 'Cannot modify details of an archived swine record.');
    }
  }

  const finalBreedId = await resolveBreedId(breed, supabaseAdmin);

  if (checkIsBatch) {
    const updatePayload = {
      batch_tag: tagNumber,
      date_of_birth: dateOfBirth || null,
      breed_id: finalBreedId,
      pen_id: penId,
      status: (status || 'suckling').toLowerCase(),
    };
    if (sourceOrigin || source_origin) updatePayload.source_origin = sourceOrigin || source_origin;
    if (supplierName || supplier_name) updatePayload.supplier_name = supplierName || supplier_name;
    if (arrivalDate || arrival_date) updatePayload.arrival_date = arrivalDate || arrival_date;
    if (weight !== undefined && weight !== null && weight !== '') {
      updatePayload.average_weight = parseFloat(weight);
    }
    if (body.currentCount !== undefined && body.currentCount !== null && body.currentCount !== '') {
      const newCurrent = Math.max(0, parseInt(body.currentCount) || 0);
      updatePayload.current_count = newCurrent;
      if (newCurrent === 0) {
        updatePayload.is_archived = true;
        updatePayload.archived_at = new Date().toISOString();
        updatePayload.archive_reasoning = 'Mortality - Total Batch Loss';
      }
    } else if (totalBornAlive !== undefined && totalBornAlive !== null && totalBornAlive !== '') {
      const newBornAlive = parseInt(totalBornAlive) || 0;
      updatePayload.total_born_alive = newBornAlive;
      const prevBornAlive = Number(existingBatchRecord?.total_born_alive ?? newBornAlive);
      const prevCurrent = Number(existingBatchRecord?.current_count ?? prevBornAlive);
      const recordedLosses = Math.max(0, prevBornAlive - prevCurrent);
      updatePayload.current_count = Math.max(0, newBornAlive - recordedLosses);
    }
    if (stillbornCount !== undefined && stillbornCount !== null && stillbornCount !== '') {
      updatePayload.stillborn_count = parseInt(stillbornCount) || 0;
    }
    if (mummyCount !== undefined && mummyCount !== null && mummyCount !== '') {
      updatePayload.mummy_count = parseInt(mummyCount) || 0;
    }

    const { data, error } = await supabaseAdmin
      .from('piglet_batches')
      .update(updatePayload)
      .eq('batch_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw createHttpError(404, 'Piglet batch not found.');
    }

    const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: creatorEmail,
      user_initials: creatorInitials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Batch Updated',
      event_desc: `Updated piglet batch ${tagNumber}.`,
      status: 'SUCCESS'
    });
    if (logError) console.error("Error inserting activity log:", logError);

    return { message: 'Piglet batch updated successfully', data: data[0] };
  }

  const { data: currentPig, error: currentPigError } = await supabaseAdmin
    .from('pigs')
    .select('pen_id, gender, status')
    .eq('pig_id', id)
    .maybeSingle();

  if (currentPigError) throw currentPigError;

  if (currentPig && String(currentPig.pen_id) !== String(penId)) {
    const { data: pen, error: penError } = await supabaseAdmin
      .from('pens')
      .select('pen_code, pen_type, max_capacity')
      .eq('pen_id', penId)
      .single();

    if (penError || !pen) {
      throw createHttpError(400, 'Selected pen not found or invalid.');
    }

    const occ = await getPenOccupancy(penId);
    const occupied = typeof occ === 'number' ? occ : occ.total;
    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');

    const pigGender = gender || currentPig?.gender || (category === 'Sow' ? 'Female' : category === 'Boar' ? 'Male' : '');
    const isSow = (pigGender || '').toLowerCase().startsWith('f') || currentPig?.status?.toLowerCase() === 'sow';
    const isBoar = (pigGender || '').toLowerCase().startsWith('m') || currentPig?.status?.toLowerCase() === 'boar';

    if (isSow && (penSection === 'B' || penSection === 'BOAR')) {
      throw createHttpError(400, `Cannot assign a female sow to boar pen ${pen.pen_code}.`);
    }
    if (isBoar && penSection !== 'B' && penSection !== 'BOAR') {
      throw createHttpError(400, `Cannot assign a male boar to ${pen.pen_code}. Boars must be housed alone in a Boar pen.`);
    }
    const currentStatus = body.status?.toLowerCase() || currentPig?.status?.toLowerCase() || '';
    const isSickOrQ = currentStatus === 'sick' || currentStatus === 'quarantine';
    const isQPen = penSection === 'Q' || penSection === 'QUARANTINE';
    if (!isSickOrQ && isQPen) {
      throw createHttpError(400, `Cannot assign a ${currentStatus || 'Healthy'} pig to Quarantine pen ${pen.pen_code}. Quarantine pens are reserved for sick or quarantined pigs.`);
    }
    if (isSickOrQ && !isQPen) {
      throw createHttpError(400, `Cannot assign a ${currentStatus} pig to ${pen.pen_code}. Sick or quarantined pigs must be placed in a Quarantine housing unit.`);
    }
    if (isSow && !isQPen && penSection !== 'S' && penSection !== 'SOW') {
      throw createHttpError(400, `Cannot assign a female sow to ${pen.pen_code}. Sows must be housed in Sow/Farrowing pens.`);
    }
    if ((penSection === 'S' || penSection === 'SOW') && (occ.sowCount >= 1 || occ.pigCount >= 1)) {
      throw createHttpError(400, `Sow pen ${pen.pen_code} already houses 1 sow. The farm can only house 1 sow per sow pen.`);
    }
    if ((penSection === 'B' || penSection === 'BOAR') && (occ.boarCount >= 1 || occ.pigCount >= 1)) {
      throw createHttpError(400, `Boar pen ${pen.pen_code} already houses 1 boar. The farm can only house 1 boar per boar pen.`);
    }
    if (occupied >= (pen.max_capacity ?? 0)) {
      throw createHttpError(400, `Pen ${pen.pen_code} is already at full capacity (${pen.max_capacity}). Please choose another pen.`);
    }
  }

  const updatePayload = {
    pig_tag: tagNumber,
    date_of_birth: dateOfBirth || null,
    breed_id: finalBreedId,
    weight: (weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight))) ? parseFloat(weight) : null,
    pen_id: penId,
    status: (status || '').toLowerCase(),
  };
  if (gender) updatePayload.gender = gender;
  if (sourceOrigin || source_origin) updatePayload.source_origin = sourceOrigin || source_origin;
  if (supplierName || supplier_name) updatePayload.supplier_name = supplierName || supplier_name;
  if (arrivalDate || arrival_date) updatePayload.arrival_date = arrivalDate || arrival_date;

  if (parityCount !== undefined && parityCount !== '' && !Number.isNaN(Number(parityCount))) {
    updatePayload.parity_count = Number(parityCount);
  }

  const { data, error } = await supabaseAdmin
    .from('pigs')
    .update(updatePayload)
    .eq('pig_id', id)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw createHttpError(404, 'Pig not found.');
  }

  const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
    user_name: creatorName,
    user_email: creatorEmail,
    user_initials: creatorInitials,
    user_bg_color: 'bg-emerald-100 text-emerald-700',
    event_title: 'Swine Record Updated',
    event_desc: `Updated swine record for tag ${tagNumber}.`,
    status: 'SUCCESS'
  });
  if (logError) console.error("Error inserting activity log:", logError);

  return { message: 'Pig updated successfully', data: data[0] };
}

// PUT /api/pigs/:id - Update pig details or piglet batch
router.put('/api/pigs/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.isAdmin) {
      const result = await executeUpdatePig(id, {
        ...req.body,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const checkIsBatch = req.body.category === 'Piglet Batch' || req.body.isBatch === true;

    if (checkIsBatch) {
      const { data: existingBatch, error: bErr } = await supabaseAdmin
        .from('piglet_batches')
        .select('*, breeds(name), pens(pen_code)')
        .eq('batch_id', id)
        .maybeSingle();

      if (bErr) throw bErr;
      if (!existingBatch) {
        return res.status(404).json({ error: 'Piglet batch not found.' });
      }
      if (existingBatch.is_archived) {
        return res.status(400).json({ error: 'Cannot modify details of an archived piglet batch.' });
      }

      const prevWeight = existingBatch.average_weight !== null && existingBatch.average_weight !== undefined
        ? Number(existingBatch.average_weight)
        : null;
      const rawWeight = req.body.averageWeight ?? req.body.weight;
      const nextWeight = (rawWeight !== undefined && rawWeight !== null && rawWeight !== '' && !isNaN(parseFloat(rawWeight)))
        ? parseFloat(rawWeight)
        : prevWeight;

      const prevStatus = String(existingBatch.status || 'suckling').toLowerCase();
      const nextStatus = req.body.status ? String(req.body.status).trim().toLowerCase() : prevStatus;

      const weightChanged = prevWeight !== nextWeight;
      const statusChanged = prevStatus !== nextStatus;
      if (!weightChanged && !statusChanged) {
        return res.status(400).json({
          error: 'No weight or status changes were detected. Staff can only propose weight and status updates.'
        });
      }

      const changeParts = [];
      if (weightChanged) changeParts.push(`avg weight ${prevWeight ?? 'unset'} kg to ${nextWeight ?? 'unset'} kg`);
      if (statusChanged) changeParts.push(`status ${prevStatus} to ${nextStatus}`);

      const sanitizedPayload = {
        tagNumber: existingBatch.batch_tag,
        batchTag: existingBatch.batch_tag,
        dateOfBirth: existingBatch.date_of_birth || null,
        breed: existingBatch.breeds?.name || existingBatch.breed_id || req.body.breed || '',
        penId: existingBatch.pen_id,
        penCode: existingBatch.pens?.pen_code || '',
        sowId: existingBatch.sow_id || null,
        weight: nextWeight,
        averageWeight: nextWeight,
        status: nextStatus,
        totalBornAlive: existingBatch.total_born_alive,
        currentCount: existingBatch.current_count,
        stillbornCount: existingBatch.stillborn_count,
        mummyCount: existingBatch.mummy_count,
        sourceOrigin: existingBatch.source_origin || 'born_in_farm',
        supplierName: existingBatch.supplier_name || null,
        arrivalDate: existingBatch.arrival_date || null,
        category: 'Piglet Batch',
        isBatch: true,
        viaUnifiedUpdate: true,
        staffRestrictedUpdate: true,
      };

      const approvalRequest = await queueApprovalRequest({
        req,
        module: 'swine',
        action: 'update_batch',
        actionLabel: 'Update Piglet Batch',
        summary: `Update batch ${existingBatch.batch_tag}: ${changeParts.join(', ')}`,
        targetId: id,
        payload: sanitizedPayload,
        beforeSnapshot: {
          tag: existingBatch.batch_tag,
          penCode: existingBatch.pens?.pen_code || '',
          weight: prevWeight,
          status: prevStatus,
        },
      });

      return res.status(202).json({
        pendingApproval: true,
        approvalRequest,
        message: 'Batch update submitted for administrator approval.',
      });
    }

    const { data: existingPig, error: pErr } = await supabaseAdmin
      .from('pigs')
      .select('*, breeds(name), pens(pen_code)')
      .eq('pig_id', id)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!existingPig) {
      return res.status(404).json({ error: 'Pig not found.' });
    }
    if (existingPig.is_archived) {
      return res.status(400).json({ error: 'Cannot modify details of an archived swine record.' });
    }

    const prevWeight = existingPig.weight !== null && existingPig.weight !== undefined
      ? Number(existingPig.weight)
      : null;
    const rawWeight = req.body.weight;
    const nextWeight = (rawWeight !== undefined && rawWeight !== null && rawWeight !== '' && !isNaN(parseFloat(rawWeight)))
      ? parseFloat(rawWeight)
      : prevWeight;

    const prevStatus = String(existingPig.status || 'healthy').toLowerCase();
    const nextStatus = req.body.status ? String(req.body.status).trim().toLowerCase() : prevStatus;

    const weightChanged = prevWeight !== nextWeight;
    const statusChanged = prevStatus !== nextStatus;
    if (!weightChanged && !statusChanged) {
      return res.status(400).json({
        error: 'No weight or status changes were detected. Staff can only propose weight and status updates.'
      });
    }

    const changeParts = [];
    if (weightChanged) changeParts.push(`weight ${prevWeight ?? 'unset'} kg to ${nextWeight ?? 'unset'} kg`);
    if (statusChanged) changeParts.push(`status ${prevStatus} to ${nextStatus}`);

    const sanitizedPayload = {
      tagNumber: existingPig.pig_tag,
      dateOfBirth: existingPig.date_of_birth || null,
      breed: existingPig.breeds?.name || existingPig.breed_id || req.body.breed || '',
      penId: existingPig.pen_id,
      penCode: existingPig.pens?.pen_code || '',
      gender: existingPig.gender,
      parityCount: existingPig.parity_count,
      weight: nextWeight,
      status: nextStatus,
      sourceOrigin: existingPig.source_origin || 'born_in_farm',
      supplierName: existingPig.supplier_name || null,
      arrivalDate: existingPig.arrival_date || null,
      category: (existingPig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      isBatch: false,
      staffRestrictedUpdate: true,
    };

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'swine',
      action: 'update_pig',
      actionLabel: 'Update Swine Record',
      summary: `Update swine #${existingPig.pig_tag}: ${changeParts.join(', ')}`,
      targetId: id,
      payload: sanitizedPayload,
      beforeSnapshot: {
        tag: existingPig.pig_tag,
        penCode: existingPig.pens?.pen_code || '',
        weight: prevWeight,
        status: prevStatus,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Swine update submitted for administrator approval.',
    });
  } catch (error) {
    console.error('Error updating pig:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /api/pigs/:id/archive – soft-archive a pig or piglet batch
router.patch('/api/pigs/:id/archive', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { creator, archive_reasoning } = req.body;
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator || 'Admin');

    const updatePayload = { is_archived: true, archived_at: new Date().toISOString() };
    if (archive_reasoning !== undefined) {
      updatePayload.archive_reasoning = archive_reasoning;
    }

    // Try pigs table first
    const { data: pigData, error: pigError } = await supabaseAdmin
      .from('pigs')
      .update(updatePayload)
      .eq('pig_id', id)
      .select();

    if (pigError) throw pigError;

    if (pigData && pigData.length > 0) {
      const tag = pigData[0].pig_tag || id;
      await supabaseAdmin.from('activity_logs').insert({
        user_name: creatorName,
        user_email: creatorEmail,
        user_initials: creatorInitials,
        user_bg_color: 'bg-rose-100 text-rose-700',
        event_title: 'Swine Record Archived',
        event_desc: archive_reasoning ? `Archived swine record with tag ${tag}. Reason: ${archive_reasoning}` : `Archived swine record with tag ${tag}.`,
        status: 'SUCCESS'
      });
      return res.json({ message: 'Pig archived successfully', data: pigData });
    }

    // Fallback to piglet_batches
    const { data: batchData, error: batchError } = await supabaseAdmin
      .from('piglet_batches')
      .update(updatePayload)
      .eq('batch_id', id)
      .select();

    if (batchError) throw batchError;

    if (!batchData || batchData.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const tag = batchData[0].batch_tag || id;
    await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: creatorEmail,
      user_initials: creatorInitials,
      user_bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Batch Archived',
      event_desc: archive_reasoning ? `Archived piglet batch with tag ${tag}. Reason: ${archive_reasoning}` : `Archived piglet batch with tag ${tag}.`,
      status: 'SUCCESS'
    });

    return res.json({ message: 'Piglet batch archived successfully', data: batchData });
  } catch (error) {
    console.error('Error archiving record:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pigs/batch/:batchId/promote - Promote 1 pig from batch to breeding herd (Gilt/Boar)
router.post('/api/pigs/batch/:batchId/promote', verifyAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { tagNumber, gender, penId, weight, dateOfBirth, creator } = req.body;

    if (!tagNumber || !tagNumber.trim()) {
      return res.status(400).json({ error: 'Pig tag number is required.' });
    }
    if (!gender || !['Female', 'Male'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be either "Female" or "Male".' });
    }
    if (!penId) {
      return res.status(400).json({ error: 'Target pen is required.' });
    }

    // 1. Fetch batch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('piglet_batches')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return res.status(404).json({ error: 'Piglet batch not found.' });
    }
    if (batch.is_archived) {
      return res.status(400).json({ error: 'Cannot promote pigs from an archived batch.' });
    }
    if ((batch.current_count ?? 0) < 1) {
      return res.status(400).json({ error: 'Batch has no remaining pigs to promote.' });
    }

    // 2. Check tag uniqueness in pigs table
    const cleanTag = tagNumber.trim();
    const { data: existingPig, error: tagCheckError } = await supabaseAdmin
      .from('pigs')
      .select('pig_id')
      .ilike('pig_tag', cleanTag)
      .maybeSingle();

    if (tagCheckError) throw tagCheckError;
    if (existingPig) {
      return res.status(400).json({ error: `Tag "${cleanTag}" is already in use by another swine record.` });
    }

    // 3. Confirm target pen validation & occupancy
    const { data: pen, error: penError } = await supabase
      .from('pens')
      .select('pen_code, pen_type, max_capacity')
      .eq('pen_id', penId)
      .single();

    if (penError || !pen) {
      return res.status(400).json({ error: 'Selected pen was not found.' });
    }

    const occ = await getPenOccupancy(penId);
    let occupied = typeof occ === 'number' ? occ : (occ.total || 0);

    // If target pen is the batch's current pen, 1 head leaves the batch and enters as a pig,
    // so net occupancy remains unchanged. Subtract 1 to reflect this transition.
    if (batch.pen_id && String(batch.pen_id) === String(penId)) {
      occupied = Math.max(0, occupied - 1);
    }

    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');

    if (gender === 'Female' && (penSection === 'B' || penSection === 'BOAR')) {
      return res.status(400).json({ error: `Cannot assign a female sow/gilt to boar pen ${pen.pen_code}.` });
    }
    if (gender === 'Male' && penSection !== 'B' && penSection !== 'BOAR') {
      return res.status(400).json({ error: `Cannot assign a male boar to ${pen.pen_code}. Boars must be housed alone in a Boar pen.` });
    }
    if (gender === 'Female' && penSection !== 'S' && penSection !== 'SOW') {
      return res.status(400).json({ error: `Cannot assign a female sow/gilt to ${pen.pen_code}. Sows must be housed in Sow/Farrowing pens.` });
    }
    if ((penSection === 'S' || penSection === 'SOW') && (occ.hasSow || occ.sowCount >= 1 || occ.pigCount >= 1)) {
      return res.status(400).json({
        error: `Sow pen ${pen.pen_code} already houses 1 sow. The farm can only house 1 sow per sow pen.`,
      });
    }
    if ((penSection === 'B' || penSection === 'BOAR') && (occ.hasBoar || occ.boarCount >= 1 || occ.pigCount >= 1)) {
      return res.status(400).json({
        error: `Boar pen ${pen.pen_code} already houses 1 boar. The farm can only house 1 boar per boar pen.`,
      });
    }
    if (occupied >= (pen.max_capacity ?? 0)) {
      return res.status(400).json({
        error: `Pen ${pen.pen_code} is already at full capacity (${pen.max_capacity}). Please choose another pen.`,
      });
    }

    // 4. Insert new pig record
    const parsedWeight = (weight !== undefined && weight !== null && weight !== '' && !isNaN(parseFloat(weight)))
      ? parseFloat(weight)
      : (batch.average_weight || null);
    const resolvedDob = dateOfBirth || batch.date_of_birth || null;

    const { data: newPigData, error: pigInsertError } = await supabaseAdmin
      .from('pigs')
      .insert([{
        pig_tag: cleanTag,
        gender: gender,
        date_of_birth: resolvedDob,
        breed_id: batch.breed_id || null,
        weight: parsedWeight,
        pen_id: penId,
        status: 'healthy',
        parity_count: 0,
        source_origin: batch.source_origin || 'born_in_farm',
        supplier_name: batch.supplier_name || null,
        arrival_date: batch.arrival_date || null,
        source_batch_id: batch.batch_id,
        source_batch_tag: batch.batch_tag,
        dam_id: batch.sow_id || null,
        promoted_at: new Date().toISOString(),
        is_archived: false,
      }])
      .select();

    if (pigInsertError) throw pigInsertError;
    const createdPig = newPigData[0];

    // 5. Deduct 1 head from batch and auto-archive if 0 left
    const newCount = (batch.current_count || 1) - 1;
    const batchUpdatePayload = {
      current_count: newCount,
    };
    if (newCount === 0) {
      batchUpdatePayload.is_archived = true;
      batchUpdatePayload.archived_at = new Date().toISOString();
      batchUpdatePayload.archive_reasoning = `Promoted to Breeder - ${cleanTag}`;
    }

    const { error: batchUpdateError } = await supabaseAdmin
      .from('piglet_batches')
      .update(batchUpdatePayload)
      .eq('batch_id', batchId);

    if (batchUpdateError) {
      // Rollback pig insert
      await supabaseAdmin.from('pigs').delete().eq('pig_id', createdPig.pig_id);
      throw batchUpdateError;
    }

    // 6. Record activity log
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator || 'Admin');
    const roleTerm = gender === 'Female' ? 'gilt' : 'boar';
    const logDesc = `Promoted 1 pig from batch ${batch.batch_tag || batchId} to ${roleTerm} ${cleanTag}.${newCount === 0 ? ' Batch archived (0 heads left).' : ` ${newCount} head(s) remain.`}`;

    await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: creatorEmail,
      user_initials: creatorInitials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Promoted to Breeder',
      event_desc: logDesc,
      status: 'SUCCESS'
    });

    res.json({
      message: `Successfully promoted 1 pig to ${roleTerm} ${cleanTag}.`,
      pig: createdPig,
      batch_remaining: newCount,
      batch_archived: newCount === 0,
    });
  } catch (error) {
    console.error('Error promoting pig from batch:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/pigs/:id/unarchive – unarchive a pig or piglet batch
router.patch('/api/pigs/:id/unarchive', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { creator } = req.body;
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator || 'Admin');

    const updatePayload = { is_archived: false, archived_at: null, archive_reasoning: null };

    // 1. Check if it's a single pig
    const { data: pigCheck } = await supabaseAdmin
      .from('pigs')
      .select('pig_id, pig_tag, pen_id')
      .eq('pig_id', id)
      .maybeSingle();

    if (pigCheck) {
      if (pigCheck.pen_id) {
        const { data: pen } = await supabaseAdmin.from('pens').select('pen_code, max_capacity, pen_type').eq('pen_id', pigCheck.pen_id).single();
        if (pen) {
          const occ = await getPenOccupancy(pigCheck.pen_id);
          const occupied = occ.total || 0;

          const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');

          if ((penSection === 'S' || penSection === 'SOW') && (occ.hasSow || occ.sowCount >= 1 || occ.pigCount >= 1)) {
            return res.status(400).json({ error: `Cannot restore: Sow pen ${pen.pen_code} already houses 1 sow. The farm can only house 1 sow per sow pen.` });
          }

          if ((penSection === 'B' || penSection === 'BOAR') && (occ.hasBoar || occ.boarCount >= 1 || occ.pigCount >= 1)) {
            return res.status(400).json({ error: `Cannot restore: Boar pen ${pen.pen_code} already houses 1 boar. The farm can only house 1 boar per boar pen.` });
          }

          if (occupied >= (pen.max_capacity ?? 0)) {
            return res.status(400).json({ error: `Cannot restore: Pen ${pen.pen_code} is at full capacity (${pen.max_capacity}). Please free up space in this pen first.` });
          }
        }
      }

      const { data: pigData, error: pigError } = await supabaseAdmin
        .from('pigs')
        .update(updatePayload)
        .eq('pig_id', id)
        .select();

      if (pigError) throw pigError;

      const tag = pigData[0].pig_tag || id;
      await supabaseAdmin.from('activity_logs').insert({
        user_name: creatorName,
        user_email: creatorEmail,
        user_initials: creatorInitials,
        user_bg_color: 'bg-emerald-100 text-emerald-700',
        event_title: 'Swine Record Restored',
        event_desc: `Restored swine record with tag ${tag} to active circulation.`,
        status: 'SUCCESS'
      });
      return res.json({ message: 'Pig unarchived successfully', data: pigData[0] });
    }

    // 2. Fallback to piglet_batches
    const { data: batchCheck } = await supabaseAdmin
      .from('piglet_batches')
      .select('batch_id, batch_tag, pen_id, current_count, total_born_alive, archive_reasoning')
      .eq('batch_id', id)
      .maybeSingle();

    if (!batchCheck) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    if (batchCheck.archive_reasoning && batchCheck.archive_reasoning.toLowerCase().includes('promot')) {
      return res.status(400).json({
        error: 'Cannot restore this batch: its piglet was promoted to the breeding herd and is now an active sow/boar. Restoring would create duplicate records.'
      });
    }

    if (batchCheck.pen_id) {
      const { data: pen } = await supabaseAdmin.from('pens').select('pen_code, max_capacity').eq('pen_id', batchCheck.pen_id).single();
      if (pen) {
        const occ = await getPenOccupancy(batchCheck.pen_id);
        const occupied = occ.total || 0;
        const incomingCount = (batchCheck.current_count && batchCheck.current_count > 0) ? batchCheck.current_count : (batchCheck.total_born_alive || 1);
        if (occupied + incomingCount > (pen.max_capacity ?? 0)) {
          return res.status(400).json({ error: `Cannot restore: Pen ${pen.pen_code} only has ${(pen.max_capacity ?? 0) - occupied} slot(s) available, but this batch has ${incomingCount} piglets.` });
        }
      }
    }

    const batchUpdatePayload = { ...updatePayload };
    if (!batchCheck.current_count || batchCheck.current_count <= 0) {
      batchUpdatePayload.current_count = batchCheck.total_born_alive > 0 ? batchCheck.total_born_alive : 1;
    }

    const { data: batchData, error: batchError } = await supabaseAdmin
      .from('piglet_batches')
      .update(batchUpdatePayload)
      .eq('batch_id', id)
      .select();

    if (batchError) throw batchError;

    const tag = batchData[0].batch_tag || id;
    await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: creatorEmail,
      user_initials: creatorInitials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Batch Restored',
      event_desc: `Restored piglet batch with tag ${tag} to active circulation.`,
      status: 'SUCCESS'
    });

    return res.json({ message: 'Piglet batch unarchived successfully', data: batchData[0] });
  } catch (error) {
    console.error('Error unarchiving record:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export async function executeUpdateBatch(id, body = {}) {
  if (body.viaUnifiedUpdate || body.staffRestrictedUpdate) {
    return executeUpdatePig(id, { ...body, isBatch: true, category: 'Piglet Batch' });
  }

  const {
    batchTag, tagNumber, dateOfBirth, breed, averageWeight, weight,
    penId, sowId, status, creator,
    totalBornAlive, stillbornCount, mummyCount,
    sourceOrigin, source_origin, supplierName, supplier_name, arrivalDate, arrival_date
  } = body;

  const resolvedTag = batchTag || tagNumber;
  const resolvedWeight = averageWeight ?? weight;
  const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

  if (!resolvedTag || !breed || !penId) {
    throw createHttpError(400, 'Batch tag, breed, and pen are required.');
  }

  const { data: existingBatch } = await supabaseAdmin
    .from('piglet_batches')
    .select('is_archived, current_count, pen_id')
    .eq('batch_id', id)
    .maybeSingle();
  if (existingBatch && existingBatch.is_archived) {
    throw createHttpError(400, 'Cannot modify details of an archived piglet batch.');
  }

  if (penId) {
    const { data: pen, error: penError } = await supabase
      .from('pens')
      .select('pen_code, max_capacity, pen_type')
      .eq('pen_id', penId)
      .single();
    if (penError || !pen) throw createHttpError(400, 'Selected pen not found.');

    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : pen.pen_code && pen.pen_code.toUpperCase().startsWith('B') ? 'B' : '');
    if (penSection === 'B' || penSection === 'BOAR') {
      throw createHttpError(400, `Piglet batches cannot be assigned to Boar pen ${pen.pen_code}.`);
    }

    const occupied = await getPenOccupancy(penId);
    const currentOccupied = typeof occupied === 'number' ? occupied : occupied.total;
    const maxCap = pen.max_capacity ?? 20;

    const isSamePen = existingBatch && String(existingBatch.pen_id) === String(penId);
    const currentBatchCountInPen = isSamePen ? (existingBatch.current_count || 0) : 0;
    const effectiveOccupied = currentOccupied - currentBatchCountInPen;
    const remaining = Math.max(0, maxCap - effectiveOccupied);

    const incomingCount = parseInt(body.currentCount ?? body.totalBornAlive) || (existingBatch ? existingBatch.current_count : 0);
    if (incomingCount > remaining) {
      throw createHttpError(
        400,
        `Pen ${pen.pen_code} only has ${remaining} slot(s) left (capacity ${maxCap}), but this batch has ${incomingCount} piglet(s).`
      );
    }

    const statusStr = (status || '').toLowerCase();
    let ageInDays = null;
    if (dateOfBirth) {
      ageInDays = Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24));
    }
    const isBatchWeaned = statusStr === 'weaned' || (statusStr !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isBatchNursing = statusStr === 'suckling' || (statusStr !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    if (sowId && penId && isBatchNursing) {
      const { data: motherSow } = await supabase.from('pigs').select('pen_id, pig_tag').eq('pig_id', sowId).single();
      if (motherSow && motherSow.pen_id && String(motherSow.pen_id) !== String(penId)) {
        throw createHttpError(
          400,
          `Piglet batch is linked to Mother Sow #${motherSow.pig_tag}, but assigned to a different pen (${pen.pen_code}). Nursing piglet batches must be placed in their Mother Sow's pen.`
        );
      }
    }

    if (dateOfBirth) {
      if (ageInDays <= 28 && statusStr === 'weaned') {
        throw createHttpError(400, `Too young for Weaned (${ageInDays}d old). Keep as Suckling until day 29.`);
      }
      if (ageInDays > 28 && statusStr === 'suckling') {
        throw createHttpError(400, `Batch is ${ageInDays}d old (> 28 days). Mark as Weaned.`);
      }

      if (isBatchNursing && penSection !== 'S' && penSection !== 'SOW') {
        throw createHttpError(400, `Nursing piglet batches (<=28 days old) must be assigned to a Sow/Farrowing pen (${pen.pen_code} is ${penSection}).`);
      }
      if (isBatchWeaned && penSection !== 'W' && penSection !== 'WEANED') {
        throw createHttpError(400, `Weaned piglet batches (>28 days old) must be assigned to a Weaned/Fattening pen (${pen.pen_code} is ${penSection}).`);
      }
    }
  }

  const finalBreedId = await resolveBreedId(breed, supabaseAdmin);

  const updatePayload = {
    batch_tag: resolvedTag.trim(),
    date_of_birth: dateOfBirth || null,
    breed_id: finalBreedId,
    pen_id: penId,
    status: (status || 'suckling').toLowerCase(),
  };
  if (sourceOrigin || source_origin) updatePayload.source_origin = sourceOrigin || source_origin;
  if (supplierName || supplier_name) updatePayload.supplier_name = supplierName || supplier_name;
  if (arrivalDate || arrival_date) updatePayload.arrival_date = arrivalDate || arrival_date;
  if (sowId !== undefined) updatePayload.sow_id = sowId || null;
  if (resolvedWeight !== undefined && resolvedWeight !== null && resolvedWeight !== '') {
    updatePayload.average_weight = parseFloat(resolvedWeight);
  }
  if (body.currentCount !== undefined && body.currentCount !== null && body.currentCount !== '') {
    const newCurrent = Math.max(0, parseInt(body.currentCount) || 0);
    updatePayload.current_count = newCurrent;
    if (newCurrent === 0) {
      updatePayload.is_archived = true;
      updatePayload.archived_at = new Date().toISOString();
      updatePayload.archive_reasoning = 'Mortality - Total Batch Loss';
    }
  } else if (totalBornAlive !== undefined && totalBornAlive !== null && totalBornAlive !== '') {
    updatePayload.total_born_alive = parseInt(totalBornAlive) || 0;
  }
  if (stillbornCount !== undefined && stillbornCount !== null && stillbornCount !== '') {
    updatePayload.stillborn_count = parseInt(stillbornCount) || 0;
  }
  if (mummyCount !== undefined && mummyCount !== null && mummyCount !== '') {
    updatePayload.mummy_count = parseInt(mummyCount) || 0;
  }

  const { data, error } = await supabaseAdmin
    .from('piglet_batches')
    .update(updatePayload)
    .eq('batch_id', id)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw createHttpError(404, 'Piglet batch not found.');
  }

  const { error: logError } = await supabaseAdmin.from('activity_logs').insert({
    user_name: creatorName,
    user_email: creatorEmail,
    user_initials: creatorInitials,
    user_bg_color: 'bg-emerald-100 text-emerald-700',
    event_title: 'Batch Updated',
    event_desc: `Updated piglet batch ${resolvedTag}.`,
    status: 'SUCCESS'
  });
  if (logError) console.error("Error inserting activity log:", logError);

  return { message: 'Piglet batch updated successfully', data };
}

// PUT /api/pigs/batch/:id - Dedicated update endpoint for piglet batches
router.put('/api/pigs/batch/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.isAdmin) {
      const result = await executeUpdateBatch(id, {
        ...req.body,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const { data: existingBatch, error: bErr } = await supabaseAdmin
      .from('piglet_batches')
      .select('*, breeds(name), pens(pen_code)')
      .eq('batch_id', id)
      .maybeSingle();

    if (bErr) throw bErr;
    if (!existingBatch) {
      return res.status(404).json({ error: 'Piglet batch not found.' });
    }
    if (existingBatch.is_archived) {
      return res.status(400).json({ error: 'Cannot modify details of an archived piglet batch.' });
    }

    const prevWeight = existingBatch.average_weight !== null && existingBatch.average_weight !== undefined
      ? Number(existingBatch.average_weight)
      : null;
    const rawWeight = req.body.averageWeight ?? req.body.weight;
    const nextWeight = (rawWeight !== undefined && rawWeight !== null && rawWeight !== '' && !isNaN(parseFloat(rawWeight)))
      ? parseFloat(rawWeight)
      : prevWeight;

    const prevStatus = String(existingBatch.status || 'suckling').toLowerCase();
    const nextStatus = req.body.status ? String(req.body.status).trim().toLowerCase() : prevStatus;

    const weightChanged = prevWeight !== nextWeight;
    const statusChanged = prevStatus !== nextStatus;
    if (!weightChanged && !statusChanged) {
      return res.status(400).json({
        error: 'No weight or status changes were detected. Staff can only propose weight and status updates.'
      });
    }

    const changeParts = [];
    if (weightChanged) changeParts.push(`avg weight ${prevWeight ?? 'unset'} kg to ${nextWeight ?? 'unset'} kg`);
    if (statusChanged) changeParts.push(`status ${prevStatus} to ${nextStatus}`);

    const sanitizedPayload = {
      batchTag: existingBatch.batch_tag,
      tagNumber: existingBatch.batch_tag,
      dateOfBirth: existingBatch.date_of_birth || null,
      breed: existingBatch.breeds?.name || existingBatch.breed_id || req.body.breed || '',
      penId: existingBatch.pen_id,
      penCode: existingBatch.pens?.pen_code || '',
      sowId: existingBatch.sow_id || null,
      weight: nextWeight,
      averageWeight: nextWeight,
      status: nextStatus,
      totalBornAlive: existingBatch.total_born_alive,
      currentCount: existingBatch.current_count,
      stillbornCount: existingBatch.stillborn_count,
      mummyCount: existingBatch.mummy_count,
      sourceOrigin: existingBatch.source_origin || 'born_in_farm',
      supplierName: existingBatch.supplier_name || null,
      arrivalDate: existingBatch.arrival_date || null,
      category: 'Piglet Batch',
      isBatch: true,
      staffRestrictedUpdate: true,
    };

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'swine',
      action: 'update_batch',
      actionLabel: 'Update Piglet Batch',
      summary: `Update batch ${existingBatch.batch_tag}: ${changeParts.join(', ')}`,
      targetId: id,
      payload: sanitizedPayload,
      beforeSnapshot: {
        tag: existingBatch.batch_tag,
        penCode: existingBatch.pens?.pen_code || '',
        weight: prevWeight,
        status: prevStatus,
      },
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Batch update submitted for administrator approval.',
    });
  } catch (error) {
    console.error('Error updating batch:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
