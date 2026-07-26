import React, { useState, useEffect } from "react";
import { toast } from "../utils/toast";

const FONT_DISPLAY = "font-['Space_Grotesk',_sans-serif]";

/* ---------------------------------------------------------------------- */
/* Chart geometry helpers (repurposed for Feed Consumption)               */
/* ---------------------------------------------------------------------- */
const CHART_W = 720;
const CHART_H = 280;
const PAD = { top: 16, right: 20, bottom: 30, left: 40 };

function FeedConsumptionChart({ batch, maxFeed = 1000 }) {
  if (!batch) return null;
  
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  
  // A simplified bar chart showing Target vs Actual feed for the batch
  const targetH = Math.min((batch.targetFeedKg / maxFeed) * plotH, plotH) || 0;
  const actualH = Math.min((batch.actualFeedKg / maxFeed) * plotH, plotH) || 0;
  
  return (
    <div className="w-full h-[220px] sm:h-[280px]">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-full">
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = Math.round(maxFeed * ratio);
          const y = PAD.top + plotH - (ratio * plotH);
          return (
            <g key={val}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} stroke="#e2e6df" strokeWidth="1" />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize="10.5" fill="#5c6b62">{val}kg</text>
            </g>
          );
        })}

        {/* Target Bar */}
        <rect
          x={PAD.left + plotW * 0.25}
          y={PAD.top + plotH - targetH}
          width={plotW * 0.2}
          height={targetH}
          fill="#d4d9d1"
          rx="4"
        />
        <text x={PAD.left + plotW * 0.35} y={CHART_H - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5c6b62">
          Target Feed
        </text>

        {/* Actual Bar */}
        <rect
          x={PAD.left + plotW * 0.55}
          y={PAD.top + plotH - actualH}
          width={plotW * 0.2}
          height={actualH}
          fill={batch.status === 'alert' ? '#a8412a' : '#1c6b4c'}
          rx="4"
        />
        <text x={PAD.left + plotW * 0.65} y={CHART_H - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5c6b62">
          Actual Consumed
        </text>
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                   */
/* ---------------------------------------------------------------------- */
function KpiCard({ label, value, sub, tone }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 flex-1 min-w-[150px] shadow-sm">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
        {label}
      </span>
      <span
        className={`${FONT_DISPLAY} block text-2xl font-bold tracking-tight ${
          tone === "positive" ? "text-emerald-800" : tone === "negative" ? "text-[#a8412a]" : "text-neutral-900"
        }`}
      >
        {value}
      </span>
      {sub && <span className="block text-xs text-neutral-500 mt-1">{sub}</span>}
    </div>
  );
}

function StatusPill({ status, children }) {
  return (
    <span
      className={`text-[12.5px] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap text-white ${
        status === "alert" ? "bg-[#a8412a]" : "bg-emerald-800"
      }`}
    >
      {children}
    </span>
  );
}

function SegmentedToggle({ value, onChange }) {
  const options = [
    { id: "overview", label: "All Programs" },
    { id: "detail", label: "Program Detail" },
  ];
  return (
    <div className="inline-flex bg-white border border-neutral-200 rounded-full p-1 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
            value === opt.id ? "bg-emerald-800 text-white" : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Overview: cross-batch comparison                                        */
/* ---------------------------------------------------------------------- */
function OverviewView({ programs }) {
  const onTrackCount = programs.filter((p) => p.status === "on-track").length;
  const alertCount = programs.length - onTrackCount;
  
  const totalTargetFeed = programs.reduce((sum, p) => sum + (p.targetFeedKg || 0), 0);
  const totalActualFeed = programs.reduce((sum, p) => sum + (p.actualFeedKg || 0), 0);
  const variance = totalActualFeed - totalTargetFeed;

  return (
    <div className="flex flex-col gap-5 tab-enter">
      <div className="flex flex-col sm:flex-row gap-4">
        <KpiCard label="Active Batches" value={programs.length} />
        <KpiCard
          label="On Track / Alert"
          value={`${onTrackCount} / ${alertCount}`}
          tone={alertCount > 0 ? "negative" : "positive"}
        />
        <KpiCard
          label="Total Feed Variance"
          value={`${variance > 0 ? "+" : ""}${variance} kg`}
          sub="across all active batches"
          tone={variance > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-neutral-200">
                {["Program Template", "Batch ID", "Current Age", "Target Feed", "Actual Feed", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500 px-5 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.id} className="border-b border-neutral-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-semibold text-neutral-800 whitespace-nowrap">
                    {program.name}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-600 whitespace-nowrap">{program.batch}</td>
                  <td className="px-5 py-3.5 text-sm text-neutral-600 whitespace-nowrap">
                    {program.ageInDays} Days Old
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-600 whitespace-nowrap">
                    {program.targetFeedKg} kg
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-800 font-semibold whitespace-nowrap">
                    {program.actualFeedKg} kg
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <StatusPill status={program.status}>{program.statusLabel}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Detail: single-program deep dive                                        */
/* ---------------------------------------------------------------------- */
function DetailView({ programs, selectedId, onSelect }) {
  const program = programs.find((p) => p.id === selectedId) ?? programs[0];
  if (!program) return null;

  const variance = program.actualFeedKg - program.targetFeedKg;
  const maxFeed = Math.max(program.targetFeedKg, program.actualFeedKg, 100) * 1.2; // Add 20% headroom

  return (
    <div className="flex flex-col gap-5 tab-enter">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <label className="flex items-center gap-2.5">
          <span className="text-[12.5px] font-semibold text-neutral-500 whitespace-nowrap">Select Batch</span>
          <select
            value={program.id}
            onChange={(e) => onSelect(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg pl-3 pr-8 py-2 text-sm font-semibold text-neutral-800 shadow-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"
          >
            {programs.map((p) => (
              <option value={p.id} key={p.id}>
                {p.batch} ({p.name})
              </option>
            ))}
          </select>
        </label>
        <StatusPill status={program.status}>{program.statusLabel}</StatusPill>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <KpiCard label="Batch Age" value={`${program.ageInDays} Days`} />
        <KpiCard label="Target Feed Consumption" value={`${program.targetFeedKg} kg`} />
        <KpiCard label="Actual Feed Consumption" value={`${program.actualFeedKg} kg`} />
        <KpiCard
          label="Feed Variance"
          value={`${variance > 0 ? "+" : ""}${variance} kg`}
          tone={variance > 0 ? "negative" : "positive"}
          sub={variance > 0 ? "Overfeeding detected" : "Within limits"}
        />
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`${FONT_DISPLAY} text-[15.5px] font-semibold`}>Feed Consumption Analysis</h3>
        </div>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          Comparing the target feed volume required for this batch's age against the actual recorded feed logs.
        </p>
        <FeedConsumptionChart batch={program} maxFeed={maxFeed} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                     */
/* ---------------------------------------------------------------------- */
export default function GrowthAnalytics() {
  const [view, setView] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/growth/batches');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const data = await res.json();
      setPrograms(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f3f5f1] min-h-full px-4 sm:px-9 pt-8 pb-14 font-sans text-neutral-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');`}</style>

      <div className="flex flex-col sm:flex-row sm:items-end items-stretch justify-between gap-4 mb-7">
        <div>
          <span className={`${FONT_DISPLAY} block text-xs font-semibold uppercase tracking-[0.08em] text-emerald-800 mb-1.5`}>
            Growth Management
          </span>
          <h1 className={`${FONT_DISPLAY} text-[26px] font-bold tracking-tight m-0`}>Growth Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor feed consumption and guideline adherence across all enrolled batches.
          </p>
        </div>
        <SegmentedToggle value={view} onChange={setView} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl shadow-sm">
          <p className="text-neutral-500 text-sm font-semibold">No analytics data available yet. Enroll batches into a growth program first.</p>
        </div>
      ) : view === "overview" ? (
        <OverviewView programs={programs} />
      ) : (
        <DetailView programs={programs} selectedId={selectedId} onSelect={setSelectedId} />
      )}
    </div>
  );
}
