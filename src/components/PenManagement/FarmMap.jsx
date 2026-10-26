import React, { useMemo, useState } from "react";
import { Plus, ShieldAlert, Wrench, Building2, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { FARM_LAYOUT, UNIT, LAYOUT_CODES, ALL_SLOTS } from "../../config/farmLayout";
import { SECTIONS, getSectionKey, getPenStatus, OOS_PATTERN, STATUS_LEGEND } from "./penStatus";

const GAP = 3;        // px gap around each tile
const WALL_PAD = 8;   // px between outermost tiles and the building wall
const MARGIN = 14;    // px around the wall inside each building canvas

const BUFFER_PATTERN = {
  backgroundImage: "repeating-linear-gradient(45deg, rgba(100,116,139,0.16) 0 4px, transparent 4px 9px)",
};

// Expands a clockwise rectilinear polygon outward by `pad` px (screen coords)
function expandOutline(points, pad) {
  const px = points.map(([x, y]) => [x * UNIT.x, y * UNIT.y]);
  const n = px.length;
  const normal = (a, b) => {
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    return [dy, -dx];
  };
  return px.map((p, i) => {
    const prev = px[(i - 1 + n) % n];
    const next = px[(i + 1) % n];
    const n1 = normal(prev, p);
    const n2 = normal(p, next);
    return [p[0] + (n1[0] + n2[0]) * pad + MARGIN, p[1] + (n1[1] + n2[1]) * pad + MARGIN];
  });
}

const box = ({ x, y, w, h }, inset = 0) => ({
  left: MARGIN + x * UNIT.x + inset,
  top: MARGIN + y * UNIT.y + inset,
  width: w * UNIT.x - inset * 2,
  height: h * UNIT.y - inset * 2,
});

function Zone({ zone }) {
  const style = box(zone, zone.type === "isolation" ? -4 : GAP);
  if (zone.type === "pathway") {
    return (
      <div style={style} className="absolute rounded-md bg-slate-100 flex items-center justify-center overflow-hidden">
        {zone.label && (
          <span
            className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 select-none whitespace-nowrap"
            style={zone.vertical ? { writingMode: "vertical-rl" } : undefined}
          >
            {zone.label}
          </span>
        )}
      </div>
    );
  }
  if (zone.type === "buffer") {
    return (
      <div style={{ ...style, ...BUFFER_PATTERN }} className="absolute rounded-md border border-slate-300/70 bg-white flex items-center justify-center">
        <span className="px-1.5 py-0.5 rounded bg-white/90 text-[9px] font-extrabold uppercase tracking-wider text-slate-500 select-none whitespace-nowrap">
          {zone.label}
        </span>
      </div>
    );
  }
  // isolation
  return (
    <div style={style} className="absolute rounded-xl border-2 border-dashed border-slate-400/80 pointer-events-none">
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm">
        {zone.label}
      </span>
    </div>
  );
}

function PenTile({ slot, pen, dimmed, highlighted, onClick, onHover }) {
  const sectionKey = getSectionKey(pen.section);
  const section = SECTIONS[sectionKey];
  const status = getPenStatus(pen);
  const isOOS = status.key === "oos";
  const pct = pen.capacity > 0 ? Math.min(100, Math.round((pen.occupancy / pen.capacity) * 100)) : 0;
  const tall = slot.h * UNIT.y > 90;

  return (
    <button
      type="button"
      id={`pen-tile-${slot.code}`}
      onClick={onClick}
      onMouseEnter={() => onHover(slot.code)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(slot.code)}
      onBlur={() => onHover(null)}
      style={{ ...box(slot, GAP), ...(isOOS ? OOS_PATTERN : {}) }}
      className={`absolute rounded-lg border-2 p-1.5 flex flex-col justify-between text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${status.tile} ${dimmed ? "opacity-25 saturate-50" : ""
        } ${highlighted ? "ring-2 ring-slate-900 ring-offset-2 z-10" : ""}`}
    >
      <div className="flex items-start justify-between gap-1 min-w-0">
        <span className="text-[11px] font-black tracking-tight leading-none truncate">{slot.code}</span>
        {isOOS && <Wrench className="w-3 h-3 shrink-0 opacity-70" />}
      </div>

      <span className="self-start max-w-full truncate px-1 py-px rounded border text-[7.5px] font-extrabold uppercase tracking-tight leading-tight bg-white/80 text-slate-600 border-slate-200">
        {section?.short || pen.section}
      </span>

      {isOOS ? (
        <span className="text-[9px] font-bold uppercase leading-none text-slate-500 truncate">Out of service</span>
      ) : (
        <div className="space-y-1">
          <span className="block text-[10px] font-bold leading-none">
            {pen.occupancy}
            <span className="font-medium opacity-60">/{pen.capacity}</span>
          </span>
          {tall && (
            <div className="h-1 rounded-full bg-white/80 overflow-hidden">
              <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function MissingTile({ slot, isAdmin, onAdd, dimmed }) {
  return (
    <button
      type="button"
      id={`pen-slot-${slot.code}`}
      disabled={!isAdmin}
      onClick={() => onAdd(slot)}
      style={box(slot, GAP)}
      title={isAdmin ? `Set up ${slot.code}` : `${slot.code} is not set up yet`}
      className={`absolute rounded-lg border-2 border-dashed border-slate-300 bg-white/70 flex flex-col items-center justify-center gap-0.5 text-slate-400 transition-all ${isAdmin ? "hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 cursor-pointer" : "cursor-not-allowed"
        } ${dimmed ? "opacity-25" : ""}`}
    >
      <span className="text-[10px] font-black leading-none">{slot.code}</span>
      {isAdmin ? <Plus className="w-3.5 h-3.5" /> : <span className="text-[8px] font-bold uppercase">Not set up</span>}
    </button>
  );
}

function Tooltip({ slot, pen, building }) {
  const r = box(slot, GAP);
  const status = getPenStatus(pen);
  const section = SECTIONS[getSectionKey(pen.section)];
  const below = slot.y < 1.5;

  const canvasW = building ? building.width * UNIT.x + MARGIN * 2 : 300;
  const tooltipW = 192; // px (w-48)
  const centerX = r.left + r.width / 2;
  // Clamp tooltip center so it never bleeds off the left or right canvas boundaries
  const clampedX = Math.max(tooltipW / 2 + 8, Math.min(centerX, canvasW - tooltipW / 2 - 8));

  return (
    <div
      className="absolute z-50 pointer-events-none w-48 animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: clampedX,
        top: below ? r.top + r.height + 8 : r.top - 8,
        transform: `translate(-50%, ${below ? "0" : "-100%"})`,
      }}
    >
      <div className="rounded-xl bg-slate-900/95 backdrop-blur-sm text-white shadow-2xl border border-slate-700/60 p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black tracking-tight">{slot.code}</span>
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
          </span>
        </div>
        <p className="text-[10px] text-slate-300 font-medium">{section?.label || pen.section}</p>
        {pen.is_archived ? (
          <p className="text-[10px] text-slate-200 leading-snug">
            <span className="font-bold">Reason:</span> {pen.archive_reason || "Not specified"}
          </p>
        ) : (
          <p className="text-[10px] text-slate-200">
            <span className="font-bold text-white">{pen.occupancy}</span> / {pen.capacity} head · {Math.max(0, pen.capacity - pen.occupancy)} slot(s) left
          </p>
        )}
      </div>
    </div>
  );
}

function BuildingCanvas({ building, penByCode, isAdmin, query, activeSection, statusFilter, onPenClick, onAddSlot }) {
  const [hovered, setHovered] = useState(null);
  const width = building.width * UNIT.x + MARGIN * 2;
  const height = building.height * UNIT.y + MARGIN * 2;
  const outline = expandOutline(building.outline, WALL_PAD).map((p) => p.join(",")).join(" ");

  const q = (query || "").trim().toLowerCase();
  const hoveredSlot = hovered ? building.slots.find((s) => s.code === hovered) : null;
  const hoveredPen = hoveredSlot ? penByCode.get(hoveredSlot.code) : null;

  return (
    <section className="shrink-0" aria-label={building.name}>
      <header className="flex items-center gap-2 mb-2 px-1">
        <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-sm font-black text-slate-900 leading-tight">{building.name}</h2>
      </header>

      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden="true">
          <polygon points={outline} fill="white" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>

        {building.zones.map((z, i) => (
          <Zone key={`${building.id}-zone-${i}`} zone={z} />
        ))}

        {building.slots.map((slot) => {
          const pen = penByCode.get(slot.code);
          if (!pen) {
            const dimmed =
              (q && !slot.code.toLowerCase().includes(q)) ||
              (activeSection !== "ALL" && slot.defaultSection !== activeSection) ||
              (statusFilter && statusFilter !== "ALL");
            return <MissingTile key={slot.code} slot={slot} isAdmin={isAdmin} onAdd={onAddSlot} dimmed={dimmed} />;
          }
          const matchesQuery = !q || slot.code.toLowerCase().includes(q);
          const matchesSection = activeSection === "ALL" || getSectionKey(pen.section) === activeSection;
          const matchesStatus = !statusFilter || statusFilter === "ALL" || getPenStatus(pen).key === statusFilter;
          return (
            <PenTile
              key={slot.code}
              slot={slot}
              pen={pen}
              dimmed={!matchesQuery || !matchesSection || !matchesStatus}
              highlighted={Boolean(q) && matchesQuery}
              onClick={() => onPenClick(pen)}
              onHover={setHovered}
            />
          );
        })}

        {hoveredSlot && hoveredPen && <Tooltip slot={hoveredSlot} pen={hoveredPen} building={building} />}
      </div>
    </section>
  );
}

export default function FarmMap({ pens, loading, isAdmin, query, activeSection, statusFilter, onPenClick, onAddSlot, onInitialize, initializing }) {
  const penByCode = useMemo(() => {
    const m = new Map();
    pens.forEach((p) => {
      if (p.code) m.set(String(p.code).toUpperCase(), p);
    });
    return m;
  }, [pens]);

  const missingSlots = ALL_SLOTS.filter((s) => !penByCode.has(s.code));
  const unplaced = pens.filter((p) => !LAYOUT_CODES.has(String(p.code || "").toUpperCase()));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-500">Loading farm map…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missingSlots.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                {missingSlots.length} of {ALL_SLOTS.length} pens are not set up yet
              </p>
              <p className="text-[11px] text-amber-800/80 font-medium mt-0.5">
                {isAdmin
                  ? "Initialize the farm layout to create them with default types and capacities, or click a dashed slot to set one up."
                  : "Ask an administrator to initialize the farm layout."}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              id="initialize-farm-layout"
              onClick={onInitialize}
              disabled={initializing}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {initializing ? "Initializing…" : "Initialize Farm Layout"}
            </button>
          )}
        </div>
      )}

      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto"
        style={{ backgroundImage: "radial-gradient(rgba(148,163,184,0.25) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        <div className="flex flex-wrap items-start gap-x-16 gap-y-8 p-6 w-max min-w-full">
          {FARM_LAYOUT.map((b) => (
            <BuildingCanvas
              key={b.id}
              building={b}
              penByCode={penByCode}
              isAdmin={isAdmin}
              query={query}
              activeSection={activeSection}
              statusFilter={statusFilter}
              onPenClick={onPenClick}
              onAddSlot={onAddSlot}
            />
          ))}
        </div>
      </div>

      {unplaced.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5">
          <div>
            <p className="text-xs font-bold text-slate-800">Unplaced pens ({unplaced.length})</p>
            <p className="text-[11px] text-slate-400 font-medium">These pens exist in the database but don't match any slot on the farm map.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unplaced.map((p) => {
              const status = getPenStatus(p);
              const matchesSection = activeSection === "ALL" || getSectionKey(p.section) === activeSection;
              const matchesStatus = !statusFilter || statusFilter === "ALL" || status.key === statusFilter;
              const dimmed = !matchesSection || !matchesStatus;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPenClick(p)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer transition-all ${
                    dimmed ? "opacity-25 saturate-50" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${status.dot}`} /> {p.code}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

