import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { getAllPenOccupancy, getPenOccupancy } from '../helpers/occupancy.js';
import { verifyAuth, verifyAdmin } from '../middleware/auth.js';
import { createHttpError, queueApprovalRequest } from '../helpers/approvalQueue.js';

const router = express.Router();
const db = supabaseAdmin || supabase;

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

function getSectionCategory(penSection) {
  if (!penSection) return "S";
  const s = String(penSection).trim().toUpperCase();
  if (s === "BOAR" || s.includes("BOAR") || s === "B") return "B";
  if (s === "SOW" || s.includes("SOW") || s.includes("GEST") || s.includes("FARR") || s === "S" || s.startsWith("A")) return "S";
  if (s === "WEAN" || s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS") || s === "W" || s.startsWith("N") || s.startsWith("T")) return "W";
  if (s === "QUAR" || s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK") || s === "Q") return "Q";
  return "S";
}

// GET /api/pens – fetch all pens for dropdown filter (active only)
router.get('/api/pens', verifyAuth, async (req, res) => {
  try {
    const { data: pens, error } = await db
      .from('pens')
      .select('pen_id, pen_code, pen_type, max_capacity, is_archived')
      .order('pen_code', { ascending: true });

    if (error) {
      console.error('Error fetching pens:', error.message);
      return res.json({ data: [] });
    }

    const occupancy = await getAllPenOccupancy();
    const active = (pens || [])
      .filter(p => !p.is_archived)
      .map(p => {
        const occ = occupancy.get(String(p.pen_id)) || { total: 0, pigCount: 0, sowCount: 0, boarCount: 0, batchCount: 0 };
        const occupied = typeof occ === 'number' ? occ : occ.total;
        const sowCount = typeof occ === 'number' ? 0 : occ.sowCount;
        const boarCount = typeof occ === 'number' ? 0 : occ.boarCount;
        const pigCount = typeof occ === 'number' ? 0 : occ.pigCount;
        const capacity = p.max_capacity ?? 20;
        const section = getSectionCategory(p.pen_type || p.section || p.pen_code);

        const isSowPen = section === 'S';
        const isBoarPen = section === 'B';

        let remaining = Math.max(0, capacity - occupied);
        if (isBoarPen && (boarCount >= 1 || pigCount >= 1)) {
          remaining = 0;
        }

        return {
          id: p.pen_id,
          name: p.pen_code,
          section,
          maxCapacity: capacity,
          occupied,
          sowCount,
          boarCount,
          pigCount,
          hasSow: sowCount > 0 || (isSowPen && pigCount > 0),
          hasBoar: boarCount > 0 || (isBoarPen && pigCount > 0),
          remaining,
        };
      });

    res.json({ data: active });
  } catch (err) {
    console.error('Error in /api/pens:', err.message);
    res.json({ data: [] });
  }
});

// GET /api/pens/available – pens that still have room for at least one more (active only)
router.get('/api/pens/available', verifyAuth, async (req, res) => {
  try {
    const { data: pens, error } = await db
      .from('pens')
      .select('pen_id, pen_code, pen_type, max_capacity, is_archived')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const available = (pens || [])
      .filter(p => !p.is_archived)
      .map(p => {
        const occ = occupancy.get(String(p.pen_id)) || { total: 0, pigCount: 0, sowCount: 0, boarCount: 0, batchCount: 0 };
        const occupied = typeof occ === 'number' ? occ : occ.total;
        const sowCount = typeof occ === 'number' ? 0 : occ.sowCount;
        const boarCount = typeof occ === 'number' ? 0 : occ.boarCount;
        const pigCount = typeof occ === 'number' ? 0 : occ.pigCount;
        const capacity = p.max_capacity ?? 20;
        const section = getSectionCategory(p.pen_type || p.section || p.pen_code);

        const isSowPen = section === 'S';
        const isBoarPen = section === 'B';

        let remaining = Math.max(0, capacity - occupied);
        if (isBoarPen && (boarCount >= 1 || pigCount >= 1)) {
          remaining = 0;
        }

        return {
          id: p.pen_id,
          name: p.pen_code,
          section,
          maxCapacity: capacity,
          occupied,
          sowCount,
          boarCount,
          pigCount,
          hasSow: sowCount > 0 || (isSowPen && pigCount > 0),
          hasBoar: boarCount > 0 || (isBoarPen && pigCount > 0),
          remaining,
        };
      })
      .filter(p => p.remaining > 0);

    res.json({ data: available });
  } catch (error) {
    console.error('Error fetching available pens:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pens/all – fetch all pens (both active and archived) with live occupancy and capacity details
router.get('/api/pens/all', verifyAuth, async (req, res) => {
  try {
    const { data: pens, error } = await db
      .from('pens')
      .select('*')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const formatted = (pens || []).map(p => {
      const occ = occupancy.get(String(p.pen_id)) || { total: 0, pigCount: 0, sowCount: 0, boarCount: 0, batchCount: 0 };
      const occupied = typeof occ === 'number' ? occ : occ.total;
      const sowCount = typeof occ === 'number' ? 0 : occ.sowCount;
      const boarCount = typeof occ === 'number' ? 0 : occ.boarCount;
      const pigCount = typeof occ === 'number' ? 0 : occ.pigCount;
      const capacity = p.max_capacity ?? p.capacity ?? 20;
      let section = p.pen_type || p.section || p.pen_section || 'S';
      if (!p.pen_type && !p.section && !p.pen_section && p.pen_code) {
        const match = p.pen_code.match(/-(.?)/) || p.pen_code.match(/^([A-Za-z])/);
        if (match && match[1]) {
          section = match[1].toUpperCase();
        }
      }
      return {
        id: p.pen_id || p.id,
        code: p.pen_code || p.code || p.name || 'Unknown',
        section: section,
        capacity: capacity,
        occupancy: occupied,
        remaining: Math.max(0, capacity - occupied),
        sowCount,
        boarCount,
        pigCount,
        hasSow: sowCount > 0 || (section === 'S' && pigCount > 0),
        hasBoar: boarCount > 0 || (section === 'B' && pigCount > 0),
        is_archived: Boolean(p.is_archived),
        archived_at: p.archived_at || null,
        archive_reason: p.archive_reason || null,
        ...p
      };
    });

    res.json({ data: formatted });
  } catch (error) {
    console.error('Error fetching all pens:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/pens/:id/swine – get all pigs and piglet batches assigned to a specific pen
router.get('/api/pens/:id/swine', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [pigsRes, batchesRes] = await Promise.all([
      db.from('pigs').select('*').eq('pen_id', id).eq('is_archived', false).order('pig_tag', { ascending: true }),
      db.from('piglet_batches').select('*').eq('pen_id', id).eq('is_archived', false).order('batch_tag', { ascending: true })
    ]);

    let pigs = pigsRes.data || [];
    let batches = batchesRes.data || [];

    if (pigs.length === 0 && batches.length === 0) {
      const pen = await db.from('pens').select('pen_id, id, pen_code').or(`pen_id.eq.${id},pen_code.eq.${id}`).maybeSingle();
      if (pen.data) {
        const targetIds = [pen.data.pen_id, pen.data.id, pen.data.pen_code].filter(Boolean);
        if (targetIds.length > 0) {
          const [p2, b2] = await Promise.all([
            db.from('pigs').select('*').in('pen_id', targetIds).eq('is_archived', false).order('pig_tag', { ascending: true }),
            db.from('piglet_batches').select('*').in('pen_id', targetIds).eq('is_archived', false).order('batch_tag', { ascending: true })
          ]);
          pigs = p2.data || pigs;
          batches = b2.data || batches;
        }
      }
    }

    res.json({ data: { pigs, batches } });
  } catch (error) {
    console.error('Error fetching pen swine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pens/initialize – initialize layout slots in bulk
router.post('/api/pens/initialize', verifyAdmin, async (req, res) => {
  try {
    const { pens: incomingPens = [], creator } = req.body;
    if (!Array.isArray(incomingPens) || incomingPens.length === 0) {
      return res.status(400).json({ error: 'List of pens to initialize is required.' });
    }

    const { data: existingPens, error: fetchErr } = await db
      .from('pens')
      .select('pen_code');

    if (fetchErr) throw fetchErr;

    const existingSet = new Set((existingPens || []).map(p => String(p.pen_code || '').trim().toUpperCase()));
    const missing = incomingPens.filter(p => p.code && !existingSet.has(String(p.code).trim().toUpperCase()));

    if (missing.length === 0) {
      return res.json({ message: 'All pens already exist in database.', created: 0 });
    }

    const payloads = missing.map(p => ({
      pen_code: String(p.code).trim().toUpperCase(),
      pen_type: p.section || 'S',
      max_capacity: Number(p.capacity) || 12,
      is_archived: false,
    }));

    let { data, error } = await db
      .from('pens')
      .insert(payloads)
      .select();

    if (error && (error.message.includes('column "pen_type"') || error.message.includes('schema cache'))) {
      const fallbackPayloads = payloads.map(p => {
        const copy = { ...p, section: p.pen_type };
        delete copy.pen_type;
        return copy;
      });
      const fallback = await db.from('pens').insert(fallbackPayloads).select();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const creatorInfo = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Farm Layout Initialized',
      event_desc: `Initialized ${payloads.length} farm housing units with default capacities.`,
      status: 'SUCCESS'
    });

    res.status(201).json({ success: true, created: payloads.length, data });
  } catch (error) {
    console.error('Error initializing pens:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pens – create a new pen
router.post('/api/pens', verifyAdmin, async (req, res) => {
  try {
    const { code, section, capacity, creator } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pen code is required.' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const { data: existing } = await db
      .from('pens')
      .select('pen_id, pen_code')
      .ilike('pen_code', normalizedCode)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: `Pen with code ${normalizedCode} already exists.` });
    }

    const payload = {
      pen_code: normalizedCode,
      max_capacity: Number(capacity) || 12,
      is_archived: false,
    };
    if (section) payload.pen_type = section;

    let { data, error } = await db
      .from('pens')
      .insert([payload])
      .select()
      .single();

    if (error && (error.message.includes('column "pen_type"') || error.message.includes('schema cache'))) {
      delete payload.pen_type;
      if (section) payload.section = section;
      const fallback = await db.from('pens').insert([payload]).select().single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const creatorInfo = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Pen Added',
      event_desc: `Added new housing unit ${normalizedCode} (Capacity: ${payload.max_capacity}).`,
      status: 'SUCCESS'
    });

    res.status(201).json({ data });
  } catch (error) {
    console.error('Error creating pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pens/:id – edit/update a pen
router.put('/api/pens/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, section, capacity, creator } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pen code is required.' });
    }

    if (section) {
      const [penRes, pigsRes, batchesRes] = await Promise.all([
        db.from('pens').select('pen_id, id, pen_code, pen_type').or(`pen_id.eq.${id},id.eq.${id}`).maybeSingle(),
        db.from('pigs').select('pig_id, pig_tag, gender, status').eq('pen_id', id).eq('is_archived', false),
        db.from('piglet_batches').select('batch_id, batch_number, current_count').eq('pen_id', id).eq('is_archived', false)
      ]);
      const currentPen = penRes.data || {};
      const pigs = pigsRes.data || [];
      const batches = batchesRes.data || [];
      const oldCat = getSectionCategory(currentPen.pen_type || currentPen.section || currentPen.pen_code || 'S');
      const newCat = getSectionCategory(section);

      if (newCat !== oldCat && (pigs.length > 0 || batches.length > 0)) {
        if (newCat === 'S') {
          const boarsOrOthers = pigs.filter(p => (p.gender || '').toLowerCase().startsWith('m') || p.status?.toLowerCase() === 'boar');
          if (boarsOrOthers.length > 0 || batches.length > 0) {
            const names = boarsOrOthers.map(p => `#${p.pig_tag || p.pig_id}`).join(', ');
            return res.status(400).json({
              error: `Cannot change pen type to Sow Pen because this unit currently houses ${boarsOrOthers.length > 0 ? `boar(s): ${names}` : 'piglet batches'}. Please transfer them to another housing unit first.`
            });
          }
        } else if (newCat === 'B') {
          const sowsOrOthers = pigs.filter(p => (p.gender || '').toLowerCase().startsWith('f') || p.status?.toLowerCase() === 'sow');
          if (sowsOrOthers.length > 0 || batches.length > 0 || pigs.length > 1) {
            const names = sowsOrOthers.map(p => `#${p.pig_tag || p.pig_id}`).join(', ');
            return res.status(400).json({
              error: `Cannot change pen type to Boar Pen because ${sowsOrOthers.length > 0 ? `it houses sow(s): ${names}` : batches.length > 0 ? 'it houses piglet batches' : `it currently houses ${pigs.length} pigs (Boar pens allow max 1 boar)`}. Please transfer them first.`
            });
          }
        } else if (newCat === 'W') {
          const breeding = pigs.filter(p => p.type?.toLowerCase() === 'boar' || p.type?.toLowerCase() === 'sow' || p.category?.toLowerCase()?.includes('boar') || p.category?.toLowerCase()?.includes('sow'));
          if (breeding.length > 0) {
            const names = breeding.map(p => `#${p.pig_tag || p.id}`).join(', ');
            return res.status(400).json({
              error: `Cannot change pen type to Weaned / Fattening because this unit currently houses adult breeding swine (${names}). Please transfer them first.`
            });
          }
        }
      }
    }

    const payload = {
      pen_code: code,
      max_capacity: Number(capacity) || 20,
    };
    if (section) payload.pen_type = section;

    let { data, error } = await db
      .from('pens')
      .update(payload)
      .eq('pen_id', id)
      .select()
      .single();

    if (error && (error.message.includes('column "pen_type"') || error.message.includes('schema cache') || !data)) {
      delete payload.pen_type;
      if (section) payload.section = section;
      const fallback = await db.from('pens').update(payload).eq('id', id).select().single();
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    }

    if (error && !data) throw error;

    const creatorInfo = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-amber-100 text-amber-700',
      event_title: 'Pen Updated',
      event_desc: `Updated housing unit ${code} (Capacity: ${payload.max_capacity}).`,
      status: 'SUCCESS'
    });

    res.json({ data });
  } catch (error) {
    console.error('Error updating pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pens/:id/archive – archive a pen (soft archive)
router.put('/api/pens/:id/archive', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { creator, code, reason } = req.body || {};

    const occupied = await getPenOccupancy(id);
    if (occupied > 0) {
      return res.status(400).json({
        error: `Cannot archive this pen because it currently houses ${occupied} active swine record(s). Please relocate or archive the swine first.`
      });
    }

    const payload = {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: reason || 'Archived by user',
    };

    let { error } = await db.from('pens').update(payload).eq('pen_id', id);
    if (error) {
      const fallback = await db.from('pens').update(payload).eq('id', id);
      if (fallback.error) throw fallback.error;
    }

    const creatorInfo = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Pen Archived',
      event_desc: `Archived housing unit ${code || id}${reason ? ' (' + reason + ')' : ''}.`,
      status: 'SUCCESS'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pens/:id/unarchive – unarchive/restore a pen
router.put('/api/pens/:id/unarchive', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { creator, code } = req.body || {};

    const payload = {
      is_archived: false,
      archived_at: null,
      archive_reason: null,
    };

    let { error } = await db.from('pens').update(payload).eq('pen_id', id);
    if (error) {
      const fallback = await db.from('pens').update(payload).eq('id', id);
      if (fallback.error) throw fallback.error;
    }

    const creatorInfo = getCreatorDetails(creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-emerald-100 text-emerald-700',
      event_title: 'Pen Restored',
      event_desc: `Restored housing unit ${code || id} back to active status.`,
      status: 'SUCCESS'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error unarchiving pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pens/:id – delete a pen (only if empty)
router.delete('/api/pens/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { creator, code } = req.query || {};

    const occupied = await getPenOccupancy(id);
    if (occupied > 0) {
      return res.status(400).json({
        error: `Cannot delete this pen because it currently houses ${occupied} active swine record(s). Please relocate the swine first.`
      });
    }

    const { error } = await db
      .from('pens')
      .delete()
      .eq('pen_id', id);

    if (error) {
      const fallback = await db.from('pens').delete().eq('id', id);
      if (fallback.error) throw fallback.error;
    }

    const creatorInfo = getCreatorDetails(creator || req.body?.creator);
    await db.from('activity_logs').insert({
      user_name: creatorInfo.name,
      user_email: creatorInfo.email,
      user_initials: creatorInfo.initials,
      user_bg_color: 'bg-rose-100 text-rose-700',
      event_title: 'Pen Deleted',
      event_desc: `Removed housing unit ${code || id}.`,
      status: 'SUCCESS'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export async function validateAndBuildTransfer(body = {}) {
  const { sourcePenId, destinationPenId, pigIds = [], batchIds = [] } = body;

  if (!sourcePenId || !destinationPenId || (pigIds.length === 0 && batchIds.length === 0)) {
    throw createHttpError(400, 'Source, destination, and at least one animal to transfer are required.');
  }

  if (String(sourcePenId) === String(destinationPenId)) {
    throw createHttpError(400, 'Source and destination pens cannot be the same.');
  }

  const [{ data: destPen, error: destPenError }, { data: sourcePen }] = await Promise.all([
    db.from('pens').select('pen_id, pen_code, max_capacity, pen_type, is_archived').eq('pen_id', destinationPenId).single(),
    db.from('pens').select('pen_id, pen_code').eq('pen_id', sourcePenId).maybeSingle(),
  ]);

  if (destPenError || !destPen) {
    throw createHttpError(400, 'Destination pen not found.');
  }

  if (destPen.is_archived) {
    throw createHttpError(400, `Cannot transfer swine to archived pen ${destPen.pen_code}.`);
  }

  let selectedPigs = [];
  if (pigIds.length > 0) {
    const { data } = await db
      .from('pigs')
      .select('pig_id, pig_tag, gender, status, is_archived')
      .in('pig_id', pigIds)
      .eq('is_archived', false);
    selectedPigs = data || [];
    if (selectedPigs.length !== pigIds.length) {
      throw createHttpError(400, 'One or more selected pigs are no longer active or available for transfer.');
    }
  }

  let selectedBatches = [];
  let incomingBatchHeadCount = 0;
  if (batchIds.length > 0) {
    const { data } = await db
      .from('piglet_batches')
      .select('batch_id, batch_tag, current_count, date_of_birth, status, is_archived')
      .in('batch_id', batchIds)
      .eq('is_archived', false);
    selectedBatches = data || [];
    if (selectedBatches.length !== batchIds.length) {
      throw createHttpError(400, 'One or more selected piglet batches are no longer active or available for transfer.');
    }
    incomingBatchHeadCount = selectedBatches.reduce((acc, b) => acc + (b.current_count || 0), 0);
  }

  const totalIncoming = selectedPigs.length + incomingBatchHeadCount;

  const occ = await getPenOccupancy(destinationPenId);
  const currentOccupied = typeof occ === 'number' ? occ : occ.total;
  const destMaxCap = destPen.max_capacity ?? 20;
  const remaining = Math.max(0, destMaxCap - currentOccupied);

  if (totalIncoming > remaining) {
    throw createHttpError(
      400,
      `Pen ${destPen.pen_code} only has ${remaining} slot(s) left, but you are trying to transfer ${totalIncoming} animal(s).`
    );
  }

  const penSection = getSectionCategory(destPen.pen_type || destPen.section);
  const isQPen = penSection === 'Q';

  for (const pig of selectedPigs) {
    const isSow = (pig.gender || '').toLowerCase().startsWith('f') || pig.status?.toLowerCase() === 'sow';
    const isBoar = (pig.gender || '').toLowerCase().startsWith('m') || pig.status?.toLowerCase() === 'boar';
    const isSickOrQ = pig.status?.toLowerCase() === 'sick' || pig.status?.toLowerCase() === 'quarantine';

    if (isSow && (penSection === 'B' || penSection === 'BOAR')) {
      throw createHttpError(400, `Cannot transfer female sow #${pig.pig_tag} to boar pen ${destPen.pen_code}.`);
    }
    if (isBoar && penSection !== 'B' && penSection !== 'BOAR') {
      throw createHttpError(400, `Cannot transfer male boar #${pig.pig_tag} to ${destPen.pen_code}. Boars must be housed in a Boar pen.`);
    }
    if (!isSickOrQ && isQPen) {
      throw createHttpError(400, `Cannot transfer ${pig.status || 'Healthy'} pig #${pig.pig_tag} to Quarantine pen ${destPen.pen_code}.`);
    }
    if (isSickOrQ && !isQPen) {
      throw createHttpError(400, `Cannot transfer ${pig.status} pig #${pig.pig_tag} to ${destPen.pen_code}. Sick/Quarantined pigs must go to a Quarantine pen.`);
    }
    if (isSow && !isQPen && penSection !== 'S' && penSection !== 'SOW') {
      throw createHttpError(400, `Cannot transfer female sow #${pig.pig_tag} to ${destPen.pen_code}. Sows must be housed in Sow/Farrowing pens.`);
    }
  }

  const incomingSowsCount = selectedPigs.filter(p => (p.gender || '').toLowerCase().startsWith('f') || p.status?.toLowerCase() === 'sow').length;
  const incomingBoarsCount = selectedPigs.filter(p => (p.gender || '').toLowerCase().startsWith('m') || p.status?.toLowerCase() === 'boar').length;

  if ((penSection === 'S' || penSection === 'SOW') && (occ.sowCount + incomingSowsCount > 1 || occ.pigCount + selectedPigs.length > 1)) {
    throw createHttpError(400, `Sow pen ${destPen.pen_code} can only house 1 sow.`);
  }
  if ((penSection === 'B' || penSection === 'BOAR') && (occ.boarCount + incomingBoarsCount > 1 || occ.pigCount + selectedPigs.length > 1)) {
    throw createHttpError(400, `Boar pen ${destPen.pen_code} can only house 1 boar.`);
  }
  if ((penSection === 'B' || penSection === 'BOAR') && selectedBatches.length > 0) {
    throw createHttpError(400, `Piglet batches cannot be transferred to Boar pen ${destPen.pen_code}.`);
  }

  for (const batch of selectedBatches) {
    const statusStr = (batch.status || '').toLowerCase();
    let ageInDays = null;
    if (batch.date_of_birth) {
      ageInDays = Math.floor((Date.now() - new Date(batch.date_of_birth).getTime()) / (1000 * 60 * 60 * 24));
    }
    const isBatchWeaned = statusStr === 'weaned' || (statusStr !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isBatchNursing = statusStr === 'suckling' || (statusStr !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    if (isBatchNursing && penSection !== 'S' && penSection !== 'SOW') {
      throw createHttpError(400, `Nursing piglet batch #${batch.batch_tag} must be transferred to a Sow/Farrowing pen (${destPen.pen_code} is ${penSection}).`);
    }
    if (isBatchWeaned && penSection !== 'W' && penSection !== 'WEANED') {
      throw createHttpError(400, `Weaned piglet batch #${batch.batch_tag} must be transferred to a Weaned/Fattening pen (${destPen.pen_code} is ${penSection}).`);
    }
  }

  return {
    sourcePenId,
    destinationPenId,
    sourcePenCode: sourcePen?.pen_code || '',
    destinationPenCode: destPen.pen_code,
    pigIds,
    batchIds,
    pigTags: selectedPigs.map(p => p.pig_tag).filter(Boolean),
    batchTags: selectedBatches.map(b => b.batch_tag).filter(Boolean),
    totalHeads: totalIncoming,
  };
}

export async function executeTransferSwine(body = {}) {
  const details = await validateAndBuildTransfer(body);
  const { destinationPenId, destinationPenCode, pigIds, batchIds } = details;

  if (pigIds.length > 0) {
    const { error: pErr } = await db.from('pigs').update({ pen_id: destinationPenId }).in('pig_id', pigIds);
    if (pErr) throw pErr;
  }
  if (batchIds.length > 0) {
    const { error: bErr } = await db.from('piglet_batches').update({ pen_id: destinationPenId }).in('batch_id', batchIds);
    if (bErr) throw bErr;
  }

  const creatorInfo = getCreatorDetails(body.creator);
  const msg = `Bulk transferred ${pigIds.length} pig(s) and ${batchIds.length} batch(es) to ${destinationPenCode}.`;
  await db.from('activity_logs').insert({
    user_name: creatorInfo.name,
    user_email: creatorInfo.email,
    user_initials: creatorInfo.initials,
    user_bg_color: 'bg-indigo-100 text-indigo-700',
    event_title: 'Swine Transferred',
    event_desc: msg,
    status: 'SUCCESS'
  });

  return { success: true, message: msg };
}

// POST /api/pens/transfer - bulk transfer swine between pens
router.post('/api/pens/transfer', verifyAuth, async (req, res) => {
  try {
    const transferDetails = await validateAndBuildTransfer(req.body);

    if (req.isAdmin) {
      const result = await executeTransferSwine({
        ...req.body,
        creator: req.body.creator || req.userName,
      });
      return res.json(result);
    }

    const itemParts = [];
    if (transferDetails.pigTags.length > 0) {
      itemParts.push(`${transferDetails.pigTags.length} pig(s) (${transferDetails.pigTags.join(', ')})`);
    }
    if (transferDetails.batchTags.length > 0) {
      itemParts.push(`${transferDetails.batchTags.length} batch(es) (${transferDetails.batchTags.join(', ')})`);
    }
    const fromText = transferDetails.sourcePenCode ? `from ${transferDetails.sourcePenCode} ` : '';
    const summary = `Transfer ${itemParts.join(' and ')} (${transferDetails.totalHeads} head${transferDetails.totalHeads === 1 ? '' : 's'}) ${fromText}to ${transferDetails.destinationPenCode}`;

    const approvalRequest = await queueApprovalRequest({
      req,
      module: 'pens',
      action: 'transfer_swine',
      actionLabel: 'Transfer Swine',
      summary,
      targetId: transferDetails.destinationPenId,
      payload: transferDetails,
    });

    return res.status(202).json({
      pendingApproval: true,
      approvalRequest,
      message: 'Transfer submitted for administrator approval.',
    });
  } catch (error) {
    console.error('Error transferring swine:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
