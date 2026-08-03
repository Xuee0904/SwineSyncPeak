import express from 'express';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// GET /api/health-logs
router.get('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;

    let dbQuery = supabase.from('health_logs').select('*');
    if (pig_id) {
      dbQuery = dbQuery.eq('pig_id', pig_id);
    } else {
      dbQuery = dbQuery.eq('batch_id', batch_id);
    }

    dbQuery = dbQuery.order('log_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vaccination-records
router.get('/api/vaccination-records', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;

    let dbQuery = supabase.from('vaccination_records').select('*');
    if (pig_id) {
      dbQuery = dbQuery.eq('pig_id', pig_id);
    } else {
      dbQuery = dbQuery.eq('batch_id', batch_id);
    }

    dbQuery = dbQuery.order('administered_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/health-logs
router.post('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id, recorded_by, symptoms, diagnosis, treatment, medication_name, dosage, status, notes } = req.body;
    
    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id' });
    }

    const { data, error } = await supabase
      .from('health_logs')
      .insert([
        { pig_id, batch_id, recorded_by, symptoms, diagnosis, treatment, medication_name, dosage, status, notes }
      ])
      .select();

    if (error) throw error;
    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/health-logs/:id
router.put('/api/health-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('health_logs')
      .update(updates)
      .eq('health_id', id)
      .select();

    if (error) throw error;
    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mortality-logs
router.get('/api/mortality-logs', async (req, res) => {
  try {
    const { pig_id, batch_id, pen_id } = req.query;

    let dbQuery = supabase.from('mortality_logs').select('*');
    if (pig_id) dbQuery = dbQuery.eq('pig_id', pig_id);
    if (batch_id) dbQuery = dbQuery.eq('batch_id', batch_id);
    if (pen_id) dbQuery = dbQuery.eq('pen_id', pen_id);

    dbQuery = dbQuery.order('log_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mortality-logs
router.post('/api/mortality-logs', async (req, res) => {
  try {
    const { pen_id, batch_id, pig_id, cause, action_taken, recorded_by } = req.body;
    
    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Must provide pig_id or batch_id' });
    }

    const { data, error } = await supabase
      .from('mortality_logs')
      .insert([
        { pen_id, batch_id, pig_id, cause, action_taken, recorded_by }
      ])
      .select();

    if (error) throw error;
    res.json({ data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
