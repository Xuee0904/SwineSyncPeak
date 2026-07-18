import express from 'express';
import { supabase } from '../supabaseClient.js';
import { getAllPenOccupancy } from '../helpers/occupancy.js';

const router = express.Router();

// GET /api/pens – fetch all pens for dropdown filter
router.get('/api/pens', async (req, res) => {
  const { data, error } = await supabase
    .from('pens')
    .select('id:pen_id, name:pen_code')
    .order('pen_code', { ascending: true });

  if (error) {
    console.error('Error fetching pens:', error.message);
    return res.json({ data: [] });
  }
  res.json({ data: data ?? [] });
});

// GET /api/pens/available – pens that still have room for at least one more
router.get('/api/pens/available', async (req, res) => {
  try {
    const { data: pens, error } = await supabase
      .from('pens')
      .select('pen_id, pen_code, max_capacity')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const available = (pens || [])
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

// GET /api/pens/all – fetch all pens with live occupancy and capacity details
router.get('/api/pens/all', async (req, res) => {
  try {
    const { data: pens, error } = await supabase
      .from('pens')
      .select('*')
      .order('pen_code', { ascending: true });

    if (error) throw error;

    const occupancy = await getAllPenOccupancy();

    const formatted = (pens || []).map(p => {
      const occupied = occupancy.get(p.pen_id) || 0;
      const capacity = p.max_capacity ?? p.capacity ?? 20;
      let section = p.section || p.pen_section || 'S';
      if (!p.section && !p.pen_section && p.pen_code) {
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
    const { code, section, capacity } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Pen code is required.' });
    }
    const payload = {
      pen_code: code,
      max_capacity: Number(capacity) || 20,
    };
    if (section) payload.section = section;

    let { data, error } = await supabase
      .from('pens')
      .insert([payload])
      .select()
      .single();

    if (error && error.message.includes('column "section"')) {
      delete payload.section;
      const fallback = await supabase.from('pens').insert([payload]).select().single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    res.status(201).json({ data });
  } catch (error) {
    console.error('Error creating pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/pens/:id – delete a pen
router.delete('/api/pens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('pens')
      .delete()
      .eq('pen_id', id);

    if (error) {
      const fallback = await supabase.from('pens').delete().eq('id', id);
      if (fallback.error) throw fallback.error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
