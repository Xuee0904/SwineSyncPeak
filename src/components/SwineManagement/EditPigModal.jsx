import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Calendar, Weight, Home, Activity, Ruler, Loader2, AlertCircle, PlusCircle } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Inactive'];

export default function EditPigModal({ isOpen, onClose, onSave, pigData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Data states for combo boxes
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Breed dropdown logic
  const [breedOpen, setBreedOpen] = useState(false);
  const breedWrapRef = useRef(null);

  // 1. Initialize form with existing pig data
  useEffect(() => {
    if (isOpen && pigData) {
      setForm({
        tagNumber: pigData.pig_tag || '',
        dateOfBirth: pigData.date_of_birth || '',
        breed: pigData.breed || '',
        weight: pigData.current_weight || '',
        penId: pigData.pen_id || '',
        status: pigData.status ? (pigData.status.charAt(0).toUpperCase() + pigData.status.slice(1)) : 'Healthy',
        parityCount: pigData.parity_count || '',
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, pigData]);

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
        weight: Number(form.weight),
        parityCount: pigData.category === 'Sow' ? Number(form.parityCount) : undefined,
      });
      requestClose();
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
      <div className={`w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative ${panelClassName}`}>
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <PlusCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Edit Swine Record</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">#{pigData.pig_tag || pigData.id}</p>
            </div>
          </div>
          <button onClick={() => requestClose()} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-4 text-left">
          {submitError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="text-rose-500" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Tag and DOB */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tag Number" error={errors.tagNumber} icon={<Tag />}>
              <input type="text" value={form.tagNumber} onChange={handleChange('tagNumber')} className={`${inputBase} ${errors.tagNumber ? inputErr : inputOk}`} />
            </Field>
            <Field label="Date of Birth" icon={<Calendar />}>
              <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} className={`${inputBase} ${inputOk}`} />
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
                  className={`${inputBase} ${errors.breed ? inputErr : inputOk}`}
                  autoComplete="off"
                />
              </Field>
              {breedOpen && !isLoadingData && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {breeds.filter(b => b.name.toLowerCase().includes(form.breed.toLowerCase())).map(b => (
                    <li key={b.breed_id} onClick={() => { setForm(p => ({...p, breed: b.name})); setBreedOpen(false); }} className="cursor-pointer px-4 py-2 text-xs hover:bg-emerald-50">{b.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Weight (kg)" icon={<Weight />}>
              <input type="number" step="0.1" value={form.weight} onChange={handleChange('weight')} className={`${inputBase} ${inputOk}`} />
            </Field>
          </div>

          {/* Pen and Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pen Code" error={errors.penId} icon={<Home />}>
              <select value={form.penId} onChange={handleChange('penId')} className={`${inputBase} ${errors.penId ? inputErr : inputOk} appearance-none`}>
                <option value="">Select Pen</option>
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

          {pigData.category === 'Sow' && (
            <Field label="Parity Count" icon={<Ruler />}>
              <input type="number" value={form.parityCount} onChange={handleChange('parityCount')} className={`${inputBase} ${inputOk}`} />
            </Field>
          )}

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => requestClose()} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Update Record'}
            </button>
          </div>
        </form>
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