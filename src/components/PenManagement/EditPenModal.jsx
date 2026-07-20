import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Pencil, Loader2, CheckCircle2 } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

export default function EditPenModal({ isOpen, onClose, onUpdate, pen, sections, submitting }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [code, setCode] = useState("");
  const [section, setSection] = useState("B");
  const [capacity, setCapacity] = useState("10");
  const [successInfo, setSuccessInfo] = useState(null);
  const [housedSwine, setHousedSwine] = useState({ pigs: [], batches: [] });

  useEffect(() => {
    if (isOpen && pen) {
      setCode(pen.code || "");
      let sec = pen.section && sections?.[pen.section] ? pen.section : "S";
      if (!sections?.[pen.section] && pen.section) {
        const s = String(pen.section).toUpperCase();
        if (s === "BOAR" || s.includes("BOAR") || s === "B") sec = "B";
        else if (s === "SOW" || s.includes("SOW") || s.includes("GEST") || s.includes("FARR") || s === "S" || s.startsWith("A")) sec = "S";
        else if (s === "WEAN" || s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS") || s === "W" || s.startsWith("N") || s.startsWith("T")) sec = "W";
        else if (s === "QUAR" || s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK") || s === "Q") sec = "Q";
      }
      setSection(sec);
      setCapacity(String(pen.capacity || sections?.[sec]?.defaultCapacity || 10));
      setSuccessInfo(null);

      const id = pen.id || pen.pen_id;
      if (id) {
        fetch(`/api/pens/${encodeURIComponent(id)}/swine`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.data) {
              setHousedSwine(data.data);
            } else {
              setHousedSwine({ pigs: [], batches: [] });
            }
          })
          .catch(() => setHousedSwine({ pigs: [], batches: [] }));
      } else {
        setHousedSwine({ pigs: [], batches: [] });
      }
    } else {
      setHousedSwine({ pigs: [], batches: [] });
    }
  }, [isOpen, pen, sections]);

  if (!shouldRender || !pen) return null;

  const handleClose = () => {
    requestClose();
  };

  const getSectionCat = (sec) => {
    if (!sec) return "S";
    const s = String(sec).toUpperCase();
    if (s === "BOAR" || s.includes("BOAR") || s === "B") return "B";
    if (s === "SOW" || s.includes("SOW") || s.includes("GEST") || s.includes("FARR") || s === "S" || s.startsWith("A")) return "S";
    if (s === "WEAN" || s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS") || s === "W" || s.startsWith("N") || s.startsWith("T")) return "W";
    if (s === "QUAR" || s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK") || s === "Q") return "Q";
    return "S";
  };

  const isBoarLocked = section === "B";
  const minCapacity = Math.max(1, pen?.occupancy || 1);

  const originalSecCat = getSectionCat(pen?.section);
  const newSecCat = getSectionCat(section);
  const hasSwine = (housedSwine.pigs?.length || 0) > 0 || (housedSwine.batches?.length || 0) > 0 || (pen?.occupancy || 0) > 0;
  let typeWarning = null;

  if (hasSwine && newSecCat !== originalSecCat) {
    if (newSecCat === "S" && (housedSwine.pigs?.some(p => p.gender === "Male" || p.type?.toLowerCase() === "boar" || p.category?.toLowerCase()?.includes("boar")) || originalSecCat === "B" || housedSwine.batches?.length > 0)) {
      typeWarning = "Cannot change to Sow Pen: this housing unit currently houses boars, piglet batches, or non-sow swine. Please transfer them to another pen first.";
    } else if (newSecCat === "B" && (housedSwine.pigs?.some(p => p.gender === "Female" || p.type?.toLowerCase() === "sow" || p.category?.toLowerCase()?.includes("sow")) || originalSecCat === "S" || housedSwine.batches?.length > 0 || (pen?.occupancy || 0) > 1)) {
      typeWarning = `Cannot change to Boar Pen: this housing unit currently houses ${pen?.occupancy} swine (sows/batches). Boar pens allow max 1 solitary boar.`;
    } else if (newSecCat === "W" && housedSwine.pigs?.some(p => p.type?.toLowerCase() === "boar" || p.type?.toLowerCase() === "sow" || p.category?.toLowerCase()?.includes("boar") || p.category?.toLowerCase()?.includes("sow"))) {
      typeWarning = "Cannot change to Weaned / Fattening: this housing unit currently houses adult breeding swine. Please transfer them first.";
    } else if (pen?.occupancy > 0) {
      typeWarning = `Cannot change pen type from ${pen?.section} while this housing unit currently houses ${pen?.occupancy} active swine. Please transfer them to another pen first.`;
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeWarning) return;
    onUpdate({
      id: pen.id,
      code,
      section,
      capacity: isBoarLocked ? 1 : Number(capacity),
      onSuccess: (info) => {
        setSuccessInfo(info);
      },
    });
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) handleClose();
      }}
    >
      <div className={`w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${panelClassName}`}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Pen #{pen.code}</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Update housing unit details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {successInfo ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Housing Unit Updated
              </span>
              <h4 className="text-xl font-black text-slate-900">
                Pen #{successInfo.code} Updated!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {sections[successInfo.section]?.label || "Pen"} details have been updated successfully and recorded in activity logs.
              </p>
            </div>

            <div className="pt-2 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Done & Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Pen Code *
              </label>
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
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Section (Pen Type) *
              </label>
              <select
                value={section}
                disabled={submitting}
                onChange={(e) => {
                  const val = e.target.value;
                  setSection(val);
                  if (val === "B") {
                    setCapacity("1");
                  } else if (Number(capacity) < minCapacity) {
                    setCapacity(String(minCapacity));
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {Object.entries(sections || {}).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label} ({key}) — {s.desc}
                  </option>
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
                  <span className="text-slate-400 font-normal text-[11px]">
                    Min capacity: {pen.occupancy} (Currently housed)
                  </span>
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
                <p className="text-[11px] font-bold text-amber-600 mt-1">
                  ⚠️ Max capacity is locked to 1 since boars fight other pigs.
                </p>
              ) : pen?.occupancy > 0 ? (
                <p className="text-[11px] font-medium text-slate-500 mt-1">
                  ℹ️ Capacity cannot be lower than the current occupancy ({pen.occupancy} pigs).
                </p>
              ) : null}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || Boolean(typeWarning)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
