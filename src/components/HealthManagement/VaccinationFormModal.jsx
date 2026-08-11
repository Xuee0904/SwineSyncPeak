import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Archive, ChevronDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";
import useSmoothStepTransition from "../../hooks/useSmoothStepTransition";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// Common swine vaccines with typical booster intervals (days). null = no booster.
const VACCINE_OPTIONS = [
  { name: "Erysipelas Vaccine",               boosterDays: 180 },
  { name: "Circovirus (PCV2)",                boosterDays: 365 },
  { name: "Mycoplasma Hyopneumoniae",         boosterDays: 90  },
  { name: "Iron Injection & Mycoplasma",      boosterDays: null },
  { name: "Circovirus Vaccine (Weaning)",     boosterDays: 180 },
  { name: "PRRS Vaccine",                     boosterDays: 120 },
  { name: "Foot & Mouth Disease (FMD)",       boosterDays: 180 },
  { name: "Parvovirus Vaccine",               boosterDays: 365 },
  { name: "Leptospirosis Vaccine",            boosterDays: 180 },
  { name: "TGE / Coronavirus Vaccine",        boosterDays: 90  },
  { name: "Streptococcus suis Vaccine",       boosterDays: 90  },
  { name: "Salmonella Vaccine",               boosterDays: 180 },
  { name: "Iron Dextran Injection",           boosterDays: null },
  { name: "Vitamin B Complex",                boosterDays: null },
];

const EMPTY_FORM = {
  targetType: "pig",
  pig_id: "",
  batch_id: "",
  vaccine_name: "",
  vaccine_name_custom: "",
  administered_date: "",
  dosage: "",
  lot_number: "",
  booster_due_date: "",
  administered_by: "",
  recorded_by: "",
};

function addDays(dateStr, days) {
  if (!dateStr || !days) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function VaccinationFormModal({ open, onClose, editRecord, onSuccess, prefillData, currentUser }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(open, onClose);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  const { containerRef, style: stepTransitionStyle } = useSmoothStepTransition(Boolean(successInfo));

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
        const res = await fetch(`${API_BASE}/api/pigs?archived=false&limit=1000`);
        const json = await res.json();
        const all = json.data || [];
        setPigs(all.filter((x) => x.category !== "Piglet Batch"));
        setBatches(all.filter((x) => x.category === "Piglet Batch"));
      } catch {
        setApiError("Failed to load pigs/batches.");
      } finally {
        setLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    const userName = currentUser?.name || currentUser?.email?.split('@')[0] || "";
    if (editRecord) {
      setForm({
        targetType: editRecord._raw.pig_id ? "pig" : "batch",
        pig_id: editRecord._raw.pig_id || "",
        batch_id: editRecord._raw.batch_id || "",
        vaccine_name: VACCINE_OPTIONS.some((v) => v.name === editRecord._raw.vaccine_name)
          ? editRecord._raw.vaccine_name
          : "Other",
        vaccine_name_custom: VACCINE_OPTIONS.some((v) => v.name === editRecord._raw.vaccine_name)
          ? ""
          : editRecord._raw.vaccine_name || "",
        administered_date: editRecord._raw.administered_date || "",
        dosage: editRecord._raw.dosage || "",
        lot_number: editRecord._raw.lot_number || "",
        booster_due_date: editRecord._raw.booster_due_date || "",
        administered_by: editRecord._raw.administered_by || "",
        recorded_by: editRecord._raw.recorded_by || userName,
      });
    } else if (prefillData) {
      const isCustomVac = prefillData.vaccine_name && !VACCINE_OPTIONS.some(v => v.name === prefillData.vaccine_name);
      setForm({
        ...EMPTY_FORM,
        targetType: prefillData.targetType || "batch",
        pig_id: prefillData.targetType === "pig" ? (prefillData.pig_id || prefillData.id || "") : "",
        batch_id: prefillData.targetType === "batch" ? (prefillData.batch_id || prefillData.id || "") : "",
        administered_date: prefillData.administered_date || new Date().toISOString().slice(0, 10),
        vaccine_name: isCustomVac ? "Other" : (prefillData.vaccine_name || ""),
        vaccine_name_custom: isCustomVac ? prefillData.vaccine_name : "",
        recorded_by: userName,
      });
    } else {
      setForm({ ...EMPTY_FORM, recorded_by: userName });
    }
    setFieldErrors({});
    setConfirmArchive(false);
    setArchiveReason("");
  }, [editRecord, prefillData, currentUser, open]);

  if (!shouldRender) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };

      // Auto-suggest booster date when vaccine or date changes
      if (name === "vaccine_name" || name === "administered_date") {
        const vaccineName = name === "vaccine_name" ? value : f.vaccine_name;
        const dateStr = name === "administered_date" ? value : f.administered_date;
        const match = VACCINE_OPTIONS.find((v) => v.name === vaccineName);
        if (match && match.boosterDays && dateStr) {
          next.booster_due_date = addDays(dateStr, match.boosterDays);
        }
      }

      return next;
    });
    // Clear the error for this field as user types
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const effectiveVaccineName =
    form.vaccine_name === "Other" ? form.vaccine_name_custom : form.vaccine_name;

  const validate = () => {
    const errs = {};
    if (!effectiveVaccineName.trim()) errs.vaccine_name = "Vaccine name is required.";
    if (!form.administered_date) errs.administered_date = "Date administered is required.";
    if (!form.administered_by.trim()) errs.administered_by = "Administered by is required.";
    if (form.targetType === "pig" && !form.pig_id) errs.pig_id = "Please select a pig.";
    if (form.targetType === "batch" && !form.batch_id) errs.batch_id = "Please select a batch.";
    if (form.vaccine_name === "Other" && !form.vaccine_name_custom.trim()) errs.vaccine_name_custom = "Please specify the vaccine name.";
    return errs;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setApiError(null);
    setSaving(true);
    try {
      const payload = {
        vaccine_name: effectiveVaccineName,
        administered_date: form.administered_date,
        dosage: form.dosage || null,
        lot_number: form.lot_number || null,
        booster_due_date: form.booster_due_date || null,
        administered_by: form.administered_by,
        recorded_by: form.recorded_by,
        pig_id: form.targetType === "pig" ? form.pig_id : null,
        batch_id: form.targetType === "batch" ? form.batch_id : null,
        performed_by: form.recorded_by,
      };
      const url = editRecord
        ? `${API_BASE}/api/vaccination-records/${editRecord._raw.vaccination_id}`
        : `${API_BASE}/api/vaccination-records`;
      const method = editRecord ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      
      onSuccess();
      setSuccessInfo({
        message: editRecord
          ? "Your changes have been saved. The vaccination record is now up to date."
          : "The vaccination has been logged. You can view it in the vaccination schedule.",
        isArchive: false
      });
    } catch (e) {
      setApiError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/vaccination-records/${editRecord._raw.vaccination_id}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performed_by: form.administered_by || "Admin",
            archive_reasoning: archiveReason,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to archive");
      
      onSuccess();
      setSuccessInfo({
        message: "This vaccination record has been removed from the active list. You can still find it in the archived records.",
        isArchive: true
      });
    } catch (e) {
      setApiError(e.message);
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
      <div 
        ref={containerRef}
        style={stepTransitionStyle}
        className={`w-full ${successInfo ? 'max-w-sm' : 'max-w-lg'} overflow-hidden rounded-2xl bg-white shadow-2xl ${panelClassName || "animate-modal-in"}`}
      >

        {/* Header — hidden on success screen */}
        {!successInfo && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              {editRecord ? "Edit Vaccination Record" : "Add Vaccination Record"}
            </h2>
            <button
              onClick={() => requestClose()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body */}
        {successInfo ? (
          <div className="flex flex-col items-center justify-center p-10 text-center animate-fade-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">
              {successInfo.isArchive ? 'Record Removed!' : (editRecord ? 'Changes Saved!' : 'Record Added!')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">
              {successInfo.message}
            </p>
            <div className="mt-8 flex gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  requestClose();
                }}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : confirmArchive ? (
          <div className="px-6 py-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Are you sure you want to archive this vaccination record? This will hide it from the registry.
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
            {apiError && (
              <div className="col-span-2 mb-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Target Type Toggle */}
            <div className="col-span-2">
              <label className={labelCls}>Record for</label>
              <div className="flex gap-3">
                {["pig", "batch"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={!!prefillData}
                    onClick={() => setForm((f) => ({ ...f, targetType: t, pig_id: "", batch_id: "" }))}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition ${
                      form.targetType === t
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    } ${prefillData ? "opacity-50 cursor-not-allowed" : ""}`}
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
                      disabled={!!prefillData}
                      className={`${selectCls} ${prefillData ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""} ${fieldErrors.pig_id || fieldErrors.batch_id ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
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
              {(fieldErrors.pig_id || fieldErrors.batch_id) && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.pig_id || fieldErrors.batch_id}
                </p>
              )}
            </div>

            {/* Vaccine name dropdown */}
            <div className="col-span-2">
              <label className={labelCls}>Vaccine Name *</label>
              <div className="relative">
                <select
                  name="vaccine_name"
                  value={form.vaccine_name}
                  onChange={handleChange}
                  className={`${selectCls} ${fieldErrors.vaccine_name ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
                >
                  <option value="">— Select a vaccine —</option>
                  {VACCINE_OPTIONS.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                  <option value="Other">Other (specify below)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {fieldErrors.vaccine_name && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.vaccine_name}
                </p>
              )}
              <div
                style={{
                  maxHeight: form.vaccine_name === "Other" ? "80px" : "0px",
                  opacity: form.vaccine_name === "Other" ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.3s ease, opacity 0.25s ease",
                  marginTop: form.vaccine_name === "Other" ? "8px" : "0px",
                }}
              >
                <input
                  name="vaccine_name_custom"
                  value={form.vaccine_name_custom}
                  onChange={handleChange}
                  placeholder="Enter vaccine name..."
                  className={`${inputCls} ${fieldErrors.vaccine_name_custom ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
                />
              </div>
              {fieldErrors.vaccine_name_custom && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.vaccine_name_custom}
                </p>
              )}
              {form.vaccine_name && form.vaccine_name !== "Other" && (() => {
                const match = VACCINE_OPTIONS.find((v) => v.name === form.vaccine_name);
                return match?.boosterDays ? (
                  <p className="mt-1 text-xs text-emerald-600">
                    ✓ Booster auto-suggested: {match.boosterDays} days after administration
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No booster typically required for this vaccine.</p>
                );
              })()}
            </div>

            {/* Dates */}
            <div>
              <label className={labelCls}>Date Administered *</label>
              <input
                type="date"
                name="administered_date"
                value={form.administered_date}
                onChange={handleChange}
                className={`${inputCls} ${fieldErrors.administered_date ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
              />
              {fieldErrors.administered_date && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.administered_date}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                Booster Due Date
                <span className="ml-1 text-slate-400 font-normal">(auto-suggested)</span>
              </label>
              <input
                type="date"
                name="booster_due_date"
                value={form.booster_due_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            {/* Dosage & Lot */}
            <div>
              <label className={labelCls}>Dosage</label>
              <input
                name="dosage"
                value={form.dosage}
                onChange={handleChange}
                placeholder="e.g. 2 ml"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Lot Number</label>
              <input
                name="lot_number"
                value={form.lot_number}
                onChange={handleChange}
                placeholder="e.g. LOT-PCV-404B"
                className={inputCls}
              />
            </div>

            {/* Administered by */}
            <div className="col-span-2">
              <label className={labelCls}>Administered By *</label>
              <input
                name="administered_by"
                value={form.administered_by}
                onChange={handleChange}
                placeholder="e.g. Dr. Rachel Vance"
                className={`${inputCls} ${fieldErrors.administered_by ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
              />
              {fieldErrors.administered_by && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.administered_by}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {!confirmArchive && !successInfo && (
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
