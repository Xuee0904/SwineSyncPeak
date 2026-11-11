import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import RecordTransactionModal from "../components/Transactions/RecordTransactionModal";
import ExportDropdown from "../components/common/ExportDropdown";
import { Loader2, CheckCircle2, Printer } from "lucide-react";
import toast from "../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/* -------------------------------------------------------------------------- */
/*  Fallback / Initial Data                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_STATS = [
  { label: "Total sales", value: "₱482,500", note: "Current period", icon: "trendUp", tone: "emerald" },
  { label: "Total expenses", value: "₱196,350", note: "Current period", icon: "trendDown", tone: "slate" },
  { label: "Net income", value: "₱286,150", note: "59% profit margin", icon: "wallet", tone: "emerald" },
  { label: "Pending payments", value: "₱67,850", note: "2 transactions", icon: "clock", tone: "amber" },
];

const DEFAULT_TREND = {
  labels: ["Sep 19", "Sep 26", "Oct 3", "Oct 10", "Oct 17", "Oct 24", "Oct 31", "Nov 7"],
  sales: [210, 260, 240, 310, 290, 380, 350, 420], // in thousands
  expenses: [140, 150, 170, 160, 185, 175, 190, 196],
};

const DEFAULT_TRANSACTIONS = [
  {
    id: "TX-94821", date: "Nov 6, 2026", rawDate: "2026-11-06", type: "Sale", party: "Green Valley Organics",
    category: "Finisher hogs", amount: 156000, status: "Completed", method: "Bank transfer",
    items: [{ name: "Finisher hog (~100 kg)", qty: 12, price: 13000 }],
    linked: "12 finishers removed from Pen 4 inventory",
    notes: "Picked up by buyer’s truck at 7:30 AM. Weighed on farm scale.",
  },
  {
    id: "TX-94820", date: "Nov 5, 2026", rawDate: "2026-11-05", type: "Expense", party: "AgriMax Feeds Supply",
    category: "Feeds", amount: 66000, status: "Completed", method: "Bank transfer",
    items: [{ name: "Starter feed, 50 kg sack", qty: 40, price: 1650 }],
    linked: "+40 sacks added to Feed stock",
    notes: "Delivered to the main feed storage. Batch no. S-1105.",
  },
  {
    id: "TX-94819", date: "Nov 5, 2026", rawDate: "2026-11-05", type: "Sale", party: "Southern Feeders Ltd.",
    category: "Breeding sows", amount: 55500, status: "Pending", method: "Check",
    items: [{ name: "Breeding sow", qty: 3, price: 18500 }],
    linked: "#SOW-11012025, #SOW-08152025, #SOW-08152024",
    notes: "Check expected to clear within 3 banking days.",
  },
  {
    id: "TX-94818", date: "Nov 4, 2026", rawDate: "2026-11-04", type: "Expense", party: "Dr. Reyes Veterinary Clinic",
    category: "Veterinary", amount: 8600, status: "Completed", method: "Cash",
    items: [
      { name: "Hog cholera vaccine dose", qty: 60, price: 85 },
      { name: "Farm visit fee", qty: 1, price: 3500 },
    ],
    linked: "Health log updated for Pen 2 and Pen 3",
    notes: "",
  },
  {
    id: "TX-94817", date: "Nov 3, 2026", rawDate: "2026-11-03", type: "Sale", party: "Peak Livestock",
    category: "Piglets", amount: 70000, status: "Completed", method: "GCash",
    items: [{ name: "Weaned piglet", qty: 25, price: 2800 }],
    linked: "#BTC-09012026 (25 of 31 piglets)",
    notes: "Buyer requested health records for the batch.",
  },
  {
    id: "TX-94816", date: "Nov 2, 2026", rawDate: "2026-11-02", type: "Expense", party: "Nueva Ecija Power Coop",
    category: "Utilities", amount: 12350, status: "Overdue", method: "Over the counter",
    items: [{ name: "Electricity, October billing", qty: 1, price: 12350 }],
    linked: "",
    notes: "Due date was Nov 1. Pay before the disconnection notice.",
  },
  {
    id: "TX-94815", date: "Nov 1, 2026", rawDate: "2026-11-01", type: "Expense", party: "Farm payroll",
    category: "Labor", amount: 38000, status: "Completed", method: "Cash",
    items: [{ name: "Farmhand, semi-monthly pay", qty: 4, price: 9500 }],
    linked: "",
    notes: "",
  },
  {
    id: "TX-94814", date: "Oct 31, 2026", rawDate: "2026-10-31", type: "Sale", party: "Mang Tonio’s Lechon",
    category: "Finisher hogs", amount: 50000, status: "Completed", method: "Cash",
    items: [{ name: "Finisher hog (~90 kg)", qty: 4, price: 12500 }],
    linked: "4 finishers removed from Pen 4 inventory",
    notes: "",
  },
];

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

const TONE_STYLES = {
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-500",
  amber: "bg-amber-50 text-amber-600",
};

const ICONS = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  trendUp: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  trendDown: <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
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

function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className={`${card} flex items-center gap-4 p-5`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_STYLES[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{note}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trend Chart (Plain SVG based on live weekly totals)                       */
/* -------------------------------------------------------------------------- */

function TrendChart({ trend }) {
  const W = 800, H = 280;
  const pad = { l: 48, r: 16, t: 16, b: 32 };

  const labels = trend?.labels || DEFAULT_TREND.labels;
  const sales = trend?.sales || DEFAULT_TREND.sales;
  const expenses = trend?.expenses || DEFAULT_TREND.expenses;

  const maxVal = Math.max(50, ...sales, ...expenses);
  const max = Math.ceil(maxVal / 100) * 100 || 500;
  const n = labels.length;

  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v) => pad.t + (1 - (v || 0) / max) * (H - pad.t - pad.b);

  const toPoints = (arr) => arr.map((v, i) => [x(i), y(v)]);
  const smooth = (pts) =>
    pts.reduce((d, [px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = pts[i - 1];
      const cx = (qx + px) / 2;
      return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`;
    }, "");

  const salesPts = toPoints(sales);
  const expPts = toPoints(expenses);
  const baseY = H - pad.b;
  const salesArea = `${smooth(salesPts)} L${x(n - 1)},${baseY} L${x(0)},${baseY} Z`;

  const step = max / 5;
  const ticks = [0, step, step * 2, step * 3, step * 4, max].map((v) => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sales and expenses over the last 8 weeks">
      <defs>
        <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? "0" : "3 4"} />
          <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" className="fill-slate-400" fontSize="11">
            {t === 0 ? "0" : `₱${t}k`}
          </text>
        </g>
      ))}

      <path d={salesArea} fill="url(#salesFill)" />
      <path d={smooth(expPts)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
      <path d={smooth(salesPts)} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />

      {salesPts.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={i === n - 1 ? 5 : 3} fill="#fff" stroke="#059669" strokeWidth="2" />
      ))}

      {labels.map((l, i) => (
        <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="11">
          {l}
        </text>
      ))}
    </svg>
  );
}

function TrendCard({ trend }) {
  return (
    <section className={`${card} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sales vs. expenses</h2>
          <p className="mt-0.5 text-sm text-slate-500">Weekly totals for the last 8 weeks</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-emerald-600" /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-slate-400" /> Expenses
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <TrendChart trend={trend} />
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
  totalCount,
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
                    {(t.time || t.createdAt) && (
                      <div className="text-[11px] text-slate-400 font-normal">
                        {t.time || (t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : "")}
                      </div>
                    )}
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
            <p className="text-sm font-semibold text-slate-700">No transactions match your search</p>
            <p className="mt-1 text-xs text-slate-500">Try a different ID, client, or reset the filters.</p>
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

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [trend, setTrend] = useState(DEFAULT_TREND);
  const [transactions, setTransactions] = useState(DEFAULT_TRANSACTIONS);
  const [selectedId, setSelectedId] = useState(DEFAULT_TRANSACTIONS[0]?.id || null);

  const [loading, setLoading] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Fetch Summary KPIs & 8-week Trend
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions/summary`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.trend) setTrend(data.trend);
      }
    } catch (err) {
      console.warn("Could not load transactions summary, using fallback:", err.message);
    }
  }, []);

  // Fetch Transactions list
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
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length > 0) {
          setTransactions(data.data);
          if (!selectedId || !data.data.some((t) => t.id === selectedId)) {
            setSelectedId(data.data[0].id);
          }
        } else {
          // If server returned 0 results, fall back to filtered DEFAULT_TRANSACTIONS
          const localFiltered = DEFAULT_TRANSACTIONS.filter((t) => {
            if (tab === "Sales" && t.type !== "Sale") return false;
            if (tab === "Expenses" && t.type !== "Expense") return false;
            if (categoryFilter !== "All categories" && (t.category || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
            if (statusFilter !== "All statuses" && (t.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
            if (query.trim()) {
              const q = query.trim().toLowerCase();
              return t.id.toLowerCase().includes(q) || t.party.toLowerCase().includes(q);
            }
            return true;
          });
          setTransactions(localFiltered);
          if (localFiltered.length > 0 && (!selectedId || !localFiltered.some((t) => t.id === selectedId))) {
            setSelectedId(localFiltered[0].id);
          }
        }
      }
    } catch (err) {
      console.warn("Could not load transactions from API, using default:", err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, categoryFilter, statusFilter, dateRangeFilter, query, selectedId]);

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
      {/* 4 Top KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* 8-Week Trend Chart */}
      <TrendCard trend={trend} />

      {/* Main Transactions Grid */}
      <div className={`grid items-start gap-6 ${selected ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <TransactionsCard
          rows={transactions}
          totalCount={transactions.length}
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

      {/* Record Transaction Modal */}
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
