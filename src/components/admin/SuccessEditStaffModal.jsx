import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function SuccessEditStaffModal({ isOpen, onClose, staff }) {
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
          <div className="mx-auto w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Check className="w-7 h-7 text-indigo-600" strokeWidth={3} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">Changes Saved</h3>
            <p className="text-xs text-slate-400 mt-1">
              {staff?.name ? (
                <>
                  Successfully updated profile details for <span className="font-semibold text-slate-600">{staff.name}</span> in our registry.
                </>
              ) : (
                'The caretaker account changes were successfully saved.'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}