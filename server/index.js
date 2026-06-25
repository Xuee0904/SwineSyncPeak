// 1. Import dependencies (ES Module syntax)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();

// 2. Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Warning: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are missing. ' +
    'Please configure them in your .env file or your platform control panel.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Configure CORS (Cross-Origin Resource Sharing)
const allowedOrigins = [
  'http://localhost:5173',            // Local Vite Development
  'https://your-app-name.netlify.app'  // Replace with your real Netlify URL once deployed
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// 4. Global Middleware
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────

// GET /api/pigs — Get individual pigs with optional filters
app.get('/api/pigs', async (req, res) => {
  try {
    const { search, status, gender } = req.query;
    
    // Select data and query the total count
    let dbQuery = supabase.from('pigs').select('*', { count: 'exact' });

    // Filter by status if specified
    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status.toLowerCase());
    }

    // Filter by gender prefix (matches 'm', 'f', 'c')
    if (gender && gender !== 'all') {
      dbQuery = dbQuery.ilike('gender', `${gender}%`);
    }

    // Optional text search on tag
    if (search) {
      dbQuery = dbQuery.ilike('pig_tag', `%${search}%`);
    }

    const { data, error, count } = await dbQuery;

    if (error) throw error;
    res.json({ data: data ?? [], count: count ?? 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/piglet-batches — Get piglet batches with optional filters
app.get('/api/piglet-batches', async (req, res) => {
  try {
    const { search, status } = req.query;

    let dbQuery = supabase.from('piglet_batches').select('*', { count: 'exact' });

    // Filter by status if specified
    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status.toLowerCase());
    }

    // Optional text search on batch_tag
    if (search) {
      dbQuery = dbQuery.ilike('batch_tag', `%${search}%`);
    }

    const { data, error, count } = await dbQuery;

    if (error) throw error;
    res.json({ data: data ?? [], count: count ?? 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/health-logs — Fetch health logs by pig_id or batch_id
app.get('/api/health-logs', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;
    
    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'You must provide either pig_id or batch_id.' });
    }

    let dbQuery = supabase.from('health_logs').select('*');

    if (pig_id) {
      dbQuery = dbQuery.eq('pig_id', pig_id);
    } else {
      dbQuery = dbQuery.eq('batch_id', batch_id);
    }

    // Sort logs descending by default to show newest logs first
    dbQuery = dbQuery.order('log_date', { ascending: false });

    const { data, error } = await dbQuery;

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vaccination-records — Fetch vaccinations by pig_id or batch_id
app.get('/api/vaccination-records', async (req, res) => {
  try {
    const { pig_id, batch_id } = req.query;

    if (!pig_id && !batch_id) {
      return res.status(400).json({ error: 'You must provide either pig_id or batch_id.' });
    }

    let dbQuery = supabase.from('vaccination_records').select('*');

    if (pig_id) {
      dbQuery = dbQuery.eq('pig_id', pig_id);
    } else {
      dbQuery = dbQuery.eq('batch_id', batch_id);
    }

    // Sort descending to show newest first
    dbQuery = dbQuery.order('administered_date', { ascending: false });

    const { data, error } = await dbQuery;

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Start Server (Binding to dynamic cloud environment port, defaulting to 3001)
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});