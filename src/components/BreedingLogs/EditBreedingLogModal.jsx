import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, CheckCircle2, Dna, Heart,
  Calendar, User, PiggyBank, CalendarCheck, Edit3
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const GESTATION_DAYS = 114;

const METHODS = [
  {
    id: 'artificial_insemination',
    label: 'Artificial Insemination',
    abbr: 'AI',
    icon: Dna,
    tint: 'bg-sky-50 border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'natural_mating',
    label: 'Natural Mating',
    abbr: 'NM',
    icon: Heart,
    tint: 'bg-rose-50 border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
  },
];

const STEP_FORM    = 'form';
const STEP_SUCCESS = 'success';

const TRANSITION_MS = 320;

function calcExpectedFarrowingDate(breedingDate) {
  if (!breedingDate) return '';
  const d = new Date(breedingDate);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + GESTATION_DAYS);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function EditBreedingLogModal({ isOpen, onClose, onSaved, loggedInUser, initialData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  /* ── step state ───────────────────────────────────────────────── */
  const [step, setStep] = useState(STEP_FORM);
  const [successInfo, setSuccessInfo] = useState(null);

  /* ── form fields ──────────────────────────────────────────────── */
  const [sowId, setSowId]             = useState('');
  const [boarId, setBoarId]           = useState('');
  const [breedingDate, setBreedingDate] = useState('');
  const [breedingMethod, setBreedingMethod] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');

  /* ── dropdown data ────────────────────────────────────────────── */
  const [sows, setSows]   = useState([]);
  const [boars, setBoars] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  /* ── smooth step transition (snapshot pattern) ────────────────── */
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
  }, [step, breedingDate, breedingMethod]);

  const goTo = (newStep) => {
    if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
    setStep(newStep);
  };

  const containerStyle = {
    height: ht,
    transition: ht === 'auto' ? undefined : `height ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: 'height',
  };

  /* ── reset on open / close & populate initialData ──────────────── */
  useEffect(() => {
    if (isOpen) {
      setStep(STEP_FORM);
      setFormError('');
      setSuccessInfo(null);
      setHt('auto');

      if (initialData) {
        setSowId(initialData.sow_id || '');
        setBoarId(initialData.boar_id || '');
        setBreedingDate(initialData.matingDate || '');
        setBreedingMethod(initialData.breeding_method || '');
      }
    }
  }, [isOpen, initialData]);

  /* ── fetch sows & boars when opening ───────────────────────────── */
  useEffect(() => {
    if (step !== STEP_FORM || !isOpen) return;
    setLoadingDropdowns(true);
    
    // For edit, we fetch both so they are ready if method is natural_mating
    Promise.all([
      fetch(`${API_BASE}/api/sows`).then(r => r.json()),
      fetch(`${API_BASE}/api/boars`).then(r => r.json())
    ])
      .then(([sowsRes, boarsRes]) => {
        setSows(sowsRes?.data || []);
        setBoars(boarsRes?.data || []);
      })
      .catch(console.error)
      .finally(() => setLoadingDropdowns(false));
  }, [step, isOpen]);

  if (!shouldRender || !initialData) return null;

  const selectedMethod = METHODS.find(m => m.id === breedingMethod);
  const expectedFarrowing = calcExpectedFarrowingDate(breedingDate);
  const selectedSow  = sows.find(s => s.id === sowId) || { tag: initialData.tag };
  const selectedBoar = boars.find(b => b.id === boarId) || { tag: initialData.boarTag };

  const handleClose = () => requestClose();

  /* ── submit ───────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!sowId) { setFormError('Please select a sow.'); return; }
    if (!breedingDate) { setFormError('Please enter the breeding date.'); return; }
    if (breedingMethod === 'natural_mating' && !boarId) {
      setFormError('Please select a boar for Natural Mating.'); return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs/${initialData.breeding_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breeding_method: breedingMethod,
          sow_id: sowId,
          boar_id: breedingMethod === 'natural_mating' ? boarId : null,
          breeding_date: breedingDate,
          creator: loggedInUser,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update breeding log.');

      setSuccessInfo({
        method: selectedMethod,
        sowTag: selectedSow?.tag || sowId,
        boarTag: selectedBoar?.tag || null,
        breedingDate,
        expectedFarrowing,
      });
      goTo(STEP_SUCCESS);
      onSaved?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const maxWidth = step === STEP_SUCCESS ? 'max-w-sm' : 'max-w-md';

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) handleClose(); }}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${maxWidth} ${panelClassName}`}
      >
        {/* ══ STEP: FORM ══════════════════════════════════════════ */}
        {step === STEP_FORM && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Edit3 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Edit Breeding Log</h3>
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Update record details</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} disabled={submitting} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 animate-in fade-in duration-200">
              
              {/* Method Selector */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const isSelected = breedingMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                          setBreedingMethod(m.id);
                        }}
                        className={`px-3 py-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <Icon size={18} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />
                        <span className={`text-[11px] font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-600'}`}>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sow selector */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  <User size={12} /> Sow *
                </label>
                {loadingDropdowns ? (
                  <div className="w-full h-10 rounded-xl bg-slate-100 animate-pulse" />
                ) : (
                  <select
                    required
                    disabled={submitting}
                    value={sowId}
                    onChange={(e) => setSowId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <option value="">— Select a sow —</option>
                    {/* Make sure the initial sow is always in the list even if no longer active, but usually it should be */}
                    {!sows.find(s => s.id === initialData.sow_id) && (
                       <option value={initialData.sow_id}>#{initialData.tag} (Current)</option>
                    )}
                    {sows.map(s => (
                      <option key={s.id} value={s.id}>
                        #{s.tag} — {s.breed}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Boar selector — only for Natural Mating */}
              {breedingMethod === 'natural_mating' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    <PiggyBank size={12} /> Boar *
                  </label>
                  {loadingDropdowns ? (
                    <div className="w-full h-10 rounded-xl bg-slate-100 animate-pulse" />
                  ) : (
                    <select
                      required={breedingMethod === 'natural_mating'}
                      disabled={submitting}
                      value={boarId}
                      onChange={(e) => setBoarId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <option value="">— Select a boar —</option>
                      {initialData.boar_id && !boars.find(b => b.id === initialData.boar_id) && (
                         <option value={initialData.boar_id}>#{initialData.boarTag} (Current)</option>
                      )}
                      {boars.map(b => (
                        <option key={b.id} value={b.id}>
                          #{b.tag} — {b.breed}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Breeding date */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                  <Calendar size={12} /> Breeding Date *
                </label>
                <input
                  type="date"
                  required
                  disabled={submitting}
                  max={new Date().toISOString().split('T')[0]}
                  value={breedingDate}
                  onChange={(e) => {
                    if (containerRef.current) prevHeightRef.current = containerRef.current.offsetHeight;
                    setBreedingDate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50"
                />
              </div>

              {/* Expected farrowing — read-only computed field */}
              {breedingDate && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    <CalendarCheck size={12} /> Expected Farrowing Date
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider normal-case">Auto-computed</span>
                  </label>
                  <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">{formatDisplayDate(expectedFarrowing)}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">+{GESTATION_DAYS} days</span>
                  </div>
                </div>
              )}

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
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══ STEP: SUCCESS ═══════════════════════════════════════ */}
        {step === STEP_SUCCESS && successInfo && (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            {/* Icon */}
            <div className={`w-16 h-16 rounded-full border-4 border-emerald-50 flex items-center justify-center bg-emerald-100 text-emerald-600 shadow-inner mx-auto`}>
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>

            {/* Title */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Breeding Log Updated
              </span>
              <h4 className="text-xl font-black text-slate-900">Record Updated!</h4>
            </div>

            {/* Details card */}
            <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2.5 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Method</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${successInfo.method?.badge}`}>
                  {successInfo.method?.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Sow</span>
                <span className="font-bold text-slate-800">#{successInfo.sowTag}</span>
              </div>
              {successInfo.boarTag && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Boar</span>
                  <span className="font-bold text-slate-800">#{successInfo.boarTag}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Breeding Date</span>
                <span className="font-bold text-slate-800">{formatDisplayDate(successInfo.breedingDate)}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2.5 mt-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Expected Farrowing</span>
                <span className="font-bold text-emerald-700">{formatDisplayDate(successInfo.expectedFarrowing)}</span>
              </div>
            </div>

            <div className="pt-1 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
