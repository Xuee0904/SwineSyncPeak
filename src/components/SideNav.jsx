import React, { useState } from 'react';
import {
  LayoutDashboard, Users, TrendingUp, Activity,
  Baby, ClipboardList, Receipt, Settings, LogOut, X, ChevronRight,
  Grid3X3,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard',         label: 'Dashboard',           icon: LayoutDashboard },
  { id: 'swine_management',  label: 'Swine Management',    icon: Users,          sub: true,
    children: [
      { id: 'pen_management', label: 'Pen Management', icon: Grid3X3 },
    ]
  },
  { id: 'growth_program',    label: 'Growth Program',      icon: TrendingUp,     sub: true },
  { id: 'health_management', label: 'Health Management',   icon: Activity,       sub: true },
  { id: 'breeding_logs',     label: 'Breeding Logs',       icon: Baby,           sub: true },
  { id: 'inventory',         label: 'Inventory Mgmt',      icon: ClipboardList,  sub: true },
  { id: 'transactions',      label: 'Transaction Records', icon: Receipt,        sub: true },
  { id: 'admin',             label: 'Admin Settings',      icon: Settings },
];

export default function SideNav({ activeTab, onTabChange, onClose, onLogout, loggedInUser, mobileOpen }) {
  const [expanded, setExpanded] = useState(() => {
    const parentWithChild = NAV_ITEMS.find(item =>
      item.children?.some(child => child.id === activeTab) || (item.id === activeTab && !!item.children?.length)
    );
    return parentWithChild ? { [parentWithChild.id]: true } : {};
  });

  const getInitials = () => {
    if (!loggedInUser) return '?';
    if (typeof loggedInUser === 'string') return loggedInUser.charAt(0).toUpperCase();
    if (typeof loggedInUser === 'object') {
      const name = loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || '';
      return name.charAt(0).toUpperCase() || '?';
    }
    return '?';
  };

  const getDisplayName = () => {
    if (!loggedInUser) return '';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Staff';
    }
    return '';
  };

  const getUserRole = () => {
    if (!loggedInUser) return 'Staff';
    if (typeof loggedInUser === 'string') return 'Staff';
    if (typeof loggedInUser === 'object') {
      return loggedInUser.role || 'Staff';
    }
    return 'Staff';
  };

  const isItemActive = (item) => {
    if (activeTab === item.id) return true;
    return item.children?.some(c => c.id === activeTab) ?? false;
  };

  // ─── ROLE-BASED PRIVILEGES FILTERING ───
  const role = getUserRole().toLowerCase();

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (role !== 'admin') {
      if (item.id === 'admin' || item.id === 'transactions') {
        return false;
      }
    }
    return true;
  });

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50', // Elevated from z-30 to z-50 to sit above modal overlays
          'w-60 h-screen',
          'bg-white border-r border-slate-200/80 shadow-[4px_0_24px_-4px_rgba(15,23,42,0.05)]',
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

          {/* Nav Menu */}
          <nav className="px-3 py-4 space-y-0.5" aria-label="Main menu">
            {filteredNavItems.map(({ id, label, icon: Icon, sub, children }) => {
              const active       = activeTab === id;
              const parentActive = isItemActive({ id, children });
              const isExpanded   = !!expanded[id];
              const hasChildren  = !!children?.length;

              return (
                <div key={id} className="space-y-0.5">
                  {!hasChildren ? (
                    <button
                      onClick={() => {
                        onTabChange(id);
                        onClose?.();
                      }}
                      className={[
                        'w-full flex items-center gap-3 rounded-xl text-xs font-semibold py-2.5 text-left transition-all duration-150 cursor-pointer',
                        parentActive
                          ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 pl-2 pr-3'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${parentActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {sub && !parentActive && (
                        <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center w-full justify-between">
                      <button
                        onClick={() => {
                          onTabChange(id);
                        }}
                        className={[
                          'flex-1 flex items-center gap-3 rounded-l-xl text-xs font-semibold py-2.5 text-left transition-all duration-150 cursor-pointer',
                          parentActive
                            ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 pl-2 pr-1'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 pl-3 pr-1',
                        ].join(' ')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${parentActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="flex-1 truncate">{label}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
                        }}
                        className={[
                          'py-2.5 px-3 rounded-r-xl transition-all duration-150 cursor-pointer flex items-center justify-center border-l border-slate-100/40',
                          parentActive 
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50' 
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                        title={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
                        aria-label={isExpanded ? `Collapse ${label} menu` : `Expand ${label} menu`}
                      >
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 stroke-[2.5px] ${isExpanded ? 'rotate-90 text-emerald-600' : 'text-slate-400'}`} />
                      </button>
                    </div>
                  )}

                  {/* Children */}
                  {hasChildren && isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-2">
                      {children.map(({ id: cid, label: clabel, icon: CIcon }) => {
                        const childActive = activeTab === cid;
                        return (
                          <button
                            key={cid}
                            onClick={() => { onTabChange(cid); onClose?.(); }}
                            className={[
                              'w-full flex items-center gap-2.5 rounded-lg text-xs font-semibold',
                              'transition-all duration-150 cursor-pointer text-left py-2 px-2.5',
                              childActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                            ].join(' ')}
                            aria-current={childActive ? 'page' : undefined}
                          >
                            <CIcon className={`w-3.5 h-3.5 shrink-0 ${childActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="flex-1 truncate">{clabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Chip & Logout */}
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