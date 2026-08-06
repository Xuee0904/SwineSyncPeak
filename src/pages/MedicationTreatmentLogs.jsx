import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Download,
  ChevronDown,
  SlidersHorizontal,
  X,
  MoreVertical,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Eye,
  CheckCircle2,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import { toast } from "../utils/toast";
import AddHealthLogModal from "../components/HealthManagement/AddHealthLogModal";

// ---------------------------------------------------------------------------
// Data fetched from backend API
// ---------------------------------------------------------------------------

// Pipeline-wide distribution across all 128 active treatments, not just the
// rows visible in this page of the table.
const statusMeta = {
  sick: {
    label: "Sick / Treatment",
    cls: "bg-rose-50 text-rose-700 ring-rose-600/20",
    bar: "#e11d48",
    rowAccent: "border-l-4 border-l-rose-400",
  },
  monitoring: {
    label: "Monitoring",
    cls: "bg-amber-50 text-amber-700 ring-amber-600/20",
    bar: "#d97706",
    rowAccent: "border-l-4 border-l-amber-300",
  },
  resolved: {
    label: "Resolved",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    bar: "#059669",
    rowAccent: "border-l-4 border-l-transparent",
  },
};

const medicationDotColor = {
  Tylosin: "bg-sky-500",
  Meloxicam: "bg-violet-500",
  Enrofloxacin: "bg-orange-500",
  Penicillin: "bg-emerald-500",
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function StatusPill({ status }) {
  const s = statusMeta[status] ?? statusMeta.resolved;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function CriticalCaseCard({ item }) {
  return (
    <div className="flex-1 min-w-[240px] rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
          {item.tag}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
          <ShieldAlert className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-base font-semibold text-slate-900">Pig {item.pigId}</p>
      <p className="text-xs text-slate-500">
        Pen {item.pen} &middot; {item.diagnosis}
      </p>
      <div className="mt-3 border-t border-rose-100 pt-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.detailLabel}</p>
        <p className="text-sm font-medium text-slate-800">{item.detailValue}</p>
      </div>
    </div>
  );
}

function RecoveryRateCard({ rate, resolvedCount, totalCount }) {
  return (
    <div className="min-w-[240px] flex-1 rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-emerald-50">Overall Recovery Rate</p>
        <ArrowUpRight className="h-4 w-4 text-emerald-100" />
      </div>
      <p className="mt-2 text-4xl font-semibold tracking-tight">{rate.toFixed(1)}%</p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/50">
        <div className="h-full rounded-full bg-white" style={{ width: `${rate}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-emerald-100">{resolvedCount} resolved out of {totalCount} total cases</p>
    </div>
  );
}

function StatusDistributionBar({ distribution, total }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">Treatment Pipeline</p>
        <span className="text-[11px] text-slate-400">{total} active treatments</span>
      </div>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {distribution.map((s) => (
          <div
            key={s.status}
            style={{
              width: total > 0 ? `${(s.count / total) * 100}%` : "0%",
              backgroundColor: statusMeta[s.status]?.bar || "#ccc",
            }}
            title={`${statusMeta[s.status]?.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {distribution.map((s) => (
          <div key={s.status} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: statusMeta[s.status]?.bar || "#ccc" }}
            />
            <span className="text-slate-700">{statusMeta[s.status]?.label}</span>
            <span className="text-slate-400">
              {s.count} &middot; {total > 0 ? Math.round((s.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowActions({ row, onEdit, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  };

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        type="button"
        aria-label="Row actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[201] w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { setOpen(false); onEdit(row); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit / Update status
            </button>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                // Quick status update to "resolved"
                const r = row._raw;
                await fetch(`/api/health-logs/${r.health_id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'resolved', performed_by: r.recorded_by || 'Admin' }),
                });
                if (onRefresh) onRefresh();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MedicationTreatmentLogs({ setActiveTab }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const [treatmentLog, setTreatmentLog] = useState([]);
  const [archivedLog, setArchivedLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [activeRes, archivedRes] = await Promise.all([
          fetch("/api/health-logs?t=" + Date.now()),
          fetch("/api/health-logs?archived=true&t=" + Date.now()),
        ]);
        const activeJson = await activeRes.json();
        const archivedJson = await archivedRes.json();

        const mapRow = (h) => {
          const start = new Date(h.log_date);
          const daysDiff = Math.floor((Date.now() - start.getTime()) / (1000 * 3600 * 24));
          let st = "monitoring";
          if (["sick", "monitoring", "resolved"].includes(h.status)) st = h.status;
          return {
            treatmentId: "TX-" + h.health_id.substring(0, 6).toUpperCase(),
            pigId: h.pigs?.pig_tag || h.piglet_batches?.batch_tag || (h.pig_id ? `Pig ${h.pig_id.substring(0, 8)}` : `Batch ${h.batch_id?.substring(0, 8)}`),
            diagnosis: h.diagnosis || "Unknown",
            medication: h.medication_name || "None",
            dosage: h.dosage || "N/A",
            startDate: start.toLocaleDateString(),
            status: st,
            daysInStatus: Math.max(1, daysDiff),
            _raw: h,
          };
        };

        setTreatmentLog((activeJson.data || []).map(mapRow));
        setArchivedLog((archivedJson.data || []).map(mapRow));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load treatments");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshTrigger]);

  const refreshData = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const sickCases = useMemo(() => {
    return treatmentLog.filter(t => t.status === "sick").map(t => ({
      id: t.treatmentId,
      pigId: t.pigId,
      pen: "Unknown",
      diagnosis: t.diagnosis,
      tag: "Urgent Attention",
      detailLabel: "Last Treatment",
      detailValue: `${t.medication} · ${t.startDate}`,
    })).slice(0, 4);
  }, [treatmentLog]);

  const filtered = useMemo(() => {
    return treatmentLog.filter((row) => {
      const matchesQuery =
        query.trim() === "" ||
        [row.treatmentId, row.pigId, row.diagnosis, row.medication]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [treatmentLog, query, statusFilter]);

  const resolvedCount = treatmentLog.filter(t => t.status === 'resolved').length;
  const totalCount = treatmentLog.length;
  const recoveryRate = totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8">

        {/* Critical Cases */}
        <div className="mt-2">
          <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-600">
                <ShieldAlert className="h-4 w-4" />
                Active Sick Cases
              </h2>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("sick");
                  setFiltersOpen(true);
                  // Scroll to table
                  document.getElementById("treatment-log-table")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                View All Sick
              </button>
            </div>
            <div className="flex flex-wrap gap-4">
              {sickCases.map((c) => (
              <CriticalCaseCard key={c.id} item={c} />
            ))}
            <RecoveryRateCard rate={recoveryRate} resolvedCount={resolvedCount} totalCount={totalCount} />
          </div>
        </div>

        {/* Treatment pipeline overview across all active treatments */}
        <div className="mt-4">
            <StatusDistributionBar
              distribution={["sick", "monitoring", "resolved"].map(st => ({
              status: st,
              count: treatmentLog.filter(t => t.status === st).length
            }))}
            total={treatmentLog.length}
          />
        </div>

        {/* Treatment Log */}
        <div id="treatment-log-table" className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Treatment Log</h2>
              {/* Active / Archived toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => { setShowArchived(false); setPage(1); }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    !showArchived ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => { setShowArchived(true); setPage(1); }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                    showArchived ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={showArchived ? "Search archived logs..." : "Search pig ID, diagnosis..."}
                  className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {!showArchived && (
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  type="button"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                  />
                </button>
              )}
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              {!showArchived && (
                <button
                  onClick={() => { setEditRecord(null); setModalOpen(true); }}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                  type="button"
                >
                  + Add Treatment Record
                </button>
              )}
            </div>
          </div>

          {filtersOpen && !showArchived && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All</option>
                  <option value="sick">Sick / Treatment</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Start date</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {(statusFilter !== "all" || query) && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setQuery("");
                    setPage(1);
                  }}
                  className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Pig ID</th>
                  <th className="px-5 py-3 font-medium">Diagnosis</th>
                  <th className="px-5 py-3 font-medium">Medication</th>
                  <th className="px-5 py-3 font-medium">Dosage</th>
                  <th className="px-5 py-3 font-medium">Start date</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {!showArchived && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full"></div></td>
                    </tr>
                  ))
                ) : showArchived ? (
                  archivedLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        No archived treatment records yet.
                      </td>
                    </tr>
                  ) : (
                    archivedLog.filter(row =>
                      query.trim() === '' ||
                      [row.pigId, row.diagnosis, row.medication].join(' ').toLowerCase().includes(query.toLowerCase())
                    ).map((row) => (
                      <tr key={row.treatmentId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-medium text-slate-800">{row.pigId}</td>
                        <td className="px-5 py-4 text-slate-600">{row.diagnosis}</td>
                        <td className="px-5 py-4 text-slate-600">
                          <span className="inline-flex items-center gap-2 text-slate-700">
                            <span className={`h-2 w-2 rounded-full ${medicationDotColor[row.medication] ?? "bg-slate-400"}`} />
                            {row.medication}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                        <td className="px-5 py-4 text-slate-600">{row.startDate}</td>
                        <td className="px-5 py-4 text-slate-600">{row.daysInStatus} {row.daysInStatus === 1 ? 'day' : 'days'}</td>
                        <td className="px-5 py-4"><StatusPill status={row.status} /></td>
                      </tr>
                    ))
                  )
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                      No treatments match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.treatmentId}
                      className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors ${statusMeta[row.status]?.rowAccent || ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-slate-800">{row.pigId}</td>
                      <td className="px-5 py-4 text-slate-600">{row.diagnosis}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <span
                            className={`h-2 w-2 rounded-full ${medicationDotColor[row.medication] ?? "bg-slate-400"}`}
                          />
                          {row.medication}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                      <td className="px-5 py-4 text-slate-600">{row.startDate}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.daysInStatus} {row.daysInStatus === 1 ? "day" : "days"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <RowActions row={row} onEdit={(r) => { setEditRecord(r); setModalOpen(true); }} onRefresh={refreshData} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {showArchived
                ? `${archivedLog.length} archived record${archivedLog.length !== 1 ? 's' : ''}`
                : `Showing ${filtered.length} of ${treatmentLog.length} active treatments`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40"
                type="button"
                disabled={page === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-xs font-medium text-slate-500">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50"
                type="button"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddHealthLogModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        editRecord={editRecord}
        onSuccess={() => {
          setModalOpen(false);
          refreshData();
        }}
      />
    </div>
  );
}
