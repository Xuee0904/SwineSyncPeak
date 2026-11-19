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
} from 'lucide-react';
import ApprovalDetailModal from '../components/admin/ApprovalDetailModal';
import { formatTimestamp } from '../utils/formatTimestamp';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const MODULE_LABELS = {
  swine: 'Swine',
  pens: 'Pens',
  health: 'Health',
};

const STATUS_TABS = [
  { id: 'all', label: 'All' },
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

export default function MySubmissions({ onQueueChanged }) {
  const [statusTab, setStatusTab] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/approvals?status=all`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Failed to load submissions (${res.status}).`);
      }
      setTableMissing(Boolean(json.tableMissing));
      setSubmissions(json.data || []);
      onQueueChanged?.();
    } catch (err) {
      setError(err.message || 'Could not load your submissions.');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [onQueueChanged]);

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/approvals?status=all`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(json.error || `Failed to load submissions (${res.status}).`);
        }
        setTableMissing(Boolean(json.tableMissing));
        setSubmissions(json.data || []);
        setError('');
        onQueueChanged?.();
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load your submissions.');
        setSubmissions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInitial();
    return () => { cancelled = true; };
  }, [onQueueChanged]);

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((row) => {
      if (statusTab !== 'all' && row.status !== statusTab) return false;
      if (moduleFilter !== 'all' && row.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        String(row.summary || '').toLowerCase().includes(q) ||
        String(row.action_label || '').toLowerCase().includes(q) ||
        String(row.review_note || '').toLowerCase().includes(q)
      );
    });
  }, [submissions, statusTab, moduleFilter, searchQuery]);

  const hasFilters = statusTab !== 'all' || moduleFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="p-4 sm:p-5 lg:p-6 space-y-5 text-left" id="staff-my-submissions-page">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  My Submissions
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Track your requests awaiting administrator review, approved updates, and rejection notes.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchSubmissions}
              disabled={loading}
              className="min-h-[44px] sm:min-h-0 h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
              {STATUS_TABS.map((tab) => {
                const active = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusTab(tab.id)}
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
                <label htmlFor="submissions-search-input" className="sr-only">
                  Search my submissions
                </label>
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  id="submissions-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search summary or review note..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label htmlFor="submissions-module-filter" className="sr-only">
                  Filter by module
                </label>
                <select
                  id="submissions-module-filter"
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
                    setStatusTab('all');
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
          <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading your submissions">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
            <p className="text-xs font-medium text-slate-600 text-center pt-1">
              Loading your submissions...
            </p>
          </div>
        ) : tableMissing ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
              <Database className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Approval Queue Not Initialized</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Ask an administrator to run <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">supabase/0027_approval_requests.sql</code> in Supabase.
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3" role="alert">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Could not load your submissions</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={fetchSubmissions}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Try Again
            </button>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {hasFilters ? 'No submissions match your filters' : 'No submissions yet'}
            </h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              {hasFilters
                ? 'Reset your status or search filters to view your other submissions.'
                : 'Any swine registrations, weight or status updates, transfers, or health logs you submit will appear here for tracking.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatusTab('all');
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
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Module & Action</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Summary</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Submitted</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Status</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600">Reviewer Note</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-600 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSubmissions.map((item) => {
                    const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                    const BadgeIcon = badge.Icon;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {MODULE_LABELS[item.module] || item.module}
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-1">{item.action_label}</p>
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-md">
                          <p className="text-xs text-slate-800 leading-relaxed">{item.summary}</p>
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
                        <td className="py-3.5 px-4 align-top max-w-xs text-xs text-slate-700">
                          {item.review_note || (item.status === 'pending' ? 'Awaiting review' : 'None')}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(item)}
                            className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {filteredSubmissions.map((item) => {
                const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
                const BadgeIcon = badge.Icon;
                return (
                  <article key={item.id} className="p-4 space-y-2.5">
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
                    <p className="text-xs text-slate-600">Submitted {formatTimestamp(item.submitted_at)}</p>

                    {item.review_note && (
                      <div
                        className={`rounded-lg border p-2.5 text-xs ${
                          item.status === 'rejected'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className="font-bold">Admin Note:</span> {item.review_note}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedRequest(item)}
                      className="min-h-[44px] w-full px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                      <span>Inspect Details</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <ApprovalDetailModal
        request={selectedRequest}
        isAdmin={false}
        initialMode="inspect"
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}
