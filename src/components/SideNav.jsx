import React from 'react';
import {
  LayoutDashboard, Users, TrendingUp, Activity,
  Baby, ClipboardList, Receipt, Settings, LogOut, X, ChevronRight,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard',         label: 'Dashboard',           icon: LayoutDashboard },
  { id: 'swine_management',  label: 'Swine Management',    icon: Users,          sub: true },
  { id: 'growth_program',    label: 'Growth Program',      icon: TrendingUp,     sub: true },
  { id: 'health_management', label: 'Health Management',   icon: Activity,       sub: true },
  { id: 'breeding_logs',     label: 'Breeding Logs',       icon: Baby,           sub: true },
  { id: 'inventory',         label: 'Inventory Mgmt',      icon: ClipboardList,  sub: true },
  { id: 'transactions',      label: 'Transaction Records', icon: Receipt,        sub: true },
  { id: 'admin',             label: 'Admin Settings',      icon: Settings },
];

export default function SideNav({ activeTab, onTabChange, onClose, onLogout, loggedInUser, mobileOpen }) {
  const handleClick = (id) => {
    onTabChange(id);
    onClose?.();
  };

  // Type-safe initials extractor
  const getInitials = () => {
    if (!loggedInUser) return '?';
    if (typeof loggedInUser === 'string') return loggedInUser.charAt(0).toUpperCase();
    if (typeof loggedInUser === 'object') {
      const name = loggedInUser.user_metadata?.full_name || loggedInUser.email || '';
      return name.charAt(0).toUpperCase() || '?';
    }
    return '?';
  };

  // Type-safe display name extractor
  const getDisplayName = () => {
    if (!loggedInUser) return '';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Staff';
    }
    return '';
  };

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30',
          'w-60 h-screen',
          'bg-white border-r border-slate-100 shadow-sm',
          'flex flex-col justify-between',
          'overflow-y-auto',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
        id="sidenav"
        aria-label="Staff navigation"
      >
        <div>
          {/* Brand */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 shrink-0">
            <div>
              <p className="text-xs font-extrabold text-slate-900 tracking-tight">
                Swine<span className="text-emerald-600">Sync</span> Ops
              </p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                Main Facility
              </p>
            </div>
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="px-3 py-4 space-y-0.5" aria-label="Main menu">
            {NAV_ITEMS.map(({ id, label, icon: Icon, sub }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => handleClick(id)}
                  className={[
                    'w-full flex items-center gap-3 rounded-xl text-xs font-semibold',
                    'transition-all duration-150 cursor-pointer text-left py-2.5',
                    active
                      ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 pl-2 pr-3'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="flex-1 truncate">{label}</span>
                  {sub && !active && (
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Chip & Logout (Safe render guards) */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-1 shrink-0">
          {loggedInUser && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                {getInitials()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{getDisplayName()}</p>
                <p className="text-[10px] text-slate-400 font-semibold">Staff Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
            id="sidenav-logout-btn"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}