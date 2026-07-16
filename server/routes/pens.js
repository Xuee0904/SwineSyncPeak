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

export default router;
