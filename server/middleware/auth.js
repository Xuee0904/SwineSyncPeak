import { supabase } from '../supabaseClient.js';

export async function verifyAdmin(req, res, next) {
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
