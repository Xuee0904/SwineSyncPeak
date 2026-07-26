import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

export default function ArchiveBreedingLogModal({ isOpen, onClose, onConfirm, sowTag, isArchiving }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } = useModalAnimation(isOpen, onClose);
  
  const containerRef = useRef(null);
  const [contentHeight, setContentHeight] = useState("auto");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset success state whenever modal opens fresh
  useLayoutEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setReason("");
      setOtherReason("");
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      await onConfirm(reason === "Other" ? otherReason : reason);
      setShowSuccess(true);
    } catch (e) {
      // Error handled by parent
    }
  };

  const ARCHIVE_REASONS = [
    "Entered in error",
    "Duplicate record",
    "Sow sold/removed during gestation",
    "Other"
  ];

  useLayoutEffect(() => {
    if (!shouldRender || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContentHeight(`${entry.target.offsetHeight}px`);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [shouldRender]);

  if (!shouldRender) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 sm:p-0 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isArchiving) requestClose(); }}
    >

      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-md relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${panelClassName}`}
        style={{ height: contentHeight }}
      >
        <div ref={containerRef} className="absolute inset-x-0 top-0">
          {!showSuccess ? (
            <div className="p-6 animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Archive Breeding Record</h2>
                <p className="text-sm text-slate-500">
                  Are you sure you want to archive the breeding record for <strong className="text-slate-900">Sow #{sowTag}</strong>? 
                  This action will remove it from the active dashboard.
                </p>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason for archiving <span className="text-red-500">*</span></label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isArchiving}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-shadow appearance-none"
                  >
                    <option value="" disabled>Select a reason...</option>
                    {ARCHIVE_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {reason === "Other" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Please specify</label>
                    <input
                      type="text"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      disabled={isArchiving}
                      placeholder="Enter reason..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-shadow"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setReason("");
                    setOtherReason("");
                    onClose();
                  }}
                  disabled={isArchiving}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isArchiving || !reason || (reason === "Other" && !otherReason.trim())}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isArchiving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    "Archive Record"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Archived Successfully</h2>
              <p className="text-sm text-slate-500 mb-8">The breeding record has been archived and removed from the active dashboard.</p>
              <button
                type="button"
                onClick={() => requestClose()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all"
              >
                Done & Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
