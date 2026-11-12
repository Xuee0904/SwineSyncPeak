import { useEffect, useRef, useState, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, Tag, Calendar, Home, Heart,
  AlertCircle, Baby, Weight, Activity, PlusCircle, Hash,
  Shuffle, BarChart2, Bookmark, ChevronLeft, ChevronDown, CheckCircle2, Users,
  Sparkles, ShoppingBag, ArrowRightLeft, Dna, Check,
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import useSmoothStepTransition from '../../hooks/useSmoothStepTransition';
import useFormDraft, { fetchDraftPayload } from '../../hooks/useFormDraft';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import DraftBanner from '../DraftBanner';
import toast from '../../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const SOURCE_OPTIONS = [
  { value: 'born_in_farm', label: 'Born in Farm', hint: 'Internal breeding cycle' },
  { value: 'purchased', label: 'Purchased', hint: 'External supplier acquisition' },
  { value: 'transferred', label: 'Transferred', hint: 'Moved from another facility' },
];

const STATUS_OPTIONS = ['suckling', 'weaned', 'healthy', 'sick', 'quarantine'];

const EMPTY_FORM = {
  batchTag: '',
  sowId: '',
  penId: '',
  dateOfBirth: '',
  breed: '',
  sourceOrigin: 'born_in_farm',
  supplierName: '',
  arrivalDate: '',
  totalBornAlive: '',
  currentCount: '',
  stillbornCount: '0',
  mummyCount: '0',
  averageWeight: '',
  status: 'suckling',
  assignedProgramId: '',
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

export function getAgeInDays(dobStr) {
  if (!dobStr) return null;
  const parts = dobStr.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - birth) / (1000 * 60 * 60 * 24));
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
  initialData,
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
  } = useFormDraft('swinesync_draft_add_piglet_batch', () => ({ ...EMPTY_FORM }), { autoRestore, onRestored });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Dropdown data
  const [pensState, setPens] = useState([]);
  const [sows, setSows] = useState([]);
  const [breedsState, setBreeds] = useState([]);
  const [programsState, setPrograms] = useState([]);
  const [existingTags, setExistingTags] = useState(new Set());
  const [isTagManuallyEdited, setIsTagManuallyEdited] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const pens = pensState.length > 0 ? pensState : (propPens || []);
  const breeds = propBreeds || breedsState;

  const availablePensForBatch = pens.filter(p => {
    if (p.section === 'B' || p.section === 'BOAR') return false;

    let ageInDays = null;
    if (form.dateOfBirth) {
      ageInDays = getAgeInDays(form.dateOfBirth);
    }
    const currentStatus = (form.status || '').toLowerCase();
    const isWeaned = currentStatus === 'weaned' || (currentStatus !== 'suckling' && ageInDays !== null && ageInDays > 28);
    const isNursing = currentStatus === 'suckling' || (currentStatus !== 'weaned' && ageInDays !== null && ageInDays <= 28);

    const incomingCount = parseInt(form.currentCount || form.totalBornAlive) || 1;

    // The selected mother sow's pen is always accessible when nursing
    const selectedSow = sows.find(s => String(s.id) === String(form.sowId));
    if (selectedSow && selectedSow.penId && String(p.id) === String(selectedSow.penId)) {
      if (!isWeaned) return true;
    }

    if (isWeaned) {
      if (p.section !== 'W' && p.section !== 'WEANED') return false;
      return typeof p.remaining === 'number' ? (String(p.id) === String(form.penId) || p.remaining >= incomingCount) : true;
    }
    if (isNursing) {
      if (p.section !== 'S' && p.section !== 'SOW') return false;
      return typeof p.remaining === 'number' ? (String(p.id) === String(form.penId) || p.remaining >= incomingCount) : true;
    }

    if (String(p.id) === String(form.penId)) return true;
    return typeof p.remaining === 'number' ? p.remaining >= incomingCount : true;
  }).sort((a, b) => {
    const aName = a.name || a.pen_number || '';
    const bName = b.name || b.pen_number || '';
    const aIsM = aName.startsWith('M');
    const bIsM = bName.startsWith('M');
    if (aIsM && !bIsM) return -1;
    if (!aIsM && bIsM) return 1;
    return aName.localeCompare(bName, undefined, { numeric: true });
  });

  // Breed combo-box
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
    if (!isOpen) return;
    setErrors({});
    setSubmitError(null);
    setIsTagManuallyEdited(Boolean(initialData?.batchTag));
    if (!autoRestore) {
      Promise.resolve().then(() => {
        checkDraft();
        resetForm(() => ({
          ...EMPTY_FORM,
          batchTag: initialData?.dateOfBirth ? buildUniqueTag('BTC', initialData.dateOfBirth, new Set()) : '',
          ...initialData
        }));
      });
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, sowsRes, breedsRes, programsRes, activePigsRes, archivedPigsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens`),
          fetch(`${API_BASE}/api/sows`),
          fetch(`${API_BASE}/api/breeds`),
          fetch(`${API_BASE}/api/growth/programs?archived=false`),
          fetch(`${API_BASE}/api/pigs?limit=9999`),
          fetch(`${API_BASE}/api/pigs/archived?limit=9999`),
        ]);
        const [pensData, sowsData, breedsData, programsData, activePigsData, archivedPigsData] = await Promise.all([
          pensRes.json(),
          sowsRes.json(),
          breedsRes.json(),
          programsRes.json(),
          activePigsRes.ok ? activePigsRes.json() : { data: [] },
          archivedPigsRes.ok ? archivedPigsRes.json() : { data: [] },
        ]);
        setPens(pensData.data || []);
        setSows(sowsData.data || []);
        setBreeds(breedsData.data || []);
        setPrograms(programsData || []);

        const tagSet = new Set();
        [...(activePigsData.data || []), ...(archivedPigsData.data || [])].forEach((p) => {
          const t = (p.tag || p.pig_tag || p.batch_code || '').trim().toUpperCase();
          if (t) tagSet.add(t);
        });
        setExistingTags(tagSet);

        if (initialData?.dateOfBirth && !initialData?.batchTag) {
          setForm(prev => ({
            ...prev,
            batchTag: buildUniqueTag('BTC', initialData.dateOfBirth, tagSet),
          }));
        }
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
    if (field === 'batchTag') {
      setIsTagManuallyEdited(value.trim().length > 0);
    }
    setForm(prev => {
      const nextForm = { ...prev, [field]: value };
      let currentStatus = (nextForm.status || '').toLowerCase();

      if (field === 'dateOfBirth') {
        if (!isTagManuallyEdited || !prev.batchTag.trim()) {
          nextForm.batchTag = value ? buildUniqueTag('BTC', value, existingTags) : '';
        }
        if (value) {
          const age = getAgeInDays(value);
          if (age !== null && age >= 0) {
            if (age <= 28) {
              nextForm.status = 'suckling';
              currentStatus = 'suckling';
            } else {
              nextForm.status = 'weaned';
              currentStatus = 'weaned';
            }
          }
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
      if ((!isTagManuallyEdited || !form.batchTag.trim()) && errors.batchTag) {
        setErrors(prev => ({ ...prev, batchTag: undefined }));
      }
    } else if (field === 'status') {
      if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
      if (errors.penId) setErrors(prev => ({ ...prev, penId: undefined }));

      if (form.dateOfBirth) {
        const age = getAgeInDays(form.dateOfBirth);
        const chosenStatus = (value || '').toLowerCase();
        if (age !== null && age >= 0) {
          if (chosenStatus === 'suckling' && age > 28) {
            setErrors(prev => ({
              ...prev,
              status: `Piglets > 28 days old (${age} days old) must be marked Weaned (or check birth date if still suckling)`
            }));
          } else if (chosenStatus === 'weaned' && age <= 28) {
            setErrors(prev => ({
              ...prev,
              status: `Piglets ≤ 28 days old (${age} days old) cannot be marked Weaned (must be Suckling or check birth date)`
            }));
          }
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
      const nextPenId = (currentStatus === 'weaned')
        ? prev.penId
        : (selectedSow && selectedSow.penId ? selectedSow.penId : prev.penId);

      // Auto-populate breed from Mother Sow if breed is currently blank
      const nextBreed = (!prev.breed?.trim() && selectedSow?.breed && selectedSow.breed !== '—')
        ? selectedSow.breed
        : prev.breed;

      return {
        ...prev,
        sowId,
        status: nextStatus,
        penId: nextPenId,
        breed: nextBreed,
      };
    });
    if (errors.sowId) setErrors(prev => ({ ...prev, sowId: undefined }));
    if (errors.penId && selectedSow && selectedSow.penId) setErrors(prev => ({ ...prev, penId: undefined }));
    if (errors.status) setErrors(prev => ({ ...prev, status: undefined }));
    if (errors.breed && selectedSow?.breed && selectedSow.breed !== '—') setErrors(prev => ({ ...prev, breed: undefined }));
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

    if (!form.batchTag.trim()) next.batchTag = 'Batch tag is required';
    if (!form.penId) next.penId = 'Select a pen';
    if (!form.breed?.trim()) next.breed = 'Breed is required';
    if (!form.assignedProgramId) next.assignedProgramId = 'Growth program is required';
    if (!form.dateOfBirth) {
      next.dateOfBirth = 'Date of birth is required';
    } else if (form.dateOfBirth > today) {
      next.dateOfBirth = 'Date of birth cannot be in the future';
    } else if (form.dateOfBirth < minDobStr) {
      next.dateOfBirth = 'Date of birth is too far in the past (max 15 years)';
    } else {
      const ageInDays = getAgeInDays(form.dateOfBirth);
      const chosenStatus = (form.status || '').toLowerCase();
      if (ageInDays !== null && ageInDays >= 0) {
        if (ageInDays <= 28 && chosenStatus === 'weaned') {
          next.status = `Piglets ≤ 28 days old (${ageInDays} days old) cannot be marked Weaned (must be Suckling or check birth date)`;
        } else if (ageInDays > 28 && chosenStatus === 'suckling') {
          next.status = `Piglets > 28 days old (${ageInDays} days old) must be marked Weaned (or check birth date if still suckling)`;
        }
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
      const ageInDays = getAgeInDays(form.dateOfBirth);

      if (selectedPen) {
        const batchCount = parseInt(form.currentCount || form.totalBornAlive) || 0;
        if (selectedPen.section === 'B' || selectedPen.section === 'BOAR') {
          next.penId = 'Piglet batches cannot be assigned to a Boar pen';
        } else if (selectedSow && selectedSow.penId && String(selectedPen.id) !== String(selectedSow.penId) && (!form.status || form.status.toLowerCase() === 'suckling')) {
          next.penId = `Must be assigned to Mother Sow #${selectedSow.tag}'s pen while suckling`;
        } else if (ageInDays !== null && ageInDays <= 28 && selectedPen.section !== 'S' && selectedPen.section !== 'SOW') {
          next.penId = 'Nursing piglets (≤ 28 days old) must be assigned to a Sow pen';
        } else if (ageInDays !== null && ageInDays > 28 && selectedPen.section !== 'W' && selectedPen.section !== 'WEANED') {
          next.penId = 'Weaned piglets (> 28 days old) must be assigned to a Weaned pen';
        } else if (typeof selectedPen.remaining === 'number' && batchCount > selectedPen.remaining && (!selectedSow || String(selectedPen.id) !== String(selectedSow.penId))) {
          next.penId = `Pen ${selectedPen.name} only has ${selectedPen.remaining} slot(s) left, but this batch has ${batchCount} piglet(s).`;
        }
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetAndClose = () => {
    resetForm(() => ({ ...EMPTY_FORM }));
    setIsTagManuallyEdited(false);
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
    resetForm(() => ({ ...EMPTY_FORM }));
    setIsTagManuallyEdited(false);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    setSubmitError(null);
    try {
      const result = await onSave?.({
        batchTag: form.batchTag.trim(),
        sowId: form.sourceOrigin === 'born_in_farm' ? (form.sowId || null) : null,
        penId: form.penId || null,
        dateOfBirth: form.dateOfBirth || null,
        breed: form.breed.trim() || null,
        sourceOrigin: form.sourceOrigin,
        supplierName: (form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred') ? form.supplierName?.trim() || null : null,
        arrivalDate: (form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred') ? form.arrivalDate || null : null,
        totalBornAlive: Number(form.totalBornAlive) || 0,
        currentCount: Number(form.totalBornAlive) || 0,
        stillbornCount: Number(form.stillbornCount) || 0,
        mummyCount: Number(form.mummyCount) || 0,
        averageWeight: (form.averageWeight !== '' && form.averageWeight !== undefined && form.averageWeight !== null && !isNaN(Number(form.averageWeight))) ? Number(form.averageWeight) : null,
        status: form.status,
        assignedProgramId: form.assignedProgramId || null,
      });
      clearDraft();
      toast.success('Batch Created', `Batch #${form.batchTag.trim()} created with ${Number(form.totalBornAlive) || 0} born alive.`);
      if (onSuccess) {
        onSuccess({
          type: 'Piglet Batch',
          tag: form.batchTag.trim(),
          message: 'Successfully registered to your active swine inventory.'
        }, result, form);
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
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-rose-50/10 text-slate-900";

  const todayStr = new Date().toISOString().split('T')[0];
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 15);
  const minDobStr = minDate.toISOString().split('T')[0];
  const batchAge = getAgeInDays(form.dateOfBirth);
  const isFutureDob = batchAge !== null && batchAge < 0;
  const isPastDob = Boolean(form.dateOfBirth && form.dateOfBirth < minDobStr);
  const isInvalidBornAlive = Boolean(form.totalBornAlive !== '' && form.totalBornAlive !== undefined && (isNaN(Number(form.totalBornAlive)) || Number(form.totalBornAlive) <= 0));
  const isInvalidWeight = Boolean(form.averageWeight && (isNaN(Number(form.averageWeight)) || Number(form.averageWeight) < 0 || Number(form.averageWeight) > 500));

  const selectedSow = sows.find(s => String(s.id) === String(form.sowId));
  const sowPen = selectedSow?.penId ? pens.find(p => String(p.id) === String(selectedSow.penId)) : null;
  const isSuckling = (form.status || '').toLowerCase() === 'suckling';
  const isPenAutoLinked = Boolean(selectedSow && selectedSow.penId && form.penId && String(form.penId) === String(selectedSow.penId) && isSuckling);

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
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Piglet Batch</h3>
          </div>
        </div>
        <button type="button" onClick={resetAndClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {/* ── Body ── */}
      <form
        id="batch-form"
        onSubmit={(e) => handleSubmit(e, 'finish')}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        {/* Main form body with stable min-height */}
        <div className="flex-1 min-h-[440px] max-h-[68vh] overflow-y-auto px-8 py-4 space-y-4 text-left">
          <DraftBanner
            hasDraft={hasDraft}
            draftInfo={draftInfo}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            isOffline={isOffline}
          />

          {/* Smooth animated submit error */}
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

          {/* Top: Source Origin */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Origin</p>
              <span className="text-[10px] text-slate-400 font-medium">Batch origin</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {SOURCE_OPTIONS.map(opt => {
                const isSelected = form.sourceOrigin === opt.value;
                const IconComp = opt.value === 'born_in_farm' ? Sparkles : opt.value === 'purchased' ? ShoppingBag : ArrowRightLeft;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({
                      ...p,
                      sourceOrigin: opt.value,
                      ...(opt.value !== 'born_in_farm' ? { sowId: '' } : {})
                    }))}
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

            {/* Smooth animated supplier tracking when purchased or transferred */}
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                form.sourceOrigin === 'purchased' || form.sourceOrigin === 'transferred'
                  ? 'grid-rows-[1fr] opacity-100 mt-2.5'
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
          </div>

          {/* Row 1: Date of Birth & Batch Tag */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Date of Birth"
              hint={batchAge !== null && batchAge >= 0 ? `${batchAge} day${batchAge === 1 ? '' : 's'} old` : undefined}
              error={errors.dateOfBirth || (isFutureDob ? 'Date of birth cannot be from the future' : isPastDob ? 'Date of birth is too far in the past (max 15 years)' : undefined)}
              icon={<Calendar />}
            >
              <input
                type="date"
                min={minDobStr}
                max={todayStr}
                value={form.dateOfBirth}
                onChange={handleChange('dateOfBirth')}
                disabled={!!initialData?.dateOfBirth}
                className={`${inputBase} ${errors.dateOfBirth || isFutureDob || isPastDob ? inputErr : inputOk} ${!!initialData?.dateOfBirth ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
              />
            </Field>

            <Field label="Batch Tag" error={errors.batchTag} icon={<Tag />}>
              <input
                type="text"
                value={form.batchTag}
                onChange={handleChange('batchTag')}
                placeholder="e.g. BTC-YYYYMMDD"
                className={`${inputBase} ${errors.batchTag ? inputErr : inputOk}`}
              />
            </Field>
          </div>

          {/* Row 2: Mother Sow & Pen Assignment (Mother Sow placed FIRST to guide pen assignment) */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={
                <span>
                  Mother Sow <span className="font-normal text-slate-400 lowercase">(optional)</span>
                </span>
              }
              hint={
                form.sourceOrigin !== 'born_in_farm'
                  ? 'External batch'
                  : (selectedSow ? `Selected #${selectedSow.tag}` : 'Internal cycle')
              }
              error={errors.sowId}
              icon={<Heart />}
            >
              <select
                value={form.sowId}
                onChange={handleSowChange}
                disabled={isLoadingData || !!initialData?.sowId || form.sourceOrigin !== 'born_in_farm'}
                className={`${inputBase} pr-9 ${errors.sowId ? inputErr : inputOk} appearance-none cursor-pointer ${(form.sourceOrigin !== 'born_in_farm' || !!initialData?.sowId) ? 'bg-slate-50 cursor-not-allowed text-slate-400' : ''}`}
              >
                <option value="">
                  {form.sourceOrigin !== 'born_in_farm'
                    ? 'N/A (External batch)'
                    : (isLoadingData ? 'Loading…' : 'None / Unknown')}
                </option>
                {form.sourceOrigin === 'born_in_farm' && sows.map(s => {
                  const penObj = pens.find(p => String(p.id) === String(s.penId));
                  return (
                    <option key={s.id} value={s.id}>
                      #{s.tag} — {s.breed}{penObj ? ` (Pen ${penObj.name})` : ''}
                    </option>
                  );
                })}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>

            <Field
              label="Pen Assignment"
              error={errors.penId}
              hint={
                isPenAutoLinked ? (
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                    <Check size={10} className="stroke-[2.5]" /> Auto-synced ({sowPen?.name || 'Sow Pen'})
                  </span>
                ) : undefined
              }
              icon={<Home />}
            >
              <select
                value={form.penId}
                onChange={handleChange('penId')}
                disabled={isLoadingData || !!initialData?.penId}
                className={`${inputBase} pr-9 ${errors.penId ? inputErr : inputOk} appearance-none cursor-pointer ${!!initialData?.penId ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
              >
                <option value="">{isLoadingData ? 'Loading…' : 'Select Pen'}</option>
                {availablePensForBatch.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slots)` : ''}
                    {selectedSow && String(p.id) === String(selectedSow.penId) ? " ★ Mother Sow's Pen" : ''}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>
          </div>

          {/* Row 3: Initial Head Count & Average Weight */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Initial Head Count" error={errors.totalBornAlive || (isInvalidBornAlive ? 'Enter at least 1 piglet' : undefined)} icon={<Baby />}>
              <input type="number" min="1" value={form.totalBornAlive} onChange={handleBornAliveChange} placeholder="e.g. 10" className={`${inputBase} ${errors.totalBornAlive || isInvalidBornAlive ? inputErr : inputOk}`} />
            </Field>

            <Field
              label={
                <span>
                  Average Weight (kg) <span className="font-normal text-slate-400 lowercase">(optional)</span>
                </span>
              }
              error={errors.averageWeight || (isInvalidWeight ? (Number(form.averageWeight) < 0 ? 'Weight cannot be negative' : 'Weight cannot exceed 500 kg') : undefined)}
              icon={<Weight />}
            >
              <input
                type="number"
                min="0"
                max="500"
                step="0.1"
                value={form.averageWeight}
                onChange={handleChange('averageWeight')}
                placeholder="Leave blank or e.g. 1.5"
                className={`${inputBase} ${errors.averageWeight || isInvalidWeight ? inputErr : inputOk}`}
              />
            </Field>
          </div>

          {/* Row 4: Breed & Status (with auto-sync from birth date & mother sow) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Breed combo-box */}
            <div className="relative" ref={breedWrapRef}>
              <Field
                label="Breed"
                hint={selectedSow?.breed && form.breed === selectedSow.breed ? 'Inherited from Sow' : undefined}
                error={errors.breed}
                icon={<Dna />}
              >
                <input
                  type="text"
                  value={form.breed}
                  onChange={(e) => {
                    handleChange('breed')(e);
                    setIsSearchingBreed(true);
                    setBreedOpen(true);
                  }}
                  onFocus={() => setBreedOpen(true)}
                  placeholder={isLoadingData ? 'Loading…' : 'Select or type a breed'}
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
              label="Status"
              error={errors.status}
              hint={
                batchAge !== null && batchAge >= 0
                  ? (batchAge <= 28 ? 'Auto: Suckling (≤28d)' : 'Auto: Weaned (>28d)')
                  : undefined
              }
              icon={<Activity />}
            >
              <select value={form.status} onChange={handleChange('status')} className={`${inputBase} pr-9 ${errors.status ? inputErr : inputOk} appearance-none cursor-pointer`}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </span>
            </Field>
          </div>

          {/* Row 5: Growth Program (Required) */}
          <Field label="Growth Program" error={errors.assignedProgramId} icon={<Bookmark />}>
            <select
              value={form.assignedProgramId || ''}
              onChange={handleChange('assignedProgramId')}
              disabled={isLoadingData || !!initialData?.assignedProgramId}
              className={`${inputBase} pr-9 ${errors.assignedProgramId ? inputErr : inputOk} appearance-none cursor-pointer ${!!initialData?.assignedProgramId ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
            >
              <option value="" disabled>{isLoadingData ? 'Loading…' : 'Select Growth Program...'}</option>
              {programsState.map(p => (
                <option key={p.program_id} value={p.program_id}>{p.name}</option>
              ))}
            </select>
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <ChevronDown size={14} />
            </span>
          </Field>
        </div>
      </form>

      {/* ── Footer ── */}
      <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={resetAndClose}
          className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="batch-form"
          disabled={isSaving || isLoadingData}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} className="stroke-[2.5]" />
          )}
          <span>Save Batch</span>
        </button>
      </div>
    </div>
  );
}

export default function AddPigletBatchModal({ isOpen, onClose, onSave, pens, breeds, initialData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [step, setStep] = useState('form');
  const [successInfo, setSuccessInfo] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const { containerRef, style: stepTransitionStyle } = useSmoothStepTransition(step);

  useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setSuccessInfo(null);
    }
  }, [isOpen]);

  const handleModalClose = () => {
    requestClose(onClose);
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleModalClose(); }}
    >
      <div
        ref={containerRef}
        style={stepTransitionStyle}
        className={`flex max-h-[86vh] w-full ${step === 'success' ? 'max-w-md' : 'max-w-2xl'
          } flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transition-[max-width] duration-300 ease-in-out ${panelClassName}`}
      >
        {step === 'success' ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mx-auto">
              <CheckCircle2 size={28} strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900">
                {successInfo?.tag} Added!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {successInfo?.message || 'Successfully registered to your active swine inventory.'}
              </p>
            </div>

            <div className="pt-2 w-full flex flex-col gap-2.5">
              {!initialData && (
                <button
                  type="button"
                  onClick={() => {
                    setFormKey(k => k + 1);
                    setStep('form');
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle size={16} />
                  Add Another Batch
                </button>
              )}
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <AddPigletBatchForm
            key={formKey}
            isOpen={isOpen}
            onClose={handleModalClose}
            onSave={onSave}
            onSuccess={(info) => {
              setSuccessInfo(info);
              setStep('success');
            }}
            pens={pens}
            breeds={breeds}
            initialData={initialData}
          />
        )}
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
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
            {cloneElement(icon, { size: 14 })}
          </span>
        )}
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