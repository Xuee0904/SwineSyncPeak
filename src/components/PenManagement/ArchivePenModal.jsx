import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2, CheckCircle2, Archive, Lock } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";
import useSmoothStepTransition from "../../hooks/useSmoothStepTransition";

export default function ArchivePenModal({ isOpen, onClose, onArchive, pen, submitting }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [selectedReason, setSelectedReason] = useState("Facility Decommissioned / No Longer Needed");
  const [customReason, setCustomReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  const { containerRef, style: stepTransitionStyle } = useSmoothStepTransition(Boolean(successInfo));

  const reasonOptions = [
    "Facility Decommissioned / No Longer Needed",
    "Under Long-term Maintenance or Renovation",
    "Consolidated with Another Pen Section",
    "Other (Specify below)",
  ];

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(reasonOptions[0]);
      setCustomReason("");
      setReasonError("");
      setSuccessInfo(null);
    }
  }, [isOpen]);

  if (!shouldRender || !pen) return null;

  const handleClose = () => {
    requestClose();
  };

  const hasSwine = Number(pen.occupancy || 0) > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasSwine) return;

    if (selectedReason.startsWith("Other") && !customReason.trim()) {
      setReasonError("Please specify the reason for archiving this pen.");
      return;
    }

    const finalReason = selectedReason.startsWith("Other") ? customReason.trim() : selectedReason;
    onArchive({
      id: pen.id,
      code: pen.code,
      reason: finalReason,
      onSuccess: (info) => {
        setSuccessInfo(info || { code: pen.code });
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
      <div
        ref={containerRef}
        style={stepTransitionStyle}
        className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${successInfo ? "max-w-sm" : "max-w-md"
          } ${panelClassName}`}
      >
        {!successInfo && (
          <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${hasSwine ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"} flex items-center justify-center font-bold`}>
                {hasSwine ? <Lock size={18} /> : <Archive size={18} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {hasSwine ? `Cannot Archive ${pen.code}` : `Archive Pen ${pen.code}`}
                </h3>
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
        )}

        {successInfo ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mx-auto">
              <CheckCircle2 size={28} strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900">
                Pen Archived!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {successInfo.code} has been successfully archived.
              </p>
            </div>

            <div className="pt-2 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 shadow-rose-600/20 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        ) : hasSwine ? (
          <div className="p-6 space-y-5 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4.5 flex gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <p className="text-amber-800 leading-relaxed">
                  This pen currently houses <span className="font-bold underline">{pen.occupancy} active swine</span>. You must transfer or archive them first.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 animate-in fade-in duration-300">
            <p className="text-xs text-slate-600 leading-relaxed">
              Archiving <span className="font-bold text-slate-900">{pen.code}</span> will remove it from active housing selections.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                Reason for Archiving *
              </label>
              <div className="space-y-2">
                {reasonOptions.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${selectedReason === option
                      ? "border-rose-500 bg-rose-50/40 text-rose-900 shadow-xs"
                      : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/60"
                      }`}
                  >
                    <input
                      type="radio"
                      name="archiveReason"
                      value={option}
                      checked={selectedReason === option}
                      onChange={(e) => {
                        setSelectedReason(e.target.value);
                        setReasonError("");
                      }}
                      className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>

              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${selectedReason.startsWith("Other") ? 'max-h-20 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                <input
                  type="text"
                  placeholder="Enter specific reason..."
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    if (e.target.value.trim()) setReasonError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all"
                />
              </div>
              {reasonError && (
                <p className="text-xs text-rose-600 font-medium mt-1">{reasonError}</p>
              )}
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
                disabled={submitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? "Archiving..." : "Archive Pen"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
