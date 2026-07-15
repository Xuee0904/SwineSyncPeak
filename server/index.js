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

// ─── SECURITY MIDDLEWARE: ROLE-BASED PRIVILEGES VERIFICATION ─────────────────
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No active session token provided.' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token identity using standard public client to authenticate the caller
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Access denied. Session has expired or is invalid.' });
    }

    // Inspect user metadata to verify role permissions
    const userRole = user.user_metadata?.role || 'Staff';
    if (userRole.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrative privileges are required.' });
    }

    // Attach verified user to request context and proceed
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── ADMIN USER MANAGEMENT ENDPOINTS (SECURED WITH VERIFYADMIN) ─────────────

// 1. GET /api/admin/users
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
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
      const isArchived = !!user.user_metadata?.is_archived;

      return {
        id: user.id.slice(0, 8).toUpperCase(),
        fullId: user.id,
        name,
        email,
        role: user.user_metadata?.role || 'Staff',
        isArchived,
        // Shows as Archived first, otherwise falls back to active tracking status
        status: isArchived ? 'Archived' : (user.last_sign_in_at ? 'Active' : 'Inactive'),
        lastSignInAt: user.last_sign_in_at || null, 
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
app.post('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client (service role key) is not configured on this server.' });
    }

    const { email, password, name, role, creator } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required registration parameters (email, password, name).' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: role || 'Staff',
        must_change_password: true,
        is_archived: false // Default to active on creation
      }
    });

    if (error) throw error;

    let creatorName = 'Admin System';
    if (typeof creator === 'string' && creator.trim() !== '') {
      creatorName = creator;
    } else if (creator && typeof creator === 'object') {
      creatorName = creator.full_name || creator.name || creator.email || 'Admin System';
    }

    const initials = creatorName
      .split(' ')
      .map(word => word ? word[0] : '')
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const { error: logError } = await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_name: creatorName,
        user_email: creatorName.toLowerCase() === 'admin system' ? 'system@internal' : 'admin@gmail.com',
        user_initials: initials || 'AD',
        user_bg_color: 'bg-emerald-100 text-emerald-700',
        event_title: 'Account Created',
        event_desc: `Registered new caretaker account: ${name} (${email}) as ${role}.`,
        status: 'SUCCESS'
      });

    if (logError) {
      console.error('Failed to log account creation event:', logError.message);
    }

    res.json({ message: 'Staff account created successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. PUT /api/admin/users/:id (Edit & Archive/Restore Toggle)
app.put('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client not configured.' });
    }

    const { id } = req.params;
    const { name, role, is_archived, creator, targetRole } = req.body;

    if (targetRole && targetRole.toLowerCase() === 'admin') {
      return res.status(403).json({ error: 'Administrative security rules prevent editing fellow Admin accounts.' });
    }

    // Standard business lockout suspension: 100,000 hours ban duration if archived, 'none' if restored
    const banDuration = is_archived ? '100000h' : 'none';

    // Update user metadata & login permissions in Supabase Auth
    const { data: { user }, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: banDuration,
      user_metadata: {
        full_name: name,
        role: role || 'Staff',
        is_archived: !!is_archived
      }
    });

    if (error) throw error;

    let creatorName = 'Admin System';
    if (typeof creator === 'string' && creator.trim() !== '') {
      creatorName = creator;
    } else if (creator && typeof creator === 'object') {
      creatorName = creator.full_name || creator.name || creator.email || 'Admin System';
    }

    const initials = creatorName.split(' ').map(w => w ? w[0] : '').join('').toUpperCase().slice(0, 2);

    // Determine event details dynamically
    const eventTitle = is_archived ? 'Account Archived' : 'Account Restored';
    const eventDesc = is_archived 
      ? `Temporarily suspended access credentials for ${name} (${user.email}).`
      : `Restored login capabilities and credentials for ${name} (${user.email}).`;

    await supabaseAdmin.from('activity_logs').insert({
      user_name: creatorName,
      user_email: 'admin@gmail.com',
      user_initials: initials || 'AD',
      // Color: rose for archiving, emerald for restoring, amber for plain edits
      user_bg_color: is_archived ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700',
      event_title: eventTitle,
      event_desc: eventDesc,
      status: 'SUCCESS'
    });

    res.json({ message: 'Caretaker account updated successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. GET /api/admin/activity-logs (PAGINATION SUPPORTED — limit removed)
app.get('/api/admin/activity-logs', verifyAdmin, async (req, res) => {
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
      .order('timestamp', { ascending: false }); // Limit constraint removed completely

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

// GET /api/pigs/stats – aggregate counts for summary cards
app.get('/api/pigs/stats', async (req, res) => {
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
    
    // Sum of current_count in active piglet batches
    const batches = batchesRes.data || [];
    const pigletCount = batches.reduce((sum, b) => sum + (b.current_count || 0), 0);
    
    const totalCount = pigsCount + pigletCount;
    const healthyCount = totalCount - sickCount - quarCount;

    // Female pigs are Sow, representing pregnant/breeding candidates
    const femalePigs = (pigsRes.data || []).filter(p => {
      const g = (p.gender || '').toLowerCase();
      return g.startsWith('f') || g === 'female' || g === 'sow';
    }).length;

    res.json({
      total: totalCount,
      healthy: Math.max(0, healthyCount),
      sick: sickCount,
      quarantine: quarCount,
      pregnant: femalePigs
    });
  } catch (error) {
    console.error("Express Error at /api/pigs/stats:", error);
    res.status(500).json({ error: error.message, details: error });
  }
});

// Helper: current occupancy for a single pen = active pigs assigned to it
// + the head count of active piglet batches assigned to it.
async function getPenOccupancy(penId) {
  const [pigsRes, batchesRes] = await Promise.all([
    supabase.from('pigs').select('*', { count: 'exact', head: true }).eq('pen_id', penId).eq('is_archived', false),
    supabase.from('piglet_batches').select('current_count').eq('pen_id', penId).eq('is_archived', false),
  ]);
  const pigCount = pigsRes.count ?? 0;
  const batchCount = (batchesRes.data || []).reduce((sum, b) => sum + (b.current_count || 0), 0);
  return pigCount + batchCount;
}

// Helper: occupancy for ALL pens at once, as a Map<pen_id, occupiedCount>.
// Used by /api/pens/available so we don't run one query per pen.
async function getAllPenOccupancy() {
  const [pigsRes, batchesRes] = await Promise.all([
    supabase.from('pigs').select('pen_id').eq('is_archived', false),
    supabase.from('piglet_batches').select('pen_id, current_count').eq('is_archived', false),
  ]);

  const occupancy = new Map();
  for (const pig of pigsRes.data || []) {
    if (!pig.pen_id) continue;
    occupancy.set(pig.pen_id, (occupancy.get(pig.pen_id) || 0) + 1);
  }
  for (const batch of batchesRes.data || []) {
    if (!batch.pen_id) continue;
    occupancy.set(batch.pen_id, (occupancy.get(batch.pen_id) || 0) + (batch.current_count || 0));
  }
  return occupancy;
}

// GET /api/pens – fetch all pens for dropdown filter
app.get('/api/pens', async (req, res) => {
  // NOTE: the `pens` table's real columns are `pen_id` and `pen_code` (not id/name).
  // Aliasing here keeps the response shape `{ id, name }` so AddPigModal.jsx,
  // the pen filter dropdown, and the Pen Management cards in SwineManagement.jsx
  // don't need to change.
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
// pig/piglet. Used by the Add Pig / Add Batch forms so users can't select a
// full pen in the first place. (The general /api/pens route above is left
// untouched since the Pen Filter dropdown and Pen Management page still need
// to show every pen, including full ones.)
app.get('/api/pens/available', async (req, res) => {
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

// GET /api/pigs
// ─── SWINE MANAGEMENT ENDPOINTS ─────────────────────────────────────────────

app.get('/api/pigs/stats', async (req, res) => {
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

app.get('/api/breeds', async (req, res) => {
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

app.get('/api/pigs', async (req, res) => {
  try {
    const { search, status, pen, category, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = parseInt(limit) || 10;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    let pigData = [], batchData = [];
    const queryPigs = !category || ['all', 'sow', 'boar'].includes(category);
    const queryBatches = !category || ['all', 'piglet_batch'].includes(category);

    if (queryPigs) {
      let q = supabase.from('pigs').select('*').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') q = q.eq('status', status.toLowerCase());
      if (search) q = q.ilike('pig_tag', `%${search}%`);
      const { data } = await q;
      pigData = data || [];
    }

    if (queryBatches) {
      let q = supabase.from('piglet_batches').select('*').eq('is_archived', false);
      if (pen && pen !== 'all') q = q.eq('pen_id', pen);
      if (status && status !== 'all') q = q.eq('status', status.toLowerCase());
      if (search) q = q.ilike('batch_tag', `%${search}%`);
      const { data } = await q;
      batchData = data || [];
    }

    const unifiedPigs = pigData.map(pig => ({
      id: pig.pig_id, 
      pig_tag: pig.pig_tag, 
      breed: pig.breed || '—',
      age_weeks: pig.date_of_birth ? Math.floor((Date.now() - new Date(pig.date_of_birth)) / 604800000) : '—',
      current_weight: pig.weight,
      category: (pig.gender || '').toLowerCase().startsWith('f') ? 'Sow' : 'Boar',
      status: pig.status || 'healthy'
    }));

    const unifiedBatches = batchData.map(batch => ({
      id: batch.batch_id, 
      pig_tag: batch.batch_tag, 
      breed: '—', 
      age_weeks: '—',
      current_weight: batch.average_weight, 
      category: 'Piglet Batch', 
      status: batch.status || 'suckling'
    }));

    let merged = [...unifiedPigs, ...unifiedBatches];
    if (category && category !== 'all') {
      const map = { sow: 'Sow', boar: 'Boar', piglet_batch: 'Piglet Batch' };
      merged = merged.filter(i => i.category === map[category]);
    }

    res.json({ data: merged.slice(from, to + 1), count: merged.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── INSERTION ENDPOINTS (FIXED WITH SUPABASEADMIN) ──────────────────────────

// 1. Create an individual pig (Sow/Boar)
app.post('/api/pigs', async (req, res) => {
  try {
    const { tagNumber, dateOfBirth, breed, weight, penId, status, gender } = req.body;
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

    // 2. Confirm the selected pen still has room (guards against the dropdown
    // being stale, or two people submitting for the same pen at once).
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

    res.json({ message: 'Pig added successfully', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a piglet batch
app.post('/api/pigs/batch', async (req, res) => {
  try {
    const { batchId, penLocation, totalHerdCount, status } = req.body;

    // Confirm the pen has room for the whole batch before inserting.
    if (penLocation) {
      const { data: pen, error: penError } = await supabase
        .from('pens')
        .select('pen_code, max_capacity')
        .eq('pen_id', penLocation)
        .single();

      if (penError) throw penError;

      const occupied = await getPenOccupancy(penLocation);
      const incoming = parseInt(totalHerdCount) || 0;
      const remaining = Math.max(0, (pen.max_capacity ?? 0) - occupied);

      if (incoming > remaining) {
        return res.status(400).json({
          error: `Pen ${pen.pen_code} only has ${remaining} slot(s) left, but this batch has ${incoming} piglet(s).`,
        });
      }
    }

    // Use supabaseAdmin to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('piglet_batches')
      .insert([{
        batch_tag: batchId,
        pen_id: penLocation,
        status: status === 'active' ? 'healthy' : 'quarantine',
        current_count: parseInt(totalHerdCount),
        is_archived: false
      }])
      .select();

    if (error) throw error;

    await supabaseAdmin.from('activity_logs').insert({
      user_name: 'Caretaker',
      user_initials: 'CT',
      event_title: 'Batch Created',
      event_desc: `Created piglet batch ${batchId} (${totalHerdCount} heads).`,
      status: 'SUCCESS'
    });

    res.json({ message: 'Batch added successfully', data });
  } catch (error) {
    console.error("Error inserting batch:", error);
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