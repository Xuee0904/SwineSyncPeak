import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AlertOctagon, Loader2, Check } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

export default function ReportMiscarriageModal({ isOpen, onClose, onConfirm, sowTag, isSubmitting }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } = useModalAnimation(isOpen, onClose);
  
  const containerRef = useRef(null);
  const [contentHeight, setContentHeight] = useState("auto");
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset success state whenever modal opens fresh
  useLayoutEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      await onConfirm();
      setShowSuccess(true);
    } catch (e) {
      // Error handled by parent
    }
  };

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
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) requestClose(); }}
    >

      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-md relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${panelClassName}`}
        style={{ height: contentHeight }}
      >
        <div ref={containerRef} className="absolute inset-x-0 top-0">
          {!showSuccess ? (
            <div className="p-6 animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <AlertOctagon className="w-6 h-6 text-orange-600" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Report Miscarriage</h2>
                <p className="text-sm text-slate-500">
                  Are you sure you want to report a miscarriage for <strong className="text-slate-900">Sow #{sowTag}</strong>? 
                  This will mark the current breeding cycle as failed and return the sow to Healthy status.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-8">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Reporting...</span>
                    </>
                  ) : (
                    <span>Report Miscarriage</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Reported Successfully</h2>
              <p className="text-sm text-slate-500 mb-8">The miscarriage has been recorded and the sow's status is now Healthy.</p>
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
