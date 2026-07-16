import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Lock, Unlock } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function SuccessArchiveStaffModal({ isOpen, onClose, staff, wasArchived }) {
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
          <div className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm ${
            wasArchived 
              ? 'bg-rose-50 border-rose-100 text-rose-600' 
              : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
            {wasArchived ? <Lock className="w-7 h-7" strokeWidth={2.5} /> : <Check className="w-7 h-7" strokeWidth={3} />}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {wasArchived ? 'Account Archived' : 'Account Restored'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {staff?.name ? (
                <>
                  The caretaker credentials for <span className="font-bold text-slate-800">{staff.name}</span> have been successfully {wasArchived ? 'archived and suspended' : 'restored to active status'}.
                </>
              ) : (
                `The staff account has been successfully ${wasArchived ? 'archived' : 'restored'}.`
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => requestClose()}
            className={`w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 ${
              wasArchived 
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}