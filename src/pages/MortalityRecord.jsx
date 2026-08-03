import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  ChevronDown,
  SlidersHorizontal,
  X,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "../utils/toast";

// ---------------------------------------------------------------------------
// Data fetched from backend API
// ---------------------------------------------------------------------------

const causeStyles = {
  "Respiratory Sickness": "bg-rose-50 text-rose-700 ring-rose-600/20",
  "Traumatic Injury": "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Acute Sickness": "bg-rose-50 text-rose-700 ring-rose-600/20",
  Stillbirth: "bg-slate-100 text-slate-700 ring-slate-600/20",
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function CausePill({ cause }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${causeStyles[cause] ?? "bg-slate-50 text-slate-700 ring-slate-600/20"
        }`}
    >
      {cause}
    </span>
  );
}

const ALERT_THRESHOLD = 1.5;

function ElevatedRiskBanner({ elevatedRiskPens }) {
  if (!elevatedRiskPens || elevatedRiskPens.length === 0) return null;
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
          <ShieldAlert className="h-4 w-4" />
          {elevatedRiskPens.length} pen{elevatedRiskPens.length > 1 ? "s" : ""} showing elevated
          mortality risk
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800"
        >
          Investigate
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {elevatedRiskPens.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs"
          >
            <span className="font-semibold text-slate-800">{p.id}</span>
            <span className="text-slate-400">&middot;</span>
            <span className="text-slate-600">{p.cause}</span>
            <span className="text-slate-400">&middot;</span>
            <span className="font-medium text-rose-600">
              {Math.round(p.risk * 100)}% risk
            </span>
            <span className="text-slate-400">&middot;</span>
            <span className="text-slate-400">{p.lastIncident}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateTrendHero({ monthlyTrend }) {
  const rate = monthlyTrend && monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].rate : 0;
  const width = 640;
  const height = 190;
  const padding = 28;
  const chartMax = ALERT_THRESHOLD;
  const plotW = width - padding * 2;
  const plotH = height - padding - 16;

  const points = (monthlyTrend || []).map((d, i) => {
    const x = padding + (i / (monthlyTrend.length - 1 || 1)) * plotW;
    const y = padding + plotH - (d.rate / chartMax) * plotH;
    return { x, y, ...d };
  });

  const linePath = points.length > 0 ? points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ") : "";
  const areaPath = points.length > 0 ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${(
    padding + plotH
  ).toFixed(1)} L${points[0].x.toFixed(1)},${(padding + plotH).toFixed(1)} Z` : "";

  const thresholdY = padding + plotH - (ALERT_THRESHOLD / chartMax) * plotH;

  return (
    <div className="min-w-[320px] flex-[1.8] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Current Monthly Rate</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-4xl font-semibold tracking-tight text-emerald-600">
              {rate.toFixed(2)}%
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Status: Normal &middot; well under {ALERT_THRESHOLD}% alert line
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          12-Month Trend &middot; FY2024
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-40 w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* alert threshold reference line */}
        <line
          x1={padding}
          x2={width - padding}
          y1={thresholdY}
          y2={thresholdY}
          stroke="#fda4af"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x={width - padding} y={thresholdY - 6} textAnchor="end" fontSize="9" fill="#fb7185">
          {ALERT_THRESHOLD}% alert
        </text>

        <path d={areaPath} fill="url(#rateFill)" />
        <path d={linePath} fill="none" stroke="#059669" strokeWidth="2.5" />

        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <g key={p.month}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 4 : 2.5}
                fill={isLast ? "#059669" : "#ffffff"}
                stroke="#059669"
                strokeWidth={isLast ? 0 : 1.5}
              />
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {p.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CauseDonut({ causeBreakdown, totalMortality }) {
  const size = 150;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="min-w-[280px] flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">Breakdown by Cause</p>
      <div className="mt-4 flex items-center gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {causeBreakdown.map((c) => {
              const dash = (c.value / 100) * circumference;
              const gap = circumference - dash;
              const offset = -((cumulative / 100) * circumference);
              cumulative += c.value;
              return (
                <circle
                  key={c.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </g>
          <text
            x={size / 2}
            y={size / 2 - 4}
            textAnchor="middle"
            fontSize="19"
            fontWeight="600"
            fill="#0f172a"
          >
            {totalMortality}
          </text>
          <text x={size / 2} y={size / 2 + 13} textAnchor="middle" fontSize="10" fill="#94a3b8">
            TOTAL
          </text>
        </svg>
        <div className="space-y-3">
          {causeBreakdown.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-slate-700">{c.label}</span>
              <span className="text-slate-400">
                {c.value}% &middot; {c.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function riskColor(risk) {
  if (risk >= 0.6) return "bg-rose-500 text-white border-rose-500";
  if (risk >= 0.35) return "bg-amber-200 text-amber-900 border-amber-300";
  if (risk >= 0.2) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-emerald-50 text-emerald-600 border-emerald-100";
}

function PenHotZones({ penRisk }) {
  return (
    <div className="min-w-[280px] flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">Mortality by Pen</p>
        <span className="text-[11px] text-slate-400">Updated 2h ago</span>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-2">
        {penRisk.map((p) => (
          <div
            key={p.id}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${riskColor(
              p.risk
            )}`}
            title={`${p.id} \u00b7 ${p.count} mortalities \u00b7 ${Math.round(p.risk * 100)}% risk`}
          >
            <span>{p.id}</span>
            <span className="text-[10px] font-normal opacity-80">{p.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-100 ring-1 ring-emerald-200" /> Low
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-200" /> Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> High
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MortalityRecord({ setActiveTab }) {
  const [query, setQuery] = useState("");
  const [causeFilter, setCauseFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/mortality-logs?t=" + Date.now());
        const json = await res.json();

        const logs = (json.data || []).map(m => ({
          date: new Date(m.log_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
          penId: m.pen_id ? `Pen ${m.pen_id.substring(0, 8)}` : `Batch ${m.batch_id?.substring(0, 8)}`,
          cause: m.cause,
          action: m.action_taken || "None",
          staff: m.recorded_by || "System",
        }));
        setRecentLogs(logs);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load mortality logs");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const causes = useMemo(
    () => Array.from(new Set(recentLogs.map((r) => r.cause))),
    []
  );

  const filteredLogs = useMemo(() => {
    return recentLogs.filter((row) => {
      const matchesQuery =
        query.trim() === "" ||
        [row.penId, row.cause, row.staff, row.action]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesCause = causeFilter === "all" || row.cause === causeFilter;
      return matchesQuery && matchesCause;
    });
  }, [query, causeFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8">

        {/* Elevated risk banner (mirrors Critical Cases in Treatment Logs) */}
        <div className="mt-2">
          <ElevatedRiskBanner />
        </div>

        {/* Top row: rate hero + cause breakdown */}
        <div className="mt-4 flex flex-wrap gap-4">
          <RateTrendHero monthlyTrend={[{ month: "JAN", rate: 0.1 }, { month: "FEB", rate: 0.2 }, { month: "MAR", rate: 0.3 }]} />
          <CauseDonut causeBreakdown={[{ label: "Sickness", value: 100, count: recentLogs.length, color: "#059669" }]} totalMortality={recentLogs.length} />
        </div>

        {/* Second row: hot zones, full width for legibility */}
        <div className="mt-4 flex flex-wrap gap-4">
          <PenHotZones penRisk={[]} />
        </div>

        {/* Recent Mortality Logs */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Mortality Logs</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pen, cause, staff..."
                  className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
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
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                View All Logs &rarr;
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Cause</label>
                <select
                  value={causeFilter}
                  onChange={(e) => setCauseFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All</option>
                  {causes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Date range</label>
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
              {(causeFilter !== "all" || query) && (
                <button
                  onClick={() => {
                    setCauseFilter("all");
                    setQuery("");
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
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Pen ID</th>
                  <th className="px-5 py-3 font-medium">Cause</th>
                  <th className="px-5 py-3 font-medium">Action taken</th>
                  <th className="px-5 py-3 font-medium">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    </tr>
                  ))
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                      No logs match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-4 text-slate-600">{row.date}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">{row.penId}</td>
                      <td className="px-5 py-4">
                        <CausePill cause={row.cause} />
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.action}</td>
                      <td className="px-5 py-4 text-slate-600">{row.staff}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
