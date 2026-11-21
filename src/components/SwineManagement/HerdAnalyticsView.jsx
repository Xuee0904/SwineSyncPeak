import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  HeartPulse,
  Layers,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import PigSnout from '../common/PigSnout.jsx';

function useChartReveal(triggerKey) {
  const [revealed, setRevealed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return undefined;
    }

    setRevealed(false);
    let frame2;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setRevealed(true));
    });

    return () => {
      cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, [triggerKey]);

  return revealed;
}

export function buildClientHerdAnalytics(rows = []) {
  const STAGE_META = {
    sow: { label: 'Sows', color: '#059669', filterCat: 'sow' },
    boar: { label: 'Boars', color: '#0284c7', filterCat: 'boar' },
    suckling: { label: 'Suckling Piglets', color: '#f59e0b', filterCat: 'piglet_batch' },
    weaned: { label: 'Weaned Piglets', color: '#8b5cf6', filterCat: 'piglet_batch' },
    nursery: { label: 'Nursery', color: '#0d9488', filterCat: 'piglet_batch' },
    grower: { label: 'Grower', color: '#6366f1', filterCat: 'piglet_batch' },
    fattening: { label: 'Fattening', color: '#ec4899', filterCat: 'piglet_batch' },
    finisher: { label: 'Finisher', color: '#ec4899', filterCat: 'piglet_batch' },
    piglets_other: { label: 'Other Batches', color: '#64748b', filterCat: 'piglet_batch' },
  };

  let sowHeads = 0;
  let boarHeads = 0;
  const stageCounts = {};
  const healthBuckets = { healthy: 0, pregnant: 0, sick: 0, quarantine: 0, other: 0 };
  const batchPerf = [];

  const getHeads = (row) => {
    if (row.category !== 'Piglet Batch') return 1;
    const c = Number(row.current_count);
    if (!isNaN(c) && c >= 0 && row.current_count !== null && row.current_count !== '') return c;
    const t = Number(row.total_born_alive);
    return !isNaN(t) && t > 0 ? t : 0;
  };

  let totalBornAliveAll = 0;
  let totalSurvivedAll = 0;
  let totalLossAll = 0;

  const promotedByBatch = {};
  for (const row of rows) {
    if (row.category !== 'Piglet Batch' && row.source_batch_id) {
      promotedByBatch[row.source_batch_id] = (promotedByBatch[row.source_batch_id] || 0) + 1;
    }
  }

  for (const row of rows) {
    const isBatch = row.category === 'Piglet Batch';
    const heads = getHeads(row);
    const st = (row.status || (isBatch ? 'suckling' : 'healthy')).toLowerCase();

    if (!isBatch) {
      if (row.category === 'Sow') sowHeads += 1;
      else boarHeads += 1;
      if (st === 'sick') healthBuckets.sick += 1;
      else if (st === 'quarantine') healthBuckets.quarantine += 1;
      else if (st === 'pregnant') healthBuckets.pregnant += 1;
      else if (st === 'inactive' || st === 'cull') healthBuckets.other += 1;
      else healthBuckets.healthy += 1;
    } else {
      const stageKey = ['sick', 'quarantine', 'healthy', 'inactive', 'cull'].includes(st)
        ? 'piglets_other'
        : st;
      stageCounts[stageKey] = (stageCounts[stageKey] || 0) + heads;
      if (st === 'sick') healthBuckets.sick += heads;
      else if (st === 'quarantine') healthBuckets.quarantine += heads;
      else if (st === 'inactive' || st === 'cull') healthBuckets.other += heads;
      else healthBuckets.healthy += heads;

      const promotedCount = promotedByBatch[row.id] || 0;
      const accountedHeads = heads + promotedCount;
      const rawBorn = Number(row.total_born_alive);
      const bornAlive = !isNaN(rawBorn) && rawBorn > 0 ? rawBorn : accountedHeads;
      const mortalityLoss = Math.max(0, bornAlive - accountedHeads);
      const survivabilityRate = bornAlive > 0
        ? Math.min(100, Math.round((accountedHeads / bornAlive) * 1000) / 10)
        : 100;

      totalBornAliveAll += bornAlive;
      totalSurvivedAll += accountedHeads;
      totalLossAll += mortalityLoss;

      const avgW = Number(row.average_weight ?? row.current_weight);
      const refDate = row.date_of_birth || row.created_at;
      batchPerf.push({
        batchId: row.id,
        batchTag: row.batch_tag || row.pig_tag,
        status: st,
        bornAlive,
        currentCount: heads,
        soldCount: 0,
        promotedCount,
        mortalityLoss,
        stillborn: Number(row.stillborn_count) || 0,
        mummy: Number(row.mummy_count) || 0,
        survivabilityRate,
        ageWeeks: row.age_weeks !== '' && row.age_weeks !== undefined ? Number(row.age_weeks) : null,
        averageWeight: !isNaN(avgW) && avgW > 0 ? Math.round(avgW * 10) / 10 : null,
        _sortTime: refDate ? new Date(refDate).getTime() : 0,
      });
    }
  }

  const composition = [];
  if (sowHeads > 0) composition.push({ key: 'sow', count: sowHeads, ...STAGE_META.sow });
  if (boarHeads > 0) composition.push({ key: 'boar', count: boarHeads, ...STAGE_META.boar });
  const stageFallbackColors = ['#f59e0b', '#8b5cf6', '#0d9488', '#6366f1', '#64748b'];
  Object.entries(stageCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count], idx) => {
      if (count <= 0) return;
      const meta = STAGE_META[key] || {
        label: `${key.charAt(0).toUpperCase() + key.slice(1)} Piglets`,
        color: stageFallbackColors[idx % stageFallbackColors.length],
        filterCat: 'piglet_batch',
      };
      composition.push({ key, count, ...meta });
    });

  const healthBreakdown = [
    { key: 'healthy', label: 'Healthy', count: healthBuckets.healthy, color: '#059669', filterStatus: 'healthy' },
    { key: 'pregnant', label: 'Pregnant', count: healthBuckets.pregnant, color: '#6366f1', filterStatus: 'all' },
    { key: 'sick', label: 'Sick', count: healthBuckets.sick, color: '#f59e0b', filterStatus: 'sick' },
    { key: 'quarantine', label: 'Quarantine', count: healthBuckets.quarantine, color: '#e11d48', filterStatus: 'quarantine' },
    { key: 'other', label: 'Inactive / Cull', count: healthBuckets.other, color: '#64748b', filterStatus: 'all' },
  ].filter((item) => item.count > 0 || ['healthy', 'sick', 'quarantine'].includes(item.key));

  const recentBatches = batchPerf
    .sort((a, b) => b._sortTime - a._sortTime)
    .slice(0, 6)
    .reverse()
    .map(({ _sortTime, ...rest }) => rest);

  const pigletHeads = Object.values(stageCounts).reduce((s, n) => s + n, 0);

  return {
    summary: {
      totalHeads: sowHeads + boarHeads + pigletHeads,
      breedingHeads: sowHeads + boarHeads,
      pigletHeads,
      activeRecords: rows.length,
      avgSurvivabilityRate: totalBornAliveAll > 0
        ? Math.min(100, Math.round((totalSurvivedAll / totalBornAliveAll) * 1000) / 10)
        : 100,
      totalMortalityLoss: totalLossAll,
    },
    composition,
    healthBreakdown,
    batchPerformance: recentBatches,
  };
}

function ChartCard({ title, subtitle, badge, className = '', children }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">{title}</h3>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function AnalyticsSkeleton() {
  const barHeights = ['h-20', 'h-28', 'h-24', 'h-32', 'h-[88px]', 'h-36'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="status" aria-busy="true">
      <span className="sr-only">Loading herd insights...</span>

      {/* Skeleton Card 1: Donut + Legend */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-44 skeleton" />
            <div className="h-3 w-60 skeleton" />
          </div>
          <div className="h-6 w-20 rounded-full skeleton" />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
          <div className="relative w-36 h-36 rounded-full border-[16px] border-slate-100 shrink-0 flex items-center justify-center">
            <div className="w-16 h-6 skeleton rounded-md" />
          </div>
          <div className="flex-1 w-full space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full skeleton" />
                  <div className="h-3 w-24 skeleton" />
                </div>
                <div className="h-3 w-12 skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton Card 2: Segmented Health Bars */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-44 skeleton" />
            <div className="h-3 w-56 skeleton" />
          </div>
          <div className="h-6 w-20 rounded-full skeleton" />
        </div>
        <div className="h-3 w-full rounded-full skeleton" />
        <div className="space-y-3.5 pt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 skeleton" />
                <div className="h-3 w-16 skeleton" />
              </div>
              <div className="h-2.5 w-full rounded-full skeleton" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Card 3: Full-Width Stacked Bars */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-48 skeleton" />
            <div className="h-3 w-64 skeleton" />
          </div>
          <div className="h-6 w-28 rounded-full skeleton" />
        </div>
        <div className="flex items-end justify-around gap-4 h-44 px-6 pb-2 border-b border-slate-100">
          {barHeights.map((hCls, idx) => (
            <div key={idx} className={`w-8 sm:w-10 rounded-t-md skeleton ${hCls}`} />
          ))}
        </div>
        <div className="flex items-center gap-4 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm skeleton" />
              <div className="h-3 w-14 skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompositionDonutCard({ composition = [], summary, onFilterCategory }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const total = composition.reduce((sum, item) => sum + item.count, 0);
  const revealed = useChartReveal(`${total}-${composition.length}`);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  const slices = composition.map((item) => {
    const fraction = total > 0 ? item.count / total : 0;
    const strokeLength = fraction * circumference;
    const dashOffset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;
    return {
      ...item,
      fraction,
      pct: total > 0 ? Math.round(fraction * 1000) / 10 : 0,
      strokeLength,
      dashOffset,
    };
  });

  const activeSlice = slices.find((s) => s.key === hoveredKey) || null;

  return (
    <ChartCard
      title="Herd Composition & Stage"
      badge={
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          <Layers className="w-3 h-3 text-emerald-600" />
          {summary?.activeRecords ?? 0} records
        </span>
      }
    >
      {total === 0 ? (
        <div className="py-12 text-center">
          <PigSnout className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">No active herd records yet</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 148 148" className="w-full h-full -rotate-90" role="img" aria-label="Herd composition donut chart">
              <circle
                cx="74"
                cy="74"
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="18"
              />
              {slices.map((slice) => {
                const isHovered = hoveredKey === slice.key;
                const isDimmed = hoveredKey && !isHovered;
                return (
                  <circle
                    key={slice.key}
                    cx="74"
                    cy="74"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? 21 : 18}
                    strokeDasharray={revealed ? `${slice.strokeLength} ${circumference}` : `0 ${circumference}`}
                    strokeDashoffset={revealed ? slice.dashOffset : 0}
                    className="transition-[stroke-dasharray,stroke-dashoffset,stroke-width,opacity] duration-700 ease-out motion-reduce:transition-none cursor-pointer"
                    style={{ opacity: isDimmed ? 0.35 : 1 }}
                    onMouseEnter={() => setHoveredKey(slice.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => slice.filterCat && onFilterCategory?.(slice.filterCat)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {activeSlice ? activeSlice.count : total}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 truncate max-w-[92px]">
                {activeSlice ? `${activeSlice.pct}%` : 'Total Heads'}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            {slices.map((slice) => {
              const isHovered = hoveredKey === slice.key;
              return (
                <button
                  key={slice.key}
                  type="button"
                  onMouseEnter={() => setHoveredKey(slice.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => slice.filterCat && onFilterCategory?.(slice.filterCat)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${isHovered ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  title={slice.filterCat ? `Filter records to ${slice.label}` : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-slate-900">{slice.count}</span>
                    <span className="text-[11px] font-semibold text-slate-400 w-10 text-right">
                      {slice.pct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function HealthStatusCard({ healthBreakdown = [], onFilterStatus }) {
  const total = healthBreakdown.reduce((sum, item) => sum + item.count, 0);
  const revealed = useChartReveal(`${total}-${healthBreakdown.length}`);
  const watchCount = healthBreakdown
    .filter((i) => i.key === 'sick' || i.key === 'quarantine')
    .reduce((sum, i) => sum + i.count, 0);

  return (
    <ChartCard
      title="Health Status Distribution"
      badge={
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${watchCount > 0
            ? 'text-rose-700 bg-rose-50 border border-rose-200'
            : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            }`}
        >
          {watchCount > 0 ? (
            <>
              <HeartPulse className="w-3 h-3" />
              {watchCount} under watch
            </>
          ) : (
            <>
              <ShieldCheck className="w-3 h-3" />
              All clear
            </>
          )}
        </span>
      }
    >
      {total === 0 ? (
        <div className="py-12 text-center">
          <HeartPulse className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">No health status data available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Proportional single-strip overview */}
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
            {healthBreakdown.map((item) => {
              if (item.count <= 0) return null;
              const pct = (item.count / total) * 100;
              return (
                <div
                  key={item.key}
                  style={{ width: revealed ? `${pct}%` : '0%', backgroundColor: item.color }}
                  className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  title={`${item.label}: ${item.count} heads (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          <div className="space-y-2.5 pt-1">
            {healthBreakdown.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
              const canFilter = item.filterStatus && item.filterStatus !== 'all';
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!canFilter}
                  onClick={() => canFilter && onFilterStatus?.(item.filterStatus)}
                  className={`w-full text-left rounded-xl p-2 -mx-2 transition-colors ${canFilter ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                    }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-bold text-slate-700">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{item.count} heads</span>
                      <span className="text-[11px] font-semibold text-slate-400 w-11 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{
                        width: revealed && item.count > 0 ? `${Math.max(pct, 2)}%` : '0%',
                        backgroundColor: item.color,
                        transitionDelay: `${idx * 65}ms`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function BatchSurvivabilityCard({ batches = [], summary }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxBorn = batches.reduce(
    (max, b) => Math.max(max, b.bornAlive || 0, (b.currentCount || 0) + (b.soldCount || 0) + (b.promotedCount || 0) + (b.mortalityLoss || 0)),
    0
  );
  const yMax = Math.max(5, Math.ceil(maxBorn / 5) * 5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const W = 680;
  const H = 200;
  const padL = 32;
  const padR = 12;
  const padT = 14;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const activeBatch = hoveredIdx !== null ? batches[hoveredIdx] : null;
  const avgSurv = summary?.avgSurvivabilityRate ?? 100;

  return (
    <ChartCard
      className="lg:col-span-2"
      title="Batch Survivability & Loss"
      badge={
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${avgSurv >= 90
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}
        >
          <TrendingUp className="w-3 h-3" />
          {avgSurv}% avg survival
        </span>
      }
    >
      {batches.length === 0 ? (
        <div className="py-12 text-center">
          <PiggyBank className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">No active piglet batches to chart</p>
        </div>
      ) : (
        <div className="space-y-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto max-h-[230px] overflow-visible"
            role="img"
            aria-label="Stacked bar chart of batch survivability, sales, and mortality loss"
          >
            {/* Horizontal grid lines */}
            {ticks.map((tick) => {
              const y = padT + plotH - (tick / yMax) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={y}
                    y2={y}
                    stroke={tick === 0 ? '#cbd5e1' : '#f1f5f9'}
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-semibold"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Stacked Bars */}
            {batches.map((b, idx) => {
              const slotW = plotW / batches.length;
              const barW = Math.min(44, Math.max(20, slotW * 0.42));
              const x = padL + idx * slotW + (slotW - barW) / 2;
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;

              const currH = (b.currentCount / yMax) * plotH;
              const soldH = (b.soldCount / yMax) * plotH;
              const promH = ((b.promotedCount || 0) / yMax) * plotH;
              const lossH = (b.mortalityLoss / yMax) * plotH;

              const currY = padT + plotH - currH;
              const soldY = currY - soldH;
              const promY = soldY - promH;
              const lossY = promY - lossH;
              const topY = Math.min(currY, soldY, promY, lossY);

              const shortTag = (b.batchTag || '').replace(/^#?BTC-?/i, '#');

              return (
                <g
                  key={b.batchId || idx}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{ opacity: isDimmed ? 0.4 : 1 }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Hover column hit target */}
                  <rect
                    x={padL + idx * slotW}
                    y={padT}
                    width={slotW}
                    height={plotH + padB}
                    fill="transparent"
                  />

                  <g className="bar-grow" style={{ animationDelay: `${idx * 70}ms` }}>
                    {/* Current remaining heads */}
                    {currH > 0 && (
                      <rect
                        x={x}
                        y={currY}
                        width={barW}
                        height={currH}
                        rx={soldH === 0 && promH === 0 && lossH === 0 ? 4 : 0}
                        fill="#059669"
                      />
                    )}
                    {/* Sold / marketed heads */}
                    {soldH > 0 && (
                      <rect
                        x={x}
                        y={soldY}
                        width={barW}
                        height={soldH}
                        rx={promH === 0 && lossH === 0 ? 4 : 0}
                        fill="#0284c7"
                      />
                    )}
                    {/* Promoted to breeder heads */}
                    {promH > 0 && (
                      <rect
                        x={x}
                        y={promY}
                        width={barW}
                        height={promH}
                        rx={lossH === 0 ? 4 : 0}
                        fill="#4f46e5"
                      />
                    )}
                    {/* Mortality loss */}
                    {lossH > 0 && (
                      <rect
                        x={x}
                        y={lossY}
                        width={barW}
                        height={lossH}
                        rx="4"
                        fill="#e11d48"
                      />
                    )}
                  </g>

                  {/* Survival rate label above bar */}
                  <text
                    x={x + barW / 2}
                    y={Math.max(10, topY - 4)}
                    textAnchor="middle"
                    className={`text-[9.5px] font-bold ${isHovered ? 'fill-slate-900' : 'fill-slate-500'
                      }`}
                  >
                    {b.survivabilityRate}%
                  </text>

                  {/* X-axis Batch Tag */}
                  <text
                    x={x + barW / 2}
                    y={padT + plotH + 15}
                    textAnchor="middle"
                    className={`text-[10px] font-bold ${isHovered ? 'fill-emerald-700' : 'fill-slate-700'
                      }`}
                  >
                    {shortTag.length > 10 ? `${shortTag.slice(0, 9)}…` : shortTag}
                  </text>
                  {b.ageWeeks !== null && (
                    <text
                      x={x + barW / 2}
                      y={padT + plotH + 28}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9.5px] font-semibold"
                    >
                      {b.ageWeeks}w
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend + Hover Inspection Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
            <div className="flex items-center gap-3 text-slate-600 font-semibold flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                Remaining
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-600" />
                Sold
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
                Promoted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-600" />
                Loss
              </span>
            </div>

            {activeBatch ? (
              <div className="text-slate-700 font-semibold">
                <span className="font-black text-slate-900">#{activeBatch.batchTag}</span>
                {' · '}
                Born {activeBatch.bornAlive}, Now {activeBatch.currentCount}, Sold {activeBatch.soldCount}, Promoted {activeBatch.promotedCount || 0}, Loss {activeBatch.mortalityLoss}
                {activeBatch.averageWeight !== null ? ` · ${activeBatch.averageWeight} kg` : ''}
              </div>
            ) : (
              <span className="text-slate-400 font-medium">Hover a batch bar for details</span>
            )}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export default function HerdAnalyticsView({
  analytics,
  loading,
  error,
  onRetry,
  onFilterCategory,
  onFilterStatus,
}) {
  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error && !analytics) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-5 h-5 text-rose-500" />
        </div>
        <p className="text-xs font-semibold text-slate-600 mb-3">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry analytics
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 tab-enter-stagger">
      <CompositionDonutCard
        composition={analytics?.composition || []}
        summary={analytics?.summary}
        onFilterCategory={onFilterCategory}
      />
      <HealthStatusCard
        healthBreakdown={analytics?.healthBreakdown || []}
        onFilterStatus={onFilterStatus}
      />
      <BatchSurvivabilityCard
        batches={analytics?.batchPerformance || []}
        summary={analytics?.summary}
      />
    </div>
  );
}
