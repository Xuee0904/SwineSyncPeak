import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Baby, Loader2, CheckCircle2 } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TRANSITION_MS = 320;

export default function LogFarrowingModal({ isOpen, onClose, onSaved, onRegisterPiglets, loggedInUser, initialData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const containerRef = useRef(null);
  const prevHeightRef = useRef(null);
  const [ht, setHt] = useState('auto');

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || prevHeightRef.current === null) return;
    const fromH = prevHeightRef.current;
    prevHeightRef.current = null;
    const toH = el.scrollHeight;
    if (Math.abs(fromH - toH) < 2) return;
    setHt(`${fromH}px`);
    const raf = requestAnimationFrame(() => {
      setHt(`${toH}px`);
      const t = setTimeout(() => setHt('auto'), TRANSITION_MS);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, [isSuccess]);

  const containerStyle = {
    height: ht,
    transition: ht === 'auto' ? undefined : `height ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: 'height',
  };

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setFormError('');
      setIsSuccess(false);
      setHt('auto');
    }
  }, [isOpen]);

  if (!shouldRender || !initialData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
    setFormError('');

    if (!date) {
      setFormError('Please select the actual farrowing date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs/${initialData.breeding_id}/farrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_farrowing_date: date,
          creator: loggedInUser,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to log farrowing.');

      setIsSuccess(true);
      onSaved?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) requestClose(); }}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className={`w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col ${panelClassName}`}
      >
        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Farrowing Logged
              </span>
              <h4 className="text-xl font-black text-slate-900 leading-tight">
                Sow #{initialData.id} Farrowed
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Her status is now Healthy and parity has increased.
              </p>
            </div>
            
            <div className="w-full flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  requestClose();
                  onRegisterPiglets?.(date);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Baby size={16} /> Register Piglets Now
              </button>
              <button
                type="button"
                onClick={() => requestClose()}
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close (Do it later)
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Baby size={16} />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Log Farrowing</h3>
              </div>
              <p className="text-xs font-medium text-slate-500 pl-11">Sow #{initialData.id}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium animate-in slide-in-from-top-2">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 block">
                  Actual Farrowing Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 mt-auto">
              <button
                type="button"
                onClick={() => requestClose()}
                disabled={submitting}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !date}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
