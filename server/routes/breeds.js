import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.get('/api/breeds', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('breeds')
      .select('breed_id, name')
      .order('name', { ascending: true });
    
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
