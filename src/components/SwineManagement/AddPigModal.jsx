import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronDown, Venus, Mars, Users, Loader2, Tag, Calendar, Weight, Home, Activity, Ruler, AlertCircle, PlusCircle, Bookmark, CheckCircle2, Sparkles, ShoppingBag, ArrowRightLeft, Dna, Check } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useSmoothStepTransition from '../../hooks/useSmoothStepTransition';
import useFormDraft, { fetchDraftPayload } from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';
import toast from '../../utils/toast';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { formatTimestamp } from '../../utils/formatTimestamp';
import AddPigletBatchModal, { AddPigletBatchForm } from './AddPigletBatchModal';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const SOW_STATUS_OPTIONS = ['Healthy', 'Quarantine', 'Sick', 'Pregnant'];
const BOAR_STATUS_OPTIONS = ['Healthy', 'Quarantine', 'Sick'];

const SOURCE_OPTIONS = [
  { value: 'born_in_farm', label: 'Born in Farm' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'transferred', label: 'Transferred' },
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

function buildUniqueTag(prefix, dobStr, existingTagsSet) {
  if (!dobStr) return '';
  const yyyymmdd = dobStr.replace(/-/g, '');
  const baseTag = `${prefix}-${yyyymmdd}`;
  if (!existingTagsSet || !existingTagsSet.has(baseTag.toUpperCase())) {
    return baseTag;
  }
  let suffix = 2;
  while (existingTagsSet.has(`${baseTag}-${suffix}`.toUpperCase())) {
    suffix++;
  }
  return `${baseTag}-${suffix}`;
}

export default function AddPigModal({ isOpen, onClose, onSave, onSaveBatch, loggedInUser }) {
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
  const [animationParent] = useAutoAnimate();

  // Direct DOM opacity fade between steps (bypasses React batching)
  // useLayoutEffect fires BEFORE browser paint — opacity is set to 0
  // before the new step content is ever visible, then fades in cleanly.
  const contentRef = useRef(null);
  const isFirstStep = useRef(true);
  useLayoutEffect(() => {
    if (isFirstStep.current) { isFirstStep.current = false; return; }
    const el = contentRef.current;
    if (!el) return;
    // Snap to invisible before browser paints new content
    el.style.transition = 'none';
    el.style.opacity = '0';
    // Next frame: start the fade-in transition
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 280ms ease-in-out';
      el.style.opacity = '1';
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

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
  const [existingTags, setExistingTags] = useState(new Set());
  const [isTagManuallyEdited, setIsTagManuallyEdited] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [breedOpen, setBreedOpen] = useState(false);
  const [isSearchingBreed, setIsSearchingBreed] = useState(false);
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
          const [pensRes, breedsRes, activePigsRes, archivedPigsRes] = await Promise.all([
            fetch(`${API_BASE}/api/pens/available`),
            fetch(`${API_BASE}/api/breeds`),
            fetch(`${API_BASE}/api/pigs?limit=9999`),
            fetch(`${API_BASE}/api/pigs/archived?limit=9999`),
          ]);
          const [pensData, breedsData, activePigsData, archivedPigsData] = await Promise.all([
            pensRes.json(),
            breedsRes.json(),
            activePigsRes.ok ? activePigsRes.json() : { data: [] },
            archivedPigsRes.ok ? archivedPigsRes.json() : { data: [] },
          ]);

          setPens(pensData.data || []);
          setBreeds(breedsData.data || []);

          const tagSet = new Set();
          [...(activePigsData.data || []), ...(archivedPigsData.data || [])].forEach((p) => {
            const t = (p.tag || p.pig_tag || '').trim().toUpperCase();
            if (t) tagSet.add(t);
          });
          setExistingTags(tagSet);
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
      setIsTagManuallyEdited(false);
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
    setIsTagManuallyEdited(false);
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
            .then(() => { });
        }
      }).catch(() => { });
    }
  };

  const handleTypeSelect = (type) => {
    if (type === 'batch') {
      setStep('batch');
      return;
    }
    const nextGender = type === 'sow' ? 'Female' : 'Male';
    setGender(nextGender);
    if (!isTagManuallyEdited && form.dateOfBirth) {
      const prefix = nextGender === 'Female' ? 'SOW' : 'BOAR';
      setForm((prev) => ({
        ...prev,
        tagNumber: buildUniqueTag(prefix, prev.dateOfBirth, existingTags),
      }));
    }
    setStep('form');
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    if (field === 'tagNumber') {
      setIsTagManuallyEdited(value.trim().length > 0);
    }
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'dateOfBirth' && (!isTagManuallyEdited || !prev.tagNumber.trim())) {
        const prefix = gender === 'Female' ? 'SOW' : 'BOAR';
        next.tagNumber = value ? buildUniqueTag(prefix, value, existingTags) : '';
      }
      return next;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === 'dateOfBirth' && (!isTagManuallyEdited || !form.tagNumber.trim()) && errors.tagNumber) {
      setErrors((prev) => ({ ...prev, tagNumber: undefined }));
    }
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
    if (form.weight !== '' && form.weight !== undefined && form.weight !== null) {
      const w = Number(form.weight);
      if (isNaN(w)) {
        next.weight = 'Enter valid weight';
      } else if (w < 0) {
        next.weight = 'Weight cannot be negative';
      } else if (w > 500) {
        next.weight = 'Weight cannot exceed 500 kg';
      }
    }
    if (!form.penId) next.penId = 'Select a pen code';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const breedToSave = form.breed.trim();
      await onSave?.({
        ...form,
        breed: breedToSave,
        weight: (form.weight !== '' && form.weight !== undefined && form.weight !== null && !isNaN(Number(form.weight))) ? Number(form.weight) : null,
        parityCount: gender === 'Female' && form.parityCount ? Number(form.parityCount) : undefined,
        gender,
        type: gender === 'Female' ? 'Sow' : 'Boar',
      });
      clearDraft();
      setSuccessInfo({
        type: gender === 'Female' ? 'Sow' : 'Boar',
        tag: form.tagNumber.trim(),
        message: 'Successfully registered to your active swine inventory.'
      });
      setStep('success');
    } catch (err) {
      if (isOffline || err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        saveDraft(form, { step, gender });
      }
      
      let errorMessage = err.message || 'Something went wrong while saving. Please try again.';
      if (errorMessage.includes('pigs_pig_tag_key') || errorMessage.includes('duplicate key value violates unique constraint')) {
        setErrors(prev => ({ ...prev, tagNumber: 'A swine with this Tag Number already exists' }));
      } else {
        setSubmitError(errorMessage);
      }
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
  const availablePensForGender = pens
    .filter(p => {
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
    })
    .sort((a, b) => {
      const aName = a.name || a.pen_number || '';
      const bName = b.name || b.pen_number || '';
      const aIsM = aName.startsWith('M');
      const bIsM = bName.startsWith('M');
      if (aIsM && !bIsM) return -1;
      if (!aIsM && bIsM) return 1;
      return aName.localeCompare(bName, undefined, { numeric: true });
    });

  return createPortal(
    <>
      {shouldRender && (
        <div
          className={`fixed inset-0 lg:left-64 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) resetAndClose();
          }}
        >
          <div
            ref={containerRef}
            style={stepTransitionStyle}
            className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[86vh] transition-[max-width] duration-300 ease-in-out ${step === 'select' || step === 'success' ? 'max-w-md' : 'max-w-2xl'
              } ${panelClassName}`}
          >
            {/* Header */}
            {step !== 'batch' && step !== 'success' && (
              <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {step === 'form' ? (
                    <button type="button" onClick={() => setStep('select')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer" title="Back to selection">
                      <ChevronLeft size={18} />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <PlusCircle size={20} />
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-slate-900">
                      {step === 'form' ? (gender === 'Female' ? 'Add New Sow' : 'Add New Boar') : 'Add New Swine'}
                    </h3>
                    {step === 'form' && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        gender === 'Female'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          : 'bg-sky-50 text-sky-700 border border-sky-200/70'
                      }`}>
                        {gender === 'Female' ? <Venus size={12} className="stroke-[2.5]" /> : <Mars size={12} className="stroke-[2.5]" />}
                        {gender}
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" onClick={resetAndClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
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
            <div
              ref={contentRef}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
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
                <form onSubmit={(e) => handleSubmit(e, 'finish')} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-[440px] max-h-[68vh] overflow-y-auto px-8 py-4 space-y-4 text-left">
                    <div
                      className={`grid transition-[grid-template-rows,opacity,margin] duration-250 ease-out ${
                        submitError
                          ? 'grid-rows-[1fr] opacity-100 mb-2'
                          : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                          <AlertCircle size={14} className="text-rose-500 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      </div>
                    </div>

                    {/* DOB and Tag */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Date of Birth" error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)} icon={<Calendar />}>
                        <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} min={minDobStr} max={todayStr} className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk}`} />
                      </Field>
                      <Field label="Tag Number" error={errors.tagNumber} icon={<Tag />}>
                        <input type="text" value={form.tagNumber} onChange={handleChange('tagNumber')} placeholder={`e.g. ${gender === 'Female' ? 'SOW' : 'BOAR'}-YYYYMMDD`} className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
                      </Field>
                    </div>

                    {/* Breed and Weight */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative" ref={breedWrapRef}>
                        <Field label="Breed" error={errors.breed} icon={<Dna />}>
                          <input
                            type="text"
                            value={form.breed}
                            onChange={(e) => {
                              handleChange('breed')(e);
                              setIsSearchingBreed(true);
                              setBreedOpen(true);
                            }}
                            onFocus={() => setBreedOpen(true)}
                            placeholder={isLoadingData ? 'Loading...' : 'Select or type'}
                            disabled={isLoadingData}
                            className={`${inputBase} pr-9 ${errors.breed ? inputErr : inputOk}`}
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => {
                              setIsSearchingBreed(false);
                              setBreedOpen(prev => !prev);
                            }}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            title="Toggle breed list"
                          >
                            <ChevronDown size={14} className={`transition-transform duration-200 ${breedOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </Field>
                        {breedOpen && !isLoadingData && (() => {
                          const isExactMatch = breeds.some(b => b.name.toLowerCase() === (form.breed || '').trim().toLowerCase());
                          const listToRender = (isSearchingBreed && form.breed && !isExactMatch)
                            ? breeds.filter(b => b.name.toLowerCase().includes(form.breed.toLowerCase()))
                            : breeds;
                          const sortedList = [...listToRender].sort((a, b) => {
                            if (a.name === 'Crossbreed') return -1;
                            if (b.name === 'Crossbreed') return 1;
                            return a.name.localeCompare(b.name);
                          });

                          return (
                            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                              {sortedList.length > 0 ? (
                                sortedList.map(b => {
                                  const isSelected = form.breed && b.name.toLowerCase() === form.breed.trim().toLowerCase();
                                  return (
                                    <li
                                      key={b.breed_id}
                                      onClick={() => {
                                        setForm(p => ({ ...p, breed: b.name }));
                                        setIsSearchingBreed(false);
                                        setBreedOpen(false);
                                      }}
                                      className={`cursor-pointer px-4 py-2 text-xs transition-colors flex items-center justify-between ${
                                        isSelected
                                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                                          : 'text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span>{b.name}</span>
                                      {isSelected && <Check size={13} className="text-emerald-600 shrink-0" />}
                                    </li>
                                  );
                                })
                              ) : (
                                <li className="px-4 py-2.5 text-xs text-slate-400 italic">
                                  Press next to use custom &ldquo;{form.breed}&rdquo;
                                </li>
                              )}
                            </ul>
                          );
                        })()}
                      </div>
                      <Field
                        label={
                          <span>
                            Weight (kg) <span className="font-normal text-slate-400 lowercase">(optional)</span>
                          </span>
                        }
                        error={errors.weight || (isInvalidWeight ? (Number(form.weight) < 0 ? 'Weight cannot be negative' : 'Weight cannot exceed 500 kg') : undefined)}
                        icon={<Weight />}
                      >
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="500"
                          value={form.weight}
                          onChange={handleChange('weight')}
                          placeholder="Leave blank or e.g. 120.0"
                          className={`${inputBase} ${errors.weight || isInvalidWeight ? inputErr : inputOk}`}
                        />
                      </Field>
                    </div>

                    {/* Pen and Status */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                        <select
                          value={form.penId}
                          onChange={handleChange('penId')}
                          className={`${inputBase} pr-9 ${errors.penId ? inputErr : inputOk} appearance-none cursor-pointer`}
                          disabled={isLoadingData}
                        >
                          <option value="">{isLoadingData ? 'Loading...' : availablePensForGender.length === 0 ? `No available pens for ${gender}` : 'Select Pen'}</option>
                          {availablePensForGender.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                            </option>
                          ))}
                        </select>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </span>
                      </Field>
                      <Field label="Status" icon={<Activity />}>
                        <select
                          value={form.status}
                          onChange={handleChange('status')}
                          className={`${inputBase} pr-9 ${inputOk} appearance-none cursor-pointer`}
                        >
                          {(gender === 'Female' ? SOW_STATUS_OPTIONS : BOAR_STATUS_OPTIONS).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <ChevronDown size={14} />
                        </span>
                      </Field>
                    </div>

                    {gender === 'Female' && (
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <Field
                          label={
                            <span>
                              Parity Count <span className="font-normal text-slate-400 lowercase">(0 for maiden gilts)</span>
                            </span>
                          }
                          icon={<Ruler />}
                        >
                          <input
                            type="number"
                            min="0"
                            value={form.parityCount}
                            onChange={handleChange('parityCount')}
                            placeholder="0"
                            className={`${inputBase} ${inputOk}`}
                          />
                        </Field>
                      </div>
                    )}

                    {/* Source Origin */}
                    <div className="pt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Source Origin</p>
                      <div className="grid grid-cols-3 gap-2.5">
                        {SOURCE_OPTIONS.map(opt => {
                          const isSelected = form.sourceOrigin === opt.value;
                          const IconComp = opt.value === 'born_in_farm' ? Sparkles : opt.value === 'purchased' ? ShoppingBag : ArrowRightLeft;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(p => ({ ...p, sourceOrigin: opt.value }))}
                              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <IconComp size={14} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Supplier tracking when purchased or transferred */}
                    <div
                      className={`grid transition-all duration-300 ease-in-out ${form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
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

                  <div className="px-8 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      onClick={resetAndClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || isLoadingData}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Check size={14} className="stroke-[2.5]" />
                      )}
                      <span>{gender === 'Female' ? 'Save Sow' : 'Save Boar'}</span>
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
                <div className="p-8 text-center flex flex-col items-center justify-center space-y-5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mx-auto">
                    <CheckCircle2 size={28} strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">
                      {successInfo?.tag} Added!
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
                          const nextGender = successInfo?.type === 'Sow' ? 'Female' : 'Male';
                          setGender(nextGender);
                          resetForm(EMPTY_FORM);
                          setIsTagManuallyEdited(false);
                          setErrors({});
                          setSubmitError(null);
                          setStep('form');
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
                      Done
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
      className={`group relative flex flex-col items-center gap-3 rounded-2xl border px-3 py-6 transition-all duration-200 cursor-pointer ${hasDraftBadge
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
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${hasDraftBadge
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

function Field({ label, error, hint, icon, children, className = '' }) {
  const [displayedError, setDisplayedError] = useState(error);

  useEffect(() => {
    if (error) {
      setDisplayedError(error);
    }
  }, [error]);

  const hasError = Boolean(error);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
            {label}
          </label>
          {hint && (
            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              {hint}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
          {icon && React.cloneElement(icon, { size: 14 })}
        </span>
        {children}
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-250 ease-out ${
          hasError
            ? 'grid-rows-[1fr] opacity-100 mt-1'
            : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <p className="flex items-center gap-1 text-[10px] text-rose-600 font-semibold leading-tight pt-0.5">
            <AlertCircle size={10} className="shrink-0 text-rose-500" />
            <span>{displayedError}</span>
          </p>
        </div>
      </div>
    </div>
  );
}