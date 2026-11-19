import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, TrendingUp,
  ClipboardList, Receipt, Settings, X, ChevronRight,
  Grid3X3, HeartPulse, Dna, ClipboardCheck, LogOut,
} from 'lucide-react';
import PigSnout from './common/PigSnout';
import farmLogo from '../assets/Logo.jpg';
import { isAdminUser } from '../utils/rbac';
import useConfirmDialog from '../hooks/useConfirmDialog';

// eslint-disable-next-line react-refresh/only-export-components
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'swine_management', label: 'Swine Management', icon: PigSnout, sub: true,
    children: [
      { id: 'pen_management', label: 'Pen Management', icon: Grid3X3 },
    ]
  },
  { id: 'growth', label: 'Growth Management', icon: TrendingUp },
  { id: 'health_management', label: 'Health Management', icon: HeartPulse },
  { id: 'breeding_logs', label: 'Breeding Logs', icon: Dna },
  { id: 'inventory', label: 'Inventory', icon: ClipboardList },
  { id: 'my_submissions', label: 'My Submissions', icon: ClipboardCheck, staffOnly: true },
  { id: 'transactions', label: 'Transaction Records', icon: Receipt, adminOnly: true },
  {
    id: 'admin', label: 'Admin Settings', icon: Settings, adminOnly: true,
    children: [
      { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
    ]
  },
];

export default function SideNav({
  activeTab,
  onTabChange,
  onClose,
  onLogout,
  loggedInUser,
  mobileOpen,
  pendingApprovalsCount = 0,
}) {
  const { confirmDialog, openConfirm } = useConfirmDialog();

  const [expanded, setExpanded] = useState(() => {
    const parentWithActiveChild = NAV_ITEMS.find(item =>
      item.children?.some(child => child.id === activeTab)
    );
    return parentWithActiveChild ? { [parentWithActiveChild.id]: true } : {};
  });

  useEffect(() => {
    const parentWithActiveChild = NAV_ITEMS.find(item =>
      item.children?.some(child => child.id === activeTab)
    );
    if (parentWithActiveChild) {
      setExpanded(prev => (prev[parentWithActiveChild.id] ? prev : { ...prev, [parentWithActiveChild.id]: true }));
    }
  }, [activeTab]);

  const isAdmin = isAdminUser(loggedInUser);

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly || item.id === 'admin' || item.id === 'transactions') {
      return isAdmin;
    }
    if (item.staffOnly || item.id === 'my_submissions') {
      return !isAdmin;
    }
    return true;
  });

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50', // Elevated from z-30 to z-50 to sit above modal overlays
          'w-64 h-screen',
          'bg-slate-900 border-r border-slate-800/80 shadow-[4px_0_24px_-4px_rgba(2,6,23,0.35)]',
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
          <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={farmLogo}
                alt="Ambo & Ang's Oink Yard Logo"
                className="w-9 h-9 rounded-xl object-contain bg-[#fdfbf7] p-0.5 shadow-sm border border-white/10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white tracking-tight truncate" title="Ambo & Ang's Oink Yard">
                  Ambo &amp; Ang&apos;s Oink Yard
                </p>
                <p className="text-[10px] font-semibold text-emerald-400 tracking-wide truncate">
                  SwineSync Ops
                </p>
              </div>
            </div>
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Menu */}
          <nav className="px-3 py-4 space-y-0.5" aria-label="Main menu">
            {filteredNavItems.map(({ id, label, icon: Icon, sub, children }) => {
              const active = activeTab === id;
              const hasActiveChild = children?.some(c => c.id === activeTab) ?? false;
              const isExpanded = !!expanded[id];
              const hasChildren = !!children?.length;
              const showCollapsedChildIndicator = hasActiveChild && !isExpanded;

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
                        active
                          ? 'bg-emerald-600 text-white px-3 shadow-sm shadow-emerald-600/25'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 px-3',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="flex-1 truncate">{label}</span>
                      {id === 'my_submissions' && pendingApprovalsCount > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold leading-none shrink-0"
                          aria-label={`${pendingApprovalsCount} pending submissions`}
                        >
                          {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
                        </span>
                      )}
                      {sub && !active && (
                        <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center w-full justify-between">
                      <button
                        onClick={() => {
                          onTabChange(id);
                          onClose?.();
                        }}
                        className={[
                          'flex-1 flex items-center gap-3 rounded-l-xl text-xs font-semibold py-2.5 text-left transition-all duration-150 cursor-pointer',
                          active
                            ? 'bg-emerald-600 text-white pl-3 pr-1 shadow-sm shadow-emerald-600/25'
                            : showCollapsedChildIndicator
                              ? 'bg-emerald-500/15 text-emerald-300 pl-3 pr-1'
                              : 'text-slate-300 hover:text-white hover:bg-white/5 pl-3 pr-1',
                        ].join(' ')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active
                            ? 'text-white'
                            : showCollapsedChildIndicator
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                            }`}
                        />
                        <span className="flex-1 truncate">{label}</span>
                        {id === 'admin' && !isExpanded && pendingApprovalsCount > 0 && (
                          <span
                            className="px-1.5 py-0.5 mr-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold leading-none shrink-0"
                            aria-label={`${pendingApprovalsCount} pending approvals`}
                          >
                            {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
                        }}
                        className={[
                          'py-2.5 px-3 rounded-r-xl transition-all duration-150 cursor-pointer flex items-center justify-center border-l',
                          active
                            ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 shadow-sm shadow-emerald-600/25'
                            : showCollapsedChildIndicator
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/25'
                              : 'text-slate-400 border-slate-800/60 hover:text-white hover:bg-white/5',
                        ].join(' ')}
                        title={isExpanded ? "Collapse sub-items" : "Expand sub-items"}
                        aria-label={isExpanded ? `Collapse ${label} menu` : `Expand ${label} menu`}
                      >
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform duration-300 ease-in-out stroke-[2.5px] ${isExpanded ? 'rotate-90' : ''
                            } ${active
                              ? 'text-white'
                              : showCollapsedChildIndicator
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Children with smooth CSS grid accordion transition */}
                  {hasChildren && (
                    <div
                      className={`grid transition-[grid-template-rows,opacity,margin] duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isExpanded
                        ? 'grid-rows-[1fr] opacity-100 mt-1'
                        : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                        }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-4 space-y-0.5 border-l-2 border-slate-800 pl-2 py-0.5">
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
                                    ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                                ].join(' ')}
                                aria-current={childActive ? 'page' : undefined}
                              >
                                <CIcon className={`w-3.5 h-3.5 shrink-0 ${childActive ? 'text-white' : 'text-slate-500'}`} />
                                <span className="flex-1 truncate">{clabel}</span>
                                {cid === 'approvals' && pendingApprovalsCount > 0 && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-extrabold leading-none shrink-0"
                                    aria-label={`${pendingApprovalsCount} pending approvals`}
                                  >
                                    {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Logout */}
        <div className="px-3 py-4 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              openConfirm({
                title: 'Log out of SwineSync?',
                subtitle: 'End current session',
                message: 'Are you sure you want to log out? Any unsaved changes will not be saved.',
                icon: <LogOut className="w-4 h-4" />,
                confirmLabel: 'Logout',
                leftOffset: 'left-0',
                onConfirm: () => {
                  onClose?.();
                  onLogout?.();
                },
              });
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-all cursor-pointer"
            id="sidenav-logout-btn"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {confirmDialog}

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
