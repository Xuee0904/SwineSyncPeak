import { useEffect, useMemo, useState } from 'react';
import { X, Camera, Heart, PackagePlus, Syringe, Loader2 } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

const SOURCE_OPTIONS = [
  { value: 'born_in_farm', label: 'Born in Farm', hint: 'Internal breeding cycle' },
  { value: 'purchased', label: 'Purchased', hint: 'External supplier acquisition' },
  { value: 'transferred', label: 'Transferred', hint: 'Moved from another facility' },
];

const EMPTY_FORM = {
  batchName: '',
  dateAdded: '',
  penLocation: '',
  breed: '',
  sourceOrigin: 'born_in_farm',
  maleCount: '',
  femaleCount: '',
  growthProgram: '',
};

function generateBatchId() {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `BTC-${now.getFullYear()}-${month}-${suffix}`;
}

export default function AddPigletBatchModal({ isOpen, onClose, onSave }) {
  const { shouldRender, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [batchId] = useState(generateBatchId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setErrors({});
  }, [isOpen]);

  const totalHerdCount = useMemo(() => {
    const male = Number(form.maleCount) || 0;
    const female = Number(form.femaleCount) || 0;
    return male + female;
  }, [form.maleCount, form.femaleCount]);

  if (!shouldRender) return null;

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const resetAndClose = () => {
    requestClose(() => {
      resetForm();
      setIsSaving(false);
    });
  };

  const validate = () => {
    const next = {};
    if (!form.batchName.trim()) next.batchName = 'Batch name is required';
    if (!form.dateAdded) next.dateAdded = 'Date added is required';
    if (!form.penLocation.trim()) next.penLocation = 'Pen / location is required';
    if (!form.breed.trim()) next.breed = 'Breed is required';
    if (totalHerdCount <= 0) next.maleCount = 'Enter at least one piglet';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => ({
    batchId,
    ...form,
    maleCount: Number(form.maleCount) || 0,
    femaleCount: Number(form.femaleCount) || 0,
    totalHerdCount,
  });

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSave?.({ ...buildPayload(), status: 'draft' });
      resetAndClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave?.({ ...buildPayload(), status: 'active' });
      resetAndClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 ${overlayClassName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resetAndClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl ${panelClassName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2 text-slate-800">
            <PackagePlus size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold">Add New Batch</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Save Draft
            </button>
            <button
              type="submit"
              form="batch-form"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Save Batch
            </button>
            <button
              type="button"
              onClick={resetAndClose}
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          id="batch-form"
          onSubmit={handleSubmit}
          className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto px-6 py-5 lg:grid-cols-[1fr_260px]"
        >
          <div className="flex flex-col gap-5">
            <Section step={1} title="Batch Information">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Batch ID (System Generated)">
                  <input type="text" value={batchId} disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                </Field>
                <Field label="Batch Name" error={errors.batchName}>
                  <input type="text" value={form.batchName} onChange={handleChange('batchName')} placeholder="e.g. Piglet Batch - May 2026" className={inputClass(errors.batchName)} />
                </Field>
                <Field label="Date Added" error={errors.dateAdded}>
                  <input type="date" value={form.dateAdded} onChange={handleChange('dateAdded')} className={inputClass(errors.dateAdded)} />
                </Field>
                <Field label="Pen / Location" error={errors.penLocation}>
                  <input type="text" value={form.penLocation} onChange={handleChange('penLocation')} placeholder="Sector A - Pen 04" className={inputClass(errors.penLocation)} />
                </Field>
                <Field label="Breed" error={errors.breed}>
                  <input type="text" value={form.breed} onChange={handleChange('breed')} placeholder="e.g. Landrace" className={inputClass(errors.breed)} />
                </Field>
              </div>

              <div className="mt-4">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Source Origin</span>
                <div className="grid grid-cols-3 gap-3">
                  {SOURCE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${form.sourceOrigin === opt.value ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <input type="radio" name="sourceOrigin" value={opt.value} checked={form.sourceOrigin === opt.value} onChange={handleChange('sourceOrigin')} className="accent-emerald-600" />
                        {opt.label}
                      </span>
                      <span className="pl-5 text-xs text-slate-400">{opt.hint}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section step={2} title="Quantity Information">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Total Herd Count</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">{totalHerdCount}</p>
                </div>
                <Field label="Male Count" error={errors.maleCount}>
                  <input type="number" value={form.maleCount} onChange={handleChange('maleCount')} placeholder="0" className={inputClass(errors.maleCount)} />
                </Field>
                <Field label="Female Count">
                  <input type="number" value={form.femaleCount} onChange={handleChange('femaleCount')} placeholder="0" className={inputClass(false)} />
                </Field>
              </div>
            </Section>
          </div>

          <aside className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Batch Snapshot</p>
            <div className="flex flex-col gap-2">
              <SnapshotRow icon={<Heart size={14} />} label="Mortality" value="0" tone="rose" />
              <SnapshotRow icon={<PackagePlus size={14} />} label="Weak Count" value="0" tone="amber" />
            </div>
            <button type="button" onClick={resetForm} className="mt-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              Reset Form
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Section({ step, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-xs font-bold text-emerald-700">{step}</span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SnapshotRow({ icon, label, value, tone }) {
  const tones = {
    rose: 'text-rose-500 bg-rose-50',
    amber: 'text-amber-500 bg-amber-50',
  };
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
        {label}
      </span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

function inputClass(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:ring-2 ${
    hasError ? 'border-red-300 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-100'
  }`;
}