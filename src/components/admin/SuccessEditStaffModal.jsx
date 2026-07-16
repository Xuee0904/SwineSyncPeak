import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function SuccessEditStaffModal({ isOpen, onClose, staff }) {
  const { shouldRender, requestClose, overlayClassName, panelClassName } = 
    useModalAnimation(isOpen, onClose);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <style>{`
        @keyframes modal-panel-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modal-panel-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        .animate-modal-in  { animation: modal-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-modal-out { animation: modal-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
      `}</style>

      <div
        className={[
          'w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-center',
          panelClassName,
        ].join(' ')}
      >
        <button
          onClick={() => requestClose()}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <Check className="w-7 h-7 text-indigo-600" strokeWidth={3} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Changes Saved</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {staff?.name ? (
                <>
                  Successfully updated access roles and profile parameters for <span className="font-bold text-slate-800">{staff.name}</span>.
                </>
              ) : (
                'The caretaker account changes were successfully saved.'
              )}
            </p>
          </div>

          {/* Comparison Card */}
          {staff && (staff.oldName || staff.oldRole) && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-left space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parameter Changes</p>
              
              {staff.oldName && staff.oldName !== staff.name && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium">Name:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 truncate">
                    <span className="line-through text-slate-400 font-normal">{staff.oldName}</span>
                    <span className="text-indigo-600">→</span>
                    <span>{staff.name}</span>
                  </div>
                </div>
              )}

              {staff.oldRole && staff.oldRole !== staff.role && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-medium">Role:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="line-through text-slate-400 font-normal">{staff.oldRole}</span>
                    <span className="text-indigo-600">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px]">
                      {staff.role}
                    </span>
                  </div>
                </div>
              )}

              {((!staff.oldName || staff.oldName === staff.name) && (!staff.oldRole || staff.oldRole === staff.role)) && (
                <p className="text-[11px] text-slate-500 italic">No parameter discrepancies; existing profile details reaffirmed.</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => requestClose()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}