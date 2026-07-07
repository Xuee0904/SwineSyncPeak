import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Warning: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are missing. ' +
    'Please configure them in your .env file or your platform control panel.'
  );
}

// Initialize standard client (anon)
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize administrative client (using service role key to manage Auth users)
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

if (!supabaseAdmin) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Admin user management endpoints will be disabled.');
}

const allowedOrigins = [
  'http://localhost:5173',
  'https://swinesync.netlify.app' // Change this to your actual Netlify URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Cache configuration variables stored in server memory for News
let cachedNews = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ─── Keywords that must appear in title/description for an article to qualify ──
const SWINE_KEYWORDS = [
  'swine', 'pig', 'hog', 'pork', 'piglet', 'sow', 'boar',
  'african swine fever', 'asf', 'foot-and-mouth', 'fmd',
  'hog raising', 'pig farming', 'pig disease', 'swine flu',
  'livestock disease', 'animal disease', 'veterinary',
  'porcine', 'piggery', 'swine industry',
];

// Returns true if the article title or description contains at least one swine keyword
function isSwineRelated(article) {
  const text = `${article.title ?? ''} ${article.description ?? ''}`.toLowerCase();
  return SWINE_KEYWORDS.some(kw => text.includes(kw));
}

// ─── ADMIN USER MANAGEMENT ENDPOINTS ────────────────────────────────────────

// 1. GET /api/admin/users
app.get('/api/admin/users', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client (service role key) is not configured on this server.' });
    }

    // List all users registered under your Supabase project authentication system
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    // Format the Supabase Auth data to match your Admin.jsx table schema
    const formattedUsers = users.map(user => {
      const email = user.email || 'no-email@swinesync.com';
      const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
      return {
        id: user.id.slice(0, 8).toUpperCase(),
        fullId: user.id,
        name,
        email,
        role: user.user_metadata?.role || 'Staff',
        status: user.last_sign_in_at ? 'Active' : 'Inactive',
        lastSignInAt: user.last_sign_in_at || null, // Keep raw ISO timestamp for precise front-end sorting
        lastLogin: user.last_sign_in_at 
          ? new Date(user.last_sign_in_at).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          : 'Never Signed In',
        avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`
      };
    });

    res.json({ users: formattedUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /api/admin/users
app.post('/api/admin/users', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client (service role key) is not configured on this server.' });
    }

    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required registration parameters (email, password, name).' });
    }

    // Create the user administratively. This bypasses client-side signup flow,
    // auto-confirms their email address, and records user metadata.
    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true, // auto-confirm email so staff can log in immediately
      user_metadata: {
        full_name: name,
        role: role || 'Staff'
      }
    });

    if (error) throw error;

    res.json({ message: 'Staff account created successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/activity-logs
app.get('/api/admin/activity-logs', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Administrative client (service role key) is not configured on this server.',
        hint: 'Verify that SUPABASE_SERVICE_ROLE_KEY is defined in your server/.env file and that you restarted your terminal.'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10); 

    // If Supabase returned an error, return its full descriptive body
    if (error) {
      console.error('Supabase Query Error:', error);
      return res.status(500).json({ error: error.message, details: error });
    }

    res.json({ logs: data ?? [] });
  } catch (error) {
    console.error('Express Server Exception:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// GET /api/philippines-swine-news
app.get('/api/philippines-swine-news', async (req, res) => {
  try {
    const currentTime = Date.now();

    if (cachedNews && (currentTime - lastFetchTime < CACHE_DURATION)) {
      console.log('Serving swine news from server cache. API credit saved.');
      return res.json({ articles: cachedNews });
    }

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return res.json({ articles: [], warning: 'NEWS_API_KEY is not configured on the server.' });
    }

    console.log('Cache expired or empty. Querying NewsAPI.org for fresh swine news...');

    const query = encodeURIComponent(
      '(intitle:"swine" OR intitle:"pig" OR intitle:"hog" OR intitle:"ASF" OR intitle:"African Swine Fever" OR intitle:"pork" OR intitle:"piglet" OR intitle:"swine fever" OR intitle:"livestock disease") AND (Philippines OR "Southeast Asia" OR Asia)'
    );
    const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=15&apiKey=${apiKey}`;

    const newsResponse = await fetch(url, { headers: { 'User-Agent': 'SwineSync-App/1.0' } });
    const data = await newsResponse.json();

    if (data.status !== 'ok') {
      throw new Error(data.message || 'Failed to fetch news from NewsAPI.org');
    }

    const relevant = (data.articles ?? []).filter(isSwineRelated);

    if (relevant.length === 0) {
      console.warn('NewsAPI returned results but none passed the swine relevance filter.');
    }

    const articles = relevant.slice(0, 6).map((art, idx) => ({
      id:       `live-disease-${idx}`,
      title:    art.title,
      summary:  art.description || 'No description available. Click to read the full article.',
      content:  art.content    || 'Read the full coverage on the original publisher site.',
      category: 'disease',
      date: new Date(art.publishedAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      }),
      author:    art.source?.name || 'Veterinary Monitor',
      important: false,
      url:       art.url,
      color:     'border-l-4 border-l-rose-500',
    }));

    cachedNews    = articles;
    lastFetchTime = currentTime;

    res.json({ articles });
  } catch (error) {
    console.error('Error fetching live swine news:', error.message);

    if (cachedNews) {
      console.log('Returning stale cache as fallback due to API error.');
      return res.json({ articles: cachedNews });
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/pigs
app.get('/api/pigs', async (req, res) => {
  try {
    const { search, status, gender } = req.query;
    let dbQuery = supabase.from('pigs').select('*', { count: 'exact' });

    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status.toLowerCase());
    }

    if (gender && gender !== 'all') {
      dbQuery = dbQuery.ilike('gender', `${gender}%`);
    }

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

// GET /api/piglet-batches
app.get('/api/piglet-batches', async (req, res) => {
  try {
    const { search, status } = req.query;
    let dbQuery = supabase.from('piglet_batches').select('*', { count: 'exact' });

    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status.toLowerCase());
    }

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

// GET /api/health-logs
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

    dbQuery = dbQuery.order('log_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vaccination-records
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

    dbQuery = dbQuery.order('administered_date', { ascending: false });
    const { data, error } = await dbQuery;
    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});