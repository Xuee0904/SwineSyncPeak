import { useState, useEffect, useCallback, useMemo } from 'react';
import AddStaffModal from '../components/admin/AddStaffModal';
import EditStaffModal from '../components/admin/EditStaffModal';
import ArchiveStaffModal from '../components/admin/ArchiveStaffModal';
import StaffDetailModal from '../components/admin/StaffDetailModal';
import Pagination from '../components/common/Pagination';
import StatusBadge from '../components/StatusBadge';
import ExportDropdown from '../components/common/ExportDropdown';
import { supabase } from '../supabaseClient';
import {
  Users, Plus, Edit2, Activity, Search, X, AlertCircle,
  ShieldAlert, Archive, ArchiveX, Eye,
  SlidersHorizontal, FilterX, RotateCcw,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const LOGS_PER_PAGE = 5;
const STAFF_PER_PAGE = 5;

const filterSelectClass = (isActive) =>
  `h-8.5 text-xs rounded-lg px-2.5 pr-7 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
    isActive
      ? 'border-emerald-500/60 bg-emerald-50/30 text-emerald-900 font-bold'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
  }`;

function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-slate-50">
          {Array.from({ length: cols }).map((__, colIdx) => (
            <td key={colIdx} className="py-3.5 px-4">
              <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const staffExportColumns = [
  { header: 'Staff ID', accessor: (row) => row.id ?? '—' },
  { header: 'Name', accessor: (row) => row.name ?? '—' },
  { header: 'Email', accessor: (row) => row.email ?? '—' },
  { header: 'Role', accessor: (row) => row.role ?? '—' },
  { header: 'Status', accessor: (row) => row.status ?? '—' },
  { header: 'Last Login', accessor: (row) => row.lastLogin ?? 'Never Signed In' },
];

const logExportColumns = [
  { header: 'Timestamp', accessor: (row) => (row.timestamp ? new Date(row.timestamp).toLocaleString() : '—') },
  { header: 'User', accessor: (row) => row.user_name || 'System User' },
  { header: 'Email', accessor: (row) => row.user_email || 'internal@system' },
  { header: 'Event', accessor: (row) => row.event_title || '—' },
  { header: 'Description', accessor: (row) => row.event_desc || '—' },
  { header: 'Status', accessor: (row) => row.status || '—' },
];

export default function Admin({ loggedInUser }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);

  // Account Management Tabs & Filters
  const [viewArchived, setViewArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [staffCurrentPage, setStaffCurrentPage] = useState(1);

  // Activity Log Filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('all');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [logCurrentPage, setLogCurrentPage] = useState(1);

  // Modals
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedEditStaff, setSelectedEditStaff] = useState(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [selectedArchiveStaff, setSelectedArchiveStaff] = useState(null);

  const fetchStaffAccounts = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned error ${res.status}`);
    }
    const data = await res.json();
    return data.users ?? [];
  }, []);

  const fetchActivityLogs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const res = await fetch(`${API_BASE_URL}/api/admin/activity-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server returned error ${res.status}`);
    }
    const data = await res.json();
    return data.logs ?? [];
  }, []);

  const loadStaffAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const users = await fetchStaffAccounts();
      setStaffList(users);
      setStaffCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchStaffAccounts]);

  const loadActivityLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const logs = await fetchActivityLogs();
      setActivityLogs(logs);
      setLogCurrentPage(1);
    } catch (err) {
      setLogsError(err.message);
    } finally {
      setLogsLoading(false);
    }
  }, [fetchActivityLogs]);

  useEffect(() => {
    let active = true;
    fetchStaffAccounts()
      .then((users) => {
        if (!active) return;
        setStaffList(users);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchActivityLogs()
      .then((logs) => {
        if (!active) return;
        setActivityLogs(logs);
        setLogsError(null);
      })
      .catch((err) => {
        if (active) setLogsError(err.message);
      })
      .finally(() => {
        if (active) setLogsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchStaffAccounts, fetchActivityLogs]);

  const loggedInEmail = useMemo(() => {
    if (!loggedInUser) return '';
    if (typeof loggedInUser === 'string') return loggedInUser.toLowerCase();
    if (typeof loggedInUser === 'object') {
      return (loggedInUser.email || loggedInUser.user_metadata?.email || '').toLowerCase();
    }
    return '';
  }, [loggedInUser]);

  const processedStaff = useMemo(() => {
    return [...staffList].sort((a, b) => {
      const aEmail = (a.email || '').toLowerCase();
      const bEmail = (b.email || '').toLowerCase();
      const aIsYou = loggedInEmail && aEmail === loggedInEmail;
      const bIsYou = loggedInEmail && bEmail === loggedInEmail;

      if (aIsYou && !bIsYou) return -1;
      if (!aIsYou && bIsYou) return 1;

      if (a.isArchived && !b.isArchived) return 1;
      if (!a.isArchived && b.isArchived) return -1;

      const aTime = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
      const bTime = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [staffList, loggedInEmail]);

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return processedStaff.filter((staff) => {
      if (viewArchived ? !staff.isArchived : staff.isArchived) return false;

      if (filterRole !== 'all') {
        const role = (staff.role || '').toLowerCase();
        if (role !== filterRole) return false;
      }

      if (!viewArchived && filterStatus !== 'all') {
        const status = (staff.status || '').toLowerCase();
        if (status !== filterStatus) return false;
      }

      if (!q) return true;
      const name = (staff.name || '').toLowerCase();
      const email = (staff.email || '').toLowerCase();
      const id = (staff.id || '').toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [processedStaff, viewArchived, filterRole, filterStatus, searchQuery]);

  const totalStaff = filteredStaff.length;
  const totalStaffPages = Math.max(1, Math.ceil(totalStaff / STAFF_PER_PAGE));
  const safeStaffPage = Math.min(staffCurrentPage, totalStaffPages);
  const paginatedStaff = filteredStaff.slice(
    (safeStaffPage - 1) * STAFF_PER_PAGE,
    safeStaffPage * STAFF_PER_PAGE
  );

  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfLast7Days = new Date(startOfToday);
    startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);
    const startOfLast30Days = new Date(startOfToday);
    startOfLast30Days.setDate(startOfLast30Days.getDate() - 30);

    const q = logSearchQuery.toLowerCase().trim();

    return activityLogs.filter((log) => {
      const logDate = new Date(log.timestamp);

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

      if (logStatusFilter !== 'all') {
        if ((log.status || '').toUpperCase() !== logStatusFilter) return false;
      }

      if (!q) return true;
      return (
        (log.user_name || '').toLowerCase().includes(q) ||
        (log.user_email || '').toLowerCase().includes(q) ||
        (log.event_title || '').toLowerCase().includes(q) ||
        (log.event_desc && log.event_desc.toLowerCase().includes(q))
      );
    });
  }, [activityLogs, logSearchQuery, logDateFilter, logStatusFilter, customStartDate, customEndDate]);

  const totalLogs = filteredLogs.length;
  const totalLogPages = Math.max(1, Math.ceil(totalLogs / LOGS_PER_PAGE));
  const safeLogPage = Math.min(logCurrentPage, totalLogPages);
  const paginatedLogs = filteredLogs.slice(
    (safeLogPage - 1) * LOGS_PER_PAGE,
    safeLogPage * LOGS_PER_PAGE
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const hasStaffFilters =
    Boolean(searchQuery.trim()) ||
    filterRole !== 'all' ||
    (!viewArchived && filterStatus !== 'all');

  const hasLogFilters =
    Boolean(logSearchQuery.trim()) ||
    logDateFilter !== 'all' ||
    logStatusFilter !== 'all' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate);

  const resetStaffFilters = () => {
    setSearchQuery('');
    setFilterRole('all');
    setFilterStatus('all');
    setStaffCurrentPage(1);
  };

  const resetLogFilters = () => {
    setLogSearchQuery('');
    setLogDateFilter('all');
    setLogStatusFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setLogCurrentPage(1);
  };

  const hasInvalidCustomRange =
    (customStartDate && customStartDate > todayStr) ||
    (customStartDate && customEndDate && customEndDate < customStartDate);

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in text-left" id="admin-portal-view">

      {/* ─── CARD 1: ACCOUNT MANAGEMENT ─── */}
      <section
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        id="account-management-card"
      >
        {/* Standardized Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100">
          {/* Row 1: Title + Active/Archived Tabs | Export + Add Staff */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Account Management</h2>
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setViewArchived(false);
                    setStaffCurrentPage(1);
                  }}
                  className={`h-8 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !viewArchived
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  id="admin-tab-active"
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewArchived(true);
                    setFilterStatus('all');
                    setStaffCurrentPage(1);
                  }}
                  className={`h-8 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    viewArchived
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  id="admin-tab-archived"
                >
                  Archived
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <ExportDropdown
                data={filteredStaff}
                columns={staffExportColumns}
                filename={viewArchived ? 'swine_sync_archived_accounts' : 'swine_sync_active_accounts'}
                pdfTitle={viewArchived ? 'Archived Staff Accounts' : 'Active Staff Accounts'}
              />
              {!viewArchived && (
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(true)}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                  id="add-staff-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Staff
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Search + Filter Strip + Record Count */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 mt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, email, or ID…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setStaffCurrentPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-8 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  id="staff-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStaffCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 ml-0 sm:ml-1 mr-0.5 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Filters:
                </span>
              </div>

              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setStaffCurrentPage(1);
                }}
                className={filterSelectClass(filterRole !== 'all')}
                id="staff-role-filter"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>

              {!viewArchived && (
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setStaffCurrentPage(1);
                  }}
                  className={filterSelectClass(filterStatus !== 'all')}
                  id="staff-status-filter"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}

              {hasStaffFilters && (
                <button
                  type="button"
                  onClick={resetStaffFilters}
                  className="h-8.5 flex items-center gap-1.5 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-400 hidden sm:block shrink-0">
              {hasStaffFilters ? (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Filtered: {totalStaff} accounts
                </span>
              ) : (
                <span>{totalStaff} total accounts</span>
              )}
            </div>
          </div>
        </div>

        {/* Account Management Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/75 border-b border-slate-100">
              <tr>
                {['Staff Member', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                      h === 'Staff Member' ? 'pl-5' : h === 'Actions' ? 'text-right pr-6' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={STAFF_PER_PAGE} cols={5} />
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 max-w-md px-4">
                        Could not fetch users: {error}
                      </p>
                      <button
                        type="button"
                        onClick={loadStaffAccounts}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        {viewArchived
                          ? <ArchiveX className="w-5 h-5 text-slate-300" />
                          : <Users className="w-5 h-5 text-slate-300" />}
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {viewArchived
                          ? 'No archived accounts found'
                          : hasStaffFilters
                            ? 'No accounts match your filters'
                            : 'No staff accounts found'}
                      </p>
                      {hasStaffFilters && (
                        <button
                          type="button"
                          onClick={resetStaffFilters}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => {
                  const staffName = staff.name || '';
                  const staffEmail = (staff.email || '').toLowerCase();
                  const isYou = Boolean(loggedInEmail && staffEmail === loggedInEmail);
                  const isTargetAdmin = (staff.role || '').toLowerCase() === 'admin';

                  return (
                    <tr
                      key={staff.fullId}
                      onClick={() => setSelectedStaffDetail(staff)}
                      className={`border-b border-slate-100/70 transition-colors group cursor-pointer ${
                        viewArchived
                          ? 'opacity-70 hover:opacity-100 hover:bg-amber-50/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                      title="Click to view full staff profile & activity audit trail"
                    >
                      {/* Staff Member */}
                      <td className="py-3.5 px-4 pl-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={staff.avatar}
                            alt={staffName}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`text-xs font-bold transition-colors flex items-center gap-1.5 ${
                                viewArchived
                                  ? 'text-slate-500 group-hover:text-slate-700'
                                  : 'text-slate-800 group-hover:text-emerald-700'
                              }`}
                            >
                              <span className="truncate">{staffName}</span>
                              {isYou && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium truncate">
                              {staffEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider border ${
                            isTargetAdmin
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                              : 'bg-sky-50 text-sky-700 border-sky-200/70'
                          }`}
                        >
                          {staff.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={staff.status} />
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            staff.lastLogin === 'Never Signed In'
                              ? 'text-slate-400'
                              : 'text-slate-600'
                          }`}
                        >
                          {staff.lastLogin}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right pr-6 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStaffDetail(staff)}
                            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors active:scale-95 cursor-pointer"
                            title="View Account Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {isTargetAdmin ? (
                            <span
                              className="w-7 h-7 flex items-center justify-center text-emerald-600 bg-emerald-50/70 rounded-lg cursor-help"
                              title="Protected — Admin accounts cannot be edited or archived."
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </span>
                          ) : !viewArchived ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedEditStaff(staff)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors active:scale-95 cursor-pointer"
                                title="Edit Profile Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedArchiveStaff(staff)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-95 cursor-pointer"
                                title="Archive Caretaker Account"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedArchiveStaff(staff)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 rounded-lg transition-colors active:scale-95 cursor-pointer"
                              title="Restore Caretaker Account"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={safeStaffPage}
          totalPages={totalStaffPages}
          onPageChange={setStaffCurrentPage}
          disabled={loading}
          totalItems={totalStaff}
          itemsPerPage={STAFF_PER_PAGE}
          itemName="accounts"
        />
      </section>

      {/* ─── CARD 2: REAL-TIME ACTIVITY LOG ─── */}
      <section
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        id="activity-log-card"
      >
        {/* Standardized Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100">
          {/* Row 1: Title | Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/60 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Activity Log</h2>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <ExportDropdown
                data={filteredLogs}
                columns={logExportColumns}
                filename="swine_sync_activity_logs"
                pdfTitle="Admin Activity Logs"
              />
            </div>
          </div>

          {/* Row 2: Search + Filter Strip + Log Count */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 mt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by keyword, user, or event…"
                  value={logSearchQuery}
                  onChange={(e) => {
                    setLogSearchQuery(e.target.value);
                    setLogCurrentPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-8 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  id="activity-log-search-input"
                />
                {logSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogSearchQuery('');
                      setLogCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 ml-0 sm:ml-1 mr-0.5 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Filters:
                </span>
              </div>

              <select
                value={logDateFilter}
                onChange={(e) => {
                  setLogDateFilter(e.target.value);
                  setLogCurrentPage(1);
                  if (e.target.value !== 'custom') {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className={filterSelectClass(logDateFilter !== 'all')}
                id="log-date-filter"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range…</option>
              </select>

              <select
                value={logStatusFilter}
                onChange={(e) => {
                  setLogStatusFilter(e.target.value);
                  setLogCurrentPage(1);
                }}
                className={filterSelectClass(logStatusFilter !== 'all')}
                id="log-status-filter"
              >
                <option value="all">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="BLOCKED">Blocked</option>
                <option value="WARNING">Warning</option>
              </select>

              {hasLogFilters && (
                <button
                  type="button"
                  onClick={resetLogFilters}
                  className="h-8.5 flex items-center gap-1.5 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-400 hidden sm:block shrink-0">
              {hasLogFilters ? (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Filtered: {totalLogs} logs
                </span>
              ) : (
                <span>{totalLogs} total logs</span>
              )}
            </div>
          </div>

          {/* Collapsible Custom Date Range Drawer */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              logDateFilter === 'custom'
                ? 'max-h-40 opacity-100 mt-3'
                : 'max-h-0 opacity-0 mt-0 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center gap-4 bg-slate-50/75 border border-slate-200/70 px-3.5 py-2.5 rounded-xl text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  max={todayStr}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setCustomStartDate(newStart);
                    setLogCurrentPage(1);
                    if (customEndDate && customEndDate < newStart) {
                      setCustomEndDate('');
                    }
                  }}
                  className="h-8 bg-white border border-slate-200 rounded-lg px-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  max={todayStr}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setLogCurrentPage(1);
                  }}
                  className="h-8 bg-white border border-slate-200 rounded-lg px-2.5 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setLogCurrentPage(1);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-auto cursor-pointer"
                >
                  Clear dates
                </button>
              )}
            </div>

            {hasInvalidCustomRange && (
              <p className="text-[11px] text-amber-600 font-semibold px-1 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {customStartDate > todayStr
                  ? '"From" date cannot be in the future.'
                  : '"To" date cannot be before "From" date.'}
              </p>
            )}
          </div>
        </div>

        {/* Activity Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/75 border-b border-slate-100">
              <tr>
                {['Timestamp', 'User', 'Event Description', 'Status'].map((h) => (
                  <th
                    key={h}
                    className={`py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                      h === 'Timestamp' ? 'pl-5 w-44' : h === 'User' ? 'w-56' : h === 'Status' ? 'text-right pr-6 w-32' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <TableSkeleton rows={LOGS_PER_PAGE} cols={4} />
              ) : logsError ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 max-w-md px-4">
                        Could not load database logs: {logsError}
                      </p>
                      <button
                        type="button"
                        onClick={loadActivityLogs}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {hasLogFilters
                          ? 'No activity logs match your filters'
                          : 'No activity logs recorded yet'}
                      </p>
                      {hasLogFilters && (
                        <button
                          type="button"
                          onClick={resetLogFilters}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const dateFormatted = dateObj.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const timeFormatted = dateObj.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr
                      key={log.log_id}
                      className="border-b border-slate-100/70 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 pl-5 whitespace-nowrap">
                        <span className="block text-xs font-bold text-slate-700">
                          {dateFormatted}
                        </span>
                        <span className="block text-[11px] font-medium text-slate-400">
                          {timeFormatted}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              log.user_bg_color || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.user_initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {log.user_name || 'System User'}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 truncate">
                              {log.user_email || 'internal@system'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-xs font-bold text-slate-800 block">
                          {log.event_title}
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-relaxed">
                          {log.event_desc}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right pr-6 whitespace-nowrap">
                        <StatusBadge status={log.status || 'SUCCESS'} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={safeLogPage}
          totalPages={totalLogPages}
          onPageChange={setLogCurrentPage}
          disabled={logsLoading}
          totalItems={totalLogs}
          itemsPerPage={LOGS_PER_PAGE}
          itemName="activity logs"
        />
      </section>

      {/* Modals */}
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

      <ArchiveStaffModal
        isOpen={!!selectedArchiveStaff}
        onClose={() => setSelectedArchiveStaff(null)}
        staff={selectedArchiveStaff}
        loggedInUser={loggedInUser}
        apiBaseUrl={API_BASE_URL}
        onArchiveConfirm={() => {
          setSelectedArchiveStaff(null);
          loadStaffAccounts();
          loadActivityLogs();
        }}
      />

      <StaffDetailModal
        isOpen={!!selectedStaffDetail}
        onClose={() => setSelectedStaffDetail(null)}
        staff={selectedStaffDetail}
        allLogs={activityLogs}
      />
    </div>
  );
}
