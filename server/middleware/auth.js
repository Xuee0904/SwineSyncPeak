import { supabase } from '../supabaseClient.js';

function getDisplayName(user) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Staff'
  );
}

export async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No active session token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No active session token provided.' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Access denied. Session has expired or is invalid.' });
    }

    if (user.user_metadata?.is_archived === true) {
      return res.status(403).json({ error: 'Access denied. This account has been archived.' });
    }

    const rawRole = String(user.app_metadata?.role || user.user_metadata?.role || 'Staff').toLowerCase();
    const isAdmin = rawRole === 'admin';

    req.user = user;
    req.userRole = isAdmin ? 'admin' : 'staff';
    req.isAdmin = isAdmin;
    req.userName = getDisplayName(user);
    req.userEmail = user.email || 'staff@swinesync.ag';

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyAdmin(req, res, next) {
  return verifyAuth(req, res, () => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Administrative privileges are required.' });
    }
    return next();
  });
}
