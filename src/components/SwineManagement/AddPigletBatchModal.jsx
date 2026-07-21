import { useEffect, useRef, useState, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import {
  X, PackagePlus, Loader2, Tag, Calendar, Home, Heart,
  AlertCircle, Baby, Weight, Activity, PlusCircle, Hash,
  Shuffle, BarChart2, Bookmark, ChevronLeft, CheckCircle2, Users,
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useSmoothStepTransition from '../../hooks/useSmoothStepTransition';
import useFormDraft from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';
import toast from '../../utils/toast';

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
  supplierName:   '',
  arrivalDate:    '',
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
  autoRestore = false,
  onRestored,
  onClose,
  onBack,
  onSave,
  onSuccess,
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
  } = useFormDraft('swinesync_draft_add_piglet_batch', () => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }), { autoRestore, onRestored });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Dropdown data
  const [pensState, setPens]   = useState([]);
  const [sows, setSows]        = useState([]);
  const [breedsState, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const pens = pensState.length > 0 ? pensState : (propPens || []);
  const breeds = propBreeds || breedsState;

  const availablePensForBatch = pens.filter(p => {
    if (p.section === 'B' || p.section === 'BOAR') return false;

    let ageInDays = null;
    if (form.dateOfBirth) {
      ageInDays = Math.floor((new Date() - new Date(form.dateOfBirth)) / (1000 * 60 * 60 * 24));
    }
    const currentStatus = (form.status || '').toLowerCase();
    const isWeaned = currentStatus === 'weaned' || (currentStatus !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isNursing = currentStatus === 'suckling' || (currentStatus !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    if (isWeaned) {
      if (p.section !== 'W' && p.section !== 'WEANED') return false;
      return typeof p.remaining === 'number' ? (String(p.id) === String(form.penId) || p.remaining > 0) : true;
    }
    if (isNursing) {
      if (p.section !== 'S' && p.section !== 'SOW') return false;
      return true;
    }

    if (String(p.id) === String(form.penId)) return true;
    const selectedSow = sows.find(s => String(s.id) === String(form.sowId));
    if (selectedSow && selectedSow.penId && String(p.id) === String(selectedSow.penId)) {
      return true;
    }
    return typeof p.remaining === 'number' ? p.remaining > 0 : true;
  });

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
    setErrors({});
    setSubmitError(null);
    if (!autoRestore) {
      Promise.resolve().then(() => {
        checkDraft();
        resetForm(() => ({ ...EMPTY_FORM, batchTag: generateBatchTag() }));
      });
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, sowsRes, breedsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens`),
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
    setForm(prev => {
      const nextForm = { ...prev, [field]: value };
      let currentStatus = (nextForm.status || '').toLowerCase();

      if (field === 'dateOfBirth' && value) {
        const ageInDays = Math.floor((new Date() - new Date(value)) / (1000 * 60 * 60 * 24));
        if (ageInDays <= 28) {
          nextForm.status = 'suckling';
          currentStatus = 'suckling';
        } else if (ageInDays > 28) {
          nextForm.status = 'weaned';
          currentStatus = 'weaned';
        }
      } else if (field === 'status') {
        currentStatus = (value || '').toLowerCase();
      }

      const currentPen = pens.find(p => String(p.id) === String(nextForm.penId));
      if (currentStatus === 'weaned' && currentPen && (currentPen.section !== 'W' && currentPen.section !== 'WEANED')) {
        nextForm.penId = '';
      } else if (currentStatus === 'suckling' && currentPen && (currentPen.section !== 'S' && currentPen.section !== 'SOW')) {
        nextForm.penId = '';
      }

      return nextForm;
    });

    if (field === 'dateOfBirth') {
      if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: undefined }));
      if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
    } else if (field === 'status') {
      if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
      if (errors.penId) setErrors(prev => ({ ...prev, penId: undefined }));

      if (form.dateOfBirth) {
        const ageInDays = Math.floor((new Date() - new Date(form.dateOfBirth)) / (1000 * 60 * 60 * 24));
        const chosenStatus = (value || '').toLowerCase();
        if (chosenStatus === 'suckling' && ageInDays > 28) {
          setErrors(prev => ({
            ...prev,
            status: `Piglets > 28 days old (${ageInDays} days old) must be marked Weaned (or check birth date if still suckling)`
          }));
        } else if (chosenStatus === 'weaned' && ageInDays <= 28) {
          setErrors(prev => ({
            ...prev,
            status: `Piglets <= 28 days old (${ageInDays} days old) cannot be marked Weaned (must be Suckling or check birth date)`
          }));
        }
      }
    } else {
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSowChange = (e) => {
    const sowId = e.target.value;
    const selectedSow = sows.find(s => String(s.id) === String(sowId));
    setForm(prev => {
      const currentStatus = (prev.status || '').toLowerCase();
      const nextStatus = currentStatus === 'weaned' ? prev.status : (sowId ? 'suckling' : prev.status);
      const nextPenId = currentStatus === 'weaned' ? prev.penId : (selectedSow && selectedSow.penId ? selectedSow.penId : prev.penId);
      return {
        ...prev,
        sowId,
        status: nextStatus,
        penId: nextPenId,
      };
    });
    if (errors.sowId) setErrors(prev => ({ ...prev, sowId: undefined }));
    if (errors.penId && selectedSow && selectedSow.penId) setErrors(prev => ({ ...prev, penId: undefined }));
    if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
  };

  // Auto-sync currentCount from totalBornAlive right at batch creation
  const handleBornAliveChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      totalBornAlive: val,
      currentCount: val,
    }));
    if (errors.totalBornAlive) setErrors(prev => ({ ...prev, totalBornAlive: undefined }));
  };

  const validate = () => {
    const next = {};
    const today = new Date().toISOString().split('T')[0];
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 15);
    const minDobStr = minDate.toISOString().split('T')[0];

    if (!form.batchTag.trim())    next.batchTag    = 'Batch tag is required';
    if (!form.penId)              next.penId       = 'Select a pen';
    if (!form.dateOfBirth) {
      next.dateOfBirth = 'Date of birth is required';
    } else if (form.dateOfBirth > today) {
      next.dateOfBirth = 'Date of birth cannot be in the future';
    } else if (form.dateOfBirth < minDobStr) {
      next.dateOfBirth = 'Date of birth is too far in the past (max 15 years)';
    } else {
      const ageInDays = Math.floor((new Date() - new Date(form.dateOfBirth)) / (1000 * 60 * 60 * 24));
      const chosenStatus = (form.status || '').toLowerCase();
      if (ageInDays <= 28 && chosenStatus === 'weaned') {
        next.status = `Piglets <= 28 days old (${ageInDays} days old) cannot be marked Weaned (must be Suckling or check birth date)`;
      } else if (ageInDays > 28 && chosenStatus === 'suckling') {
        next.status = `Piglets > 28 days old (${ageInDays} days old) must be marked Weaned (or check birth date if still suckling)`;
      }
    }
    if (!form.totalBornAlive || Number(form.totalBornAlive) <= 0)
      next.totalBornAlive = 'Enter at least 1 piglet born alive';
    if (form.averageWeight) {
      const w = Number(form.averageWeight);
      if (isNaN(w)) next.averageWeight = 'Enter valid weight';
      else if (w < 0) next.averageWeight = 'Weight cannot be negative';
      else if (w > 500) next.averageWeight = 'Weight cannot exceed 500 kg';
    }

    if (form.penId && !next.penId) {
      const selectedPen = pens.find(p => String(p.id) === String(form.penId));
      const selectedSow = sows.find(s => String(s.id) === String(form.sowId));
      let ageInDays = null;
      if (form.dateOfBirth) {
        ageInDays = Math.floor((new Date() - new Date(form.dateOfBirth)) / (1000 * 60 * 60 * 24));
      }

      if (selectedPen) {
        if (selectedPen.section === 'B' || selectedPen.section === 'BOAR') {
          next.penId = 'Piglet batches cannot be assigned to a Boar pen';
        } else if (selectedSow && selectedSow.penId && String(selectedPen.id) !== String(selectedSow.penId)) {
          next.penId = `Must be assigned to Mother Sow #${selectedSow.tag}'s pen`;
        } else if (ageInDays !== null && ageInDays <= 28 && selectedPen.section !== 'S' && selectedPen.section !== 'SOW') {
          next.penId = 'Nursing piglets (<=28 days old) must be assigned to a Sow pen';
        } else if (ageInDays !== null && ageInDays > 28 && selectedPen.section !== 'W' && selectedPen.section !== 'WEANED') {
          next.penId = 'Weaned piglets (>28 days old) must be assigned to a Weaned pen';
        }
      }
    }

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
        supplierName:   form.supplierName || null,
        arrivalDate:    form.arrivalDate || null,
        totalBornAlive: Number(form.totalBornAlive) || 0,
        currentCount:   Number(form.totalBornAlive) || 0,
        stillbornCount: Number(form.stillbornCount) || 0,
        mummyCount:     Number(form.mummyCount)     || 0,
        averageWeight:  form.averageWeight ? Number(form.averageWeight) : null,
        status:         form.status,
      });
      clearDraft();
      toast.success('Batch Created', `Batch #${form.batchTag.trim()} created with ${Number(form.totalBornAlive) || 0} born alive.`);
      if (onSuccess) {
        onSuccess({
          type: 'Piglet Batch',
          tag: form.batchTag.trim(),
          message: `Piglet Batch #${form.batchTag.trim()} created with ${Number(form.totalBornAlive) || 0} born alive.`
        });
      } else {
        resetAndClose();
      }
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
  const totalFarrowed = (Number(form.totalBornAlive) || 0) + totalLoss;
  const survivability = totalFarrowed > 0
    ? Math.round(((Number(form.totalBornAlive) || 0) / totalFarrowed) * 100)
    : 0;

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk  = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-rose-50/10 text-slate-900";

  const todayStr = new Date().toISOString().split('T')[0];
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 15);
  const minDobStr = minDate.toISOString().split('T')[0];
  const isFutureDob = Boolean(form.dateOfBirth && form.dateOfBirth > todayStr);
  const isPastDob = Boolean(form.dateOfBirth && form.dateOfBirth < minDobStr);
  const isInvalidBornAlive = Boolean(form.totalBornAlive !== '' && form.totalBornAlive !== undefined && (isNaN(Number(form.totalBornAlive)) || Number(form.totalBornAlive) <= 0));
  const isInvalidWeight = Boolean(form.averageWeight && (isNaN(Number(form.averageWeight)) || Number(form.averageWeight) < 0 || Number(form.averageWeight) > 500));

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-white overflow-hidden">
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
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-6">
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
                    {availablePensForBatch.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Date of Birth" error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)} icon={<Calendar />}>
                  <input type="date" min={minDobStr} max={todayStr} value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk}`} />
                </Field>

                <Field label="Mother Sow (optional)" icon={<Heart />}>
                  <select value={form.sowId} onChange={handleSowChange} disabled={isLoadingData} className={`${inputBase} ${inputOk} appearance-none`}>
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

                <Field label="Status" error={errors.status} icon={<Activity />}>
                  <select value={form.status} onChange={handleChange('status')} className={`${inputBase} ${errors.status ? inputErr : inputOk} appearance-none`}>
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

              {/* Supplier tracking when purchased or transferred */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
                    ? 'grid-rows-[1fr] opacity-100 mt-4'
                    : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-4 pb-1">
                    <Field label="Supplier / Breeder Name" icon={<Users />}>
                      <input type="text" value={form.supplierName || ''} onChange={handleChange('supplierName')} placeholder="e.g. AgriGenetics Inc." className={`${inputBase} ${inputOk}`} />
                    </Field>
                    <Field label="Arrival Date" icon={<Calendar />}>
                      <input type="date" value={form.arrivalDate || ''} onChange={handleChange('arrivalDate')} max={todayStr} className={`${inputBase} ${inputOk}`} />
                    </Field>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Section 2: Count & Vitals ── */}
            <Section step="2" title="Count & Vitals">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Total Born Alive" error={errors.totalBornAlive || (isInvalidBornAlive ? 'Enter at least 1 piglet born alive' : undefined)} icon={<Baby />}>
                  <input type="number" min="0" value={form.totalBornAlive} onChange={handleBornAliveChange} placeholder="0" className={`${inputBase} ${errors.totalBornAlive || isInvalidBornAlive ? inputErr : inputOk}`} />
                </Field>

                <Field label="Stillborn Count" icon={<Hash />}>
                  <input type="number" min="0" value={form.stillbornCount} onChange={handleChange('stillbornCount')} placeholder="0" className={`${inputBase} ${inputOk}`} />
                </Field>

                <Field label="Mummy Count" icon={<Shuffle />}>
                  <input type="number" min="0" value={form.mummyCount} onChange={handleChange('mummyCount')} placeholder="0" className={`${inputBase} ${inputOk}`} />
                </Field>

                <Field label="Average Weight (kg)" error={errors.averageWeight || (isInvalidWeight ? (Number(form.averageWeight) < 0 ? 'Weight cannot be negative' : 'Weight cannot exceed 500 kg') : undefined)} icon={<Weight />}>
                  <input type="number" min="0" max="500" step="0.1" value={form.averageWeight} onChange={handleChange('averageWeight')} placeholder="0.0" className={`${inputBase} ${errors.averageWeight || isInvalidWeight ? inputErr : inputOk}`} />
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
              <p className="text-4xl font-black text-slate-900 mt-1">{Number(form.totalBornAlive) || 0}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">of {((Number(form.totalBornAlive) || 0) + totalLoss) || 0} total farrowed</p>
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
              {(form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred') && form.supplierName && (
                <p className="text-[10px] text-slate-500 mt-1 truncate">Supplier: {form.supplierName}</p>
              )}
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

  const [step, setStep] = useState('form');
  const [successInfo, setSuccessInfo] = useState(null);
  const { containerRef, style: stepTransitionStyle } = useSmoothStepTransition(step);

  useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setSuccessInfo(null);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleModalClose = () => {
    requestClose(onClose);
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleModalClose(); }}
    >
      <div
        ref={containerRef}
        style={stepTransitionStyle}
        className={`flex max-h-[86vh] w-full ${step === 'success' ? 'max-w-md' : 'max-w-4xl'} flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transition-[max-width] duration-300 ease-in-out ${panelClassName}`}
      >
        {step === 'success' ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                Piglet Batch Added
              </span>
              <h4 className="text-xl font-black text-slate-900">
                Piglet Batch #{successInfo?.tag} Saved!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {successInfo?.message || 'The new piglet batch has been saved and synced to your database.'}
              </p>
            </div>

            <div className="pt-2 w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle size={16} />
                Add Another Batch
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Done & Close
              </button>
            </div>
          </div>
        ) : (
          <AddPigletBatchForm
            isOpen={isOpen}
            onClose={handleModalClose}
            onSave={onSave}
            onSuccess={(info) => {
              setSuccessInfo(info);
              setStep('success');
            }}
            pens={pens}
            breeds={breeds}
          />
        )}
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
            {cloneElement(icon, { size: 14 })}
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