import React, { useState, useEffect, useRef, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Calendar, Weight, Home, Activity, Ruler, Loader2, AlertCircle, PlusCircle, Baby, Hash, Shuffle, CheckCircle2 } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
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

export default function EditPigModal({ isOpen, onClose, onSave, pigData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const isBatch = pigData?.category === 'Piglet Batch' || Boolean(pigData?.batch_tag) || (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  // Data states for combo boxes
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Full record detail
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Breed dropdown logic
  const [breedOpen, setBreedOpen] = useState(false);
  const breedWrapRef = useRef(null);

  // 1. Fetch the full pig record and initialize the form from it
  useEffect(() => {
    if (!isOpen || !pigData) return;

    let cancelled = false;
    const loadDetail = async () => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await fetch(`${API_BASE}/api/pigs/${pigData.id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load record (status ${res.status})`);
        if (cancelled) return;
        setForm(toFormState(body.data || {}));
        setErrors({});
        setSubmitError(null);
      } catch (err) {
        if (!cancelled) setDetailError(err.message || 'Failed to load this record.');
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    };

    loadDetail();
    return () => { cancelled = true; };
  }, [isOpen, pigData]);

  useEffect(() => {
    if (!isOpen) {
      setSaveSuccess(false);
      setSuccessInfo(null);
    }
  }, [isOpen]);

  // 2. Fetch dependencies (Pens/Breeds)
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoadingData(true);
        try {
          const [pensRes, breedsRes] = await Promise.all([
            fetch(`${API_BASE}/api/pens`),
            fetch(`${API_BASE}/api/breeds`)
          ]);
          const p = await pensRes.json();
          const b = await breedsRes.json();
          setPens(p.data || []);
          setBreeds(b.data || []);
        } catch (err) {
          console.error("Error loading edit form data:", err);
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // Outside click for breed dropdown
  useEffect(() => {
    const handler = (e) => {
      if (breedWrapRef.current && !breedWrapRef.current.contains(e.target)) setBreedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!shouldRender) return null;

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.tagNumber?.trim()) next.tagNumber = 'Tag is required';
    if (!form.breed?.trim()) next.breed = 'Breed is required';
    if (!form.penId) next.penId = 'Select a pen';
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
        parityCount: pigData.category === 'Sow' ? Number(form.parityCount) : undefined,
        totalBornAlive: isBatch ? Number(form.totalBornAlive) || 0 : undefined,
        stillbornCount: isBatch ? Number(form.stillbornCount) || 0 : undefined,
        mummyCount: isBatch ? Number(form.mummyCount) || 0 : undefined,
        category: pigData.category,
        isBatch,
      });
      setSuccessInfo({
        type: isBatch ? 'Piglet Batch' : pigData.category || 'Swine',
        tag: form.tagNumber || pigData.pig_tag || pigData.batch_tag || pigData.id,
        message: isBatch
          ? `Piglet Batch #${form.tagNumber} has been successfully updated.`
          : `Swine #${form.tagNumber} has been successfully updated.`
      });
      setSaveSuccess(true);
      toast.success(isBatch ? `Batch #${form.tagNumber} updated successfully!` : `Swine #${form.tagNumber} updated successfully!`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to update record.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-955 bg-rose-50/10";

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        style={{ willChange: 'transform, opacity, max-width' }}
        className={`w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative transition-[max-width] duration-300 ease-in-out ${
          saveSuccess ? 'max-w-md' : isBatch ? 'max-w-3xl' : 'max-w-2xl'
        } ${panelClassName}`}
      >
        
        {/* Header */}
        {!saveSuccess && (
          <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <PlusCircle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit {isBatch ? 'Piglet Batch' : 'Swine Record'}</h3>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">#{pigData.pig_tag || pigData.batch_tag || pigData.id}</p>
              </div>
            </div>
            <button onClick={() => requestClose()} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}

        {saveSuccess ? (
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
        ) : isLoadingDetail ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-emerald-600" />
            <p className="text-xs font-semibold">Loading record details…</p>
          </div>
        ) : detailError ? (
          <div className="p-8 pt-6 space-y-4 text-left">
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-500" />
              <span>{detailError}</span>
            </div>
            <button type="button" onClick={() => requestClose()} className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors">
              Close
            </button>
          </div>
        ) : isBatch ? (
          <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-5 text-left max-h-[80vh] overflow-y-auto">
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
                  <input
                    type="text"
                    value={form.breed ?? ''}
                    onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }}
                    onFocus={() => setBreedOpen(true)}
                    className={`${inputBase} ${errors.breed ? inputErr : inputOk}`}
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
              <Field label="Average Weight (kg)" icon={<Weight />}>
                <input type="number" step="0.1" value={form.weight ?? ''} onChange={handleChange('weight')} className={`${inputBase} ${inputOk}`} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                  <option value="">Select Pen</option>
                  {pens.map(p => (
                     <option key={p.id} value={p.id}>
                       {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                     </option>
                  ))}
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
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Baby size={12} />
                </span>
                Batch Counts & Survivability
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Total Born Alive" icon={<Baby />}>
                  <input
                    type="number"
                    min="0"
                    value={form.totalBornAlive ?? ''}
                    onChange={handleChange('totalBornAlive')}
                    className={`${inputBase} ${inputOk}`}
                  />
                </Field>
                <Field label="Stillborn Count" icon={<Hash />}>
                  <input
                    type="number"
                    min="0"
                    value={form.stillbornCount ?? ''}
                    onChange={handleChange('stillbornCount')}
                    className={`${inputBase} ${inputOk}`}
                  />
                </Field>
                <Field label="Mummy Count" icon={<Shuffle />}>
                  <input
                    type="number"
                    min="0"
                    value={form.mummyCount ?? ''}
                    onChange={handleChange('mummyCount')}
                    className={`${inputBase} ${inputOk}`}
                  />
                </Field>
              </div>

              {/* Survivability Summary */}
              {(() => {
                const bornAlive = Number(form.totalBornAlive) || 0;
                const totalLoss = (Number(form.stillbornCount) || 0) + (Number(form.mummyCount) || 0);
                const totalFarrowed = bornAlive + totalLoss;
                const survivability = totalFarrowed > 0 ? Math.round((bornAlive / totalFarrowed) * 100) : 0;
                return (
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Survivability Rate</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {bornAlive} born alive of {totalFarrowed} total farrowed
                      </p>
                    </div>
                    <span className="text-lg font-black text-emerald-600 bg-white px-3.5 py-1 rounded-xl shadow-sm border border-emerald-100">
                      {survivability}%
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => requestClose()} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Batch Record'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4 text-left max-h-[80vh] overflow-y-auto">
            {submitError && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-500" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Tag and DOB */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tag Number" error={errors.tagNumber} icon={<Tag />}>
                <input type="text" value={form.tagNumber ?? ''} onChange={handleChange('tagNumber')} className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
              </Field>
              <Field label="Date of Birth" icon={<Calendar />}>
                <input type="date" value={form.dateOfBirth ?? ''} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${inputOk}`} />
              </Field>
            </div>

            {/* Breed and Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative" ref={breedWrapRef}>
                <Field label="Breed" error={errors.breed} icon={<PlusCircle />}>
                  <input
                    type="text"
                    value={form.breed ?? ''}
                    onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }}
                    onFocus={() => setBreedOpen(true)}
                    className={`${inputBase} ${errors.breed ? inputErr : inputOk}`}
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
              <Field label="Weight (kg)" icon={<Weight />}>
                <input type="number" step="0.1" value={form.weight ?? ''} onChange={handleChange('weight')} className={`${inputBase} ${inputOk}`} />
              </Field>
            </div>

            {/* Pen and Status */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                  <option value="">Select Pen</option>
                  {pens.map(p => (
                     <option key={p.id} value={p.id}>
                       {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                     </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" icon={<Activity />}>
                <select value={form.status ?? 'Healthy'} onChange={handleChange('status')} className={`${inputBase} ${inputOk} appearance-none`}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {pigData.category === 'Sow' && (
              <Field label="Parity Count" icon={<Ruler />}>
                <input type="number" value={form.parityCount ?? ''} onChange={handleChange('parityCount')} className={`${inputBase} ${inputOk}`} />
              </Field>
            )}

            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => requestClose()} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Record'}
              </button>
            </div>
          </form>
        )}
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