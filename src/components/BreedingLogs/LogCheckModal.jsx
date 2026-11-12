import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, CheckCircle2, CalendarCheck,
  ThumbsUp, ThumbsDown
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const TRANSITION_MS = 320;

export default function LogCheckModal({ isOpen, onClose, onSaved, loggedInUser, initialData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  /* ── form fields ──────────────────────────────────────────────── */
  const [outcome, setOutcome]       = useState(null); // 'passed' | 'failed'
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [isSuccess, setIsSuccess]   = useState(false);
  const [checkType, setCheckType]   = useState('heat');

  /* ── smooth step transition ────────────────────────────────────── */
  const containerRef      = useRef(null);
  const prevHeightRef     = useRef(null);
  const [ht, setHt]       = useState('auto');

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
  }, [outcome, isSuccess, checkType]);

  const containerStyle = {
    height: ht,
    transition: ht === 'auto' ? undefined : `height ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: 'height',
  };

  /* ── init ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isOpen) {
      setOutcome(null);
      setFormError('');
      setIsSuccess(false);
      setHt('auto');

      if (initialData) {
        // Smart select check type based on days
        if (initialData.day >= 25) {
          setCheckType('pregnancy');
        } else {
          setCheckType('heat');
        }
      }
    }
  }, [isOpen, initialData]);

  if (!shouldRender || !initialData) return null;

  const handleClose = () => requestClose();

  /* ── submit ───────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
    setFormError('');

    if (!outcome) { setFormError('Please select an outcome.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs/${initialData.breeding_id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: checkType,
          outcome,
          creator: loggedInUser,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to log check.');

      setIsSuccess(true);
      onSaved?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const maxWidth = isSuccess ? 'max-w-sm' : 'max-w-md';

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) handleClose(); }}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${maxWidth} ${panelClassName}`}
      >
        {/* ══ FORM ════════════════════════════════════════════════ */}
        {!isSuccess && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Log Milestone Check</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Sow #{initialData.tag}{initialData.day !== undefined ? ` · Day ${initialData.day}` : ''}{initialData.pen_code ? ` · Pen ${initialData.pen_code}` : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleClose} disabled={submitting} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 animate-in fade-in duration-200">
              
              {/* Check Type */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Check Type
                </label>
                <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                      setCheckType('heat');
                    }}
                    className={`text-[11px] font-bold py-2 px-2 rounded-lg transition-all cursor-pointer outline-none focus:outline-none ${
                      checkType === 'heat' 
                        ? 'bg-white text-emerald-700 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Heat Check (Day 18–24)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                      setCheckType('pregnancy');
                    }}
                    className={`text-[11px] font-bold py-2 px-2 rounded-lg transition-all cursor-pointer outline-none focus:outline-none ${
                      checkType === 'pregnancy' 
                        ? 'bg-white text-emerald-700 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Pregnancy Check (Day 28–35)
                  </button>
                </div>
              </div>

              {/* Outcome Selection */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Outcome *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                      setOutcome('passed');
                    }}
                    className={`px-4 py-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer outline-none focus:outline-none active:scale-[0.98] ${
                      outcome === 'passed' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500/20' 
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <ThumbsUp size={22} className={outcome === 'passed' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-xs font-bold">Passed / Confirmed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                      setOutcome('failed');
                    }}
                    className={`px-4 py-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer outline-none focus:outline-none active:scale-[0.98] ${
                      outcome === 'failed' 
                        ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs ring-1 ring-rose-500/20' 
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <ThumbsDown size={22} className={outcome === 'failed' ? 'text-rose-600' : 'text-slate-400'} />
                    <span className="text-xs font-bold">Failed / Returned</span>
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
                  <span>⚠️ {formError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-50">
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
                  disabled={submitting || !outcome}
                  className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                    outcome === 'failed' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  }`}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{submitting ? 'Saving...' : 'Confirm Outcome'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══ SUCCESS ═════════════════════════════════════════════ */}
        {isSuccess && (
          <div className="p-8 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm bg-emerald-50 border-emerald-100 text-emerald-600">
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">Milestone Recorded!</h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                The milestone check has been successfully logged for this breeding cycle.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
