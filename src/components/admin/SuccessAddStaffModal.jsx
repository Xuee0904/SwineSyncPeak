import React from 'react';
import { Check, X } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation'; // Restored hook import

export default function SuccessAddStaffModal({ isOpen, onClose, staff }) {
  const { shouldRender, isClosing, requestClose } = useModalAnimation(isOpen, onClose);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      style={{ animation: isClosing ? 'staffModalFadeOut 180ms ease-in forwards' : 'staffModalFadeIn 200ms ease-out' }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <style>{`
        @keyframes staffModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes staffModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes staffModalScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes staffModalScaleOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.94) translateY(10px); }
        }
      `}</style>

      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-center"
        style={{ animation: isClosing ? 'staffModalScaleOut 180ms ease-in forwards' : 'staffModalScaleIn 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <button
          onClick={requestClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-600" strokeWidth={3} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Account Created</h3>
            <p className="text-xs text-slate-400 mt-1">
              {staff?.name ? (
                <>
                  <span className="font-semibold text-slate-600">{staff.name}</span> can now sign in with the credentials you set.
                </>
              ) : (
                'The new staff account is ready to sign in.'
              )}
            </p>
          </div>

          {staff?.email && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-left space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                <span className="text-xs text-slate-700 truncate">{staff.email}</span>
              </div>
              {staff?.role && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
                  <span className="text-xs text-slate-700">{staff.role}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={requestClose}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}