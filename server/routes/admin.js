import express from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { verifyAdmin } from '../middleware/auth.js';

const router = express.Router();

// 1. GET /api/admin/users
router.get('/api/admin/users', verifyAdmin, async (req, res) => {
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
router.post('/api/admin/users', verifyAdmin, async (req, res) => {
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
router.put('/api/admin/users/:id', verifyAdmin, async (req, res) => {
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
router.get('/api/admin/activity-logs', verifyAdmin, async (req, res) => {
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

export default router;
