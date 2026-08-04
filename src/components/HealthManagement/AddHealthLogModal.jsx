import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Archive, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const STATUS_OPTIONS = [
  { value: "sick", label: "Sick" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

const MEDICATION_OPTIONS = [
  "Tylosin",
  "Meloxicam",
  "Enrofloxacin",
  "Penicillin",
  "Flunixin",
  "Amoxicillin",
  "Oxytetracycline",
  "Lincomycin",
];

// Helper to format Date object into YYYY-MM-DDTHH:MM format for datetime-local input
const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d)) return "";
  // Adjust for local timezone offset
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const EMPTY_FORM = {
  targetType: "pig",
  pig_id: "",
  batch_id: "",
  log_date: formatDateTime(new Date()),
  recorded_by: "",
  symptoms: "",
  diagnosis: "",
  treatment: "",
  medication_name: "",
  medication_name_custom: "",
  dosage: "",
  status: "sick",
  notes: "",
};

export default function AddHealthLogModal({ open, onClose, editRecord, onSuccess }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(open, onClose);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Dropdown data
  const [pigs, setPigs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Load pigs & batches when modal opens
  useEffect(() => {
    if (!open) return;
    const fetchOptions = async () => {
      setLoadingDropdowns(true);
      try {
        const res = await fetch(`${API_BASE}/api/pigs?archived=false`);
        const json = await res.json();
        const all = json.data || [];
        setPigs(all.filter((x) => x.category !== "Piglet Batch"));
        setBatches(all.filter((x) => x.category === "Piglet Batch"));
      } catch {
        toast.error("Failed to load pigs/batches.");
      } finally {
        setLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (editRecord) {
      const isCustomMed = editRecord._raw.medication_name && !MEDICATION_OPTIONS.includes(editRecord._raw.medication_name);
      
      setForm({
        targetType: editRecord._raw.pig_id ? "pig" : "batch",
        pig_id: editRecord._raw.pig_id || "",
        batch_id: editRecord._raw.batch_id || "",
        log_date: formatDateTime(editRecord._raw.log_date) || formatDateTime(new Date()),
        recorded_by: editRecord._raw.recorded_by || "",
        symptoms: editRecord._raw.symptoms || "",
        diagnosis: editRecord._raw.diagnosis || "",
        treatment: editRecord._raw.treatment || "",
        medication_name: isCustomMed ? "Other" : (editRecord._raw.medication_name || ""),
        medication_name_custom: isCustomMed ? editRecord._raw.medication_name : "",
        dosage: editRecord._raw.dosage || "",
        status: editRecord._raw.status || "sick",
        notes: editRecord._raw.notes || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setConfirmArchive(false);
    setArchiveReason("");
  }, [editRecord, open]);

  if (!shouldRender) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const effectiveMedicationName =
    form.medication_name === "Other" ? form.medication_name_custom : form.medication_name;

  const validate = () => {
    if (form.targetType === "pig" && !form.pig_id) return "Please select a pig.";
    if (form.targetType === "batch" && !form.batch_id) return "Please select a batch.";
    if (!form.log_date) return "Log date is required.";
    if (!form.recorded_by.trim()) return "Recorded by is required.";
    if (!form.status) return "Status is required.";
    
    // If selecting "Other" medication, they must provide the custom name
    if (form.medication_name === "Other" && !form.medication_name_custom.trim()) {
      return "Please specify the custom medication name.";
    }

    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload = {
        pig_id: form.targetType === "pig" ? form.pig_id : null,
        batch_id: form.targetType === "batch" ? form.batch_id : null,
        log_date: new Date(form.log_date).toISOString(),
        recorded_by: form.recorded_by,
        symptoms: form.symptoms || null,
        diagnosis: form.diagnosis || null,
        treatment: form.treatment || null,
        medication_name: effectiveMedicationName || null,
        dosage: form.dosage || null,
        status: form.status,
        notes: form.notes || null,
        performed_by: form.recorded_by,
      };
      
      const url = editRecord
        ? `${API_BASE}/api/health-logs/${editRecord._raw.health_id}`
        : `${API_BASE}/api/health-logs`;
      const method = editRecord ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      
      toast.success(editRecord ? "Health log updated!" : "Health log added!");
      onSuccess();
      requestClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/health-logs/${editRecord._raw.health_id}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performed_by: form.recorded_by || "Admin",
            archive_reasoning: archiveReason,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to archive");
      toast.success("Health log archived.");
      onSuccess();
      requestClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setArchiving(false);
    }
  };

  const selectCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 appearance-none";
  const inputCls =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1";

  const currentOptions = form.targetType === "pig" ? pigs : batches;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => { if (e.target === e.currentTarget && !saving && !archiving) requestClose(); }}
    >
      <div className={`w-full max-w-2xl rounded-2xl bg-white shadow-2xl ${panelClassName || "animate-modal-in"}`}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {editRecord ? "Edit Health Log" : "Add Health Log"}
          </h2>
          <button
            onClick={() => requestClose()}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {confirmArchive ? (
          <div className="px-6 py-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Are you sure you want to archive this health log? This will hide it from the active pipeline.
            </p>
            <label className={labelCls}>Reason (optional)</label>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Enter reason for archiving..."
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
            />
            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmArchive(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {archiving ? "Archiving..." : "Confirm Archive"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">

            {/* Target Selection */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Record for</label>
              <div className="flex gap-2">
                {["pig", "batch"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, targetType: t, pig_id: "", batch_id: "" }))}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition ${
                      form.targetType === t
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t === "pig" ? "Pig" : "Batch"}
                  </button>
                ))}
              </div>
            </div>

            {/* Pig / Batch dropdown */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>
                {form.targetType === "pig" ? "Pig" : "Piglet Batch"} *
              </label>
              <div className="relative">
                {loadingDropdowns ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <>
                    <select
                      name={form.targetType === "pig" ? "pig_id" : "batch_id"}
                      value={form.targetType === "pig" ? form.pig_id : form.batch_id}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— Select {form.targetType === "pig" ? "a pig" : "a batch"} —</option>
                      {currentOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.pig_tag || item.batch_tag} — {item.category} ({item.status})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Status *</label>
              <div className="relative">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={selectCls}
                >
                  <option value="">— Select status —</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Date Administered */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Log Date & Time *</label>
              <input
                type="datetime-local"
                name="log_date"
                value={form.log_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            {/* Symptoms & Diagnosis */}
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Diagnosis</label>
                  <input
                    name="diagnosis"
                    value={form.diagnosis}
                    onChange={handleChange}
                    placeholder="e.g. Swine Respiratory Disease"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Symptoms</label>
                  <textarea
                    rows={2}
                    name="symptoms"
                    value={form.symptoms}
                    onChange={handleChange}
                    placeholder="e.g. Coughing, lethargy, mild fever"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2 border-t border-slate-100 my-1" />

            {/* Treatment & Medication */}
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Treatment / Action</label>
                  <textarea
                    rows={2}
                    name="treatment"
                    value={form.treatment}
                    onChange={handleChange}
                    placeholder="e.g. Injectable antibiotics & separation"
                    className={`${inputCls} resize-none`}
                  />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Medication Name</label>
                  <div className="relative">
                    <select
                      name="medication_name"
                      value={form.medication_name}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— No Medication —</option>
                      {MEDICATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="Other">Other (specify below)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  
                  <div
                    style={{
                      maxHeight: form.medication_name === "Other" ? "80px" : "0px",
                      opacity: form.medication_name === "Other" ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, opacity 0.25s ease",
                      marginTop: form.medication_name === "Other" ? "8px" : "0px",
                    }}
                  >
                    <input
                      name="medication_name_custom"
                      value={form.medication_name_custom}
                      onChange={handleChange}
                      placeholder="Enter medication name..."
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dosage & Recorded By */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Dosage (if applicable)</label>
              <input
                name="dosage"
                value={form.dosage}
                onChange={handleChange}
                placeholder="e.g. 10 ml"
                className={inputCls}
              />
            </div>
            
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Recorded By *</label>
              <input
                name="recorded_by"
                value={form.recorded_by}
                onChange={handleChange}
                placeholder="e.g. Dr. Rachel Vance"
                className={inputCls}
              />
            </div>
            
            {/* Notes */}
            <div className="col-span-2">
              <label className={labelCls}>Additional Notes</label>
              <textarea
                rows={2}
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Any extra information..."
                className={`${inputCls} resize-none`}
              />
            </div>

          </div>
        )}

        {/* Footer */}
        {!confirmArchive && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <div>
              {editRecord && (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Archive className="h-4 w-4" /> Archive
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => requestClose()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Saving..." : editRecord ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
