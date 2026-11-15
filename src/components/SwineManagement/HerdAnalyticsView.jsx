import React, { useState } from 'react';
import {
  AlertCircle,
  HeartPulse,
  Layers,
  PiggyBank,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import PigSnout from '../common/PigSnout.jsx';

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
  const breedMap = {};
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
  let weighedBatchCount = 0;
  let batchWeightSum = 0;

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

      const rawBorn = Number(row.total_born_alive);
      const bornAlive = !isNaN(rawBorn) && rawBorn > 0 ? rawBorn : heads;
      const mortalityLoss = Math.max(0, bornAlive - heads);
      const survivabilityRate = bornAlive > 0
        ? Math.min(100, Math.round((heads / bornAlive) * 1000) / 10)
        : 100;

      totalBornAliveAll += bornAlive;
      totalSurvivedAll += heads;
      totalLossAll += mortalityLoss;

      const avgW = Number(row.average_weight ?? row.current_weight);
      if (!isNaN(avgW) && avgW > 0) {
        weighedBatchCount += 1;
        batchWeightSum += avgW;
      }

      const refDate = row.date_of_birth || row.created_at;
      batchPerf.push({
        batchId: row.id,
        batchTag: row.batch_tag || row.pig_tag,
        status: st,
        bornAlive,
        currentCount: heads,
        soldCount: 0,
        mortalityLoss,
        stillborn: Number(row.stillborn_count) || 0,
        mummy: Number(row.mummy_count) || 0,
        survivabilityRate,
        ageWeeks: row.age_weeks !== '' && row.age_weeks !== undefined ? Number(row.age_weeks) : null,
        averageWeight: !isNaN(avgW) && avgW > 0 ? Math.round(avgW * 10) / 10 : null,
        _sortTime: refDate ? new Date(refDate).getTime() : 0,
      });
    }

    const breedName = (row.breed || '').trim() || 'Unassigned';
    if (!breedMap[breedName]) {
      breedMap[breedName] = { breed: breedName, heads: 0, records: 0, weightSum: 0, weightCount: 0 };
    }
    breedMap[breedName].heads += heads;
    breedMap[breedName].records += 1;
    const w = Number(row.current_weight ?? row.average_weight);
    if (!isNaN(w) && w > 0) {
      breedMap[breedName].weightSum += w;
      breedMap[breedName].weightCount += 1;
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

  const sortedBreeds = Object.values(breedMap).sort((a, b) => b.heads - a.heads || b.records - a.records);
  const topBreeds = sortedBreeds.slice(0, 6).map((b) => ({
    breed: b.breed,
    heads: b.heads,
    records: b.records,
    avgWeight: b.weightCount > 0 ? Math.round((b.weightSum / b.weightCount) * 10) / 10 : null,
    filterable: b.breed !== 'Unassigned',
  }));
  if (sortedBreeds.length > 6) {
    const rest = sortedBreeds.slice(6);
    const rwSum = rest.reduce((s, r) => s + r.weightSum, 0);
    const rwCnt = rest.reduce((s, r) => s + r.weightCount, 0);
    topBreeds.push({
      breed: 'Other Breeds',
      heads: rest.reduce((s, r) => s + r.heads, 0),
      records: rest.reduce((s, r) => s + r.records, 0),
      avgWeight: rwCnt > 0 ? Math.round((rwSum / rwCnt) * 10) / 10 : null,
      filterable: false,
    });
  }

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
      avgBatchWeight: weighedBatchCount > 0
        ? Math.round((batchWeightSum / weighedBatchCount) * 10) / 10
        : null,
      weighedBatches: weighedBatchCount,
    },
    composition,
    healthBreakdown,
    breedDistribution: topBreeds,
    batchPerformance: recentBatches,
  };
}

function ChartCard({ title, subtitle, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">{title}</h3>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-100 animate-pulse rounded" />
              <div className="h-3 w-56 bg-slate-100 animate-pulse rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-100 animate-pulse rounded-full" />
          </div>
          <div className="h-48 bg-slate-50 animate-pulse rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function CompositionDonutCard({ composition = [], summary, onFilterCategory }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const total = composition.reduce((sum, item) => sum + item.count, 0);

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
      subtitle="Live headcount split across breeding stock and piglet stages"
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
                    strokeDasharray={`${slice.strokeLength} ${circumference}`}
                    strokeDashoffset={slice.dashOffset}
                    className="transition-all duration-200 cursor-pointer"
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
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isHovered ? 'bg-slate-50' : 'hover:bg-slate-50/70'
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
  const watchCount = healthBreakdown
    .filter((i) => i.key === 'sick' || i.key === 'quarantine')
    .reduce((sum, i) => sum + i.count, 0);

  return (
    <ChartCard
      title="Health Status Distribution"
      subtitle="Click Healthy, Sick, or Quarantine to view matching records"
      badge={
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            watchCount > 0
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
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                  className="h-full transition-all duration-300"
                  title={`${item.label}: ${item.count} heads (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          <div className="space-y-2.5 pt-1">
            {healthBreakdown.map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
              const canFilter = item.filterStatus && item.filterStatus !== 'all';
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!canFilter}
                  onClick={() => canFilter && onFilterStatus?.(item.filterStatus)}
                  className={`w-full text-left rounded-xl p-2 -mx-2 transition-colors ${
                    canFilter ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
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
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.count > 0 ? Math.max(pct, 2) : 0}%`,
                        backgroundColor: item.color,
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
    (max, b) => Math.max(max, b.bornAlive || 0, (b.currentCount || 0) + (b.soldCount || 0) + (b.mortalityLoss || 0)),
    0
  );
  const yMax = Math.max(5, Math.ceil(maxBorn / 5) * 5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const W = 460;
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
      title="Batch Survivability & Loss"
      subtitle="Born-alive breakdown across recent active piglet batches"
      badge={
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            avgSurv >= 90
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
            className="w-full h-auto overflow-visible"
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
              const barW = Math.min(34, Math.max(16, slotW * 0.48));
              const x = padL + idx * slotW + (slotW - barW) / 2;
              const isHovered = hoveredIdx === idx;
              const isDimmed = hoveredIdx !== null && !isHovered;

              const currH = (b.currentCount / yMax) * plotH;
              const soldH = (b.soldCount / yMax) * plotH;
              const lossH = (b.mortalityLoss / yMax) * plotH;

              const currY = padT + plotH - currH;
              const soldY = currY - soldH;
              const lossY = soldY - lossH;
              const topY = Math.min(currY, soldY, lossY);

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

                  {/* Current remaining heads */}
                  {currH > 0 && (
                    <rect
                      x={x}
                      y={currY}
                      width={barW}
                      height={currH}
                      rx={soldH === 0 && lossH === 0 ? 4 : 0}
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
                      rx={lossH === 0 ? 4 : 0}
                      fill="#0284c7"
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

                  {/* Survival rate label above bar */}
                  <text
                    x={x + barW / 2}
                    y={Math.max(10, topY - 4)}
                    textAnchor="middle"
                    className={`text-[9.5px] font-bold ${
                      isHovered ? 'fill-slate-900' : 'fill-slate-500'
                    }`}
                  >
                    {b.survivabilityRate}%
                  </text>

                  {/* X-axis Batch Tag */}
                  <text
                    x={x + barW / 2}
                    y={padT + plotH + 15}
                    textAnchor="middle"
                    className={`text-[10px] font-bold ${
                      isHovered ? 'fill-emerald-700' : 'fill-slate-700'
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
            <div className="flex items-center gap-3 text-slate-600 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                Remaining
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-600" />
                Sold
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
                Born {activeBatch.bornAlive}, Now {activeBatch.currentCount}, Sold {activeBatch.soldCount}, Loss {activeBatch.mortalityLoss}
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

function BreedDistributionCard({ breeds = [], summary, onFilterBreed }) {
  const maxHeads = breeds.reduce((max, b) => Math.max(max, b.heads), 0);

  return (
    <ChartCard
      title="Breed Mix & Average Weight"
      subtitle="Headcount by genetics with mean recorded weight where weighed"
      badge={
        summary?.avgBatchWeight !== null && summary?.avgBatchWeight !== undefined ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            <Scale className="w-3 h-3 text-emerald-600" />
            {summary.avgBatchWeight} kg batch avg
          </span>
        ) : null
      }
    >
      {breeds.length === 0 ? (
        <div className="py-12 text-center">
          <PigSnout className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">No breed records available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {breeds.map((item, idx) => {
            const pct = maxHeads > 0 ? Math.round((item.heads / maxHeads) * 100) : 0;
            const barColor = idx === 0 ? '#059669' : idx === 1 ? '#0284c7' : '#475569';
            return (
              <button
                key={item.breed}
                type="button"
                disabled={!item.filterable}
                onClick={() => item.filterable && onFilterBreed?.(item.breed)}
                className={`w-full text-left rounded-xl p-2 -mx-2 transition-colors ${
                  item.filterable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                }`}
                title={item.filterable ? `Filter records by ${item.breed}` : undefined}
              >
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-800 truncate">{item.breed}</span>
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      ({item.records} {item.records === 1 ? 'record' : 'records'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.avgWeight !== null && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        ~{item.avgWeight} kg
                      </span>
                    )}
                    <span className="font-black text-slate-900">{item.heads} heads</span>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </button>
            );
          })}
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
  onFilterBreed,
}) {
  if (loading && !analytics) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      <BreedDistributionCard
        breeds={analytics?.breedDistribution || []}
        summary={analytics?.summary}
        onFilterBreed={onFilterBreed}
      />
    </div>
  );
}
