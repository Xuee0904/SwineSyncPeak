import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Eye, Pencil, Archive, PiggyBank, Loader2,
  CheckCircle2, ChevronLeft,
} from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// Step identifiers
const STEP_VIEW   = "view";
const STEP_EDIT   = "edit";
const STEP_SUCCESS = "success";

export default function ViewPenModal({ isOpen, onClose, pen, sections, onEdit, onArchive, loggedInUser }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  /* ─── Step state ────────────────────────────────────────────── */
  const [step, setStep]           = useState(STEP_VIEW);
  const [successInfo, setSuccessInfo] = useState(null);

  /* ─── Swine data ─────────────────────────────────────────────── */
  const [swineData, setSwineData]   = useState({ pigs: [], batches: [] });
  const [loadingSwine, setLoadingSwine] = useState(false);
  const [swineReady, setSwineReady]   = useState(false);  // triggers entry animation

  /* ─── Edit form state ────────────────────────────────────────── */
  const [code, setCode]         = useState("");
  const [section, setSection]   = useState("S");
  const [capacity, setCapacity] = useState("10");
  const [submitting, setSubmitting] = useState(false);

  /* ─── Smooth step transition (ref-based snapshot approach) ─────── */
  // We capture the container height BEFORE setStep() so useLayoutEffect
  // can animate from the old height to the new height after React re-renders.
  const containerRef        = useRef(null);
  const prevHeightSnapRef   = useRef(null); // height captured before step change
  const [ht, setHt]         = useState('auto');
  const TRANSITION_DURATION = 320;

  useLayoutEffect(() => {
    const el = containerRef.current;
    // Only animate if we have a captured pre-change height
    if (!el || prevHeightSnapRef.current === null) return;

    const fromH = prevHeightSnapRef.current;
    prevHeightSnapRef.current = null; // consume it

    // Measure the new content's height
    const toH = el.scrollHeight;
    if (Math.abs(fromH - toH) < 2) return; // no meaningful change

    // 1. Fix at old height (no transition yet)
    setHt(`${fromH}px`);

    // 2. On next paint, enable transition and move to new height
    const raf = requestAnimationFrame(() => {
      setHt(`${toH}px`);

      // 3. After transition ends, unlock to auto so content can resize freely
      const timer = setTimeout(() => setHt('auto'), TRANSITION_DURATION);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Helper: capture height then change step
  const transitionToStep = (newStep) => {
    if (containerRef.current) {
      prevHeightSnapRef.current = containerRef.current.offsetHeight;
    }
    setStep(newStep);
  };

  // Animate container height when swine data arrives (loader → full list)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || prevHeightSnapRef.current === null) return;

    const fromH = prevHeightSnapRef.current;
    prevHeightSnapRef.current = null; // consume

    const toH = el.scrollHeight;
    if (Math.abs(fromH - toH) < 2) return;

    setHt(`${fromH}px`);
    const raf = requestAnimationFrame(() => {
      setHt(`${toH}px`);
      const timer = setTimeout(() => setHt('auto'), TRANSITION_DURATION);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swineData]);

  const containerStyle = {
    height: ht,
    transition: ht === 'auto' ? undefined : `height ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: 'height',
  };

  /* ─── Derived helpers ────────────────────────────────────────── */
  const getSectionCat = (sec) => {
    if (!sec) return "S";
    const s = String(sec).toUpperCase();
    if (s === "BOAR" || s.includes("BOAR") || s === "B") return "B";
    if (s === "SOW" || s.includes("SOW") || s.includes("GEST") || s.includes("FARR") || s === "S" || s.startsWith("A")) return "S";
    if (s === "WEAN" || s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS") || s === "W" || s.startsWith("N") || s.startsWith("T")) return "W";
    if (s === "QUAR" || s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK") || s === "Q") return "Q";
    return "S";
  };

  /* ─── Section object resolve ─────────────────────────────────── */
  const resolveSectionObj = (penData) => {
    if (!penData) return { label: "General Pen", desc: "" };
    let obj = sections?.[penData.section];
    if (!obj && penData?.section) {
      const cat = getSectionCat(penData.section);
      obj = sections?.[cat];
    }
    return obj || { label: penData?.section || "General Pen", desc: "" };
  };

  /* ─── Load swine on open ─────────────────────────────────────── */
  const fetchSwine = (penData) => {
    const id = penData?.id || penData?.pen_id;
    if (!id) return;
    setSwineReady(false);
    setLoadingSwine(true);
    fetch(`${API_BASE}/api/pens/${encodeURIComponent(id)}/swine`)
      .then((res) => res.json())
      .then((data) => {
        // Capture the container height (with loader) BEFORE React renders the list.
        if (containerRef.current) {
          prevHeightSnapRef.current = containerRef.current.offsetHeight;
        }
        setSwineData(data?.data ?? { pigs: [], batches: [] });
        // Defer the "ready" flag by one frame so React paints the
        // new items in their invisible start state before animating in.
        requestAnimationFrame(() => setSwineReady(true));
      })
      .catch(() => {
        setSwineData({ pigs: [], batches: [] });
        requestAnimationFrame(() => setSwineReady(true));
      })
      .finally(() => setLoadingSwine(false));
  };

  useEffect(() => {
    if (isOpen && pen) {
      // Reset step
      setStep(STEP_VIEW);
      setSuccessInfo(null);
      // Reset edit form
      const sec = getSectionCat(pen.section);
      setCode(pen.code || "");
      setSection(sec);
      setCapacity(String(pen.capacity || sections?.[sec]?.defaultCapacity || 10));
      // Fetch swine
      fetchSwine(pen);
    } else {
      setSwineData({ pigs: [], batches: [] });
      setSwineReady(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pen]);

  if (!shouldRender || !pen) return null;

  const handleClose = () => requestClose();

  /* ─── View‑step derived values ───────────────────────────────── */
  const sectionObj  = resolveSectionObj(pen);
  const pct         = Math.min(100, Math.round((Number(pen.occupancy || 0) / Number(pen.capacity || 1)) * 100));
  const totalHead   = loadingSwine
    ? "..."
    : (swineData.pigs?.length || 0) + (swineData.batches?.reduce((a, b) => a + Number(b.current_count || 0), 0) || 0);

  /* ─── Edit‑step derived values ───────────────────────────────── */
  const isBoarLocked      = section === "B";
  const minCapacity       = Math.max(1, pen?.occupancy || 1);
  const originalSecCat    = getSectionCat(pen?.section);
  const newSecCat         = getSectionCat(section);
  const hasSwine          = (swineData.pigs?.length || 0) > 0 || (swineData.batches?.length || 0) > 0 || (pen?.occupancy || 0) > 0;

  let typeWarning = null;
  if (hasSwine && newSecCat !== originalSecCat) {
    if (newSecCat === "S" && (swineData.pigs?.some(p => p.gender === "Male" || p.type?.toLowerCase() === "boar" || p.category?.toLowerCase()?.includes("boar")) || originalSecCat === "B" || swineData.batches?.length > 0)) {
      typeWarning = "Cannot change to Sow Pen: this housing unit currently houses boars, piglet batches, or non-sow swine. Please transfer them to another pen first.";
    } else if (newSecCat === "B" && (swineData.pigs?.some(p => p.gender === "Female" || p.type?.toLowerCase() === "sow" || p.category?.toLowerCase()?.includes("sow")) || originalSecCat === "S" || swineData.batches?.length > 0 || (pen?.occupancy || 0) > 1)) {
      typeWarning = `Cannot change to Boar Pen: this housing unit currently houses ${pen?.occupancy} swine (sows/batches). Boar pens allow max 1 solitary boar.`;
    } else if (newSecCat === "W" && swineData.pigs?.some(p => p.type?.toLowerCase() === "boar" || p.type?.toLowerCase() === "sow" || p.category?.toLowerCase()?.includes("boar") || p.category?.toLowerCase()?.includes("sow"))) {
      typeWarning = "Cannot change to Weaned / Fattening: this housing unit currently houses adult breeding swine. Please transfer them first.";
    } else if (pen?.occupancy > 0) {
      typeWarning = `Cannot change pen type from ${pen?.section} while this housing unit currently houses ${pen?.occupancy} active swine. Please transfer them to another pen first.`;
    }
  }

  /* ─── Edit submit ────────────────────────────────────────────── */
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (typeWarning) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/${encodeURIComponent(pen.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          section,
          capacity: isBoarLocked ? 1 : Number(capacity),
          creator: loggedInUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update pen.");
      setSuccessInfo({ code, section });
      transitionToStep(STEP_SUCCESS);
      // propagate edit up so the pen list refreshes
      onEdit?.({ ...pen, code, section, capacity: isBoarLocked ? 1 : Number(capacity) }, true);
    } catch (err) {
      // surface the error inline
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Batch display helper ───────────────────────────────────── */
  const getBatchLabel = (batch) => {
    return batch.batch_tag || `Batch ${batch.batch_id?.slice(0, 6)}`;
  };

  /* ─── Panel max‑width based on step ─────────────────────────── */
  const maxWidth = step === STEP_SUCCESS ? "max-w-sm" : "max-w-md";

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) handleClose(); }}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${maxWidth} ${panelClassName}`}
      >

        {/* ══════════════ STEP: VIEW ══════════════ */}
        {step === STEP_VIEW && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pen #{pen.code} Details</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Housing unit summary</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Info rows */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Section Type</span>
                  <span className="font-bold text-slate-800">{sectionObj.label} ({pen.section})</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Max Capacity</span>
                  <span className="font-bold text-slate-800">{pen.capacity} pigs</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Current Occupancy</span>
                  <span className="font-bold text-slate-800">{pen.occupancy} / {pen.capacity} ({pct}%)</span>
                </div>
              </div>

              {/* Occupancy bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Occupancy Level</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Housed swine */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-500 font-extrabold">
                    <PiggyBank className="w-3.5 h-3.5 text-emerald-600" /> Currently Housed Swine
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                    {totalHead} head
                  </span>
                </div>

                {loadingSwine ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading housed swine...
                  </div>
                ) : (swineData.pigs?.length || 0) === 0 && (swineData.batches?.length || 0) === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400 font-medium">
                    No active swine are currently assigned to this housing unit.
                  </div>
                ) : (
                  <>
                    {/* Keyframe animation injected inline once */}
                    <style>{`
                      @keyframes swine-fade-up {
                        from { opacity: 0; transform: translateY(10px); }
                        to   { opacity: 1; transform: translateY(0); }
                      }
                      .swine-card-enter {
                        opacity: 0;
                        animation: swine-fade-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                      }
                    `}</style>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {/* Individual pigs */}
                    {(swineData.pigs || []).map((pig, i) => (
                      <div
                        key={pig.pig_id || pig.id}
                        className={`p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between gap-2 transition-colors${swineReady ? ' swine-card-enter' : ''}`}
                        style={swineReady ? { animationDelay: `${i * 55}ms` } : undefined}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">#{pig.pig_tag || pig.id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                              pig.gender === "Female"
                                ? "bg-rose-100 text-rose-800"
                                : pig.gender === "Male"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {pig.gender || pig.status || "Pig"}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold uppercase tracking-wide shrink-0">
                              {pig.status || "Healthy"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                            {pig.breed || "Crossbreed"}
                            {pig.weight != null ? ` • ${Number(pig.weight).toFixed(1)} kg` : ""}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Piglet batches */}
                    {(swineData.batches || []).map((batch, i) => {
                      const batchAge = batch.date_of_birth
                        ? Math.floor((Date.now() - new Date(batch.date_of_birth).getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      return (
                        <div
                          key={batch.batch_id || batch.id}
                          className={`p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 border border-amber-100 flex items-center justify-between gap-2 transition-colors${swineReady ? ' swine-card-enter' : ''}`}
                          style={swineReady ? { animationDelay: `${((swineData.pigs?.length || 0) + i) * 55}ms` } : undefined}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-amber-950 truncate">
                                {getBatchLabel(batch)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide shrink-0">
                                Piglet Batch
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                                batch.status === "suckling"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-violet-100 text-violet-700"
                              }`}>
                                {batch.status || "suckling"}
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-700/80 font-medium truncate mt-0.5">
                              {batch.breed || "Crossbreed"}
                              {" • "}
                              <span className="font-semibold text-amber-900">{batch.current_count} head</span>
                              {batchAge !== null ? ` • ${batchAge}d old` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              {/* Footer buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => transitionToStep(STEP_EDIT)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Pencil size={14} /> Edit Pen
                </button>
                <button
                  type="button"
                  onClick={() => { handleClose(); onArchive(pen); }}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Archive size={14} /> Archive Pen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ STEP: EDIT ══════════════ */}
        {step === STEP_EDIT && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => transitionToStep(STEP_VIEW)}
                  disabled={submitting}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Pen #{pen.code}</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Update housing unit details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Edit form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pen Code *</label>
                <input
                  type="text"
                  required
                  disabled={submitting}
                  placeholder="e.g. PEN-S1"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Section (Pen Type) *</label>
                <select
                  value={section}
                  disabled={submitting}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSection(val);
                    if (val === "B") setCapacity("1");
                    else if (Number(capacity) < minCapacity) setCapacity(String(minCapacity));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {Object.entries(sections || {}).map(([key, s]) => (
                    <option key={key} value={key}>{s.label} ({key}) — {s.desc}</option>
                  ))}
                </select>
                {typeWarning && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold mt-2 flex items-start gap-2 animate-in fade-in">
                    <span>🚫 {typeWarning}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex justify-between">
                  <span>Capacity *</span>
                  {pen?.occupancy > 0 && (
                    <span className="text-slate-400 font-normal text-[11px]">Min capacity: {pen.occupancy} (Currently housed)</span>
                  )}
                </label>
                <input
                  type="number"
                  required
                  disabled={submitting || isBoarLocked}
                  min={isBoarLocked ? "1" : String(minCapacity)}
                  placeholder="e.g. 10"
                  value={isBoarLocked ? "1" : capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
                {isBoarLocked ? (
                  <p className="text-[11px] font-bold text-amber-600 mt-1">⚠️ Max capacity is locked to 1 since boars fight other pigs.</p>
                ) : pen?.occupancy > 0 ? (
                  <p className="text-[11px] font-medium text-slate-500 mt-1">ℹ️ Capacity cannot be lower than the current occupancy ({pen.occupancy} pigs).</p>
                ) : null}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => transitionToStep(STEP_VIEW)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || Boolean(typeWarning)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════ STEP: SUCCESS ══════════════ */}
        {step === STEP_SUCCESS && (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner mx-auto">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Housing Unit Updated
              </span>
              <h4 className="text-xl font-black text-slate-900">Pen #{successInfo?.code} Updated!</h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {sections[successInfo?.section]?.label || "Pen"} details have been updated successfully and recorded in activity logs.
              </p>
            </div>
            <div className="pt-2 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
