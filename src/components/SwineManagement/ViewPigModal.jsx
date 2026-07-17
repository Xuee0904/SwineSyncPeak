import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, PiggyBank, Layers, Calendar, MapPin, Activity, 
  Scale, Tag, Award, Edit2, Archive, HeartPulse, 
  Loader2, AlertCircle, ChevronRight, CheckCircle2,
  PlusCircle, Home, Weight, Baby, Hash, Shuffle, Ruler, ArrowLeft
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import StatusBadge from '../../components/StatusBadge';
import toast from '../../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Inactive'];
const BATCH_STATUS_OPTIONS = ['Suckling', 'Weaned', 'Nursery', 'Fattening', 'Quarantine', 'Archived'];

function toFormState(fullPig) {
  const isBatch = fullPig.category === 'Piglet Batch' || Boolean(fullPig.batch_tag) || (typeof fullPig.pig_tag === 'string' && fullPig.pig_tag.startsWith('BATCH'));
  return {
    tagNumber: fullPig.batch_tag || fullPig.pig_tag || '',
    dateOfBirth: fullPig.date_of_birth ? String(fullPig.date_of_birth).slice(0, 10) : '',
    breed: fullPig.breed || '',
    weight: fullPig.average_weight ?? fullPig.current_weight ?? fullPig.weight ?? '',
    penId: fullPig.pen_id || '',
    status: fullPig.status
      ? (fullPig.status.charAt(0).toUpperCase() + fullPig.status.slice(1))
      : (isBatch ? 'Suckling' : 'Healthy'),
    parityCount: fullPig.parity_count ?? '',
    totalBornAlive: fullPig.total_born_alive !== undefined && fullPig.total_born_alive !== null ? fullPig.total_born_alive : '',
    stillbornCount: fullPig.stillborn_count !== undefined && fullPig.stillborn_count !== null ? fullPig.stillborn_count : 0,
    mummyCount: fullPig.mummy_count !== undefined && fullPig.mummy_count !== null ? fullPig.mummy_count : 0,
  };
}

export default function ViewPigModal({ isOpen, onClose, onSave, onArchive, pigData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  // mode: 'view' | 'edit' | 'success'
  const [mode, setMode] = useState('view');

  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Edit form state
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // Edit dependencies
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const breedWrapRef = useRef(null);

  const isBatch = pigData?.category === 'Piglet Batch' || 
    Boolean(pigData?.batch_tag) || 
    (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('view');
      setSuccessInfo(null);
      setSubmitError(null);
      setErrors({});
    }
  }, [isOpen]);

  const changeMode = useCallback((nextMode, dataToForm = null) => {
    if (nextMode === 'edit' && dataToForm) {
      setForm(toFormState(dataToForm));
      setErrors({});
      setSubmitError(null);
    }
    setMode(nextMode);
  }, []);

  // 1. Fetch detail when opened
  useEffect(() => {
    if (!isOpen || !pigData) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/pigs/${pigData.id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load details (status ${res.status})`);
        if (cancelled) return;
        setDetail(body.data || pigData);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not fetch full details.');
          setDetail(pigData);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => { cancelled = true; };
  }, [isOpen, pigData]);

  // 2. Fetch pens & breeds when switching to edit mode
  useEffect(() => {
    if (mode !== 'edit') return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, breedsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens/available`).then(r => r.json()),
          fetch(`${API_BASE}/api/breeds`).then(r => r.json()),
        ]);
        if (!cancelled) {
          setPens(pensRes.data ?? []);
          setBreeds(breedsRes.data ?? []);
        }
      } catch { /* fail silently */ }
      finally { if (!cancelled) setIsLoadingData(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [mode]);

  // Close breed dropdown on outside click
  useEffect(() => {
    if (!breedOpen) return;
    const handler = (e) => { if (breedWrapRef.current && !breedWrapRef.current.contains(e.target)) setBreedOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [breedOpen]);

  if (!shouldRender || !pigData) return null;

  // Derive display metrics
  const data = detail || pigData;
  const tag = data.pig_tag || data.batch_tag || data.id || '—';
  const breed = data.breed || '—';
  const weight = data.current_weight ?? data.average_weight ?? data.weight ?? null;
  const status = data.status || (isBatch ? 'suckling' : 'healthy');
  const penCode = data.pen_code || '';
  const dob = data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : null;
  
  let ageWeeks = data.age_weeks;
  if (dob) ageWeeks = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 7));
  if (ageWeeks === undefined || ageWeeks === null || ageWeeks === '—') ageWeeks = '—';
  else ageWeeks = `${ageWeeks} weeks`;

  const totalBornAlive = Number(data.total_born_alive || 0);
  const stillbornCount = Number(data.stillborn_count || 0);
  const mummyCount = Number(data.mummy_count || 0);
  const currentCount = Number(data.current_count ?? totalBornAlive);
  const totalBorn = totalBornAlive + stillbornCount + mummyCount;
  const survivability = totalBorn > 0 ? ((totalBornAlive / totalBorn) * 100).toFixed(1) : null;

  // Edit helpers
  const handleChange = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  
  const switchToEdit = () => {
    changeMode('edit', data);
  };

  const validate = () => {
    const next = {};
    if (!form.tagNumber?.trim()) next.tagNumber = 'Required';
    if (!form.breed?.trim()) next.breed = 'Required';
    if (!form.penId) next.penId = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setSubmitError(null);
    try {
      await onSave?.(pigData.id, {
        ...form,
        weight: form.weight ? Number(form.weight) : null,
        averageWeight: form.weight ? Number(form.weight) : null,
        parityCount: data.category === 'Sow' ? Number(form.parityCount) : undefined,
        totalBornAlive: isBatch ? Number(form.totalBornAlive) || 0 : undefined,
        stillbornCount: isBatch ? Number(form.stillbornCount) || 0 : undefined,
        mummyCount: isBatch ? Number(form.mummyCount) || 0 : undefined,
        category: data.category || pigData.category,
        isBatch,
      });
      setSuccessInfo({
        type: isBatch ? 'Piglet Batch' : data.category || 'Swine',
        tag: form.tagNumber || tag,
        message: isBatch
          ? `Piglet Batch #${form.tagNumber} has been successfully updated.`
          : `Swine #${form.tagNumber} has been successfully updated.`
      });
      changeMode('success');
      toast.success(isBatch ? `Batch #${form.tagNumber} updated!` : `Swine #${form.tagNumber} updated!`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to update record.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-900 bg-rose-50/10";

  // Width class based on mode (view is max-w-xl so that edit at max-w-2xl/3xl smoothly widens out!)
  const maxWidthClass = mode === 'view' ? 'max-w-xl' : mode === 'edit' ? (isBatch ? 'max-w-3xl' : 'max-w-2xl') : 'max-w-md';

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-40 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 transition-opacity duration-300 ${overlayClassName}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        style={{ willChange: 'transform, opacity, max-width' }}
        className={`w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative transition-[max-width] duration-300 ease-in-out ${maxWidthClass} ${panelClassName}`}
      >
        <div className="flex flex-col w-full animate-in fade-in duration-300">

        {/* ──── SUCCESS VIEW ──── */}
        {mode === 'success' ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                {successInfo?.type || 'Record'} Updated
              </span>
              <h4 className="text-xl font-black text-slate-900">
                {successInfo?.type || 'Record'} #{successInfo?.tag} Saved!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {successInfo?.message || 'The record has been updated and synced to your database.'}
              </p>
            </div>
            <div className="pt-2 w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => requestClose()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Done & Close
              </button>
            </div>
          </div>

        /* ──── EDIT VIEW ──── */
        ) : mode === 'edit' ? (
          <>
            {/* Edit Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100/60">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => changeMode('view')}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                  title="Back to details"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit {isBatch ? 'Piglet Batch' : 'Swine Record'}</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">#{tag}</p>
                </div>
              </div>
              <button onClick={() => requestClose()} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {isLoadingData ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs font-semibold">Loading form data…</p>
              </div>
            ) : isBatch ? (
              /* Batch Edit Form */
              <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5 text-left max-h-[70vh] overflow-y-auto animate-in fade-in duration-300">
                {submitError && (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-500" />
                    <span>{submitError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Batch Tag ID" error={errors.tagNumber} icon={<Tag />}>
                    <input type="text" value={form.tagNumber ?? ''} onChange={handleChange('tagNumber')} className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
                  </Field>
                  <Field label="Date of Birth" icon={<Calendar />}>
                    <input type="date" value={form.dateOfBirth ?? ''} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative" ref={breedWrapRef}>
                    <Field label="Breed" error={errors.breed} icon={<PlusCircle />}>
                      <input type="text" value={form.breed ?? ''} onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }} onFocus={() => setBreedOpen(true)} className={`${inputBase} ${errors.breed ? inputErr : inputOk}`} autoComplete="off" />
                    </Field>
                    {breedOpen && breeds.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {breeds.filter(b => b.name.toLowerCase().includes((form.breed || '').toLowerCase())).map(b => (
                          <li key={b.breed_id} onClick={() => { setForm(p => ({...p, breed: b.name})); setBreedOpen(false); }} className="cursor-pointer px-4 py-2 text-xs hover:bg-emerald-50">{b.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Field label="Average Weight (kg)" icon={<Weight />}>
                    <input type="number" step="0.1" value={form.weight ?? ''} onChange={handleChange('weight')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                    <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                      <option value="">Select Pen</option>
                      {pens.map(p => (<option key={p.id} value={p.id}>{p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}</option>))}
                    </select>
                  </Field>
                  <Field label="Status" icon={<Activity />}>
                    <select value={form.status ?? 'Suckling'} onChange={handleChange('status')} className={`${inputBase} ${inputOk} appearance-none`}>
                      {BATCH_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                {/* Batch Counts & Survivability */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Baby size={12} /></span>
                    Batch Counts & Survivability
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Total Born Alive" icon={<Baby />}>
                      <input type="number" min="0" value={form.totalBornAlive ?? ''} onChange={handleChange('totalBornAlive')} className={`${inputBase} ${inputOk}`} />
                    </Field>
                    <Field label="Stillborn Count" icon={<Hash />}>
                      <input type="number" min="0" value={form.stillbornCount ?? ''} onChange={handleChange('stillbornCount')} className={`${inputBase} ${inputOk}`} />
                    </Field>
                    <Field label="Mummy Count" icon={<Shuffle />}>
                      <input type="number" min="0" value={form.mummyCount ?? ''} onChange={handleChange('mummyCount')} className={`${inputBase} ${inputOk}`} />
                    </Field>
                  </div>
                  {(() => {
                    const bornAlive = Number(form.totalBornAlive) || 0;
                    const totalLoss = (Number(form.stillbornCount) || 0) + (Number(form.mummyCount) || 0);
                    const totalFarrowed = bornAlive + totalLoss;
                    const surv = totalFarrowed > 0 ? Math.round((bornAlive / totalFarrowed) * 100) : 0;
                    return (
                      <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Survivability Rate</p>
                          <p className="text-xs text-slate-500 mt-0.5">{bornAlive} born alive of {totalFarrowed} total farrowed</p>
                        </div>
                        <span className="text-lg font-black text-emerald-600 bg-white px-3.5 py-1 rounded-xl shadow-sm border border-emerald-100">{surv}%</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setMode('view')} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Batch Record'}
                  </button>
                </div>
              </form>
            ) : (
              /* Standard Pig Edit Form */
              <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4 text-left max-h-[70vh] overflow-y-auto animate-in fade-in duration-300">
                {submitError && (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-500" />
                    <span>{submitError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tag Number" error={errors.tagNumber} icon={<Tag />}>
                    <input type="text" value={form.tagNumber ?? ''} onChange={handleChange('tagNumber')} className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
                  </Field>
                  <Field label="Date of Birth" icon={<Calendar />}>
                    <input type="date" value={form.dateOfBirth ?? ''} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative" ref={breedWrapRef}>
                    <Field label="Breed" error={errors.breed} icon={<PlusCircle />}>
                      <input type="text" value={form.breed ?? ''} onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }} onFocus={() => setBreedOpen(true)} className={`${inputBase} ${errors.breed ? inputErr : inputOk}`} autoComplete="off" />
                    </Field>
                    {breedOpen && breeds.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                        {breeds.filter(b => b.name.toLowerCase().includes((form.breed || '').toLowerCase())).map(b => (
                          <li key={b.breed_id} onClick={() => { setForm(p => ({...p, breed: b.name})); setBreedOpen(false); }} className="cursor-pointer px-4 py-2 text-xs hover:bg-emerald-50">{b.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Field label="Weight (kg)" icon={<Weight />}>
                    <input type="number" step="0.1" value={form.weight ?? ''} onChange={handleChange('weight')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                    <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                      <option value="">Select Pen</option>
                      {pens.map(p => (<option key={p.id} value={p.id}>{p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}</option>))}
                    </select>
                  </Field>
                  <Field label="Status" icon={<Activity />}>
                    <select value={form.status ?? 'Healthy'} onChange={handleChange('status')} className={`${inputBase} ${inputOk} appearance-none`}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                {data.category === 'Sow' && (
                  <Field label="Parity Count" icon={<Ruler />}>
                    <input type="number" value={form.parityCount ?? ''} onChange={handleChange('parityCount')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                )}
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setMode('view')} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Record'}
                  </button>
                </div>
              </form>
            )}
          </>

        /* ──── VIEW MODE ──── */
        ) : (
          <>
            {/* View Header */}
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                  isBatch 
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/20' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                }`}>
                  {isBatch ? <Layers className="w-7 h-7 text-white" /> : <PiggyBank className="w-7 h-7 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {isBatch ? 'Piglet Batch' : (data.category || 'Swine Record')}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mt-1 text-white">#{tag}</h2>
                  {dob && (
                    <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Date of Birth: <span className="font-semibold text-white">{dob}</span> ({ageWeeks})
                    </p>
                  )}
                </div>
              </div>
              <button onClick={requestClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer" title="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6 bg-slate-50/50 animate-in fade-in duration-300">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-500">Loading detailed swine record...</p>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" /> Core Specifications
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Tag className="w-3.5 h-3.5 text-indigo-500" /> Breed</span>
                        <span className="text-base font-extrabold text-slate-800 truncate" title={breed}>{breed}</span>
                      </div>
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5 text-amber-500" /> {isBatch ? 'Avg Weight' : 'Weight'}</span>
                        <span className="text-base font-extrabold text-slate-800">{weight != null ? `${Number(weight).toFixed(1)} kg` : '—'}</span>
                      </div>
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><MapPin className="w-3.5 h-3.5 text-rose-500" /> Pen Location</span>
                        <span className="text-base font-extrabold text-slate-800">{penCode ? penCode : 'Unassigned'}</span>
                      </div>
                      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Calendar className="w-3.5 h-3.5 text-emerald-500" /> Age</span>
                        <span className="text-base font-extrabold text-slate-800">{ageWeeks}</span>
                      </div>
                    </div>
                  </div>

                  {isBatch ? (
                    <div className="bg-gradient-to-br from-white to-amber-50/30 rounded-2xl p-5 border border-amber-200/60 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <HeartPulse className="w-4 h-4 text-amber-600" /> Batch Vitals & Survivability Snapshot
                        </h3>
                        {survivability && (
                          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                            Number(survivability) >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : Number(survivability) >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>{survivability}% Survivability</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Born Alive</span>
                          <span className="text-lg font-black text-emerald-600 mt-0.5 block">{totalBornAlive}</span>
                        </div>
                        <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Head Count</span>
                          <span className="text-lg font-black text-indigo-600 mt-0.5 block">{currentCount}</span>
                        </div>
                        <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stillborn</span>
                          <span className="text-lg font-black text-slate-700 mt-0.5 block">{stillbornCount}</span>
                        </div>
                        <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mummies</span>
                          <span className="text-lg font-black text-rose-600 mt-0.5 block">{mummyCount}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                          <Award className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Parity & Production History</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {data.category === 'Sow'
                              ? `Total Parity Count: ${data.parity_count !== undefined && data.parity_count !== '' ? data.parity_count : 0} litters farrowed.`
                              : 'Active Breeding Boar assigned to breeding logs.'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                        {data.category === 'Sow' ? `Parity #${data.parity_count ?? 0}` : 'Active Boar'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* View Footer */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200/80 flex items-center justify-between gap-3">
              <button type="button" onClick={requestClose} className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer">Close</button>
              <div className="flex items-center gap-2.5">
                {onArchive && (
                  <button type="button" onClick={() => { requestClose(() => onArchive(data)); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 transition-all cursor-pointer">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                )}
                <button type="button" onClick={switchToEdit} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5" /> Edit Record <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        </div>{/* end contentRef */}
      </div>
    </div>,
    document.body
  );
}

function Field({ label, error, icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
          {icon && React.cloneElement(icon, { size: 14 })}
        </span>
        {children}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-rose-600 font-semibold mt-1">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}
