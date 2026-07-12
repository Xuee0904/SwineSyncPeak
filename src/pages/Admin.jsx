import React, { useState, useEffect } from 'react';
import AddStaffModal from '../components/admin/AddStaffModal';
import EditStaffModal from '../components/admin/EditStaffModal';
import ArchiveStaffModal from '../components/admin/ArchiveStaffModal';
import SuccessArchiveStaffModal from '../components/admin/SuccessArchiveStaffModal';
import { supabase } from '../supabaseClient';
import { 
  Users, Download, Plus, Edit2, MoreVertical, 
  Activity, Search, X, Loader2, AlertCircle, Lock, Unlock,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const LOGS_PER_PAGE = 5; 
const STAFF_PER_PAGE = 5; 

// ─── Table 1: Account Management Loading Skeleton ──────────────────────────
function TableSkeleton({ rows = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="p-4 pl-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
              <div className="space-y-1.5 flex-grow max-w-[140px]">
                <div className="h-3 w-3/4 bg-slate-100 rounded" />
                <div className="h-2 w-full bg-slate-100/70 rounded" />
              </div>
            </div>
          </td>
          <td className="p-4 pl-6">
            <div className="h-5 w-12 bg-slate-100 rounded-full" />
          </td>
          <td className="p-4 pl-7">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <div className="h-3 w-10 bg-slate-100 rounded" />
            </div>
          </td>
          <td className="p-4 text-left">
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </td>
          <td className="p-4 text-right pr-6">
            <div className="flex justify-end gap-1.5">
              <div className="w-6 h-6 bg-slate-100 rounded" />
              <div className="w-6 h-6 bg-slate-100 rounded" />
              <div className="w-6 h-6 bg-slate-100 rounded" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Table 2: Activity Log Loading Skeleton ──────────────────────────────────
function ActivityLogSkeleton({ rows = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="p-4 pl-6">
            <div className="space-y-1.5 w-24">
              <div className="h-3.5 bg-slate-100 rounded w-5/6" />
              <div className="h-2.5 bg-slate-100/70 rounded w-1/2" />
            </div>
          </td>
          <td className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 shrink-0" />
              <div className="space-y-1.5 flex-grow max-w-[120px]">
                <div className="h-3 bg-slate-100 rounded" />
                <div className="h-2 bg-slate-100/70 rounded w-5/6" />
              </div>
            </div>
          </td>
          <td className="p-4 space-y-2">
            <div className="h-3.5 bg-slate-100 rounded w-1/3" />
            <div className="h-2.5 bg-slate-100/70 rounded w-2/3" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Admin Component ───
export default function Admin({ loggedInUser }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Real-time Activity Log States
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);

  // Filter States
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('all');

  // Progressive Disclosure: Custom Date Range boundaries
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Dropdown & Edit Modal Targets
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [selectedEditStaff, setSelectedEditStaff] = useState(null);
  
  // Dynamic Archiving / Restoring States
  const [selectedArchiveStaff, setSelectedArchiveStaff] = useState(null);
  const [recentlyArchivedStaff, setRecentlyArchivedStaff] = useState(null);
  const [showArchiveSuccess, setShowArchiveSuccess] = useState(false);
  const [archiveSuccessType, setArchiveSuccessType] = useState(false); 

  // Pagination states
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [staffCurrentPage, setStaffCurrentPage] = useState(1);

  const loadStaffAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned error ${res.status}`);
      }
      const data = await res.json();
      setStaffList(data.users ?? []);
      setStaffCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`${API_BASE_URL}/api/admin/activity-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned error ${res.status}`);
      }
      const data = await res.json();
      setActivityLogs(data.logs ?? []);
      setLogCurrentPage(1); 
    } catch (err) {
      setLogsError(err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadStaffAccounts();
    loadActivityLogs();
  }, []);

  const handleExport = (tableName) => {
    alert(`Exporting ${tableName} dataset as CSV…`);
  };

  const getUsernameSafe = () => {
    if (!loggedInUser) return '';
    if (typeof loggedInUser === 'string') return loggedInUser.toLowerCase();
    if (typeof loggedInUser === 'object') {
      if (loggedInUser.name) return loggedInUser.name.toLowerCase();
      return (loggedInUser.user_metadata?.full_name || loggedInUser.email || '').toLowerCase();
    }
    return '';
  };

  // ─── Priority Sorting (You -> Active/Inactive -> Archived at the bottom) ───
  const processedStaff = [...staffList].sort((a, b) => {
    const currentUser = getUsernameSafe();
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    const aEmail = (a.email || '').toLowerCase();
    const bEmail = (b.email || '').toLowerCase();

    const aIsYou = currentUser && (aName === currentUser || aEmail.includes(currentUser));
    const bIsYou = currentUser && (bName === currentUser || bEmail.includes(currentUser));

    // 1. Current logged-in session user always first
    if (aIsYou && !bIsYou) return -1;
    if (!aIsYou && bIsYou) return 1;

    // 2. Archived accounts pushed to the absolute bottom of the entire table
    if (a.isArchived && !b.isArchived) return 1;
    if (!a.isArchived && b.isArchived) return -1;

    // 3. Sort active/inactive chronologically by last sign-in timestamp
    const aTime = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
    const bTime = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
    
    return bTime - aTime;
  });

  const filteredStaff = processedStaff.filter(staff => {
    const name = (staff.name || '').toLowerCase();
    const email = (staff.email || '').toLowerCase();
    const id = (staff.id || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    return name.includes(q) || email.includes(q) || id.includes(q);
  });

  // Account Management Pagination bounds
  const totalStaff = filteredStaff.length;
  const totalStaffPages = Math.ceil(totalStaff / STAFF_PER_PAGE) || 1;
  const safeStaffPage = Math.min(staffCurrentPage, totalStaffPages);

  const staffStartIndex = (safeStaffPage - 1) * STAFF_PER_PAGE;
  const staffEndIndex = Math.min(staffStartIndex + STAFF_PER_PAGE, totalStaff);
  const paginatedStaff = filteredStaff.slice(staffStartIndex, staffEndIndex);

  // Filtered Activity Logs
  const filteredLogs = activityLogs.filter((log) => {
    const logDate = new Date(log.timestamp);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfLast7Days = new Date(startOfToday);
    startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);
    const startOfLast30Days = new Date(startOfToday);
    startOfLast30Days.setDate(startOfLast30Days.getDate() - 30);

    if (logDateFilter === 'today') {
      if (logDate < startOfToday) return false;
    } else if (logDateFilter === 'yesterday') {
      if (logDate < startOfYesterday || logDate >= startOfToday) return false;
    } else if (logDateFilter === 'week') {
      if (logDate < startOfLast7Days) return false;
    } else if (logDateFilter === 'month') {
      if (logDate < startOfLast30Days) return false;
    } else if (logDateFilter === 'custom') {
      if (customStartDate) {
        const startLimit = new Date(customStartDate);
        startLimit.setHours(0, 0, 0, 0);
        if (logDate < startLimit) return false;
      }
      if (customEndDate) {
        const endLimit = new Date(customEndDate);
        endLimit.setHours(23, 59, 59, 999);
        if (logDate > endLimit) return false;
      }
    }

    const q = logSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (log.user_name || '').toLowerCase().includes(q) ||
      (log.user_email || '').toLowerCase().includes(q) ||
      (log.event_title || '').toLowerCase().includes(q) ||
      (log.event_desc && log.event_desc.toLowerCase().includes(q));

    return matchesSearch;
  });

  // Activity Log Pagination bounds
  const totalLogs = filteredLogs.length;
  const totalLogPages = Math.ceil(totalLogs / LOGS_PER_PAGE) || 1;
  const safeLogPage = Math.min(logCurrentPage, totalLogPages);
  
  const logStartIndex = (safeLogPage - 1) * LOGS_PER_PAGE;
  const logEndIndex = Math.min(logStartIndex + LOGS_PER_PAGE, totalLogs);
  const paginatedLogs = filteredLogs.slice(logStartIndex, logEndIndex);

  return (
    <div className="space-y-6 pb-16 text-left animate-fade-in" id="admin-portal-view">

      {/* ─── VERTICAL SLIDE ANIMATION & SCROLLBAR SUPPRESSION ─── */}
      <style>{`
        @keyframes verticalPageSlide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-page-turn {
          animation: verticalPageSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ─── CARD 1: ACCOUNT MANAGEMENT ─────────────────────────────────────── */}
      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="account-management-card">
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Account Management</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleExport('Account Management')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-655 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1 inline-block" />
              Export
            </button>
            <button 
              onClick={() => setIsAddStaffOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 mr-1 inline-block" />
              Add Staff
            </button>
          </div>
        </div>

        {/* Live Search Filter */}
        <div className="px-5 py-2.5 bg-slate-50/40 border-b border-slate-50 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-[11px] text-slate-700 outline-none w-full placeholder-slate-450"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-455 hover:text-slate-655">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Error State Handler */}
        {error && (
          <div className="p-4 flex items-center gap-3 text-xs text-rose-700 bg-rose-50 border-b border-slate-50">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Could not fetch users: {error}. Make sure the server is configured with <code>SUPABASE_SERVICE_ROLE_KEY</code>.</span>
          </div>
        )}

        {/* Table Area */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/20 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50">
                <th className="p-4 pl-6 text-left">Staff Member</th>
                <th className="p-4 pl-6 text-left">Role</th>
                <th className="p-4 pl-7 text-left">Status</th>
                <th className="p-4 text-left">Last Login</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            {/* Dynamic key triggers smooth vertical slide transition without horizontal overflow */}
            <tbody key={safeStaffPage} className="divide-y divide-slate-50 animate-page-turn">
              {loading ? (
                <TableSkeleton rows={4} />
              ) : (
                paginatedStaff.map((staff, index) => {
                  const currentUser = getUsernameSafe();
                  const staffName = staff.name || '';
                  const staffEmail = staff.email || '';
                  const isYou = currentUser && (staffName.toLowerCase().includes(currentUser) || staffEmail.toLowerCase().includes(currentUser));
                  const isTargetAdmin = (staff.role || '').toLowerCase() === 'admin';
                  
                  // Detects if the current item is the last row in the pagination slice
                  const isLastRow = index === paginatedStaff.length - 1;

                  return (
                    <tr 
                      key={staff.fullId} 
                      className={`transition-colors ${
                        staff.isArchived 
                          ? 'bg-slate-50/40 opacity-60 text-slate-400' 
                          : 'hover:bg-slate-50/30'
                      }`}
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <img 
                            src={staff.avatar} 
                            alt={staffName} 
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              {staffName}
                              {isYou && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">{staffEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 pl-6 text-left">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                          isTargetAdmin 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {staff.role}
                        </span>
                      </td>
                      <td className="p-4 pl-7 text-left">
                        <span className="flex items-center gap-1.5 font-medium text-slate-655 text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            staff.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                          {staff.status}
                        </span>
                      </td>
                      <td className="p-4 text-left text-slate-550 font-medium">
                        {staff.lastLogin}
                      </td>
                      <td className="p-4 text-right pr-6 space-x-1 shrink-0">
                        {/* Edit Button — Disabled/Greyed out for fellow Admin accounts and Archived accounts */}
                        {isTargetAdmin || staff.isArchived ? (
                          <button 
                            disabled 
                            className="p-1.5 text-slate-200 cursor-not-allowed opacity-40 inline-block" 
                            title={staff.isArchived ? "Archived accounts cannot be edited. Please restore the account first." : "Administrative security rules prevent editing fellow Admin accounts."}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => setSelectedEditStaff(staff)}
                            className="p-1.5 text-slate-455 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all inline-block" 
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Three-dots contextual menu dropdown */}
                        <div className="relative inline-block text-left">
                          {/* Physically disabled menu trigger on Admin rows to provide visual clarity */}
                          {isTargetAdmin ? (
                            <button 
                              disabled 
                              className="p-1.5 text-slate-200 cursor-not-allowed opacity-40 inline-block"
                              title="Administrative security rules prevent archiving fellow Admin accounts."
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => setActiveDropdownId(activeDropdownId === staff.fullId ? null : staff.fullId)}
                              className="p-1.5 text-slate-455 hover:text-slate-655 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          {activeDropdownId === staff.fullId && (
                            <div className={`absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-lg z-30 py-1.5 animate-fade-in text-left ${
                              isLastRow ? 'bottom-full mb-1' : 'top-full mt-1' // Positions upwards on last row to prevent clipping
                            }`}>
                              {staff.isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    setSelectedArchiveStaff(staff);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-[11px] text-emerald-600 hover:bg-emerald-50 text-left font-semibold cursor-pointer transition-colors"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  Restore Account
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    setSelectedArchiveStaff(staff);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-[11px] text-rose-600 hover:bg-rose-50 text-left font-semibold cursor-pointer transition-colors"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  Archive Account
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    No matching credentials found in Supabase Auth.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Fully Functional Account Management Pagination Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <span>
            Showing <strong>{totalStaff > 0 ? staffStartIndex + 1 : 0} to {staffEndIndex}</strong> of {totalStaff} caretakers
          </span>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={safeStaffPage === 1}
              onClick={() => setStaffCurrentPage(prev => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalStaffPages }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === safeStaffPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setStaffCurrentPage(pageNum)}
                    className={`w-[32px] h-[32px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              disabled={safeStaffPage === totalStaffPages}
              onClick={() => setStaffCurrentPage(prev => Math.min(totalStaffPages, prev + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── CARD 2: REAL-TIME ACTIVITY LOG (Dashboard Consistent) ──────────── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="activity-log-card">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Activity Log</h2>
            </div>
          </div>
          <button 
            onClick={() => handleExport('Activity Log')}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-605 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1 inline-block" />
            Export
          </button>
        </div>

        {/* Dynamic Log search & time-period filter bar */}
        <div className="px-5 py-2.5 bg-slate-50/40 border-b border-slate-50 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            {/* Live Search Logs */}
            <div className="relative flex-grow w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search logs by keyword, user, or event..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 placeholder-slate-450"
              />
              {logSearchQuery && (
                <button onClick={() => setLogSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Time-Period Selector Dropdown */}
            <div className="w-full sm:w-44 shrink-0">
              <select
                value={logDateFilter}
                onChange={(e) => {
                  setLogDateFilter(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-600 outline-none cursor-pointer transition-all focus:border-emerald-500"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range...</option>
              </select>
            </div>
          </div>

          {/* Collapsible Custom Date Picker Drawer */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
            logDateFilter === 'custom' 
              ? 'max-h-32 opacity-100 mt-1' 
              : 'max-h-0 opacity-0 mt-0 pointer-events-none'
          }`}>
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-xl text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">From:</span>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-400">To:</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button 
                  type="button"
                  onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                  className="text-rose-600 hover:text-rose-700 font-bold ml-auto cursor-pointer"
                >
                  Clear Inputs
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Database Errors */}
        {logsError && (
          <div className="p-4 flex items-center gap-3 text-xs text-rose-700 bg-rose-50 border-b border-slate-50">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Could not load database logs: {logsError}</span>
          </div>
        )}

        {/* Table Area */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/20 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50">
                <th className="p-4 pl-6 text-left w-44">Timestamp</th>
                <th className="p-4 text-left w-52">User</th>
                <th className="p-4 text-left">Event Description</th>
              </tr>
            </thead>
            {/* Dynamic key triggers smooth vertical slide transition without horizontal overflow */}
            <tbody key={safeLogPage} className="divide-y divide-slate-50 animate-page-turn">
              {logsLoading ? (
                <ActivityLogSkeleton rows={4} />
              ) : (
                paginatedLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const dateFormatted = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeFormatted = dateObj.toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  });

                  return (
                    <tr key={log.log_id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="p-4 pl-6 font-medium text-slate-500 space-y-0.5">
                        <span className="block font-bold text-slate-700">{dateFormatted}</span>
                        <span className="block text-[10px] text-slate-450">{timeFormatted}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${log.user_bg_color || 'bg-slate-100 text-slate-700'}`}>
                            {log.user_initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-700 truncate">{log.user_name || 'System User'}</span>
                            <span className="text-[10px] text-slate-450 truncate">{log.user_email || 'internal@system'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 space-y-0.5">
                        <span className="font-bold text-slate-800 block flex items-center gap-2">
                          {log.event_title}
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === 'SUCCESS' ? 'bg-emerald-500' : log.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-amber-400'
                          }`} title={`Log Status: ${log.status}`} />
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-relaxed">{log.event_desc}</span>
                      </td>
                    </tr>
                  );
                })
              )}
              {!logsLoading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="3" className="text-center py-10 text-slate-400">
                    No matching log transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
          <span>Showing <strong>{filteredLogs.length > 0 ? logStartIndex + 1 : 0} to {logEndIndex}</strong> of {filteredLogs.length} log transactions</span>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={safeLogPage === 1}
              onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-semibold active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalLogPages }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === safeLogPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setLogCurrentPage(pageNum)}
                    className={`w-[32px] h-[32px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      isCurrent
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              disabled={safeLogPage === totalLogPages}
              onClick={() => setLogCurrentPage(prev => Math.min(totalLogPages, prev + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Dialogue Modal Component: Add Staff */}
      <AddStaffModal 
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        loggedInUser={loggedInUser}
        onAddSuccess={() => {
          setIsAddStaffOpen(false);
          loadStaffAccounts();
          loadActivityLogs(); 
        }}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Decoupled Dialogue Modal Component: Edit Staff */}
      <EditStaffModal
        isOpen={!!selectedEditStaff}
        onClose={() => setSelectedEditStaff(null)}
        staff={selectedEditStaff}
        loggedInUser={loggedInUser}
        onEditSuccess={() => {
          setSelectedEditStaff(null);
          loadStaffAccounts();
          loadActivityLogs(); 
        }}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Dialogue Modal Component: Archive Staff Confirmation */}
      <ArchiveStaffModal
        isOpen={!!selectedArchiveStaff}
        onClose={() => setSelectedArchiveStaff(null)}
        staff={selectedArchiveStaff}
        loggedInUser={loggedInUser}
        apiBaseUrl={API_BASE_URL}
        onArchiveConfirm={(wasArchived) => {
          setRecentlyArchivedStaff(selectedArchiveStaff);
          setArchiveSuccessType(wasArchived);
          setSelectedArchiveStaff(null);
          setShowArchiveSuccess(true);
        }}
      />

      {/* Dialogue Modal Component: Success Archive Staff */}
      <SuccessArchiveStaffModal
        isOpen={showArchiveSuccess}
        onClose={() => {
          setShowArchiveSuccess(false);
          setRecentlyArchivedStaff(null);
          loadStaffAccounts();
          loadActivityLogs(); 
        }}
        staff={recentlyArchivedStaff}
        wasArchived={archiveSuccessType}
      />

    </div>
  );
}