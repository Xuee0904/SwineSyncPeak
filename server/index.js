import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── GET /api/pigs ────────────────────────────────────────────────────────────
// Returns all pig records ordered by pig_tag.
// Optional query params:
//   ?status=healthy|sick|quarantine
//   ?gender=m|f|castrated
//   ?search=<text>  — matches pig_tag or gender (case-insensitive)
app.get('/api/pigs', async (req, res) => {
  try {
    const { status, gender, search } = req.query;

    let query = supabase
      .from('pigs')
      .select('*')
      .eq('is_archived', false)         // never return archived pigs
      .order('pig_tag', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (gender && gender !== 'all') {
      query = query.ilike('gender', `${gender}%`); // matches 'm','male','f','female','castrated'
    }
    if (search) {
      query = query.or(`pig_tag.ilike.%${search}%,gender.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] GET /api/pigs error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data, count: data.length });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/pigs/:pig_id ────────────────────────────────────────────────────
// Returns a single pig by UUID.
app.get('/api/pigs/:pig_id', async (req, res) => {
  try {
    const { pig_id } = req.params;

    const { data, error } = await supabase
      .from('pigs')
      .select('*')
      .eq('pig_id', pig_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: `Pig '${pig_id}' not found.` });
      }
      console.error('[Supabase] GET /api/pigs/:pig_id error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/piglet-batches ──────────────────────────────────────────────────
// Returns all piglet batch records.
// Optional query params:
//   ?status=suckling|weaned|transferred
//   ?search=<text>  — matches batch_tag (case-insensitive)
app.get('/api/piglet-batches', async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = supabase
      .from('piglet_batches')
      .select('*')
      .eq('is_archived', false)
      .order('batch_tag', { ascending: true });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('batch_tag', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] GET /api/piglet-batches error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data, count: data.length });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/piglet-batches/:batch_id ───────────────────────────────────────
// Returns a single piglet batch by UUID.
app.get('/api/piglet-batches/:batch_id', async (req, res) => {
  try {
    const { batch_id } = req.params;

    const { data, error } = await supabase
      .from('piglet_batches')
      .select('*')
      .eq('batch_id', batch_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: `Batch '${batch_id}' not found.` });
      }
      console.error('[Supabase] GET /api/piglet-batches/:batch_id error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/health-logs ─────────────────────────────────────────────────────
// Returns health logs for a pig or batch.
// Required (at least one): ?pig_id=<uuid>  or  ?batch_id=<uuid>
app.get('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Provide at least one of: pig_id, batch_id' });
    }

    let query = supabase
      .from('health_logs')
      .select('*')
      .order('log_date', { ascending: false });

    if (pig_id)   query = query.eq('pig_id', pig_id);
    if (batch_id) query = query.eq('batch_id', batch_id);

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] GET /api/health-logs error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data, count: data.length });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/vaccination-records ────────────────────────────────────────────
// Returns vaccination records for a pig or batch.
// Required (at least one): ?pig_id=<uuid>  or  ?batch_id=<uuid>
app.get('/api/vaccination-records', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'Provide at least one of: pig_id, batch_id' });
    }

    let query = supabase
      .from('vaccination_records')
      .select('*')
      .order('administered_date', { ascending: false });

    if (pig_id)   query = query.eq('pig_id', pig_id);
    if (batch_id) query = query.eq('batch_id', batch_id);

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] GET /api/vaccination-records error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data, count: data.length });
  } catch (err) {
    console.error('[Server] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/pigs/stats/summary ─────────────────────────────────────────────
// Returns aggregate counts: total, healthy, sick, quarantine.
app.get('/api/pigs/stats/summary', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pigs')
      .select('status')
      .eq('is_archived', false);

    if (error) return res.status(500).json({ error: error.message });

    const total      = data.length;
    const healthy    = data.filter(p => p.status === 'healthy').length;
    const sick       = data.filter(p => p.status === 'sick').length;
    const quarantine = data.filter(p => p.status === 'quarantine').length;

    res.json({ total, healthy, sick, quarantine });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ SwineSync API server running on http://localhost:${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
});