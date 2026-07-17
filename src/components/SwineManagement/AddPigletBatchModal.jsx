import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, PackagePlus, Loader2, Tag, Calendar, Home, Heart,
  AlertCircle, Baby, Weight, Activity, PlusCircle, Hash,
  Shuffle, BarChart2, Users, Bookmark, ChevronLeft,
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useFormDraft from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SOURCE_OPTIONS = [
  { value: 'born_in_farm',  label: 'Born in Farm',  hint: 'Internal breeding cycle' },
  { value: 'purchased',     label: 'Purchased',      hint: 'External supplier acquisition' },
  { value: 'transferred',   label: 'Transferred',    hint: 'Moved from another facility' },
];

const STATUS_OPTIONS = ['suckling', 'weaned', 'healthy', 'sick', 'quarantine'];

const EMPTY_FORM = {
  batchTag:       '',
  sowId:          '',
  penId:          '',
  dateOfBirth:    '',
  breed:          '',
  sourceOrigin:   'born_in_farm',
  totalBornAlive: '',
  currentCount:   '',
  stillbornCount: '0',
  mummyCount:     '0',
  averageWeight:  '',
  status:         'suckling',
};

function generateBatchTag() {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `BTC-${now.getFullYear()}-${month}-${suffix}`;
}

export function AddPigletBatchForm({
  isOpen = true,
  onClose,
  onBack,
  onSave,
  pens: propPens,
  breeds: propBreeds,
}) {
  const {
    form,
    setForm,
    resetForm,
    hasDraft,
    draftInfo,
    saveDraft,
    restoreDraft,
    clearDraft,
    checkDraft,
    isOffline,
  } = useFormDraft('swinesync_draft_add_piglet_batch', () => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }));
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Dropdown data
  const [pensState, setPens]   = useState([]);
  const [sows, setSows]        = useState([]);
  const [breedsState, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const pens = propPens || pensState;
  const breeds = propBreeds || breedsState;

  // Breed combo-box
  const [breedOpen, setBreedOpen] = useState(false);
  const breedWrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (breedWrapRef.current && !breedWrapRef.current.contains(e.target)) setBreedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    Promise.resolve().then(() => {
      checkDraft();
      setErrors({});
      setSubmitError(null);
      resetForm(() => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }));
    });

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, sowsRes, breedsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens/available`),
          fetch(`${API_BASE}/api/sows`),
          fetch(`${API_BASE}/api/breeds`),
        ]);
        const [pensData, sowsData, breedsData] = await Promise.all([
          pensRes.json(), sowsRes.json(), breedsRes.json(),
        ]);
        setPens(pensData.data   || []);
        setSows(sowsData.data   || []);
        setBreeds(breedsData.data || []);
      } catch (err) {
        console.error('Error loading batch form data:', err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [isOpen, checkDraft, resetForm]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // Auto-sync currentCount from totalBornAlive if not yet manually set
  const handleBornAliveChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      totalBornAlive: val,
      currentCount: prev.currentCount === '' || prev.currentCount === prev.totalBornAlive ? val : prev.currentCount,
    }));
    if (errors.totalBornAlive) setErrors(prev => ({ ...prev, totalBornAlive: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.batchTag.trim())    next.batchTag    = 'Batch tag is required';
    if (!form.penId)              next.penId       = 'Select a pen';
    if (!form.dateOfBirth)        next.dateOfBirth = 'Date of birth is required';
    if (!form.totalBornAlive || Number(form.totalBornAlive) <= 0)
      next.totalBornAlive = 'Enter at least 1 piglet born alive';
    if (!form.currentCount || Number(form.currentCount) <= 0)
      next.currentCount = 'Current count is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAndClose = () => {
    resetForm(() => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }));
    setErrors({});
    setIsSaving(false);
    setSubmitError(null);
    setBreedOpen(false);
    onClose?.();
  };

  const handleRestoreDraft = () => {
    restoreDraft();
  };

  const handleDiscardDraft = () => {
    clearDraft();
    resetForm(() => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setSubmitError(null);
    try {
      await onSave?.({
        batchTag:       form.batchTag.trim(),
        sowId:          form.sowId      || null,
        penId:          form.penId      || null,
        dateOfBirth:    form.dateOfBirth || null,
        breed:          form.breed.trim() || null,
        sourceOrigin:   form.sourceOrigin,
        totalBornAlive: Number(form.totalBornAlive) || 0,
        currentCount:   Number(form.currentCount)   || 0,
        stillbornCount: Number(form.stillbornCount) || 0,
        mummyCount:     Number(form.mummyCount)     || 0,
        averageWeight:  form.averageWeight ? Number(form.averageWeight) : null,
        status:         form.status,
      });
      clearDraft();
      resetAndClose();
    } catch (err) {
      if (isOffline || err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        saveDraft(form);
      }
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Snapshot totals
  const totalLoss = (Number(form.stillbornCount) || 0) + (Number(form.mummyCount) || 0);
  const survivability = form.totalBornAlive
    ? Math.round((Number(form.currentCount || 0) / Number(form.totalBornAlive)) * 100)
    : 0;

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk  = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-rose-50/10 text-slate-900";

  return (
    <div className="flex max-h-[90vh] w-full flex-col bg-white overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mr-1 -ml-2 p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-400 cursor-pointer"
              title="Back to record type selection"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <PackagePlus size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Piglet Batch</h3>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">New Batch Record</p>
          </div>
        </div>
        <button type="button" onClick={resetAndClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

        {/* ── Body ── */}
        <form
          id="batch-form"
          onSubmit={handleSubmit}
          className="flex flex-1 min-h-0 overflow-hidden"
        >
          {/* Left: main form */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            <DraftBanner
              hasDraft={hasDraft}
              draftInfo={draftInfo}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              isOffline={isOffline}
            />

            {submitError && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* ── Section 1: Batch Identity ── */}
            <Section step="1" title="Batch Identity">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Batch Tag" error={errors.batchTag} icon={<Tag />}>
                  <input type="text" value={form.batchTag} onChange={handleChange('batchTag')} placeholder="BTC-2026-MAY-####" className={`${inputBase} ${errors.batchTag ? inputErr : inputOk}`} />
                </Field>

                <Field label="Pen Assignment" error={errors.penId} icon={<Home />}>
                  <select value={form.penId} onChange={handleChange('penId')} disabled={isLoadingData} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                    <option value="">{isLoadingData ? 'Loading…' : 'Select Pen'}</option>
                    {pens.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Date of Birth" error={errors.dateOfBirth} icon={<Calendar />}>
                  <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${errors.dateOfBirth ? inputErr : inputOk}`} />
                </Field>

                <Field label="Mother Sow (optional)" icon={<Heart />}>
                  <select value={form.sowId} onChange={handleChange('sowId')} disabled={isLoadingData} className={`${inputBase} ${inputOk} appearance-none`}>
                    <option value="">{isLoadingData ? 'Loading…' : 'None / Unknown'}</option>
                    {sows.map(s => (
                      <option key={s.id} value={s.id}>#{s.tag} — {s.breed}</option>
                    ))}
                  </select>
                </Field>

                {/* Breed combo-box */}
                <div className="relative" ref={breedWrapRef}>
                  <Field label="Breed" icon={<PlusCircle />}>
                    <input
                      type="text"
                      value={form.breed}
                      onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }}
                      onFocus={() => setBreedOpen(true)}
                      placeholder={isLoadingData ? 'Loading…' : 'Select or type a breed'}
                      disabled={isLoadingData}
                      className={`${inputBase} ${inputOk}`}
                      autoComplete="off"
                    />
                  </Field>
                  {breedOpen && !isLoadingData && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {breeds.filter(b => b.name.toLowerCase().includes((form.breed || '').toLowerCase())).map(b => (
                        <li key={b.breed_id} onClick={() => { setForm(p => ({...p, breed: b.name})); setBreedOpen(false); }} className="cursor-pointer px-4 py-2 text-xs hover:bg-emerald-50">{b.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <Field label="Status" icon={<Activity />}>
                  <select value={form.status} onChange={handleChange('status')} className={`${inputBase} ${inputOk} appearance-none`}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </Field>
              </div>

              {/* Source Origin */}
              <div className="mt-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Source Origin</p>
                <div className="grid grid-cols-3 gap-3">
                  {SOURCE_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-3 text-xs transition-all ${form.sourceOrigin === opt.value ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <input type="radio" name="sourceOrigin" value={opt.value} checked={form.sourceOrigin === opt.value} onChange={handleChange('sourceOrigin')} className="accent-emerald-600" />
                        {opt.label}
                      </span>
                      <span className="pl-5 text-[10px] text-slate-400">{opt.hint}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── Section 2: Count & Vitals ── */}
            <Section step="2" title="Count & Vitals">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Total Born Alive" error={errors.totalBornAlive} icon={<Baby />}>
                  <input type="number" min="0" value={form.totalBornAlive} onChange={handleBornAliveChange} placeholder="0" className={`${inputBase} ${errors.totalBornAlive ? inputErr : inputOk}`} />
                </Field>

                <Field label="Current Count" error={errors.currentCount} icon={<Users />}>
                  <input type="number" min="0" value={form.currentCount} onChange={handleChange('currentCount')} placeholder="0" className={`${inputBase} ${errors.currentCount ? inputErr : inputOk}`} />
                </Field>

                <Field label="Stillborn Count" icon={<Hash />}>
                  <input type="number" min="0" value={form.stillbornCount} onChange={handleChange('stillbornCount')} placeholder="0" className={`${inputBase} ${inputOk}`} />
                </Field>

                <Field label="Mummy Count" icon={<Shuffle />}>
                  <input type="number" min="0" value={form.mummyCount} onChange={handleChange('mummyCount')} placeholder="0" className={`${inputBase} ${inputOk}`} />
                </Field>

                <Field label="Average Weight (kg)" icon={<Weight />}>
                  <input type="number" min="0" step="0.01" value={form.averageWeight} onChange={handleChange('averageWeight')} placeholder="0.0" className={`${inputBase} ${inputOk}`} />
                </Field>
              </div>
            </Section>
          </div>

          {/* Right: live snapshot sidebar */}
          <aside className="w-64 shrink-0 border-l border-slate-100 bg-slate-50/60 flex flex-col gap-5 px-5 py-6 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch Snapshot</p>

            {/* Big count display */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 text-center">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Current Count</p>
              <p className="text-4xl font-black text-slate-900 mt-1">{Number(form.currentCount) || 0}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">of {Number(form.totalBornAlive) || 0} born alive</p>
            </div>

            <div className="space-y-2">
              <SnapshotRow label="Stillborn" value={Number(form.stillbornCount) || 0} tone="rose" icon={<Hash size={12} />} />
              <SnapshotRow label="Mummies"   value={Number(form.mummyCount) || 0}     tone="amber" icon={<Shuffle size={12} />} />
              <SnapshotRow label="Total Loss" value={totalLoss}                         tone="rose" icon={<BarChart2 size={12} />} />
            </div>

            {/* Survivability bar */}
            <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Survivability</p>
                <p className="text-xs font-black text-emerald-600">{survivability}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${survivability}%` }}
                />
              </div>
            </div>

            {/* Source badge */}
            <div className="rounded-xl bg-white border border-slate-100 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source</p>
              <p className="text-xs font-semibold text-slate-700">
                {SOURCE_OPTIONS.find(o => o.value === form.sourceOrigin)?.label || '—'}
              </p>
            </div>

            <div className="mt-auto pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setForm({ ...EMPTY_FORM, batchTag: generateBatchTag() });
                  setErrors({});
                  setSubmitError(null);
                }}
                className="w-full py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Reset Form
              </button>
            </div>
          </aside>
        </form>

        {/* ── Footer ── */}
        <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetAndClose} className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                saveDraft(form);
                resetAndClose();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              title="Save current inputs as a draft and close"
            >
              <Bookmark size={15} className="text-emerald-600" />
              Save Draft
            </button>
          </div>
          <button
            type="submit"
            form="batch-form"
            disabled={isSaving || isLoadingData}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Save Batch
          </button>
        </div>
      </div>
  );
}

export default function AddPigletBatchModal({ isOpen, onClose, onSave, pens, breeds }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  if (!shouldRender) return null;

  const handleModalClose = () => {
    requestClose(onClose);
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleModalClose(); }}
    >
      <div className={`flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden ${panelClassName}`}>
        <AddPigletBatchForm
          isOpen={isOpen}
          onClose={handleModalClose}
          onSave={onSave}
          pens={pens}
          breeds={breeds}
        />
      </div>
    </div>,
    document.body
  );
}

function Section({ step, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-[10px] font-black text-emerald-700">{step}</span>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function SnapshotRow({ label, value, tone, icon }) {
  const tones = {
    rose:  'text-rose-500  bg-rose-50',
    amber: 'text-amber-500 bg-amber-50',
  };
  return (
    <div className="flex items-center justify-between rounded-xl bg-white border border-slate-100 px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${tones[tone] || 'bg-slate-50 text-slate-400'}`}>{icon}</span>
        {label}
      </span>
      <span className="text-xs font-bold text-slate-700">{value}</span>
    </div>
  );
}

function Field({ label, error, icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
            {React.cloneElement(icon, { size: 14 })}
          </span>
        )}
        {children}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-rose-600 font-semibold">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}