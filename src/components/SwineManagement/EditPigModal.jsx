import React, { useState, useEffect, useRef, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Calendar, Weight, Home, Activity, Ruler, Loader2, AlertCircle, PlusCircle, Baby, Hash, Shuffle, CheckCircle2, ArrowLeft, Users, ChevronDown, Dna, Check, Sparkles, ShoppingBag, ArrowRightLeft } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import toast from '../../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Cull'];
const BATCH_STATUS_OPTIONS = ['Suckling', 'Weaned', 'Nursery', 'Fattening', 'Sick', 'Quarantine'];

const SOURCE_OPTIONS = [
  { value: 'born_in_farm', label: 'Born in Farm', hint: 'Internal breeding cycle' },
  { value: 'purchased', label: 'Purchased', hint: 'External supplier acquisition' },
  { value: 'transferred', label: 'Transferred', hint: 'Moved from another facility' },
];

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
    currentCount: fullPig.current_count !== undefined && fullPig.current_count !== null ? fullPig.current_count : (fullPig.total_born_alive ?? ''),
    stillbornCount: fullPig.stillborn_count !== undefined && fullPig.stillborn_count !== null ? fullPig.stillborn_count : 0,
    mummyCount: fullPig.mummy_count !== undefined && fullPig.mummy_count !== null ? fullPig.mummy_count : 0,
    sourceOrigin: fullPig.source_origin || fullPig.sourceOrigin || 'born_in_farm',
    supplierName: fullPig.supplier_name || fullPig.supplierName || '',
    arrivalDate: fullPig.arrival_date || fullPig.arrivalDate ? String(fullPig.arrival_date || fullPig.arrivalDate).slice(0, 10) : '',
  };
}

export function EditPigForm({ pigData, pens = [], breeds = [], onSave, onCancel, onSuccess, isArchived = false, isLoadingData = false, maxHeightClass = 'max-h-[88vh]' }) {
  const isBatch = pigData?.category === 'Piglet Batch' || Boolean(pigData?.batch_tag) || (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  const [form, setForm] = useState(() => toFormState(pigData || {}));
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [breedOpen, setBreedOpen] = useState(false);
  const [isSearchingBreed, setIsSearchingBreed] = useState(false);
  const breedWrapRef = useRef(null);

  useEffect(() => {
    if (pigData) {
      setForm(toFormState(pigData));
      setErrors({});
      setSubmitError(null);
    }
  }, [pigData]);

  useEffect(() => {
    const handler = (e) => {
      if (breedWrapRef.current && !breedWrapRef.current.contains(e.target)) {
        setBreedOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm(p => {
      const nextForm = { ...p, [field]: value };
      if (isBatch) {
        let currentStatus = (nextForm.status || pigData?.status || '').toLowerCase();
        if (field === 'dateOfBirth' && value) {
          const ageInDays = Math.floor((new Date() - new Date(value)) / (1000 * 60 * 60 * 24));
          if (ageInDays <= 28) {
            nextForm.status = 'Suckling';
            currentStatus = 'suckling';
          } else if (ageInDays > 28 && currentStatus === 'suckling') {
            nextForm.status = 'Weaned';
            currentStatus = 'weaned';
          }
        } else if (field === 'status') {
          currentStatus = (value || '').toLowerCase();
        }

        const currentPen = pens.find(pen => String(pen.id) === String(nextForm.penId || pigData?.pen_id));
        if (currentStatus === 'weaned' && currentPen && (currentPen.section !== 'W' && currentPen.section !== 'WEANED')) {
          nextForm.penId = '';
        } else if (currentStatus === 'suckling' && currentPen && (currentPen.section !== 'S' && currentPen.section !== 'SOW')) {
          nextForm.penId = '';
        }
      }
      return nextForm;
    });

    if (field === 'dateOfBirth') {
      if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: undefined }));
      if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
    } else if (field === 'status') {
      if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
      if (errors.penId) setErrors(prev => ({ ...prev, penId: undefined }));

      if (isBatch) {
        const dob = form.dateOfBirth || pigData?.date_of_birth;
        if (dob) {
          const ageInDays = Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24));
          const chosenStatus = (value || '').toLowerCase();
          if (chosenStatus === 'suckling' && ageInDays > 28) {
            setErrors(prev => ({
              ...prev,
              status: `Piglet batches > 28 days old (${ageInDays} days old) must be "Weaned" (or check birth date if still suckling)`
            }));
          } else if (chosenStatus === 'weaned' && ageInDays <= 28) {
            setErrors(prev => ({
              ...prev,
              status: `Piglet batches <= 28 days old (${ageInDays} days old) cannot be "Weaned" (must be Suckling or check birth date)`
            }));
          }
        }
      }
    } else if (field === 'currentCount' || field === 'totalBornAlive') {
      if (isBatch) {
        const nextBorn = field === 'totalBornAlive' ? value : form.totalBornAlive;
        const nextCurrent = field === 'currentCount' ? value : form.currentCount;
        const bornNum = nextBorn !== '' && nextBorn !== undefined && nextBorn !== null ? Number(nextBorn) : null;
        const currentNum = nextCurrent !== '' && nextCurrent !== undefined && nextCurrent !== null ? Number(nextCurrent) : null;

        if (currentNum !== null && !isNaN(currentNum)) {
          if (currentNum < 0) {
            setErrors(prev => ({ ...prev, currentCount: 'Current headcount cannot be negative' }));
          } else if (bornNum !== null && !isNaN(bornNum) && currentNum > bornNum) {
            setErrors(prev => ({ ...prev, currentCount: `Current headcount (${currentNum}) cannot exceed initial count (${bornNum})` }));
          } else {
            setErrors(prev => ({ ...prev, currentCount: undefined }));
          }
        } else {
          setErrors(prev => ({ ...prev, currentCount: undefined }));
        }

        if (field === 'totalBornAlive') {
          if (bornNum !== null && !isNaN(bornNum) && bornNum <= 0) {
            setErrors(prev => ({ ...prev, totalBornAlive: 'Enter at least 1 piglet born alive' }));
          } else {
            setErrors(prev => ({ ...prev, totalBornAlive: undefined }));
          }
        }
      } else {
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    } else {
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 15);
  const minDobStr = minDate.toISOString().split('T')[0];

  const isFutureDob = Boolean(form.dateOfBirth && form.dateOfBirth > todayStr);
  const isPastDob = Boolean(form.dateOfBirth && form.dateOfBirth < minDobStr);
  const isInvalidWeight = Boolean(form.weight !== '' && form.weight !== undefined && form.weight !== null && (isNaN(Number(form.weight)) || Number(form.weight) < 0 || Number(form.weight) > 500));
  const isInvalidBornAlive = Boolean(isBatch && form.totalBornAlive !== '' && form.totalBornAlive !== undefined && form.totalBornAlive !== null && Number(form.totalBornAlive) <= 0);

  const currentCountNum = form.currentCount !== '' && form.currentCount !== undefined && form.currentCount !== null ? Number(form.currentCount) : null;
  const totalBornNum = form.totalBornAlive !== '' && form.totalBornAlive !== undefined && form.totalBornAlive !== null ? Number(form.totalBornAlive) : null;

  const currentCountExceedsInitial = Boolean(
    isBatch &&
    currentCountNum !== null &&
    totalBornNum !== null &&
    !isNaN(currentCountNum) &&
    !isNaN(totalBornNum) &&
    currentCountNum > totalBornNum
  );

  const currentCountNegative = Boolean(
    isBatch &&
    currentCountNum !== null &&
    !isNaN(currentCountNum) &&
    currentCountNum < 0
  );

  const inlineCurrentCountError = errors.currentCount || (
    currentCountExceedsInitial
      ? `Current headcount (${form.currentCount}) cannot exceed initial count (${form.totalBornAlive})`
      : currentCountNegative
        ? 'Current headcount cannot be negative'
        : undefined
  );

  const validate = () => {
    const next = {};
    if (!form.tagNumber?.trim()) next.tagNumber = 'Required';
    if (!form.breed?.trim()) next.breed = 'Required';
    if (form.dateOfBirth) {
      if (form.dateOfBirth > todayStr) {
        next.dateOfBirth = 'Date of birth cannot be from the future';
      } else if (form.dateOfBirth < minDobStr) {
        next.dateOfBirth = 'Date of birth is too far in the past (max 15 years)';
      }
    }
    if (form.weight !== '' && form.weight !== undefined && form.weight !== null) {
      const w = Number(form.weight);
      if (isNaN(w)) {
        next.weight = 'Weight must be a valid number';
      } else if (w < 0) {
        next.weight = 'Weight cannot be negative';
      } else if (w > 500) {
        next.weight = 'Weight cannot exceed 500 kg';
      }
    }
    if (isBatch) {
      if (!form.totalBornAlive || Number(form.totalBornAlive) <= 0) {
        next.totalBornAlive = 'Enter at least 1 piglet born alive';
      }
      if (form.currentCount !== '' && form.currentCount !== undefined && form.currentCount !== null) {
        const c = Number(form.currentCount);
        if (isNaN(c) || c < 0) {
          next.currentCount = 'Current headcount cannot be negative';
        } else if (c > Number(form.totalBornAlive || Infinity)) {
          next.currentCount = `Current headcount (${c}) cannot exceed initial count (${form.totalBornAlive})`;
        }
      }
      const dob = form.dateOfBirth || pigData?.date_of_birth;
      if (dob) {
        const ageInDays = Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24));
        const statusStr = (form.status || pigData?.status || '').toLowerCase();
        if (ageInDays <= 28 && statusStr === 'weaned') {
          next.status = 'Piglet batches <= 28 days old cannot have status "Weaned" (must be Suckling)';
        } else if (ageInDays > 28 && statusStr === 'suckling') {
          next.status = 'Piglet batches > 28 days old must be "Weaned" (no longer Suckling)';
        }
      }
    }
    if (!form.penId) {
      next.penId = 'Select a pen';
    } else if (form.penId && !next.penId) {
      const selectedPen = pens.find(p => String(p.id) === String(form.penId));
      if (selectedPen) {
        const isSamePen = pigData && String(pigData.pen_id || pigData.penId) === String(form.penId);
        const currentCountInPen = isSamePen
          ? (isBatch ? (pigData?.current_count ?? pigData?.total_born_alive ?? 0) : 1)
          : 0;
        const incomingCount = isBatch
          ? (parseInt(form.currentCount ?? form.totalBornAlive) || 1)
          : 1;
        const effectiveRemaining = isSamePen
          ? (typeof selectedPen.remaining === 'number' ? selectedPen.remaining + currentCountInPen : Infinity)
          : (typeof selectedPen.remaining === 'number' ? selectedPen.remaining : Infinity);

        if (incomingCount > effectiveRemaining) {
          next.penId = `Pen ${selectedPen.name} only has ${effectiveRemaining} slot(s) available for this update.`;
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const currentGender = (pigData?.gender && pigData.gender.toLowerCase().startsWith('f')) || pigData?.type?.toLowerCase() === 'sow' || pigData?.category?.toLowerCase() === 'sow'
    ? 'Female'
    : (pigData?.gender && pigData.gender.toLowerCase().startsWith('m')) || pigData?.type?.toLowerCase() === 'boar' || pigData?.category?.toLowerCase() === 'boar'
      ? 'Male'
      : (pigData?.gender || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isArchived || !validate()) return;

    setIsSaving(true);
    setSubmitError(null);
    try {
      const savedRecord = await onSave?.(pigData.id, {
        ...form,
        gender: currentGender,
        weight: form.weight ? Number(form.weight) : null,
        averageWeight: form.weight ? Number(form.weight) : null,
        parityCount: pigData.category === 'Sow' ? Number(form.parityCount) : undefined,
        totalBornAlive: isBatch ? Number(form.totalBornAlive) || 0 : undefined,
        currentCount: isBatch ? (form.currentCount !== '' && form.currentCount !== undefined ? Number(form.currentCount) : Number(form.totalBornAlive) || 0) : undefined,
        stillbornCount: isBatch ? Number(form.stillbornCount) || 0 : undefined,
        mummyCount: isBatch ? Number(form.mummyCount) || 0 : undefined,
        category: pigData.category,
        isBatch,
      });
      const updatedInfo = {
        type: isBatch ? 'Piglet Batch' : pigData.category || 'Swine',
        tag: form.tagNumber || pigData.pig_tag || pigData.batch_tag || pigData.id,
        message: 'Successfully updated in your active swine inventory.'
      };
      toast.success(isBatch ? `Batch #${form.tagNumber} updated successfully!` : `Swine #${form.tagNumber} updated successfully!`);
      if (typeof onSuccess === 'function') onSuccess(savedRecord || { ...pigData, ...form }, updatedInfo);
    } catch (err) {
      setSubmitError(err.message || 'Failed to update record.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentStatus = form.status?.toLowerCase() || pigData?.status?.toLowerCase() || '';
  const sortPens = (a, b) => {
    const aName = a.name || a.pen_number || '';
    const bName = b.name || b.pen_number || '';
    const aIsM = aName.startsWith('M');
    const bIsM = bName.startsWith('M');
    if (aIsM && !bIsM) return -1;
    if (!aIsM && bIsM) return 1;
    return aName.localeCompare(bName, undefined, { numeric: true });
  };

  const isSickOrQuarantine = currentStatus === 'sick' || currentStatus === 'quarantine';
  const availablePensForPig = pens.filter(p => {
    if (String(p.id) === String(pigData?.pen_id || form.penId)) return true;
    const isQPen = p.section === 'Q' || p.section === 'QUARANTINE';
    if (!isSickOrQuarantine && isQPen) return false;
    if (isSickOrQuarantine && !isQPen) return false;

    if (currentGender === 'Female') {
      if (!isQPen && p.section !== 'S' && p.section !== 'SOW') return false;
      if ((p.section === 'S' || p.section === 'SOW') && (p.hasSow || p.sowCount >= 1 || p.pigCount >= 1)) return false;
    }
    if (currentGender === 'Male') {
      if (p.section !== 'B' && p.section !== 'BOAR') return false;
      if (p.hasBoar || p.boarCount >= 1 || p.pigCount >= 1) return false;
    }
    return typeof p.remaining === 'number' ? p.remaining > 0 : true;
  }).sort(sortPens);
  const availablePensForBatch = pens.filter(p => {
    if (p.section === 'B' || p.section === 'BOAR') return false;

    let ageInDays = null;
    const dob = form.dateOfBirth || pigData?.date_of_birth;
    if (dob) {
      ageInDays = Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24));
    }
    const currentStatus = (form.status || pigData?.status || '').toLowerCase();
    const isWeaned = currentStatus === 'weaned' || (currentStatus !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isNursing = currentStatus === 'suckling' || (currentStatus !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    if (isWeaned) {
      if (p.section !== 'W' && p.section !== 'WEANED') return false;
      return typeof p.remaining === 'number' ? (String(p.id) === String(pigData?.pen_id || form.penId) || p.remaining > 0) : true;
    }
    if (isNursing) {
      if (p.section !== 'S' && p.section !== 'SOW') return false;
      return true;
    }

    if (String(p.id) === String(pigData?.pen_id || form.penId)) return true;
    return typeof p.remaining === 'number' ? p.remaining > 0 : true;
  }).sort(sortPens);

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs pl-10 pr-4";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-900 bg-rose-50/10";

  return isBatch ? (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-8 pt-6 space-y-5 text-left">
        {isArchived && (
          <div className="p-3.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 font-medium">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>This record is archived and cannot be modified unless restored from archive.</span>
          </div>
        )}

        <fieldset disabled={isArchived} className="space-y-5">
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
            <Field label="Date of Birth" error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)} icon={<Calendar />}>
              <input type="date" min={minDobStr} max={todayStr} value={form.dateOfBirth ?? ''} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk}`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={breedWrapRef}>
              <Field label="Breed" error={errors.breed} icon={<Dna />}>
                <input
                  type="text"
                  value={form.breed ?? ''}
                  onChange={(e) => {
                    handleChange('breed')(e);
                    setIsSearchingBreed(true);
                    setBreedOpen(true);
                  }}
                  onFocus={() => setBreedOpen(true)}
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
                        Press save to use custom &ldquo;{form.breed}&rdquo;
                      </li>
                    )}
                  </ul>
                );
              })()}
            </div>
            <Field
              label={
                <span>
                  Average Weight (kg) <span className="font-normal text-slate-400 lowercase">(optional)</span>
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
                value={form.weight ?? ''}
                onChange={handleChange('weight')}
                placeholder="Leave blank or e.g. 1.5"
                className={`${inputBase} ${errors.weight || isInvalidWeight ? inputErr : inputOk}`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Pen Code" error={errors.penId} icon={<Home />}>
              <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} pr-9 ${errors.penId ? inputErr : inputOk} appearance-none cursor-pointer`}>
                <option value="">{availablePensForBatch.length === 0 ? 'No available pens' : 'Select Pen'}</option>
                {availablePensForBatch.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>
            <Field label="Status" error={errors.status} icon={<Activity />}>
              <select value={form.status ?? 'Suckling'} onChange={handleChange('status')} className={`${inputBase} pr-9 ${errors.status ? inputErr : inputOk} appearance-none cursor-pointer`}>
                {BATCH_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Initial Head Count" error={errors.totalBornAlive || (isInvalidBornAlive ? 'Enter at least 1 piglet' : undefined)} icon={<Baby />}>
                <input
                  type="number"
                  min="1"
                  value={form.totalBornAlive ?? ''}
                  onChange={handleChange('totalBornAlive')}
                  className={`${inputBase} ${errors.totalBornAlive || isInvalidBornAlive ? inputErr : inputOk}`}
                />
              </Field>

              <Field label="Current Head Count" error={inlineCurrentCountError} icon={<Users />}>
                <input
                  type="number"
                  min="0"
                  value={form.currentCount ?? ''}
                  onChange={handleChange('currentCount')}
                  className={`${inputBase} ${inlineCurrentCountError ? inputErr : inputOk}`}
                />
              </Field>
            </div>

            {/* Source Origin */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Source Origin</p>
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

            <div
              className={`grid transition-all duration-300 ease-in-out ${form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
                ? 'grid-rows-[1fr] opacity-100 pt-3'
                : 'grid-rows-[0fr] opacity-0 pt-0 pointer-events-none'
                }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 pb-1">
                  <Field label="Supplier / Breeder Name" icon={<Users />}>
                    <input type="text" value={form.supplierName || ''} onChange={handleChange('supplierName')} placeholder="e.g. AgriGenetics Inc." className={`${inputBase} ${inputOk}`} />
                  </Field>
                  <Field label="Arrival Date" icon={<Calendar />}>
                    <input type="date" value={form.arrivalDate || ''} onChange={handleChange('arrivalDate')} className={`${inputBase} ${inputOk}`} />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      <div className="px-8 py-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
        <button type="button" onClick={() => onCancel?.()} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={isSaving || isArchived} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Batch Record'}
        </button>
      </div>
    </form>
  ) : (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-8 pt-6 space-y-4 text-left">
        {isArchived && (
          <div className="p-3.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 font-medium">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>This record is archived and cannot be modified unless restored from archive.</span>
          </div>
        )}

        <fieldset disabled={isArchived} className="space-y-4">
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
            <Field label="Date of Birth" error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)} icon={<Calendar />}>
              <input type="date" value={form.dateOfBirth ?? ''} onChange={handleChange('dateOfBirth')} min={minDobStr} max={todayStr} className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk}`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={breedWrapRef}>
              <Field label="Breed" error={errors.breed} icon={<Dna />}>
                <input
                  type="text"
                  value={form.breed ?? ''}
                  onChange={(e) => {
                    handleChange('breed')(e);
                    setIsSearchingBreed(true);
                    setBreedOpen(true);
                  }}
                  onFocus={() => setBreedOpen(true)}
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
                        Press save to use custom &ldquo;{form.breed}&rdquo;
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
                value={form.weight ?? ''}
                onChange={handleChange('weight')}
                placeholder="Leave blank or e.g. 120.0"
                className={`${inputBase} ${errors.weight || isInvalidWeight ? inputErr : inputOk}`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Pen Code" error={errors.penId} icon={<Home />}>
              <select value={form.penId ?? ''} onChange={handleChange('penId')} className={`${inputBase} pr-9 ${errors.penId ? inputErr : inputOk} appearance-none cursor-pointer`}>
                <option value="">{availablePensForPig.length === 0 ? 'No available pens' : 'Select Pen'}</option>
                {availablePensForPig.map(p => (
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
              <select value={form.status ?? 'Healthy'} onChange={handleChange('status')} className={`${inputBase} pr-9 ${inputOk} appearance-none cursor-pointer`}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>
          </div>

          {pigData?.category === 'Sow' && (
            <div className="grid grid-cols-2 gap-4">
              <Field
                label={
                  <span>
                    Parity Count <span className="font-normal text-slate-400 lowercase">(0 for maiden gilts)</span>
                  </span>
                }
                icon={<Ruler />}
              >
                <input type="number" min="0" value={form.parityCount ?? ''} onChange={handleChange('parityCount')} className={`${inputBase} ${inputOk}`} />
              </Field>
            </div>
          )}

          {/* Source Origin */}
          <div className="pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Source Origin</p>
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

          <div
            className={`grid transition-all duration-300 ease-in-out ${form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
              ? 'grid-rows-[1fr] opacity-100 pt-3'
              : 'grid-rows-[0fr] opacity-0 pt-0 pointer-events-none'
              }`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-4 pb-1">
                <Field label="Supplier / Breeder Name" icon={<Users />}>
                  <input type="text" value={form.supplierName || ''} onChange={handleChange('supplierName')} placeholder="e.g. AgriGenetics Inc." className={`${inputBase} ${inputOk}`} />
                </Field>
                <Field label="Arrival Date" icon={<Calendar />}>
                  <input type="date" value={form.arrivalDate || ''} onChange={handleChange('arrivalDate')} className={`${inputBase} ${inputOk}`} />
                </Field>
              </div>
            </div>
          </div>
        </fieldset>
      </div>

      <div className="px-8 py-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
        <button type="button" onClick={() => onCancel?.()} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="submit" disabled={isSaving || isArchived} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Record'}
        </button>
      </div>
    </form>
  );
}

export function PigEditView({
  pigData,
  onSave,
  onCancel,
  onClose,
  onSuccess,
  showBackBtn = false,
  onBack,
  fetchDetailOnMount = false,
}) {
  const isBatch = pigData?.category === 'Piglet Batch' || Boolean(pigData?.batch_tag) || (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  // Data states for combo boxes
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Full record detail if requested
  const [detail, setDetail] = useState(pigData || null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const getId = (item) => item?.id || item?.pig_id || item?.batch_id;
  const prevIdRef = useRef(getId(pigData));

  useEffect(() => {
    if (pigData) {
      setDetail(pigData);
      const currentId = getId(pigData);
      if (currentId && prevIdRef.current && currentId !== prevIdRef.current) {
        prevIdRef.current = currentId;
        setSaveSuccess(false);
        setSuccessInfo(null);
      } else if (currentId && !prevIdRef.current) {
        prevIdRef.current = currentId;
      }
    }
  }, [pigData]);

  useEffect(() => {
    if (!fetchDetailOnMount || !pigData?.id) return;
    let cancelled = false;
    const loadDetail = async () => {
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await fetch(`${API_BASE}/api/pigs/${pigData.id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load record (status ${res.status})`);
        if (!cancelled) setDetail(body.data || pigData);
      } catch (err) {
        if (!cancelled) setDetailError(err.message || 'Failed to load this record.');
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    };
    loadDetail();
    return () => { cancelled = true; };
  }, [fetchDetailOnMount, pigData?.id]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, breedsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens`),
          fetch(`${API_BASE}/api/breeds`)
        ]);
        const p = await pensRes.json();
        const b = await breedsRes.json();
        if (!cancelled) {
          setPens(p.data || []);
          setBreeds(b.data || []);
        }
      } catch (err) {
        console.error("Error loading edit form data:", err);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const data = detail || pigData || {};
  const isArchived = Boolean(data.is_archived || data.status?.toLowerCase() === 'archived' || pigData?.is_archived || pigData?.status?.toLowerCase() === 'archived');
  const tag = data.pig_tag || data.batch_tag || data.id || '—';

  if (saveSuccess) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mx-auto">
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <div>
          <h4 className="text-xl font-black text-slate-900">
            {successInfo?.tag} Updated!
          </h4>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
            {successInfo?.message || 'The record has been updated and synced to your database.'}
          </p>
        </div>
        <div className="pt-2 w-full flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
      <div className="px-8 pt-7 pb-5 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          {showBackBtn ? (
            <button
              type="button"
              onClick={() => onBack ? onBack() : onCancel?.()}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              title="Back to details"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <PlusCircle size={20} />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit {isBatch ? 'Piglet Batch' : 'Swine Record'}</h3>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">#{tag}</p>
          </div>
        </div>
        <button onClick={() => onClose?.()} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {isLoadingDetail ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-hidden p-8 pt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><div className="h-3 w-20 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
              <div className="space-y-2"><div className="h-3 w-24 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><div className="h-3 w-16 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
              <div className="space-y-2"><div className="h-3 w-28 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><div className="h-3 w-20 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
              <div className="space-y-2"><div className="h-3 w-16 bg-slate-200 rounded-md animate-pulse" /><div className="h-11 w-full bg-slate-100 rounded-xl animate-pulse" /></div>
            </div>
            <div className="pt-4 border-t border-slate-100 space-y-3 mt-2">
              <div className="h-3 w-28 bg-slate-200 rounded-md animate-pulse" />
              <div className="grid grid-cols-3 gap-2.5">
                <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
          <div className="px-8 py-4 border-t border-slate-100 bg-white flex gap-3 shrink-0">
            <div className="flex-1 h-11 bg-slate-100 rounded-xl animate-pulse" />
            <div className="flex-1 h-11 bg-slate-200/60 rounded-xl animate-pulse" />
          </div>
        </div>
      ) : detailError ? (
        <div className="p-8 pt-6 space-y-4 text-left">
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-500" />
            <span>{detailError}</span>
          </div>
          <button type="button" onClick={() => onClose?.()} className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
            Close
          </button>
        </div>
      ) : (
        <EditPigForm
          pigData={data}
          pens={pens}
          breeds={breeds}
          onSave={onSave}
          onCancel={onCancel}
          onSuccess={(savedRecord, info) => {
            setSuccessInfo(info);
            setSaveSuccess(true);
            if (typeof onSuccess === 'function') {
              onSuccess(savedRecord, info);
            }
          }}
          isArchived={isArchived}
          isLoadingData={isLoadingData}
          maxHeightClass="max-h-[88vh]"
        />
      )}
    </div>
  );
}

export default function EditPigModal({ isOpen, onClose, onSave, pigData }) {
  const { shouldRender, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const isBatch = pigData?.category === 'Piglet Batch' || Boolean(pigData?.batch_tag) || (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  if (!shouldRender || !pigData) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300 ${overlayClassName}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        style={{ willChange: 'transform, opacity, max-width' }}
        className={`flex max-h-[86vh] flex-col w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative transition-[max-width] duration-300 ease-in-out ${panelClassName}`}
      >
        <PigEditView
          pigData={pigData}
          onSave={onSave}
          onCancel={() => requestClose()}
          onClose={() => requestClose()}
          fetchDetailOnMount={true}
        />
      </div>
    </div>,
    document.body
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