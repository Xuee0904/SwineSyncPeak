import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, Venus, Mars, Users, Loader2, Tag, Calendar, Weight, Home, Activity, Ruler, AlertCircle, PlusCircle, Bookmark } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useFormDraft, { fetchDraftPayload } from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';
import { formatTimestamp } from '../../utils/formatTimestamp';
import AddPigletBatchModal from './AddPigletBatchModal';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Inactive'];

const EMPTY_FORM = {
  tagNumber: '',
  dateOfBirth: '',
  breed: '',       // Stores breed name text (typed or picked from datalist suggestions)
  weight: '',
  penId: '',       // Stores Pen UUID
  status: 'Healthy',
  parityCount: '',
};

export default function AddPigModal({ isOpen, onClose, onSave, onSaveBatch }) {
  // useModalAnimation handles mounting/unmounting and exit timings
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [step, setStep] = useState('select');
  const [gender, setGender] = useState(null);
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
      setStep('select');
      setGender(null);
      resetForm(EMPTY_FORM);
      setErrors({});
      setIsSaving(false);
      setSubmitError(null);
      setBreedOpen(false);
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
    requestClose(() => {
      setStep('select');
      setGender(null);
      resetForm(EMPTY_FORM);
      setBatchModalOpen(true);
    });
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
      requestClose(() => {
        setStep('select');
        setGender(null);
        setForm(EMPTY_FORM);
        setBatchModalOpen(true);
      });
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
    if (!form.tagNumber.trim()) next.tagNumber = 'Tag number is required';
    if (!form.dateOfBirth) next.dateOfBirth = 'Date of birth is required';
    if (!form.breed.trim()) next.breed = 'Breed is required';
    if (!form.weight || Number(form.weight) <= 0) next.weight = 'Enter valid weight';
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
      resetAndClose();
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
            style={{ willChange: 'transform, opacity, max-width' }}
            className={`w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 transition-[max-width] duration-300 ease-in-out ${
              step === 'select' ? 'max-w-md' : 'max-w-2xl'
            } ${panelClassName}`}
          >
            {/* Header */}
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

            <div className="px-8 pt-2 space-y-2">
              <DraftBanner
                hasDraft={hasDraft}
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
            <div>
              {step === 'select' && (
                <div className="px-8 pb-8 pt-2 text-left">
                  <p className="mb-6 text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Select the type of record to add to the herd
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <TypeCard icon={<Venus size={22} />} label="Sow" onClick={() => handleTypeSelect('sow')} />
                    <TypeCard icon={<Mars size={22} />} label="Boar" onClick={() => handleTypeSelect('boar')} />
                    <TypeCard icon={<Users size={22} />} label="Batch" onClick={() => handleTypeSelect('batch')} />
                  </div>
                  <div className="mt-6">
                    <button type="button" onClick={resetAndClose} className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {step === 'form' && (
                <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-4 text-left">
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
                    <Field label="Date of Birth" error={errors.dateOfBirth} icon={<Calendar />}>
                      <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${errors.dateOfBirth ? inputErr : inputOk}`} />
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
                    <Field label="Weight (kg)" error={errors.weight} icon={<Weight />}>
                      <input type="number" step="0.1" value={form.weight} onChange={handleChange('weight')} placeholder="0.0" className={`${inputBase} ${errors.weight ? inputErr : inputOk}`} />
                    </Field>
                  </div>

                  {/* Pen and Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Pen Code" error={errors.penId} icon={<Home />}>
                      <select value={form.penId} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`} disabled={isLoadingData}>
                        <option value="">{isLoadingData ? 'Loading...' : 'Select Pen'}</option>
                        {pens.map(p => (
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

                  <div className="pt-4 flex gap-2">
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

function TypeCard({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2 py-6 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md cursor-pointer">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">{icon}</span>
      <span className="text-xs font-bold text-slate-700">{label}</span>
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