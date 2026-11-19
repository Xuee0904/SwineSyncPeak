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
