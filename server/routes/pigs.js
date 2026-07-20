import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { getPenOccupancy } from '../helpers/occupancy.js';

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

const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Inactive'];

// GET /api/sows — lightweight list of active sows for the sow_id dropdown
router.get('/api/sows', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pigs')
      .select('pig_id, pig_tag, breeds(name)')
      .eq('gender', 'Female')
      .eq('is_archived', false)
      .order('pig_tag', { ascending: true });
    if (error) throw error;
    const sows = (data || []).map(p => ({
      id: p.pig_id,
      tag: p.pig_tag,
      breed: p.breeds?.name || '—',
    }));
    res.json({ data: sows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs/breeding-logs – fetch live pregnant sows for Breeding Logs module
router.get('/api/pigs/breeding-logs', async (req, res) => {
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

// GET /api/pigs/stats – aggregate counts for summary cards
router.get('/api/pigs/stats', async (req, res) => {
  try {
    const [pigsRes, sickRes, quarRes, batchesRes] = await Promise.all([
      supabase.from('pigs').select('*').eq('is_archived', false),
      supabase.from('pigs').select('*', { count: 'exact' }).eq('status', 'sick').eq('is_archived', false),
      supabase.from('pigs').select('*', { count: 'exact' }).eq('status', 'quarantine').eq('is_archived', false),
      supabase.from('piglet_batches').select('*').eq('is_archived', false),
    ]);

    const pigsCount = pigsRes.data?.length || 0;
    const sickCount = sickRes.count ?? 0;
    const quarCount = quarRes.count ?? 0;
    const pigletCount = (batchesRes.data || []).reduce((sum, b) => sum + (b.current_count || 0), 0);
    
    const totalCount = pigsCount + pigletCount;
    const femalePigs = (pigsRes.data || []).filter(p => {
      const g = (p.gender || '').toLowerCase();
      return g.startsWith('f') || g === 'female' || g === 'sow';
    }).length;

    res.json({
      total: totalCount,
      healthy: Math.max(0, totalCount - sickCount - quarCount),
      sick: sickCount,
      quarantine: quarCount,
      pregnant: femalePigs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs
router.get('/api/pigs', async (req, res) => {
  try {
    const { search, status, pen, category, breed, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = parseInt(limit) || 10;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let pigData = [], batchData = [];
    const queryPigs = !category || ['all', 'sow', 'boar'].includes(category);
    const queryBatches = !category || ['all', 'piglet_batch'].includes(category);

    if (queryPigs) {
      // Join breeds so we get the breed name, not just the breed_id UUID stored on pigs.
      let q = supabase.from('pigs').select('*, breeds(name)').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') q = q.eq('status', status.toLowerCase());
      if (search) q = q.ilike('pig_tag', `%${search}%`);
      const { data } = await q;
      pigData = data || [];
    }

    if (queryBatches) {
      let q = supabase.from('piglet_batches').select('*, breeds(name)').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') q = q.eq('status', status.toLowerCase());
      if (search) q = q.ilike('batch_tag', `%${search}%`);
      const { data } = await q;
      batchData = data || [];
    }

    const unifiedPigs = pigData.map(pig => ({
      id: pig.pig_id, 
      pig_tag: pig.pig_tag, 
      breed: pig.breeds?.name || '—',
      breed_id: pig.breed_id,
      age_weeks: pig.date_of_birth ? Math.floor((Date.now() - new Date(pig.date_of_birth)) / 604800000) : '—',
      current_weight: pig.weight,
      category: (pig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      status: pig.status || 'healthy',
      is_archived: pig.is_archived || false,
      archived_at: pig.archived_at || null,
      archive_reasoning: pig.archive_reasoning || null,
    }));

    const unifiedBatches = batchData.map(batch => ({
      id: batch.batch_id,
      pig_tag: batch.batch_tag,
      breed: batch.breeds?.name || '—',
      breed_id: batch.breed_id,
      age_weeks: batch.date_of_birth
        ? Math.floor((Date.now() - new Date(batch.date_of_birth)) / 604800000)
        : '—',
      current_weight: batch.average_weight,
      category: 'Piglet Batch',
      status: batch.status || 'suckling',
      is_archived: batch.is_archived || false,
      archived_at: batch.archived_at || null,
      archive_reasoning: batch.archive_reasoning || null,
    }));

    let merged = [...unifiedPigs, ...unifiedBatches];
    if (category && category !== 'all') {
      const map = { sow: 'Sow', boar: 'Boar', piglet_batch: 'Piglet Batch' };
      merged = merged.filter(i => i.category === map[category]);
    }
    if (breed && breed !== 'all') {
      merged = merged.filter(i => (i.breed_id && i.breed_id === breed) || (i.breed && i.breed.toLowerCase() === breed.toLowerCase()));
    }

    res.json({ data: merged.slice(from, to + 1), count: merged.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs/archived – fetch archived pig & batch records
router.get('/api/pigs/archived', async (req, res) => {
  try {
    const { search, category, breed, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = parseInt(limit) || 10;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let pigData = [], batchData = [];
    const queryPigs = !category || ['all', 'sow', 'boar'].includes(category);
    const queryBatches = !category || ['all', 'piglet_batch'].includes(category);

    if (queryPigs) {
      let q = supabase.from('pigs').select('*, breeds(name)').eq('is_archived', true);
      if (search) q = q.ilike('pig_tag', `%${search}%`);
      const { data } = await q;
      pigData = data || [];
    }

    if (queryBatches) {
      let q = supabase.from('piglet_batches').select('*, breeds(name)').eq('is_archived', true);
      if (search) q = q.ilike('batch_tag', `%${search}%`);
      const { data } = await q;
      batchData = data || [];
    }

    const unifiedPigs = pigData.map(pig => ({
      id: pig.pig_id,
      pig_tag: pig.pig_tag,
      breed: pig.breeds?.name || '—',
      breed_id: pig.breed_id,
      age_weeks: pig.date_of_birth ? Math.floor((Date.now() - new Date(pig.date_of_birth)) / 604800000) : '—',
      current_weight: pig.weight,
      category: (pig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      status: pig.status || 'healthy',
      is_archived: true,
      archived_at: pig.archived_at || null,
      archive_reasoning: pig.archive_reasoning || null,
    }));

    const unifiedBatches = batchData.map(batch => ({
      id: batch.batch_id,
      pig_tag: batch.batch_tag,
      breed: batch.breeds?.name || '—',
      breed_id: batch.breed_id,
      age_weeks: batch.date_of_birth ? Math.floor((Date.now() - new Date(batch.date_of_birth)) / 604800000) : '—',
      current_weight: batch.average_weight,
      category: 'Piglet Batch',
      status: batch.status || 'suckling',
      is_archived: true,
      archived_at: batch.archived_at || null,
      archive_reasoning: batch.archive_reasoning || null,
    }));

    let merged = [...unifiedPigs, ...unifiedBatches];
    if (category && category !== 'all') {
      const map = { sow: 'Sow', boar: 'Boar', piglet_batch: 'Piglet Batch' };
      merged = merged.filter(i => i.category === map[category]);
    }
    if (breed && breed !== 'all') {
      merged = merged.filter(i => (i.breed_id && i.breed_id === breed) || (i.breed && i.breed.toLowerCase() === breed.toLowerCase()));
    }

    res.json({ data: merged.slice(from, to + 1), count: merged.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// GET /api/pigs/:id – single pig record with full detail, for the Edit modal.
router.get('/api/pigs/:id', async (req, res) => {
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
        status: batchData.status || 'suckling',
        source_origin: batchData.source_origin,
        total_born_alive: batchData.total_born_alive,
        current_count: batchData.current_count,
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

// POST /api/pigs - Create an individual pig (Sow/Boar)
router.post('/api/pigs', async (req, res) => {
  try {
    const { tagNumber, dateOfBirth, breed, weight, penId, status, gender, creator } = req.body;
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);
    let finalBreedId = breed;

    // 1. Check if 'breed' is a UUID or a custom string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(breed);

    if (!isUuid) {
      // It's a new breed name! Let's insert it into the breeds table.
      const { data: newBreed, error: breedError } = await supabaseAdmin
        .from('breeds')
        .insert([{ name: breed }])
        .select()
        .single();

      if (breedError) {
        // If it already exists but we didn't have the UUID, fetch it
        if (breedError.code === '23505') { 
          const { data: existingBreed } = await supabaseAdmin
            .from('breeds')
            .select('breed_id')
            .eq('name', breed)
            .single();
          finalBreedId = existingBreed.breed_id;
        } else {
          throw breedError;
        }
      } else {
        finalBreedId = newBreed.breed_id;
      }
    }

    // 2. Confirm the selected pen still has room
    if (penId) {
      const { data: pen, error: penError } = await supabase
        .from('pens')
        .select('pen_code, max_capacity')
        .eq('pen_id', penId)
        .single();

      if (penError) throw penError;

      const occupied = await getPenOccupancy(penId);
      if (occupied >= (pen.max_capacity ?? 0)) {
        return res.status(400).json({
          error: `Pen ${pen.pen_code} is already at full capacity (${pen.max_capacity}). Please choose another pen.`,
        });
      }
    }

    // 3. Insert the pig using the finalBreedId
    const { data, error } = await supabaseAdmin
      .from('pigs')
      .insert([{
        pig_tag: tagNumber,
        date_of_birth: dateOfBirth,
        breed_id: finalBreedId, // Use the UUID
        weight: parseFloat(weight),
        pen_id: penId,
        status: status.toLowerCase(),
        gender: gender,
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

    res.json({ message: 'Pig added successfully', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pigs/batch - Create a piglet batch
router.post('/api/pigs/batch', async (req, res) => {
  try {
    const {
      batchTag, penId, sowId, dateOfBirth, breed,
      totalBornAlive, currentCount, stillbornCount, mummyCount,
      averageWeight, status, creator,
      // legacy fallback fields from old form
      batchId, penLocation, totalHerdCount,
    } = req.body;
    
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

    const resolvedPenId    = penId || penLocation;
    const resolvedTag      = batchTag || batchId;
    const resolvedCount    = parseInt(currentCount ?? totalHerdCount) || 0;

    // Confirm the pen has room for the whole batch before inserting.
    if (resolvedPenId) {
      const { data: pen, error: penError } = await supabase
        .from('pens')
        .select('pen_code, max_capacity')
        .eq('pen_id', resolvedPenId)
        .single();

      if (penError) throw penError;

      const occupied  = await getPenOccupancy(resolvedPenId);
      const incoming  = resolvedCount;
      const remaining = Math.max(0, (pen.max_capacity ?? 0) - occupied);

      if (incoming > remaining) {
        return res.status(400).json({
          error: `Pen ${pen.pen_code} only has ${remaining} slot(s) left, but this batch has ${incoming} piglet(s).`,
        });
      }
    }

    // Resolve breed name → breed_id (upsert if new)
    let resolvedBreedId = null;
    if (breed && breed.trim()) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(breed.trim());
      if (isUuid) {
        resolvedBreedId = breed.trim();
      } else {
        const { data: existingBreed } = await supabaseAdmin
          .from('breeds').select('breed_id').eq('name', breed.trim()).single();
        if (existingBreed) {
          resolvedBreedId = existingBreed.breed_id;
        } else {
          const { data: newBreed, error: breedErr } = await supabaseAdmin
            .from('breeds').insert([{ name: breed.trim() }]).select().single();
          if (breedErr) throw breedErr;
          resolvedBreedId = newBreed.breed_id;
        }
      }
    }

    const record = {
      batch_tag:      resolvedTag,
      pen_id:         resolvedPenId || null,
      sow_id:         sowId || null,
      date_of_birth:  dateOfBirth || null,
      breed_id:       resolvedBreedId,
      total_born_alive: parseInt(totalBornAlive) || null,
      current_count:  resolvedCount,
      stillborn_count: parseInt(stillbornCount) || 0,
      mummy_count:    parseInt(mummyCount) || 0,
      average_weight: averageWeight ? parseFloat(averageWeight) : null,
      status:         status || 'suckling',
      is_archived:    false,
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

    res.json({ message: 'Batch added successfully', data });
  } catch (error) {
    console.error("Error inserting batch:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pigs/:id - Update pig details or piglet batch
router.put('/api/pigs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      tagNumber, dateOfBirth, breed, weight, 
      penId, status, parityCount, creator,
      totalBornAlive, stillbornCount, mummyCount, category, isBatch
    } = req.body;
    
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

    if (!tagNumber || !breed || !penId) {
      return res.status(400).json({ error: 'Tag number, breed, and pen are required.' });
    }

    const checkIsBatch = category === 'Piglet Batch' || isBatch === true;

    if (checkIsBatch) {
      const { data: existingBatch } = await supabaseAdmin
        .from('piglet_batches')
        .select('is_archived')
        .eq('batch_id', id)
        .maybeSingle();
      if (existingBatch && existingBatch.is_archived) {
        return res.status(400).json({ error: 'Cannot modify details of an archived piglet batch.' });
      }
    } else {
      const { data: existingPig } = await supabaseAdmin
        .from('pigs')
        .select('is_archived')
        .eq('pig_id', id)
        .maybeSingle();
      if (existingPig && existingPig.is_archived) {
        return res.status(400).json({ error: 'Cannot modify details of an archived swine record.' });
      }
    }

    // Resolve breed name → UUID
    let finalBreedId = breed;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(breed);

    if (!isUuid) {
      const { data: existingBreed } = await supabaseAdmin
        .from('breeds')
        .select('breed_id')
        .eq('name', breed)
        .maybeSingle();

      if (existingBreed) {
        finalBreedId = existingBreed.breed_id;
      } else {
        const { data: newBreed, error: breedError } = await supabaseAdmin
          .from('breeds')
          .insert([{ name: breed }])
          .select()
          .single();
        if (breedError) throw breedError;
        finalBreedId = newBreed.breed_id;
      }
    }

    if (checkIsBatch) {
      const updatePayload = {
        batch_tag: tagNumber,
        date_of_birth: dateOfBirth || null,
        breed_id: finalBreedId,
        pen_id: penId,
        status: (status || 'suckling').toLowerCase(),
      };
      if (weight !== undefined && weight !== null && weight !== '') {
        updatePayload.average_weight = parseFloat(weight);
      }
      if (totalBornAlive !== undefined && totalBornAlive !== null && totalBornAlive !== '') {
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
        return res.status(404).json({ error: 'Piglet batch not found.' });
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

      return res.json({ message: 'Piglet batch updated successfully', data: data[0] });
    }

    // If the pen is changing, confirm the new pen actually has room
    const { data: currentPig, error: currentPigError } = await supabase
      .from('pigs')
      .select('pen_id')
      .eq('pig_id', id)
      .maybeSingle();

    if (currentPigError) throw currentPigError;

    if (currentPig && String(currentPig.pen_id) !== String(penId)) {
      const { data: pen, error: penError } = await supabase
        .from('pens')
        .select('pen_code, max_capacity')
        .eq('pen_id', penId)
        .single();

      if (penError) throw penError;

      const occupied = await getPenOccupancy(penId);
      if (occupied >= (pen.max_capacity ?? 0)) {
        return res.status(400).json({
          error: `Pen ${pen.pen_code} is already at full capacity (${pen.max_capacity}). Please choose another pen.`,
        });
      }
    }

    const updatePayload = {
      pig_tag: tagNumber,
      date_of_birth: dateOfBirth || null,
      breed_id: finalBreedId,
      weight: parseFloat(weight),
      pen_id: penId,
      status: (status || '').toLowerCase(),
    };

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
      return res.status(404).json({ error: 'Pig not found.' });
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

    res.json({ message: 'Pig updated successfully', data: data[0] });
  } catch (error) {
    console.error('Error updating pig:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/pigs/:id/archive – soft-archive a pig or piglet batch
router.patch('/api/pigs/:id/archive', async (req, res) => {
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

// PATCH /api/pigs/:id/unarchive – unarchive a pig or piglet batch
router.patch('/api/pigs/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;
    const { creator } = req.body;
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator || 'Admin');

    const updatePayload = { is_archived: false, archived_at: null, archive_reasoning: null };

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
        user_bg_color: 'bg-emerald-100 text-emerald-700',
        event_title: 'Swine Record Restored',
        event_desc: `Restored swine record with tag ${tag} to active circulation.`,
        status: 'SUCCESS'
      });
      return res.json({ message: 'Pig unarchived successfully', data: pigData[0] });
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

// PUT /api/pigs/batch/:id - Dedicated update endpoint for piglet batches
router.put('/api/pigs/batch/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      batchTag, tagNumber, dateOfBirth, breed, averageWeight, weight,
      penId, status, creator,
      totalBornAlive, stillbornCount, mummyCount
    } = req.body;
    
    const resolvedTag = batchTag || tagNumber;
    const resolvedWeight = averageWeight ?? weight;
    const { name: creatorName, email: creatorEmail, initials: creatorInitials } = getCreatorDetails(creator);

    if (!resolvedTag || !breed || !penId) {
      return res.status(400).json({ error: 'Batch tag, breed, and pen are required.' });
    }

    const { data: existingBatch } = await supabaseAdmin
      .from('piglet_batches')
      .select('is_archived')
      .eq('batch_id', id)
      .maybeSingle();
    if (existingBatch && existingBatch.is_archived) {
      return res.status(400).json({ error: 'Cannot modify details of an archived piglet batch.' });
    }

    let finalBreedId = breed;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(breed);

    if (!isUuid) {
      const { data: existingBreed } = await supabaseAdmin
        .from('breeds').select('breed_id').eq('name', breed).maybeSingle();
      if (existingBreed) {
        finalBreedId = existingBreed.breed_id;
      } else {
        const { data: newBreed, error: breedError } = await supabaseAdmin
          .from('breeds').insert([{ name: breed }]).select().single();
        if (breedError) throw breedError;
        finalBreedId = newBreed.breed_id;
      }
    }

    const updatePayload = {
      batch_tag: resolvedTag.trim(),
      date_of_birth: dateOfBirth || null,
      breed_id: finalBreedId,
      pen_id: penId,
      status: (status || 'suckling').toLowerCase(),
    };
    if (resolvedWeight !== undefined && resolvedWeight !== null && resolvedWeight !== '') {
      updatePayload.average_weight = parseFloat(resolvedWeight);
    }
    if (totalBornAlive !== undefined && totalBornAlive !== null && totalBornAlive !== '') {
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
      return res.status(404).json({ error: 'Piglet batch not found.' });
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

    res.json({ message: 'Piglet batch updated successfully', data });
  } catch (error) {
    console.error('Error updating batch:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
