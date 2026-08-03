import React, { useState, useEffect } from "react";
import { AlertTriangle, Zap, Target } from "lucide-react";
import { toast } from "../utils/toast";

const FONT_DISPLAY = "font-['Space_Grotesk',_sans-serif]";

/* ---------------------------------------------------------------------- */
/* Chart geometry helpers (repurposed for Feed Consumption)               */
/* ---------------------------------------------------------------------- */
const CHART_W = 720;
const CHART_H = 280;
const PAD = { top: 16, right: 20, bottom: 30, left: 40 };

function GrowthCurveChart({ batch }) {
  if (!batch) return null;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const targetDay = 150;
  const maxDays = Math.max(targetDay, batch.ageInDays) * 1.1;
  const maxWeight = Math.max(batch.targetWeight, batch.estimatedCurrentWeight) * 1.1;

  const getX = (days) => PAD.left + (days / maxDays) * plotW;
  const getY = (weight) => PAD.top + plotH - (weight / maxWeight) * plotH;

  const currentX = getX(batch.ageInDays);
  const currentY = getY(batch.estimatedCurrentWeight);

  const targetX = getX(targetDay);
  const targetY = getY(batch.targetWeight);

  const scaleFactor = batch.targetWeight / 105.0;
  const milestones = [
    { day: 0, weight: 1.5 },
    { day: 21, weight: 7.0 },
    { day: 49, weight: 20.0 },
    { day: 90, weight: 50.0 },
    { day: 150, weight: 105.0 }
  ];

  let actualPath = `M ${getX(0)} ${getY(1.5 * scaleFactor)}`;
  let lastDay = 0;
  for (let i = 1; i < milestones.length; i++) {
    if (batch.ageInDays >= milestones[i].day) {
      actualPath += ` L ${getX(milestones[i].day)} ${getY(milestones[i].weight * scaleFactor)}`;
      lastDay = i;
    } else {
      break;
    }
  }
  actualPath += ` L ${currentX} ${currentY}`;

  let projectedPath = `M ${currentX} ${currentY}`;
  for (let i = lastDay + 1; i < milestones.length; i++) {
    projectedPath += ` L ${getX(milestones[i].day)} ${getY(milestones[i].weight * scaleFactor)}`;
  }
  if (batch.ageInDays > 150) {
    projectedPath = ""; // No projection needed if past target day
  }

  return (
    <div className="w-full h-[220px] sm:h-[280px]">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-full overflow-visible">
        {/* Y-axis (Weight) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = Math.round(maxWeight * ratio);
          const y = PAD.top + plotH - (ratio * plotH);
          return (
            <g key={val}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} stroke="#e2e6df" strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize="10.5" fill="#5c6b62">{val}kg</text>
            </g>
          );
        })}

        {/* Target Point */}
        <circle cx={targetX} cy={targetY} r="6" fill="#d4d9d1" />
        <text x={targetX} y={targetY - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#5c6b62">Target ({batch.targetWeight}kg)</text>

        {/* Projected Line */}
        {projectedPath && (
          <path d={projectedPath} stroke="#d4d9d1" strokeWidth="3" strokeDasharray="6 6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Actual Growth Line */}
        <path d={actualPath} stroke="#1c6b4c" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Current Point */}
        <circle cx={currentX} cy={currentY} r="6" fill="#1c6b4c" stroke="#fff" strokeWidth="2" />
        <text x={currentX} y={currentY + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c6b4c">Current ({batch.estimatedCurrentWeight}kg)</text>
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Inventory Distribution Chart                                           */
/* ---------------------------------------------------------------------- */
function InventoryDistributionChart({ programs }) {
  if (!programs || programs.length === 0) return null;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const targetDay = 150;
  const maxDays = Math.max(targetDay, ...programs.map(p => p.ageInDays)) * 1.05;
  const maxWeight = Math.max(105, ...programs.map(p => Math.max(p.targetWeight, p.estimatedCurrentWeight))) * 1.1;

  const getX = (days) => PAD.left + (days / maxDays) * plotW;
  const getY = (weight) => PAD.top + plotH - (weight / maxWeight) * plotH;

  const milestones = [
    { day: 0, weight: 1.5 },
    { day: 21, weight: 7.0 },
    { day: 49, weight: 20.0 },
    { day: 90, weight: 50.0 },
    { day: 150, weight: 105.0 }
  ];

  let standardPath = `M ${getX(0)} ${getY(1.5)}`;
  for (let i = 1; i < milestones.length; i++) {
    standardPath += ` L ${getX(milestones[i].day)} ${getY(milestones[i].weight)}`;
  }

  return (
    <div className="w-full h-[220px] sm:h-[280px]">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-full overflow-visible">
        {/* Y-axis (Weight) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const val = Math.round(maxWeight * ratio);
          const y = PAD.top + plotH - (ratio * plotH);
          return (
            <g key={val}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y} y2={y} stroke="#e2e6df" strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize="10.5" fill="#5c6b62">{val}kg</text>
            </g>
          );
        })}

        {/* Shaded Area for Standard Curve */}
        <path
          d={`${standardPath} L ${getX(150)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`}
          fill="#dcfce7"
          opacity="0.3"
        />
        <path d={standardPath} stroke="#86efac" strokeWidth="2" strokeDasharray="4 4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x={getX(150)} y={getY(105) - 10} textAnchor="middle" fontSize="10" fill="#22c55e" fontWeight="600">Standard 105kg Target</text>

        {/* Batch Points */}
        {programs.map(batch => {
          const cx = getX(batch.ageInDays);
          const cy = getY(batch.estimatedCurrentWeight);
          return (
            <g key={batch.id} className="cursor-pointer transition-transform hover:scale-110 origin-center" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <circle
                cx={cx}
                cy={cy}
                r="7"
                fill={batch.status === 'alert' ? '#f97316' : '#1c6b4c'}
                stroke="#fff"
                strokeWidth="2"
              />
              <text x={cx} y={cy - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill={batch.status === 'alert' ? '#9a3412' : '#064e3b'}>
                {batch.batchTag}
              </text>
            </g>
          );
        })}
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
        className={`${FONT_DISPLAY} block text-2xl font-bold tracking-tight ${tone === "positive" ? "text-emerald-800" : tone === "negative" ? "text-[#a8412a]" : "text-neutral-900"
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
      className={`text-[12.5px] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap text-white ${status === "alert" ? "bg-[#a8412a]" : "bg-emerald-800"
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
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${value === opt.id ? "bg-emerald-800 text-white" : "text-neutral-600 hover:text-neutral-900"
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
function OverviewView({ programs, view, setView }) {
  const onTrackCount = programs.filter((p) => p.status === "on-track").length;
  const alertCount = programs.length - onTrackCount;

  const totalCumulativeFeed = programs.reduce((sum, p) => sum + (p.cumulativeFeed || 0), 0);
  const marketReadyBatches = programs.filter(p => p.estimatedCurrentWeight >= p.targetWeight).length;
  
  const avgMortalityRate = programs.length > 0
    ? programs.reduce((sum, p) => sum + (p.mortalityRate || 0), 0) / programs.length
    : 0;

  // Aggregate all DSS alerts
  const dssAlerts = programs.flatMap(p =>
    (p.alerts || []).map(a => ({ batchTag: p.batchTag, text: a }))
  );

  return (
    <div className="flex flex-col gap-5 tab-enter">

      <div className="flex flex-col sm:flex-row gap-4">
        <KpiCard label="Active Batches" value={programs.length} />
        <KpiCard
          label="Market Ready"
          value={marketReadyBatches}
          tone={marketReadyBatches > 0 ? "positive" : "neutral"}
          sub="Batches at target weight"
        />
        <KpiCard
          label="Total Est. Feed"
          value={`${totalCumulativeFeed.toFixed(0)} kg`}
          sub="cumulative across all active"
        />
        <KpiCard
          label="Avg Mortality"
          value={`${avgMortalityRate.toFixed(1)}%`}
          tone={avgMortalityRate > 5 ? "negative" : "neutral"}
          sub="across active batches"
        />
      </div>

      <div className="flex justify-start">
        <SegmentedToggle value={view} onChange={setView} />
      </div>

      {/* DSS Action Center */}
      {dssAlerts.length > 0 && (
        <div className="bg-orange-50/80 border border-orange-200/60 rounded-2xl p-5 shadow-sm">
          <h3 className={`${FONT_DISPLAY} text-[15px] font-bold text-orange-900 flex items-center gap-2 mb-3`}>
            <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
            Decision Support System (DSS) Alerts
          </h3>
          <div className="flex flex-col gap-2.5">
            {dssAlerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white/60 border border-orange-200/50 rounded-xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-[13.5px] font-semibold text-neutral-800 leading-snug flex flex-col sm:block">
                  <span className="text-orange-700 mr-2 font-bold uppercase tracking-wide text-[11px] px-2 py-0.5 rounded bg-orange-100/50 self-start sm:inline-block mb-1 sm:mb-0">{alert.batchTag}</span>
                  {alert.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Distribution Chart */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`${FONT_DISPLAY} text-[15.5px] font-semibold`}>Inventory Distribution Map</h3>
        </div>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          A bird's-eye view of all active batches mapped along the standard growth timeline.
        </p>
        <InventoryDistributionChart programs={programs} />
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-neutral-200">
                {["Batch ID", "Program", "Age", "Estimated Weight", "Target Weight", "Est. Feed Consumed", "Status"].map((h) => (
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
                  <td className="px-5 py-3.5 text-sm font-bold text-neutral-800 whitespace-nowrap">
                    {program.batchTag}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-neutral-600 whitespace-nowrap">
                    {program.programName}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-600 whitespace-nowrap">
                    {program.ageInDays} Days
                  </td>
                  <td className="px-5 py-3.5 text-sm text-indigo-700 font-bold whitespace-nowrap">
                    {program.estimatedCurrentWeight} kg
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-600 whitespace-nowrap">
                    {program.targetWeight} kg
                  </td>
                  <td className="px-5 py-3.5 text-sm text-neutral-800 font-semibold whitespace-nowrap">
                    {program.cumulativeFeed} kg
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
function DetailView({ programs, selectedId, onSelect, view, setView }) {
  const program = programs.find((p) => p.id === selectedId) ?? programs[0];
  if (!program) return null;

  return (
    <div className="flex flex-col gap-5 tab-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <label className="flex items-center gap-2.5">
          <span className="text-[12.5px] font-semibold text-neutral-500 whitespace-nowrap">Select Batch</span>
          <select
            value={program.id}
            onChange={(e) => onSelect(e.target.value)}
            className="bg-white border border-neutral-200 rounded-lg pl-3 pr-8 py-2 text-sm font-semibold text-neutral-800 shadow-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800"
          >
            {programs.map((p) => (
              <option value={p.id} key={p.id}>
                {p.batchTag} ({p.programName})
              </option>
            ))}
          </select>
        </label>
        <StatusPill status={program.status}>{program.statusLabel}</StatusPill>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <KpiCard label="Batch Age" value={`${program.ageInDays} Days`} />
        <KpiCard label="Estimated Weight" value={`${program.estimatedCurrentWeight} kg`} tone="positive" />
        <KpiCard label="Target Weight" value={`${program.targetWeight} kg`} />
        <KpiCard label="Mortality Rate" value={`${program.mortalityRate?.toFixed(1) || 0}%`} tone={program.mortalityRate > 5 ? 'negative' : 'neutral'} />
      </div>

      <div className="flex justify-start">
        <SegmentedToggle value={view} onChange={setView} />
      </div>

      {program.alerts && program.alerts.length > 0 && (
        <div className="bg-orange-50/80 border border-orange-200/60 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <Zap className="w-5 h-5 text-orange-500 fill-orange-500 shrink-0 mt-0.5" />
          <p className="text-[14px] font-semibold text-orange-900 leading-snug">
            <span className="font-bold uppercase tracking-wider text-[11px] mr-2 opacity-80">DSS Recommendation</span>
            <br className="sm:hidden" />
            {program.alerts[0]}
          </p>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`${FONT_DISPLAY} text-[15.5px] font-semibold`}>Estimated Growth Trajectory (Digital Twin)</h3>
        </div>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          Predictive model showing estimated current weight against the target market date.
        </p>
        <GrowthCurveChart batch={program} />
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
      const res = await fetch('/api/growth/analytics');
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
    <div className="bg-slate-50 min-h-full px-4 sm:px-9 pt-8 pb-14 font-sans text-neutral-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');`}</style>

      {loading ? (
        <div className="flex flex-col gap-5 mt-6 animate-pulse">
          <div className="flex flex-col sm:flex-row gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 flex-1 h-[104px]">
                <div className="h-3 w-16 bg-slate-200 rounded mb-3"></div>
                <div className="h-8 w-24 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 h-[400px]">
            <div className="h-5 w-48 bg-slate-200 rounded mb-4"></div>
            <div className="h-[300px] w-full bg-slate-100 rounded-lg"></div>
          </div>
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl shadow-sm mt-6">
          <p className="text-neutral-500 text-sm font-semibold">No analytics data available yet. Enroll batches into a growth program first.</p>
        </div>
      ) : view === "overview" ? (
        <OverviewView programs={programs} view={view} setView={setView} />
      ) : (
        <DetailView programs={programs} selectedId={selectedId} onSelect={setSelectedId} view={view} setView={setView} />
      )}
    </div>
  );
}
