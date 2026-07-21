import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, Venus, Mars, Users, Loader2, Tag, Calendar, Weight, Home, Activity, Ruler, AlertCircle, PlusCircle, Bookmark, CheckCircle2 } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useSmoothStepTransition from '../../hooks/useSmoothStepTransition';
import useFormDraft, { fetchDraftPayload } from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';
import toast from '../../utils/toast';
import { formatTimestamp } from '../../utils/formatTimestamp';
import AddPigletBatchModal, { AddPigletBatchForm } from './AddPigletBatchModal';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant'];

const SOURCE_OPTIONS = [
  { value: 'born_in_farm', label: 'Born in Farm', hint: 'Internal breeding cycle' },
  { value: 'purchased', label: 'Purchased', hint: 'External supplier acquisition' },
  { value: 'transferred', label: 'Transferred', hint: 'Moved from another facility' },
];

const EMPTY_FORM = {
  tagNumber: '',
  dateOfBirth: '',
  breed: '',       // Stores breed name text (typed or picked from datalist suggestions)
  weight: '',
  penId: '',       // Stores Pen UUID
  status: 'Healthy',
  parityCount: '',
  sourceOrigin: 'born_in_farm',
  supplierName: '',
  arrivalDate: '',
};

export default function AddPigModal({ isOpen, onClose, onSave, onSaveBatch }) {
  // useModalAnimation handles mounting/unmounting and exit timings
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [step, setStep] = useState('select');
  const [gender, setGender] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const { containerRef, style: stepTransitionStyle } = useSmoothStepTransition(step);
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
  } = useFormDraft('swinesync_draft_add_pig', EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [autoRestoreBatch, setAutoRestoreBatch] = useState(false);
  const [batchDraftInfo, setBatchDraftInfo] = useState(null);

  const checkBatchDraft = useCallback(async () => {
    try {
      const payload = await fetchDraftPayload('swinesync_draft_add_piglet_batch');
      if (payload && payload.data) {
        setBatchDraftInfo(payload);
      } else {
        setBatchDraftInfo(null);
      }
    } catch (err) {
      console.error('Error checking batch draft inside AddPigModal:', err);
      setBatchDraftInfo(null);
    }
  }, []);

  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

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
    if (isOpen) {
      Promise.resolve().then(() => {
        checkDraft();
        checkBatchDraft();
      });
      const fetchData = async () => {
        setIsLoadingData(true);
        try {
          const [pensRes, breedsRes] = await Promise.all([
            fetch(`${API_BASE}/api/pens/available`),
            fetch(`${API_BASE}/api/breeds`)
          ]);
          const pensData = await pensRes.json();
          const breedsData = await breedsRes.json();
          
          setPens(pensData.data || []);
          setBreeds(breedsData.data || []);
        } catch (err) {
          console.error("Error loading form data:", err);
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isOpen, checkDraft, checkBatchDraft]);

  useEffect(() => {
    if (!batchModalOpen && isOpen) {
      Promise.resolve().then(() => {
        checkBatchDraft();
      });
    }
  }, [batchModalOpen, isOpen, checkBatchDraft]);

  if (!shouldRender && !batchModalOpen) return null;

  const resetAndClose = () => {
    requestClose(() => {
      setAutoRestoreBatch(false);
      setStep('select');
      setGender(null);
      resetForm(EMPTY_FORM);
      setErrors({});
      setIsSaving(false);
      setSubmitError(null);
      setBreedOpen(false);
      setSuccessInfo(null);
    });
  };

  const handleRestoreDraft = () => {
    restoreDraft((extraMeta) => {
      if (extraMeta?.gender) setGender(extraMeta.gender);
      if (extraMeta?.step) setStep(extraMeta.step);
    });
  };

  const handleDiscardDraft = () => {
    clearDraft();
    resetForm(EMPTY_FORM);
  };

  const handleRestoreBatchDraft = () => {
    setAutoRestoreBatch(true);
    setStep('batch');
  };

  const handleDiscardBatchDraft = () => {
    try {
      localStorage.removeItem('swinesync_draft_add_piglet_batch');
    } catch (err) {
      console.error('Error clearing batch draft local:', err);
    }
    setBatchDraftInfo(null);
    if (navigator.onLine) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          supabase.from('form_drafts').delete()
            .eq('user_id', session.user.id)
            .eq('draft_key', 'swinesync_draft_add_piglet_batch')
            .then(() => {});
        }
      }).catch(() => {});
    }
  };

  const handleTypeSelect = (type) => {
    if (type === 'batch') {
      setStep('batch');
      return;
    }
    setGender(type === 'sow' ? 'Female' : 'Male');
    setStep('form');
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    const today = new Date().toISOString().split('T')[0];
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 15);
    const minDobStr = minDate.toISOString().split('T')[0];

    if (!form.tagNumber.trim()) next.tagNumber = 'Tag number is required';
    if (!form.dateOfBirth) {
      next.dateOfBirth = 'Date of birth is required';
    } else if (form.dateOfBirth > today) {
      next.dateOfBirth = 'Date of birth cannot be in the future';
    } else if (form.dateOfBirth < minDobStr) {
      next.dateOfBirth = 'Date of birth is too far in the past (max 15 years)';
    }
    if (!form.breed.trim()) next.breed = 'Breed is required';
    const w = Number(form.weight);
    if (form.weight === '' || form.weight === undefined || form.weight === null || isNaN(w)) {
      next.weight = 'Enter valid weight';
    } else if (w < 0) {
      next.weight = 'Weight cannot be negative';
    } else if (w > 500) {
      next.weight = 'Weight cannot exceed 500 kg';
    }
    if (!form.penId) next.penId = 'Select a pen code';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const breedToSave = form.breed.trim();
      
      await onSave?.({
        ...form,
        breed: breedToSave,
        weight: Number(form.weight),
        parityCount: gender === 'Female' && form.parityCount ? Number(form.parityCount) : undefined,
        gender,
        type: gender === 'Female' ? 'Sow' : 'Boar',
      });
      clearDraft();
      setSuccessInfo({
        type: gender === 'Female' ? 'Sow' : 'Boar',
        tag: form.tagNumber.trim(),
        message: `${gender === 'Female' ? 'Sow' : 'Boar'} #${form.tagNumber.trim()} added to your swine inventory.`
      });
      setStep('success');
      toast.success(`${gender === 'Female' ? 'Sow' : 'Boar'} #${form.tagNumber.trim()} added successfully!`);
    } catch (err) {
      if (isOffline || err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        saveDraft(form, { step, gender });
      }
      setSubmitError(err.message || 'Something went wrong while saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-955 bg-rose-50/10";

  const todayStr = new Date().toISOString().split('T')[0];
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 15);
  const minDobStr = minDate.toISOString().split('T')[0];
  const isFutureDob = Boolean(form.dateOfBirth && form.dateOfBirth > todayStr);
  const isPastDob = Boolean(form.dateOfBirth && form.dateOfBirth < minDobStr);
  const isInvalidWeight = Boolean(form.weight !== '' && form.weight !== undefined && form.weight !== null && (isNaN(Number(form.weight)) || Number(form.weight) < 0 || Number(form.weight) > 500));

  const isSickOrQuarantine = form.status?.toLowerCase() === 'sick' || form.status?.toLowerCase() === 'quarantine';
  const availablePensForGender = pens.filter(p => {
    const isQPen = p.section === 'Q' || p.section === 'QUARANTINE';
    if (!isSickOrQuarantine && isQPen) return false;
    if (isSickOrQuarantine && !isQPen) return false;

    if (gender === 'Female') {
      if (!isQPen && p.section !== 'S' && p.section !== 'SOW') return false;
      if ((p.section === 'S' || p.section === 'SOW') && (p.hasSow || p.sowCount >= 1 || p.pigCount >= 1)) return false;
    }
    if (gender === 'Male') {
      if (p.section !== 'B' && p.section !== 'BOAR') return false;
      if (p.hasBoar || p.boarCount >= 1 || p.pigCount >= 1) return false;
    }
    return typeof p.remaining === 'number' ? p.remaining > 0 : true;
  });

  return createPortal(
    <>
      {shouldRender && (
        <div
          className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) resetAndClose();
          }}
        >
          <div
            ref={containerRef}
            style={stepTransitionStyle}
            className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[86vh] transition-[max-width] duration-300 ease-in-out ${
              step === 'select' || step === 'success' ? 'max-w-md' : step === 'batch' ? 'max-w-4xl' : 'max-w-2xl'
            } ${panelClassName}`}
          >
            {/* Header */}
            {step !== 'batch' && step !== 'success' && (
              <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step === 'form' ? (
                    <button type="button" onClick={() => setStep('select')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <PlusCircle size={20} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Add New Swine</h3>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      {step === 'select' ? 'Select Record Type' : `${gender} Swine`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={resetAndClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}

            {step !== 'batch' && step !== 'success' && (
              <div className="px-8 pt-2 space-y-2">
              <DraftBanner
                hasDraft={hasDraft && (step === 'select' || (step === 'form' && (!draftInfo?.extraMeta?.gender || draftInfo.extraMeta.gender === gender)))}
                draftInfo={draftInfo}
                onRestore={handleRestoreDraft}
                onDiscard={handleDiscardDraft}
                isOffline={isOffline}
                label={step === 'select' ? "Unsaved Sow/Boar Draft Available" : "Unsaved Draft Available"}
                description={step === 'select' ? `We found a Sow/Boar draft saved on ${formatTimestamp(draftInfo?.timestamp)}. Would you like to restore your previous entries?` : undefined}
              />
              {step === 'select' && batchDraftInfo && (
                <DraftBanner
                  hasDraft={true}
                  draftInfo={batchDraftInfo}
                  onRestore={handleRestoreBatchDraft}
                  onDiscard={handleDiscardBatchDraft}
                  isOffline={isOffline && !hasDraft}
                  label="Unsaved Piglet Batch Draft Available"
                  description={`We found a Piglet Batch draft saved on ${formatTimestamp(batchDraftInfo?.timestamp)}. Would you like to open the Batch record form and restore it?`}
                />
              )}
            </div>
            )}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {step === 'select' && (
                <div className="px-8 pb-8 pt-2 text-left">
                  <p className="mb-6 text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Select the type of record to add to the herd
                  </p>
                  <div className="grid grid-cols-3 gap-3.5">
                    <TypeCard icon={<Venus size={22} />} label="Sow" onClick={() => handleTypeSelect('sow')} hasDraftBadge={hasDraft && (!draftInfo?.extraMeta?.gender || draftInfo.extraMeta.gender === 'Female')} />
                    <TypeCard icon={<Mars size={22} />} label="Boar" onClick={() => handleTypeSelect('boar')} hasDraftBadge={hasDraft && draftInfo?.extraMeta?.gender === 'Male'} />
                    <TypeCard icon={<Users size={22} />} label="Batch" onClick={() => handleTypeSelect('batch')} hasDraftBadge={Boolean(batchDraftInfo)} />
                  </div>
                  <div className="mt-6">
                    <button type="button" onClick={resetAndClose} className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {step === 'form' && (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto p-8 pt-2 space-y-4 text-left">
                  <div className="p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                    {gender === 'Female' ? <Venus size={14} /> : <Mars size={14} />}
                    <span>Gender is automatically recorded as {gender}</span>
                  </div>

                  {submitError && (
                    <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-500" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Tag and DOB */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tag Number" error={errors.tagNumber} icon={<Tag />}>
                      <input type="text" value={form.tagNumber} onChange={handleChange('tagNumber')} placeholder="e.g. SW-29401" className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
                    </Field>
                    <Field label="Date of Birth" error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)} icon={<Calendar />}>
                      <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} min={minDobStr} max={todayStr} className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk}`} />
                    </Field>
                  </div>

                  {/* Breed and Weight */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative" ref={breedWrapRef}>
                      <Field label="Breed" error={errors.breed} icon={<PlusCircle />}>
                        <input
                          type="text"
                          value={form.breed}
                          onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }}
                          onFocus={() => setBreedOpen(true)}
                          placeholder={isLoadingData ? 'Loading...' : 'Select or type'}
                          disabled={isLoadingData}
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
                    <Field label="Weight (kg)" error={errors.weight || (isInvalidWeight ? (Number(form.weight) < 0 ? 'Weight cannot be negative' : 'Weight cannot exceed 500 kg') : undefined)} icon={<Weight />}>
                      <input type="number" step="0.1" min="0" max="500" value={form.weight} onChange={handleChange('weight')} placeholder="0.0" className={`${inputBase} ${errors.weight || isInvalidWeight ? inputErr : inputOk}`} />
                    </Field>
                  </div>

                  {/* Pen and Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                      <select value={form.penId} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`} disabled={isLoadingData}>
                        <option value="">{isLoadingData ? 'Loading...' : availablePensForGender.length === 0 ? `No available pens for ${gender}` : 'Select Pen'}</option>
                        {availablePensForGender.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status" icon={<Activity />}>
                      <select value={form.status} onChange={handleChange('status')} className={`${inputBase} ${inputOk} appearance-none`}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>

                  {gender === 'Female' && (
                    <Field label="Parity Count" icon={<Ruler />}>
                      <input type="number" value={form.parityCount} onChange={handleChange('parityCount')} placeholder="0" className={`${inputBase} ${inputOk}`} />
                    </Field>
                  )}

                  {/* Source Origin */}
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Source Origin</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {SOURCE_OPTIONS.map(opt => (
                        <label key={opt.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-xs transition-all ${form.sourceOrigin === opt.value ? 'border-emerald-400 bg-emerald-50/80 shadow-xs' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <span className="flex items-center gap-2 font-semibold text-slate-700">
                            <input type="radio" name="sourceOrigin" value={opt.value} checked={form.sourceOrigin === opt.value} onChange={handleChange('sourceOrigin')} className="accent-emerald-600" />
                            {opt.label}
                          </span>
                          <span className="pl-5 text-[10px] text-slate-400 leading-tight">{opt.hint}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Supplier tracking when purchased or transferred */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
                        ? 'grid-rows-[1fr] opacity-100 pt-1'
                        : 'grid-rows-[0fr] opacity-0 pt-0 pointer-events-none'
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

                  </div>

                  <div className="px-8 py-4 border-t border-slate-100 bg-white flex gap-2 shrink-0">
                    <button type="button" onClick={resetAndClose} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        saveDraft(form, { step, gender });
                        resetAndClose();
                      }}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Save current inputs as a draft and close"
                    >
                      <Bookmark size={15} className="text-emerald-600" />
                      Save Draft
                    </button>
                    <button type="submit" disabled={isSaving || isLoadingData} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      Save Swine
                    </button>
                  </div>
                </form>
              )}

              {step === 'batch' && (
                <AddPigletBatchForm
                  isOpen={isOpen && step === 'batch'}
                  autoRestore={autoRestoreBatch}
                  onRestored={() => setAutoRestoreBatch(false)}
                  onBack={() => {
                    setAutoRestoreBatch(false);
                    setStep('select');
                  }}
                  onClose={resetAndClose}
                  onSave={onSaveBatch}
                  onSuccess={(info) => {
                    setAutoRestoreBatch(false);
                    setSuccessInfo(info);
                    setStep('success');
                  }}
                  pens={pens}
                  breeds={breeds}
                />
              )}

              {step === 'success' && (
                <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                    <CheckCircle2 size={32} className="animate-bounce" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                      {successInfo?.type || 'Record'} Added
                    </span>
                    <h4 className="text-xl font-black text-slate-900">
                      {successInfo?.type || 'Swine'} #{successInfo?.tag} Saved!
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                      {successInfo?.message || 'The new record has been saved and synced to your database.'}
                    </p>
                  </div>

                  <div className="pt-2 w-full flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (successInfo?.type === 'Piglet Batch') {
                          setStep('batch');
                        } else {
                          setGender(successInfo?.type === 'Sow' ? 'Female' : 'Male');
                          setStep('pig');
                        }
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <PlusCircle size={16} />
                      Add Another {successInfo?.type || 'Record'}
                    </button>
                    <button
                      type="button"
                      onClick={resetAndClose}
                      className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AddPigletBatchModal 
        isOpen={batchModalOpen} 
        onClose={() => setBatchModalOpen(false)} 
        onSave={onSaveBatch} 
        pens={pens} 
        breeds={breeds} 
      />
    </>,
    document.body
  );
}

function TypeCard({ icon, label, onClick, hasDraftBadge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-3 rounded-2xl border px-3 py-6 transition-all duration-200 cursor-pointer ${
        hasDraftBadge
          ? 'border-emerald-300 bg-emerald-50/30 shadow-xs hover:border-emerald-400 hover:bg-emerald-50/70 hover:shadow-md'
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-sm'
      }`}
    >
      {hasDraftBadge && (
        <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Draft
        </span>
      )}
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${
          hasDraftBadge
            ? 'bg-emerald-500/15 text-emerald-600 group-hover:scale-105 group-hover:bg-emerald-500/20'
            : 'bg-slate-100/80 text-slate-600 group-hover:scale-105 group-hover:bg-emerald-50 group-hover:text-emerald-600'
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-bold text-slate-800 tracking-tight group-hover:text-emerald-950 transition-colors">
        {label}
      </span>
    </button>
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