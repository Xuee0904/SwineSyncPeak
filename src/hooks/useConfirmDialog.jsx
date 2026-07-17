import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Archive } from 'lucide-react';

/**
 * useConfirmDialog
 *
 * A reusable hook for destructive-action confirmation dialogs.
 * Renders via createPortal so the overlay covers the main content area
 * (to the right of the sidebar) while leaving the side-nav visible.
 *
 * Usage:
 *   const { confirmDialog, openConfirm } = useConfirmDialog();
 *   // Trigger:
 *   openConfirm({ title, subtitle, message, icon, confirmLabel, onConfirm });
 *   // Pass leftOffset to skip the sidebar: leftOffset defaults to 'lg:left-60'
 *   // Render anywhere in your tree:
 *   {confirmDialog}
 */
export default function useConfirmDialog() {
  const [state, setState] = useState(null);

  const openConfirm = useCallback((options) => {
    setState({ ...options, isLoading: false });
  }, []);

  const close = useCallback(() => {
    setState(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!state?.onConfirm) return;
    setState(s => ({ ...s, isLoading: true }));
    try {
      await state.onConfirm();
      setState(null);
    } catch {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [state]);

  const confirmDialog = state
    ? createPortal(
        <div
          // 'leftOffset' lets callers skip past a sidebar. Default = lg:left-60 (240px).
          className={`fixed top-0 right-0 bottom-0 z-[200] flex items-center justify-center ${state.leftOffset ?? 'left-0 lg:left-60'}`}
          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.40)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !state.isLoading) close(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4"
            style={{ animation: 'confirmIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            {/* Icon + Title row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                {state.icon ?? <Archive className="w-5 h-5 text-rose-600" />}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">{state.title}</h4>
                {state.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{state.subtitle}</p>
                )}
              </div>
            </div>

            {/* Message */}
            {state.message && (
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">{state.message}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={close}
                disabled={state.isLoading}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={state.isLoading}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${
                  state.confirmClassName ?? 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {state.isLoading ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  state.icon ?? <Archive className="w-3.5 h-3.5" />
                )}
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { confirmDialog, openConfirm, closeConfirm: close };
}

