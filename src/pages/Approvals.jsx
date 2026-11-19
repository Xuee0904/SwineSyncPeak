import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Database,
  FilterX,
  Loader2,
} from 'lucide-react';
import ApprovalDetailModal from '../components/admin/ApprovalDetailModal';
import { formatTimestamp } from '../utils/formatTimestamp';
import toast from '../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const MODULE_LABELS = {
  swine: 'Swine',
  pens: 'Pens',
  health: 'Health',
};

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
  pending: {
    label: 'Pending',
    Icon: Clock,
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Approved',
    Icon: CheckCircle2,
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    Icon: XCircle,
    cls: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

export default function Approvals({ onQueueChanged }) {
  const [statusTab, setStatusTab] = useState('pending');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalInitialMode, setModalInitialMode] = useState('inspect');

  const fetchApprovals = useCallback(async (tab = statusTab, showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
      setError('');
    }
    try {
      const params = new URLSearchParams({ status: tab });
      const res = await fetch(`${API_BASE}/api/approvals?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Failed to load approval requests (${res.status}).`);
      }
      setTableMissing(Boolean(json.tableMissing));
      setRequests(json.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load approval queue.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      try {
        const params = new URLSearchParams({ status: statusTab });
        const res = await fetch(`${API_BASE}/api/approvals?${params}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(json.error || `Failed to load approval requests (${res.status}).`);
        }
        setTableMissing(Boolean(json.tableMissing));
        setRequests(json.data || []);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load approval queue.');
        setRequests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInitial();
    return () => { cancelled = true; };
  }, [statusTab]);

  const notifyQueueUpdate = useCallback(() => {
    onQueueChanged?.();
    window.dispatchEvent(new CustomEvent('swinesync:approvals-updated'));
    window.dispatchEvent(new CustomEvent('swinesync_data_updated'));
  }, [onQueueChanged]);

  const handleQuickApprove = async (item) => {
    setApprovingId(item.id);
    try {
      const res = await fetch(`${API_BASE}/api/approvals/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Could not approve request (${res.status}).`);
      }
      toast.success('Request approved', `${item.action_label} has been applied.`);
      await fetchApprovals();
      notifyQueueUpdate();
    } catch (err) {
      toast.error('Approval failed', err.message);
      setModalInitialMode('inspect');
      setSelectedRequest(item);
    } finally {
      setApprovingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((row) => {
      if (moduleFilter !== 'all' && row.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        String(row.summary || '').toLowerCase().includes(q) ||
        String(row.action_label || '').toLowerCase().includes(q) ||
        String(row.submitted_by_name || '').toLowerCase().includes(q) ||
        String(row.submitted_by_email || '').toLowerCase().includes(q) ||
        String(row.review_note || '').toLowerCase().includes(q)
      );
    });
  }, [requests, moduleFilter, searchQuery]);

  const hasFilters = moduleFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-5 text-left" id="admin-approvals-page">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Staff Change Approvals
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Review staff additions, swine updates, transfers, and health logs before they apply to live records.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchApprovals()}
              disabled={loading}
              className="min-h-[44px] sm:min-h-0 h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              {STATUS_TABS.map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (statusTab !== tab.id) {
                        setLoading(true);
                        setError('');
                        setStatusTab(tab.id);
                      }
                    }}
                    aria-pressed={active}
                    className={`min-h-[36px] px-3.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      active
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:justify-end">
              <div className="relative sm:w-64">
                <label htmlFor="approvals-search-input" className="sr-only">
                  Search approval requests
                </label>
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  id="approvals-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search summary or staff..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="approvals-module-filter" className="sr-only">
                  Filter by module
                </label>
                <select
                  id="approvals-module-filter"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="w-full sm:w-auto h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="all">All Modules</option>
                  <option value="swine">Swine Management</option>
                  <option value="pens">Pen Management</option>
                  <option value="health">Health Management</option>
                </select>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setModuleFilter('all');
                    setSearchQuery('');
                  }}
                  className="min-h-[40px] px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                >
                  <FilterX className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading approval requests">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
            <p className="text-xs font-medium text-slate-600 text-center pt-1">
              Loading {statusTab} requests...
            </p>
          </div>
        ) : tableMissing ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
              <Database className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Approval Queue Table Not Initialized</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Run <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">supabase/0027_approval_requests.sql</code> in the Supabase SQL Editor to enable staff request approvals.
            </p>
            <button
              type="button"
              onClick={fetchApprovals}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Retry Connection
            </button>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3" role="alert">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Could not load approval requests</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={fetchApprovals}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Try Again
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {hasFilters
                ? 'No approval requests match your filters'
                : `No ${statusTab} requests`}
            </h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              {hasFilters
                ? 'Adjust your module filter or search query to see other submissions.'
                : statusTab === 'pending'
                  ? 'All staff submissions have been reviewed.'
                  : `No requests have been ${statusTab} yet.`}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setModuleFilter('all');
                  setSearchQuery('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Submitted By</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Module & Action</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Summary</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Submitted</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Status</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRequests.map((item) => {
                    const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                    const BadgeIcon = badge.Icon;
                    const isRowApproving = approvingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <p className="text-xs font-bold text-slate-900">{item.submitted_by_name}</p>
                          <p className="text-xs text-slate-600">{item.submitted_by_email}</p>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {MODULE_LABELS[item.module] || item.module}
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-1">{item.action_label}</p>
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-md">
                          <p className="text-xs text-slate-800 leading-relaxed">{item.summary}</p>
                          {item.review_note && (
                            <p className="text-xs text-slate-600 mt-1">
                              Note: {item.review_note}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs text-slate-600">
                          {formatTimestamp(item.submitted_at)}
                        </td>
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${badge.cls}`}>
                            <BadgeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{badge.label}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setModalInitialMode('inspect');
                                setSelectedRequest(item);
                              }}
                              className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Inspect</span>
                            </button>
                            {item.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isRowApproving}
                                  onClick={() => handleQuickApprove(item)}
                                  className="h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                                >
                                  {isRowApproving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  )}
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isRowApproving}
                                  onClick={() => {
                                    setModalInitialMode('reject');
                                    setSelectedRequest(item);
                                  }}
                                  className="h-9 px-3 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                                >
                                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {filteredRequests.map((item) => {
                const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                const BadgeIcon = badge.Icon;
                const isRowApproving = approvingId === item.id;
                return (
                  <article key={item.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                          {MODULE_LABELS[item.module] || item.module}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{item.action_label}</h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${badge.cls}`}>
                        <BadgeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 leading-relaxed">{item.summary}</p>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <span>By {item.submitted_by_name}</span>
                      <span>{formatTimestamp(item.submitted_at)}</span>
                    </div>

                    {item.review_note && (
                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        Note: {item.review_note}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModalInitialMode('inspect');
                          setSelectedRequest(item);
                        }}
                        className="min-h-[44px] flex-1 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        <span>Inspect</span>
                      </button>
                      {item.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={isRowApproving}
                            onClick={() => handleQuickApprove(item)}
                            className="min-h-[44px] flex-1 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            {isRowApproving ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            )}
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={isRowApproving}
                            onClick={() => {
                              setModalInitialMode('reject');
                              setSelectedRequest(item);
                            }}
                            className="min-h-[44px] flex-1 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                          >
                            <XCircle className="w-4 h-4" aria-hidden="true" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <ApprovalDetailModal
        request={selectedRequest}
        isAdmin={true}
        initialMode={modalInitialMode}
        onClose={() => setSelectedRequest(null)}
        onSuccess={() => {
          fetchApprovals();
          notifyQueueUpdate();
        }}
      />
    </div>
  );
}
