import { useMemo, useState, useEffect, useCallback } from "react";
import RecordTransactionModal from "../components/Transactions/RecordTransactionModal";
import ExportDropdown from "../components/common/ExportDropdown";
import { Loader2, CheckCircle2, Printer, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import toast from "../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const ICON_MAP = {
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  wallet: Wallet,
  clock: Clock,
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_TREND = { labels: [], sales: [], expenses: [] };

/* -------------------------------------------------------------------------- */
/*  Helpers & Styles                                                          */
/* -------------------------------------------------------------------------- */

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

const STATUS_STYLES = {
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Overdue: "bg-rose-50 text-rose-700 ring-rose-600/20",
  Cancelled: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

const TYPE_STYLES = {
  Sale: "bg-sky-50 text-sky-700 ring-sky-600/20",
  Expense: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const ICONS = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  box: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
};

function Icon({ name, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Pill({ children, className }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

const card = "rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5";

const EXPORT_COLUMNS = [
  { header: "Transaction ID", accessor: "id" },
  { header: "Date & Time", accessor: (r) => (r.time ? `${r.date} ${r.time}` : r.date) },
  { header: "Type", accessor: "type" },
  { header: "Client / Supplier", accessor: "party" },
  { header: "Category", accessor: "category" },
  { header: "Amount (₱)", accessor: (r) => r.amount },
  { header: "Payment Method", accessor: "method" },
  { header: "Status", accessor: "status" },
  { header: "Linked Impact", accessor: "linked" },
  { header: "Notes", accessor: "notes" },
];

/* -------------------------------------------------------------------------- */
/*  Stat Card                                                                 */
/* -------------------------------------------------------------------------- */

const TONE_ICON_BG = {
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-50 text-slate-500",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
};

function StatCard({ icon, label, value, unit, tone = "emerald", isAlert = false, loading = false }) {
  const Icon = ICON_MAP[icon] || Wallet;

  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[106px] sm:min-h-[112px] ${
        isAlert ? "border-amber-200/90 ring-1 ring-amber-100/70" : "border-slate-200/70"
      }`}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${TONE_ICON_BG[tone] || TONE_ICON_BG.slate}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        {loading ? (
          <div className="h-7 w-24 bg-slate-100 animate-pulse rounded-md" />
        ) : (
          <>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</span>
            {unit && (
              <span className={`text-xs font-semibold ${isAlert ? "text-amber-700 font-bold" : "text-slate-400"}`}>{unit}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trend Chart                                                               */
/* -------------------------------------------------------------------------- */

const TIMEFRAMES = [
  { id: "weekly", label: "Weekly", sub: "Weekly totals for the last 8 weeks" },
  { id: "monthly", label: "Monthly", sub: "Monthly totals for the last 6 months" },
  { id: "quarterly", label: "Quarterly", sub: "Quarterly totals for recent quarters" },
  { id: "yearly", label: "Yearly", sub: "Annual totals over recent years" },
];

// Round up to a 1/2/5 x 10^n value so the y-axis ticks are clean numbers.
function niceCeil(v) {
  if (v <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const f = v / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function formatTick(val) {
  if (val === 0) return "0";
  if (val >= 1_000_000) return `₱${+(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1000) return `₱${+(val / 1000).toFixed(1)}k`;
  return `₱${val}`;
}

function TrendChart({ trend, activeTypeTab = "All" }) {
  const W = 880, H = 210;
  const pad = { l: 52, r: 20, t: 20, b: 32 };

  const labels = trend?.labels || [];
  const sales = trend?.sales || [];
  const expenses = trend?.expenses || [];

  const max = niceCeil(Math.max(...sales, ...expenses, 0));
  const n = labels.length;

  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const baseY = H - pad.b;

  const groupWidth = chartW / Math.max(1, n);
  const barW = Math.min(22, Math.max(10, groupWidth * 0.24));
  const barGap = 3;

  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  const isSalesDimmed = activeTypeTab === "Expenses";
  const isExpDimmed = activeTypeTab === "Sales";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label="Sales and expenses grouped bar chart">
      {ticks.map((t) => {
        const y = pad.t + (1 - (t || 0) / max) * chartH;
        return (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray={t === 0 ? "0" : "3 4"}
              strokeWidth={t === 0 ? "1.5" : "1"}
            />
            <text x={pad.l - 10} y={y + 3.5} textAnchor="end" className="fill-slate-400 font-semibold" fontSize="10">
              {formatTick(t)}
            </text>
          </g>
        );
      })}

      {labels.map((l, i) => {
        const groupCenterX = pad.l + (i + 0.5) * groupWidth;
        const salesVal = sales[i] || 0;
        const expVal = expenses[i] || 0;
        const netVal = salesVal - expVal;

        const salesH = (salesVal / max) * chartH;
        const expH = (expVal / max) * chartH;

        const salesX = groupCenterX - barW - barGap / 2;
        const expX = groupCenterX + barGap / 2;

        const salesY = baseY - salesH;
        const expY = baseY - expH;

        return (
          <g key={l + i} className="group cursor-pointer">
            <rect
              x={groupCenterX - groupWidth / 2 + 2}
              y={pad.t}
              width={groupWidth - 4}
              height={chartH}
              rx="6"
              fill="#f1f5f9"
              className="opacity-0 group-hover:opacity-60 transition-opacity"
            />

            {salesVal > 0 ? (
              <rect
                x={salesX}
                y={salesY}
                width={barW}
                height={Math.max(3, salesH)}
                rx="3"
                ry="3"
                fill="#059669"
                className={`bar-grow transition-[fill,opacity] duration-200 group-hover:fill-emerald-500 ${
                  isSalesDimmed ? "opacity-25" : "opacity-100"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ) : (
              <rect
                x={salesX}
                y={baseY - 2}
                width={barW}
                height="2"
                rx="1"
                fill="#e2e8f0"
                className={isSalesDimmed ? "opacity-25" : "opacity-100"}
              />
            )}

            {expVal > 0 ? (
              <rect
                x={expX}
                y={expY}
                width={barW}
                height={Math.max(3, expH)}
                rx="3"
                ry="3"
                fill="#94a3b8"
                className={`bar-grow transition-[fill,opacity] duration-200 group-hover:fill-slate-500 ${
                  isExpDimmed ? "opacity-25" : "opacity-100"
                }`}
                style={{ animationDelay: `${i * 40 + 20}ms` }}
              />
            ) : (
              <rect
                x={expX}
                y={baseY - 2}
                width={barW}
                height="2"
                rx="1"
                fill="#e2e8f0"
                className={isExpDimmed ? "opacity-25" : "opacity-100"}
              />
            )}

            <text
              x={groupCenterX}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 group-hover:fill-slate-700 font-semibold transition-colors"
              fontSize="11"
            >
              {l}
            </text>

            <title>
              {`${l}\n• Sales: ₱${salesVal.toLocaleString("en-PH")}\n• Expenses: ₱${expVal.toLocaleString("en-PH")}\n• Net: ${netVal >= 0 ? "+" : ""}₱${netVal.toLocaleString("en-PH")}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

function TrendCard({ trends, activeTypeTab = "All" }) {
  const [timeframe, setTimeframe] = useState("weekly");

  const currentTrend = trends?.[timeframe] || EMPTY_TREND;

  const currentMeta = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[0];

  return (
    <section className="rounded-2xl bg-white border border-slate-200/70 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Sales vs. Expenses</h2>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">{currentMeta.sub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3.5 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Expenses
            </span>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100/80 p-1 border border-slate-200/60">
            {TIMEFRAMES.map((tab) => {
              const active = timeframe === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeframe(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <TrendChart key={timeframe} trend={currentTrend} activeTypeTab={activeTypeTab} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Transactions Table + Filters                                              */
/* -------------------------------------------------------------------------- */

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TransactionsCard({
  rows,
  tab,
  setTab,
  query,
  setQuery,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  dateRangeFilter,
  setDateRangeFilter,
  selectedId,
  onSelect,
  onOpenRecordModal,
  loading,
  error,
  onRetry,
}) {
  const tabs = ["All", "Sales", "Expenses"];
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className={`${card} min-w-0`}>
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by ID, client or supplier…"
                className="h-9 w-72 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setCurrentPage(1);
                  }}
                  className={`rounded-md px-3 py-1 cursor-pointer transition-all ${
                    tab === t ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ExportDropdown
              data={rows}
              columns={EXPORT_COLUMNS}
              filename={`SwineSync_Transactions_${new Date().toISOString().split("T")[0]}`}
              pdfTitle="SwineSync Financial Transactions Ledger"
            />
            <button
              onClick={onOpenRecordModal}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Icon name="plus" /> Record transaction
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <FilterSelect
            label="Filter by category"
            value={categoryFilter}
            onChange={(val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            }}
            options={[
              "All categories",
              "Finisher hogs",
              "Breeding sows",
              "Piglets",
              "Boars",
              "Feeds",
              "Medication",
              "Supplements",
              "Veterinary",
              "Labor",
              "Utilities",
              "Maintenance",
            ]}
          />
          <FilterSelect
            label="Filter by status"
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            options={["All statuses", "Completed", "Pending", "Overdue"]}
          />
          <FilterSelect
            label="Date range"
            value={dateRangeFilter}
            onChange={(val) => {
              setDateRangeFilter(val);
              setCurrentPage(1);
            }}
            options={["All", "Last 7 days", "Last 30 days", "This quarter", "This year"]}
          />
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-6 py-3">Transaction</th>
              <th className="px-3 py-3">Date & Time</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Client / Supplier</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-6 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-t border-slate-100">
            {pagedRows.map((t) => {
              const active = t.id === selectedId;
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`cursor-pointer transition-colors ${active ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
                >
                  <td className={`px-6 py-4 font-bold text-emerald-600 ${active ? "shadow-[inset_3px_0_0_#059669]" : ""}`}>
                    {t.id?.startsWith("#") ? t.id : `#${t.id}`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <div className="font-semibold text-slate-800">{t.date}</div>
                    {t.time && <div className="text-[11px] text-slate-400 font-normal">{t.time}</div>}
                  </td>
                  <td className="px-3 py-4">
                    <Pill className={TYPE_STYLES[t.type] || TYPE_STYLES.Expense}>{t.type}</Pill>
                  </td>
                  <td className="px-3 py-4 font-semibold text-slate-800">{t.party}</td>
                  <td className="px-3 py-4 text-slate-600">{t.category}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums ${
                      t.type === "Sale" ? "text-emerald-600" : "text-slate-800"
                    }`}
                  >
                    {t.type === "Sale" ? "+" : "−"}
                    {peso(t.amount)}
                  </td>
                  <td className="px-3 py-4">
                    <Pill className={STATUS_STYLES[t.status] || STATUS_STYLES.Completed}>{t.status || "Completed"}</Pill>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      aria-label={`View details for ${t.id}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {pagedRows.length === 0 && (
          <div className="px-6 py-14 text-center">
            {loading ? (
              <p className="text-sm font-semibold text-slate-500">Loading transactions…</p>
            ) : error ? (
              <>
                <p className="text-sm font-semibold text-rose-600">Couldn’t load transactions</p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
                <button
                  onClick={onRetry}
                  className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700">No transactions found</p>
                <p className="mt-1 text-xs text-slate-500">Try a different ID, client, or reset the filters.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-xs font-medium">
        <p className="text-slate-400">
          Showing {rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)} of {rows.length} records
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-40"
            >
              <Icon name="left" className="h-3 w-3" /> Prev
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`h-7 w-7 rounded-lg text-xs font-bold transition-all ${
                  safePage === i + 1 ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-40"
            >
              Next <Icon name="right" className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Detail Side Panel                                                         */
/* -------------------------------------------------------------------------- */

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-xs font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function DetailPanel({ tx, onClose, onStatusUpdated, loggedInUser }) {
  const isSale = tx.type === "Sale";
  const [updating, setUpdating] = useState(false);

  const handleMarkCompleted = async () => {
    setUpdating(true);
    try {
      const endpoint = `${API_BASE}/api/transactions/${tx.type}/${tx.rawId || tx.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed", creator: loggedInUser }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Status Updated", `Transaction #${tx.id} marked as Completed.`);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      toast.error("Error", err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-900/40 xl:hidden" onClick={onClose} />
      <aside
        aria-label="Transaction details"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl xl:sticky xl:top-6 xl:z-auto xl:max-h-[calc(100vh-3rem)] xl:max-w-none xl:self-start xl:rounded-2xl xl:shadow-sm xl:ring-1 xl:ring-slate-900/5"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <p className="text-sm font-bold text-emerald-600">{tx.id?.startsWith("#") ? tx.id : `#${tx.id}`}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {tx.date}
              {(tx.time || tx.createdAt) && (
                <span className="text-slate-400"> • {tx.time || (tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "")}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <div className="flex items-center gap-2">
              <Pill className={TYPE_STYLES[tx.type] || TYPE_STYLES.Expense}>{tx.type}</Pill>
              <Pill className={STATUS_STYLES[tx.status] || STATUS_STYLES.Completed}>{tx.status}</Pill>
            </div>
            <p className={`mt-3 text-3xl font-bold tabular-nums ${isSale ? "text-emerald-600" : "text-slate-900"}`}>
              {isSale ? "+" : "−"}
              {peso(tx.amount)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailRow label={isSale ? "Client / Buyer" : "Supplier / Payee"} value={tx.party} />
            <DetailRow label="Category" value={tx.category} />
            <DetailRow label="Payment method" value={tx.method} />
            <DetailRow label="Payment status" value={tx.status} />
          </dl>

          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Breakdown Items</h3>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {(tx.items || []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{it.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {isSale && it.weight
                        ? `${it.qty} head${it.qty > 1 ? "s" : ""} • ${it.weight} kg @ ${peso(it.price)}/kg`
                        : `${it.qty} × ${peso(it.price)}${it.unit ? ` / ${it.unit}` : ""}`}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-slate-800">{peso(it.subtotal || it.qty * it.price)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-xs">
                <p className="font-semibold text-slate-600">Total</p>
                <p className="font-bold tabular-nums text-slate-900">{peso(tx.amount)}</p>
              </div>
            </div>
          </div>

          {tx.linked && (
            <div className="flex gap-3 rounded-xl bg-emerald-50 p-4">
              <Icon name="box" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">
                  {isSale ? "Swine & Pen Occupancy Affected" : "Inventory & Stock Logs Updated"}
                </p>
                <p className="mt-0.5 text-xs text-emerald-900">{tx.linked}</p>
              </div>
            </div>
          )}

          {tx.notes && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notes & Reference</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{tx.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-auto flex gap-3 border-t border-slate-100 p-6">
          {tx.status !== "Completed" && tx.status !== "Cancelled" && (
            <button
              onClick={handleMarkCompleted}
              disabled={updating}
              className="h-9 flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark as Paid
            </button>
          )}
          <button
            onClick={handlePrint}
            className="h-9 flex-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print receipt
          </button>
        </div>
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Page Component                                                       */
/* -------------------------------------------------------------------------- */

export default function TransactionRecords({ loggedInUser }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [dateRangeFilter, setDateRangeFilter] = useState("All");

  const [stats, setStats] = useState([]);
  const [trends, setTrends] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions/summary`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load summary");
      setStats(data.stats || []);
      setTrends(data.trends || null);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(err.message);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "All") params.append("tab", tab);
      if (categoryFilter !== "All categories") params.append("category", categoryFilter);
      if (statusFilter !== "All statuses") params.append("status", statusFilter);
      if (dateRangeFilter !== "All") params.append("range", dateRangeFilter);
      if (query.trim()) params.append("search", query.trim());

      const res = await fetch(`${API_BASE}/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load transactions");

      const rows = Array.isArray(data.data) ? data.data : [];
      setTransactions(rows);
      setError(null);

      // Only auto-open the detail panel on desktop, where it sits beside the table.
      const desktop = window.innerWidth >= 1280;
      setSelectedId((prev) => (rows.some((t) => t.id === prev) ? prev : desktop ? rows[0]?.id ?? null : null));
    } catch (err) {
      setTransactions([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, categoryFilter, statusFilter, dateRangeFilter, query]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const selected = useMemo(() => {
    return transactions.find((t) => t.id === selectedId) || null;
  }, [transactions, selectedId]);

  return (
    <div className="space-y-6 bg-slate-50 p-6 min-h-screen">
      {summaryError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          <span>Couldn’t load totals and chart: {summaryError}</span>
          <button onClick={fetchSummary} className="rounded-lg bg-white px-3 py-1 font-bold text-rose-700 ring-1 ring-rose-200 cursor-pointer">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.length > 0
          ? stats.map((s) => <StatCard key={s.label} {...s} />)
          : ["Total Sales", "Total Expenses", "Net Income", "Pending Payments"].map((label) => (
              <StatCard key={label} label={label} loading={!summaryError} value="—" />
            ))}
      </div>

      <TrendCard trends={trends} activeTypeTab={tab} />

      <div className={`grid items-start gap-6 ${selected ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <TransactionsCard
          rows={transactions}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          dateRangeFilter={dateRangeFilter}
          setDateRangeFilter={setDateRangeFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpenRecordModal={() => setIsRecordModalOpen(true)}
          loading={loading}
          error={error}
          onRetry={fetchTransactions}
        />
        {selected && (
          <DetailPanel
            tx={selected}
            onClose={() => setSelectedId(null)}
            onStatusUpdated={() => {
              fetchSummary();
              fetchTransactions();
            }}
            loggedInUser={loggedInUser}
          />
        )}
      </div>

      {isRecordModalOpen && (
        <RecordTransactionModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={() => {
            fetchSummary();
            fetchTransactions();
          }}
          loggedInUser={loggedInUser}
        />
      )}
    </div>
  );
}
