import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X, Bookmark } from 'lucide-react';
import { subscribeToToasts } from '../utils/toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToast) => {
      if (newToast.dismiss) {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        return;
      }
      setToasts((prev) => [...prev, newToast]);
      if (newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    });
    return () => unsubscribe();
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
      <style>{`
        @keyframes toast-slide-up {
          0% { opacity: 0; transform: translateY(16px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-toast-in { animation: toast-slide-up 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto animate-toast-in overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-4 shadow-2xl text-white flex items-start gap-3 transition-all duration-300 group"
          role="alert"
        >
          <div className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {t.type === 'draft' && (
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Bookmark className="w-4 h-4" />
              </div>
            )}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
          </div>
          <div className="flex-1 min-w-0 pr-1 text-left">
            <p className="text-xs font-bold tracking-tight text-white leading-tight">{t.title}</p>
            {t.description && (
              <p className="text-[11px] text-slate-300/90 mt-1 leading-relaxed">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
