export function getUserRole(user) {
  if (!user) return 'staff';
  if (typeof user === 'string') return 'staff';
  const raw = user.role || user.app_metadata?.role || user.user_metadata?.role || 'Staff';
  return String(raw).toLowerCase() === 'admin' ? 'admin' : 'staff';
}

export function isAdminUser(user) {
  return getUserRole(user) === 'admin';
}

export function isStaffUser(user) {
  return Boolean(user) && !isAdminUser(user);
}

const ADMIN_ONLY_TABS = new Set(['admin', 'approvals', 'transactions']);

export function canAccessTab(user, tabId) {
  if (ADMIN_ONLY_TABS.has(tabId)) {
    return isAdminUser(user);
  }
  if (tabId === 'my_submissions') {
    return isStaffUser(user);
  }
  return true;
}

export const VALID_TABS = new Set([
  'dashboard',
  'admin',
  'approvals',
  'my_submissions',
  'swine_management',
  'pen_management',
  'breeding_logs',
  'growth',
  'health_management',
  'inventory',
  'transactions',
]);

export function isValidTab(tabId) {
  return VALID_TABS.has(tabId);
}

export function mapSupabaseUser(user) {
  if (!user) return null;
  const email = user.email || '';
  const localPart = email ? email.split('@')[0] : '';
  const fallbackName = localPart
    ? localPart.charAt(0).toUpperCase() + localPart.slice(1)
    : 'Staff';
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    fallbackName;

  return {
    id: user.id,
    name: displayName,
    email,
    role: user.app_metadata?.role || user.user_metadata?.role || 'Staff',
  };
}
