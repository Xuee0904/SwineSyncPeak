import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Eye, Pencil, Archive, Grid3X3, Users, CheckCircle2, Loader2, PiggyBank } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

export default function ViewPenModal({ isOpen, onClose, pen, sections, onEdit, onArchive }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [swineData, setSwineData] = useState({ pigs: [], batches: [] });
  const [loadingSwine, setLoadingSwine] = useState(false);

  useEffect(() => {
    if (isOpen && pen) {
      const id = pen.id || pen.pen_id;
      if (!id) return;
      setLoadingSwine(true);
      fetch(`/api/pens/${encodeURIComponent(id)}/swine`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.data) {
            setSwineData(data.data);
          } else {
            setSwineData({ pigs: [], batches: [] });
          }
        })
        .catch((err) => {
          console.error("Error fetching pen swine:", err);
          setSwineData({ pigs: [], batches: [] });
        })
        .finally(() => setLoadingSwine(false));
    } else {
      setSwineData({ pigs: [], batches: [] });
    }
  }, [isOpen, pen]);

  if (!shouldRender || !pen) return null;

  const handleClose = () => {
    requestClose();
  };

  let sectionObj = sections?.[pen.section];
  if (!sectionObj && pen?.section) {
    const s = String(pen.section).toUpperCase();
    if (s === "BOAR" || s.includes("BOAR") || s === "B") sectionObj = sections?.B;
    else if (s === "SOW" || s.includes("SOW") || s.includes("GEST") || s.includes("FARR") || s === "S" || s.startsWith("A")) sectionObj = sections?.S;
    else if (s === "WEAN" || s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS") || s === "W" || s.startsWith("N") || s.startsWith("T")) sectionObj = sections?.W;
    else if (s === "QUAR" || s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK") || s === "Q") sectionObj = sections?.Q;
  }
  sectionObj = sectionObj || { label: pen?.section || "General Pen", desc: "" };
  const pct = Math.min(100, Math.round((Number(pen.occupancy || 0) / Number(pen.capacity || 1)) * 100));

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${panelClassName}`}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pen #{pen.code} Details</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Housing unit summary
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
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

          {/* Currently Housed Swine Section */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-500 font-extrabold">
                <PiggyBank className="w-3.5 h-3.5 text-emerald-600" /> Currently Housed Swine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                {loadingSwine ? "..." : (swineData.pigs?.length || 0) + (swineData.batches?.reduce((acc, b) => acc + Number(b.current_count || 0), 0) || 0)} head
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
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {(swineData.pigs || []).map((pig) => (
                  <div
                    key={pig.id || pig.pig_id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          #{pig.pig_tag || pig.id}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wide shrink-0">
                          {pig.category || pig.type || pig.gender || "Pig"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {pig.breed || "Crossbreed"} {pig.current_weight != null ? `• ${Number(pig.current_weight).toFixed(1)} kg` : ""}
                      </p>
                    </div>
                  </div>
                ))}

                {(swineData.batches || []).map((batch) => (
                  <div
                    key={batch.batch_id || batch.id}
                    className="p-3 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-100 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-amber-950 truncate">
                          Batch #{batch.batch_number}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide shrink-0">
                          Piglet Batch
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-700/80 font-medium truncate mt-0.5">
                        {batch.breed || "Crossbreed"} • {batch.current_count} head
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
            <button
              type="button"
              onClick={() => {
                handleClose();
                onEdit(pen);
              }}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Pencil size={14} /> Edit Pen
            </button>
            <button
              type="button"
              onClick={() => {
                handleClose();
                onArchive(pen);
              }}
              className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Archive size={14} /> Archive Pen
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
