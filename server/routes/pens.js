import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { getAllPenOccupancy, getPenOccupancy } from '../helpers/occupancy.js';

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

// GET /api/pens – fetch all pens for dropdown filter (active only)
router.get('/api/pens', async (req, res) => {
  const { data, error } = await db
    .from('pens')
    .select('id:pen_id, name:pen_code, is_archived')
    .order('pen_code', { ascending: true });

  if (error) {
    console.error('Error fetching pens:', error.message);
    return res.json({ data: [] });
  }
  const active = (data ?? []).filter(p => !p.is_archived);
  res.json({ data: active });
});

// GET /api/pens/available – pens that still have room for at least one more (active only)
router.get('/api/pens/available', async (req, res) => {
  try {
    const { data: pens, error } = await db
      .from('pens')
      .select('pen_id, pen_code, max_capacity, is_archived')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const available = (pens || [])
      .filter(p => !p.is_archived)
      .map(p => {
        const occupied = occupancy.get(p.pen_id) || 0;
        const capacity = p.max_capacity ?? 0;
        return {
          id: p.pen_id,
          name: p.pen_code,
          maxCapacity: capacity,
          occupied,
          remaining: Math.max(0, capacity - occupied),
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
router.get('/api/pens/all', async (req, res) => {
  try {
    const { data: pens, error } = await db
      .from('pens')
      .select('*')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const formatted = (pens || []).map(p => {
      const occupied = occupancy.get(p.pen_id) || 0;
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

// POST /api/pens – create a new pen
router.post('/api/pens', async (req, res) => {
  try {
    const { code, section, capacity, creator } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pen code is required.' });
    }
    const payload = {
      pen_code: code,
      max_capacity: Number(capacity) || 20,
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
      event_desc: `Added new housing unit ${code} (Capacity: ${payload.max_capacity}).`,
      status: 'SUCCESS'
    });

    res.status(201).json({ data });
  } catch (error) {
    console.error('Error creating pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/pens/:id – edit/update a pen
router.put('/api/pens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, section, capacity, creator } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pen code is required.' });
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
router.put('/api/pens/:id/archive', async (req, res) => {
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
router.put('/api/pens/:id/unarchive', async (req, res) => {
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
router.delete('/api/pens/:id', async (req, res) => {
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

export default router;
