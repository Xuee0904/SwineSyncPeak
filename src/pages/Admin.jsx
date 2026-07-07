import React, { useState, useEffect } from 'react';
import AddStaffModal from '../components/admin/AddStaffModal';
import { 
  Users, Download, Plus, BarChart2, Edit2, MoreVertical, 
  Activity, Search, X, Loader2, AlertCircle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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

  const loadStaffAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned error ${res.status}`);
      }
      const data = await res.json();
      setStaffList(data.users ?? []);
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
      const res = await fetch(`${API_BASE_URL}/api/admin/activity-logs`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned error ${res.status}`);
      }
      const data = await res.json();
      setActivityLogs(data.logs ?? []);
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

  // Sort: current logged-in session always remains at top
  const processedStaff = [...staffList].sort((a, b) => {
    const currentUser = loggedInUser || '';
    const aIsYou = a.name.toLowerCase().includes(currentUser.toLowerCase());
    const bIsYou = b.name.toLowerCase().includes(currentUser.toLowerCase());

    if (aIsYou && !bIsYou) return -1;
    if (!aIsYou && bIsYou) return 1;

    const aTime = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
    const bTime = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
    
    return bTime - aTime;
  });

  const filteredStaff = processedStaff.filter(staff => 
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Filtered Activity Logs (Timeframe Date Bounds) ───────────────────────
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

    // 1. Dropdown timeframe checks
    if (logDateFilter === 'today') {
      if (logDate < startOfToday) return false;
    } else if (logDateFilter === 'yesterday') {
      if (logDate < startOfYesterday || logDate >= startOfToday) return false;
    } else if (logDateFilter === 'week') {
      if (logDate < startOfLast7Days) return false;
    } else if (logDateFilter === 'month') {
      if (logDate < startOfLast30Days) return false;
    } else if (logDateFilter === 'custom') {
      // 2. Custom date range boundaries checks
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

    // 3. Search input keyword checks
    const q = logSearchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      log.user_name.toLowerCase().includes(q) ||
      log.user_email.toLowerCase().includes(q) ||
      log.event_title.toLowerCase().includes(q) ||
      (log.event_desc && log.event_desc.toLowerCase().includes(q));

    return matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16 text-left animate-fade-in" id="admin-portal-view">

      {/* ─── CARD 1: ACCOUNT MANAGEMENT ─────────────────────────────────────── */}
      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="account-management-card">
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Account Management</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage administrative credentials, staff rosters, and audit records.</p>
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
            <button onClick={() => setSearchQuery('')} className="text-slate-450 hover:text-slate-655">
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
        <div className="overflow-x-auto">
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
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <TableSkeleton rows={4} />
              ) : (
                filteredStaff.map((staff) => {
                  const currentUser = loggedInUser || '';
                  const isYou = staff.name.toLowerCase().includes(currentUser.toLowerCase());
                  
                  return (
                    <tr key={staff.fullId} className="hover:bg-slate-50/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <img 
                            src={staff.avatar} 
                            alt={staff.name} 
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              {staff.name}
                              {isYou && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">{staff.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 pl-6 text-left">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                          staff.role.toLowerCase() === 'admin' 
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
                        <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="View Audit Logs">
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-indigo-650 rounded-lg transition-all" title="Edit Profile">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-650 rounded-lg transition-all">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
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
      </section>

      {/* ─── CARD 2: REAL-TIME ACTIVITY LOG ─────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="activity-log-card">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Activity Log</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">System audit tracking trail of modifications and logins.</p>
            </div>
          </div>
          <button 
            onClick={() => handleExport('Activity Log')}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
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
                <button onClick={() => setLogSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-655">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Time-Period Quick Selector Dropdown (Now Including Custom Option) */}
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

          {/* ─── Animated Sliding/Fading Custom Date Picker Drawer ─── */}
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

        {/* Adjusted Table Layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/20 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-50">
                <th className="p-4 pl-6 text-left w-44">Timestamp</th>
                <th className="p-4 text-left w-52">User</th>
                <th className="p-4 text-left">Event Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logsLoading ? (
                <ActivityLogSkeleton rows={4} />
              ) : (
                filteredLogs.map((log) => {
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
                            <span className="font-bold text-slate-700 truncate">{log.user_name}</span>
                            <span className="text-[10px] text-slate-450 truncate">{log.user_email}</span>
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
          <span>Showing <strong>{filteredLogs.length}</strong> of {activityLogs.length} log transactions</span>
          <div className="flex items-center gap-1.5">
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-655 text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">Previous</button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-655 text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      </section>

      {/* Decoupled Dialogue Modal Component */}
      <AddStaffModal 
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        onAddSuccess={() => {
          setIsAddStaffOpen(false);
          loadStaffAccounts();
        }}
        apiBaseUrl={API_BASE_URL}
      />

    </div>
  );
}