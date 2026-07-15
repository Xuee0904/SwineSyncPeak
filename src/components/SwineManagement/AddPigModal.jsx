import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, Venus, Mars, Users, Loader2 } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import AddPigletBatchModal from './AddPigletBatchModal';

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
  // z-[60] ensures we cover the module header/sidebar
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [step, setStep] = useState('select');
  const [gender, setGender] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  // Data states for combo boxes
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Custom styled breed combobox (replaces native <select>/<datalist> so it
  // matches the app's own dropdown look instead of the browser default)
  const [breedOpen, setBreedOpen] = useState(false);
  const breedWrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (breedWrapRef.current && !breedWrapRef.current.contains(e.target)) setBreedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 1. Fetch Pens and Breeds when modal opens
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  if (!shouldRender && !batchModalOpen) return null;

  const resetAndClose = () => {
    requestClose(() => {
      setStep('select');
      setGender(null);
      setForm(EMPTY_FORM);
      setErrors({});
      setIsSaving(false);
      setSubmitError(null);
      setBreedOpen(false);
    });
  };

  const handleTypeSelect = (type) => {
    if (type === 'batch') {
      requestClose(() => {
        setStep('select');
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
      resetAndClose();
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong while saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const title = step === 'select' ? 'Add New Swine' : `Add New ${gender}`;

  return (
    <>
      {shouldRender && (
        <div
          // z-[60] and backdrop-blur-md blurs the header and main module
          className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
          onMouseDown={(e) => e.target === e.currentTarget && resetAndClose()}
        >
          <div
            style={{ willChange: 'transform, opacity, max-width' }}
            className={`w-full overflow-hidden bg-white shadow-2xl rounded-2xl transition-[max-width] duration-300 ease-in-out ${
              step === 'select' ? 'max-w-lg' : 'max-w-2xl'
            } ${panelClassName}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                {step === 'form' && (
                  <button type="button" onClick={() => setStep('select')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    <ChevronLeft size={18} />
                  </button>
                )}
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">{title}</h2>
              </div>
              <button type="button" onClick={resetAndClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="transition-opacity duration-300">
              {step === 'select' && (
                <div className="px-6 py-8">
                  <div className="grid grid-cols-3 gap-4">
                    <TypeCard icon={<Venus size={28} />} label="Sow" onClick={() => handleTypeSelect('sow')} />
                    <TypeCard icon={<Mars size={28} />} label="Boar" onClick={() => handleTypeSelect('boar')} />
                    <TypeCard icon={<Users size={28} />} label="Batch" onClick={() => handleTypeSelect('batch')} />
                  </div>
                </div>
              )}

              {step === 'form' && (
                <form onSubmit={handleSubmit} className="px-6 py-6">
                  <div className="mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {gender === 'Female' ? <Venus size={14} /> : <Mars size={14} />}
                    Gender is automatically recorded as {gender}
                  </div>

                  {submitError && (
                    <div className="mb-5 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                      {submitError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tag Number" error={errors.tagNumber}>
                      <input type="text" value={form.tagNumber} onChange={handleChange('tagNumber')} placeholder="e.g. SW-29401" className={inputClass(errors.tagNumber)} />
                    </Field>

                    <Field label="Date of Birth" error={errors.dateOfBirth}>
                      <input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} className={inputClass(errors.dateOfBirth)} />
                    </Field>

                    {/* BREED COMBO BOX — single styled input + suggestion list, no popup second field */}
                    <div className="relative" ref={breedWrapRef}>
                      <Field
                        label="Breed"
                        error={errors.breed}
                        hint={
                          !errors.breed && form.breed.trim() && !breeds.some(b => b.name.toLowerCase() === form.breed.trim().toLowerCase())
                            ? 'New breed — will be added when you save'
                            : undefined
                        }
                      >
                        <input
                          type="text"
                          value={form.breed}
                          onChange={(e) => { handleChange('breed')(e); setBreedOpen(true); }}
                          onFocus={() => setBreedOpen(true)}
                          placeholder={isLoadingData ? 'Loading Breeds...' : 'Select or type a breed'}
                          disabled={isLoadingData}
                          className={inputClass(errors.breed)}
                          autoComplete="off"
                        />
                      </Field>
                      {breedOpen && !isLoadingData && (() => {
                        const filtered = breeds.filter(b =>
                          b.name.toLowerCase().includes(form.breed.trim().toLowerCase())
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                            {filtered.map(b => (
                              <li
                                key={b.breed_id}
                                onClick={() => {
                                  setForm((prev) => ({ ...prev, breed: b.name }));
                                  if (errors.breed) setErrors((prev) => ({ ...prev, breed: undefined }));
                                  setBreedOpen(false);
                                }}
                                className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                {b.name}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>

                    <Field label="Weight (kg)" error={errors.weight}>
                      <input type="number" step="0.1" value={form.weight} onChange={handleChange('weight')} placeholder="0.0" className={inputClass(errors.weight)} />
                    </Field>

                    {/* PEN CODE COMBO BOX */}
                    <Field label="Pen Code" error={errors.penId}>
                      <select 
                        value={form.penId} 
                        onChange={handleChange('penId')} 
                        className={inputClass(errors.penId)}
                        disabled={isLoadingData}
                      >
                        <option value="">{isLoadingData ? 'Loading Pens...' : 'Select Pen Code'}</option>
                        {pens.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{typeof p.remaining === 'number' ? ` (${p.remaining} slot${p.remaining === 1 ? '' : 's'} left)` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Status">
                      <select value={form.status} onChange={handleChange('status')} className={inputClass(false)}>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>

                    {gender === 'Female' && (
                      <Field label="Parity Count" hint="Times farrowed">
                        <input type="number" value={form.parityCount} onChange={handleChange('parityCount')} placeholder="0" className={inputClass(false)} />
                      </Field>
                    )}
                  </div>

                  <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                    <button type="button" onClick={resetAndClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={isSaving || isLoadingData} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {isSaving && <Loader2 size={16} className="animate-spin" />}
                      Save {gender}
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
    </>
  );
}

function TypeCard({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-8 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">{icon}</span>
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </button>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {hint && !error && <span className="text-[10px] text-slate-400">{hint}</span>}
      {error && <span className="text-[10px] font-semibold text-rose-500">{error}</span>}
    </label>
  );
}

function inputClass(hasError) {
  return `w-full rounded-xl border px-4 py-2.5 text-sm text-slate-700 outline-none transition-all focus:ring-4 ${
    hasError ? 'border-rose-200 focus:ring-rose-50' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-50'
  }`;
}