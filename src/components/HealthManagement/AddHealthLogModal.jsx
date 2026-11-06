import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Archive, ChevronDown, Loader2, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { toast } from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";
import useSmoothStepTransition from "../../hooks/useSmoothStepTransition";
import { supabase } from "../../supabaseClient";
import { getContainerMeta, fromSubUnitQty, toSubUnitQty, getShortUnit } from "../Inventory/inventoryUtils";
import { isVaccineItem } from "../../pages/GrowthProgramManagement";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const STATUS_OPTIONS = [
  { value: "sick", label: "Sick" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
  { value: "healthy", label: "Healthy / Routine" },
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
  examined_by: "",
  symptoms: "",
  diagnosis: "",
  treatment: "",
  medication_name: "",
  medication_name_custom: "",
  item_id: "",
  deduct_stock: true,
  dose_per_head: "",
  dosage: "",
  status: "sick",
  notes: "",
};

export default function AddHealthLogModal({ open, onClose, editRecord, onSuccess, prefillData, currentUser }) {
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
  const [inventorySupplies, setInventorySupplies] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [cachedInventoryItem, setCachedInventoryItem] = useState(null);

  const selectedInventoryItem = inventorySupplies.find(i => i.item_id === form.item_id);

  useEffect(() => {
    if (selectedInventoryItem) {
      setCachedInventoryItem(selectedInventoryItem);
    }
  }, [selectedInventoryItem]);

  // Load pigs, batches & inventory supplies when modal opens
  useEffect(() => {
    if (!open) return;
    const fetchOptions = async () => {
      setLoadingDropdowns(true);
      try {
        const [pigsRes, invRes] = await Promise.all([
          fetch(`${API_BASE}/api/pigs?archived=false&limit=1000`).then(r => r.json()),
          supabase
            .from("inventory_items")
            .select("item_id, item_name, unit_of_measure, category, current_stock_level")
            .eq("is_archived", false)
            .in("category", ["Medical", "Medication", "Supplements"])
            .order("item_name")
        ]);

        const all = pigsRes.data || [];
        setPigs(all.filter((x) => x.category !== "Piglet Batch"));
        setBatches(all.filter((x) => x.category === "Piglet Batch"));
        if (invRes.data) setInventorySupplies(invRes.data.filter(i => !isVaccineItem(i)));
      } catch {
        setApiError("Failed to load pigs/batches or inventory supplies.");
      } finally {
        setLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, [open]);

  // Populate form when editing or prefilling
  useEffect(() => {
    const userName = currentUser?.name || currentUser?.email?.split('@')[0] || "";
    if (editRecord) {
      const matchInv = inventorySupplies.find(
        (i) => i.item_id === editRecord._raw.item_id || i.item_name.toLowerCase() === (editRecord._raw.medication_name || "").toLowerCase()
      );
      const isCustomMed = !matchInv && !!editRecord._raw.medication_name;
      
      setForm({
        targetType: editRecord._raw.pig_id ? "pig" : "batch",
        pig_id: editRecord._raw.pig_id || "",
        batch_id: editRecord._raw.batch_id || "",
        log_date: formatDateTime(editRecord._raw.log_date) || formatDateTime(new Date()),
        recorded_by: editRecord._raw.recorded_by || userName,
        examined_by: editRecord._raw.examined_by || "",
        symptoms: editRecord._raw.symptoms || "",
        diagnosis: editRecord._raw.diagnosis || "",
        treatment: editRecord._raw.treatment || "",
        medication_name: matchInv ? matchInv.item_name : (isCustomMed ? "Other" : ""),
        medication_name_custom: isCustomMed ? editRecord._raw.medication_name : "",
        item_id: matchInv ? matchInv.item_id : (editRecord._raw.item_id || ""),
        deduct_stock: false,
        dose_per_head: "",
        dosage: editRecord._raw.dosage || "",
        status: editRecord._raw.status || "sick",
        notes: editRecord._raw.notes || "",
      });
    } else if (prefillData) {
      const matchInv = inventorySupplies.find(
        (i) => (prefillData.item_id && i.item_id === prefillData.item_id) ||
               (prefillData.medication_name && i.item_name.toLowerCase() === prefillData.medication_name.toLowerCase())
      );
      const itemId = prefillData.item_id || prefillData.inventoryItem?.item_id || matchInv?.item_id || "";
      const medName = matchInv ? matchInv.item_name : (prefillData.medication_name || "");
      const isCustomMed = !matchInv && !!medName;

      setForm({
        ...EMPTY_FORM,
        targetType: prefillData.targetType || "batch",
        pig_id: prefillData.targetType === "pig" ? (prefillData.pig_id || prefillData.id || "") : "",
        batch_id: prefillData.targetType === "batch" ? (prefillData.batch_id || prefillData.id || "") : "",
        log_date: prefillData.log_date || formatDateTime(new Date()),
        treatment: prefillData.treatment || "",
        medication_name: isCustomMed ? "Other" : medName,
        medication_name_custom: isCustomMed ? medName : "",
        item_id: itemId,
        deduct_stock: !!itemId,
        dose_per_head: "",
        status: prefillData.status || "healthy",
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

  // Routine Growth Program tasks (Procedure, Supplement, or Medication from a program)
  // hide clinical fields like Status, Diagnosis, Symptoms and lock status to "healthy".
  const isProcedure = prefillData?.isProcedure;
  const isRoutineTask = !!(prefillData && (
    prefillData.isProcedure ||
    prefillData.activity_type === 'SUPPLEMENT' ||
    (prefillData.activity_type === 'MEDICATION' && prefillData.isGrowthTask)
  ));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear the error for this field as user types
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const activeInventoryItem = selectedInventoryItem || cachedInventoryItem;
  const selectedBatch = batches.find(b => String(b.id) === String(form.batch_id));
  const batchCount = form.targetType === "batch" ? (selectedBatch?.current_count || prefillData?.headCount || 1) : 1;
  const containerMeta = activeInventoryItem ? getContainerMeta(activeInventoryItem.unit_of_measure) : null;
  const subUnitLabel = containerMeta?.subUnit || activeInventoryItem?.unit_of_measure || "units";
  const containerLabel = activeInventoryItem ? getShortUnit(activeInventoryItem.unit_of_measure) : "";
  const doseNum = parseFloat(form.dose_per_head) || 0;
  const totalSubQty = Number((doseNum * batchCount).toFixed(2));
  const containerDeductionQty = containerMeta ? fromSubUnitQty(totalSubQty, containerMeta.size) : totalSubQty;
  const currentStockNum = Number(activeInventoryItem?.current_stock_level || 0);
  const stockAfterDeduction = Number((currentStockNum - containerDeductionQty).toFixed(2));
  const hasSub = !!containerMeta;

  const handleMedicationChange = (e) => {
    const val = e.target.value;
    if (val.startsWith("inv:")) {
      const itemId = val.replace("inv:", "");
      const inv = inventorySupplies.find(i => i.item_id === itemId);
      setForm(f => ({
        ...f,
        item_id: itemId,
        medication_name: inv ? inv.item_name : "",
        medication_name_custom: "",
        deduct_stock: true
      }));
    } else if (val === "Other") {
      setForm(f => ({
        ...f,
        item_id: "",
        medication_name: "Other",
        deduct_stock: false
      }));
    } else {
      const matchingInv = inventorySupplies.find(i => i.item_name.toLowerCase() === val.toLowerCase());
      setForm(f => ({
        ...f,
        item_id: matchingInv ? matchingInv.item_id : "",
        medication_name: val,
        medication_name_custom: "",
        deduct_stock: !!matchingInv
      }));
    }
  };

  const effectiveMedicationName =
    form.medication_name === "Other" ? form.medication_name_custom : form.medication_name;

  const validate = () => {
    const errs = {};
    if (form.targetType === "pig" && !form.pig_id) errs.pig_id = "Please select a pig.";
    if (form.targetType === "batch" && !form.batch_id) errs.batch_id = "Please select a batch.";
    if (!form.log_date) errs.log_date = "Log date is required.";
    if (!form.examined_by.trim()) errs.examined_by = "Examined by is required.";
    if (!form.status) errs.status = "Status is required.";
    if (form.medication_name === "Other" && !form.medication_name_custom.trim()) {
      errs.medication_name_custom = "Please specify the medication name.";
    }
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setApiError(null);
    setSaving(true);
    try {
      // Determine final dosage text
      let finalDosage = form.dosage;
      if (!finalDosage && doseNum > 0) {
        finalDosage = form.targetType === "batch"
          ? `${doseNum} ${subUnitLabel}/head (${totalSubQty} ${subUnitLabel} total)`
          : `${doseNum} ${subUnitLabel}`;
      }

      const willDeduct = form.deduct_stock && selectedInventoryItem && containerDeductionQty > 0;

      const payload = {
        pig_id: form.targetType === "pig" ? form.pig_id : null,
        batch_id: form.targetType === "batch" ? form.batch_id : null,
        log_date: new Date(form.log_date).toISOString(),
        recorded_by: form.recorded_by,
        examined_by: form.examined_by || null,
        symptoms: form.symptoms || null,
        diagnosis: form.diagnosis || null,
        treatment: form.treatment || null,
        medication_name: effectiveMedicationName || null,
        dosage: finalDosage || null,
        status: form.status,
        notes: form.notes || null,
        performed_by: form.recorded_by,
        item_id: willDeduct ? selectedInventoryItem.item_id : (form.item_id || null),
        quantity_deducted: willDeduct ? containerDeductionQty : null,
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
      
      onSuccess(json.data);
      setSuccessInfo({
        message: editRecord
          ? "Your changes have been saved. The health log is now up to date."
          : "The health log has been added. You can view it in the treatment list.",
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
      
      onSuccess();
      setSuccessInfo({
        message: "This health log has been removed from the active list. You can still find it in the archived records.",
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
        className={`w-full ${successInfo ? 'max-w-md' : 'max-w-2xl'} overflow-hidden rounded-2xl bg-white shadow-2xl ${panelClassName || "animate-modal-in"}`}
      >

        {/* Header — hidden on success screen */}
        {!successInfo && (
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
        )}

        {/* Body */}
        {successInfo ? (
          <div className="flex flex-col items-center justify-center p-10 text-center animate-fade-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">
              {successInfo.isArchive ? 'Log Removed!' : (editRecord ? 'Changes Saved!' : 'Log Added!')}
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

            {/* API-level errors only (network failures etc.) */}
            {apiError && (
              <div className="col-span-2 mb-1 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Target Selection */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Record for</label>
              <div className="flex gap-2">
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

            {/* Status — hidden for routine Growth Program tasks */}
            {!isProcedure && !isRoutineTask && (
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Status *</label>
                <div className="relative">
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={`${selectCls} ${fieldErrors.status ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
                  >
                    <option value="">— Select status —</option>
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                {fieldErrors.status && (
                  <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle size={11} /> {fieldErrors.status}
                  </p>
                )}
              </div>
            )}

            {/* Date Administered */}
            <div className={!isProcedure && !isRoutineTask ? "col-span-2 sm:col-span-1" : "col-span-2"}>
              <label className={labelCls}>Log Date & Time *</label>
              <input
                type="datetime-local"
                name="log_date"
                value={form.log_date}
                onChange={handleChange}
                className={`${inputCls} ${fieldErrors.log_date ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
              />
              {fieldErrors.log_date && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.log_date}
                </p>
              )}
            </div>

            {/* Symptoms & Diagnosis — clinical logs only */}
            {!isProcedure && !isRoutineTask && (
              <>
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
              </>
            )}

            {/* Treatment & Medication */}
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className={`col-span-2 ${isProcedure || isRoutineTask ? "" : "sm:col-span-1"}`}>
                  <label className={labelCls}>{isProcedure ? "Procedure / Action" : "Treatment / Action"}</label>
                  <textarea
                    rows={2}
                    name="treatment"
                    value={form.treatment}
                    onChange={handleChange}
                    placeholder={isProcedure ? "e.g. Teeth clipping" : "e.g. Injectable antibiotics & separation"}
                    className={`${inputCls} resize-none`}
                  />
                </div>
                
                {!isProcedure && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Medication / Supply</label>
                  <div className="relative">
                    <select
                      name="medication_name"
                      value={form.item_id ? `inv:${form.item_id}` : form.medication_name}
                      onChange={handleMedicationChange}
                      className={selectCls}
                    >
                      <option value="">— No Medication —</option>
                      {inventorySupplies.map((inv) => (
                        <option key={inv.item_id} value={`inv:${inv.item_id}`}>
                          {inv.item_name} ({inv.current_stock_level} {inv.unit_of_measure})
                        </option>
                      ))}
                      <option value="Other">Other (not in inventory)</option>
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
                      className={`${inputCls} ${fieldErrors.medication_name_custom ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
                    />
                    {fieldErrors.medication_name_custom && (
                      <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle size={11} /> {fieldErrors.medication_name_custom}
                      </p>
                    )}
                  </div>
                </div>
                )}
              </div>
              {/* Inventory Stock Deduction Panel — smoothly pops up and collapses */}
              <div
                className={`grid transition-all duration-300 ease-out ${
                  selectedInventoryItem && !isProcedure
                    ? "grid-rows-[1fr] opacity-100 mt-3.5"
                    : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  {activeInventoryItem && (
                    <div
                      className={`rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-3 shadow-sm transform transition-all duration-300 ease-out origin-top ${
                        selectedInventoryItem && !isProcedure
                          ? "scale-100 translate-y-0 opacity-100"
                          : "scale-[0.98] -translate-y-2 opacity-0"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-bold text-emerald-950">
                            Inventory Deduction &middot; {activeInventoryItem.item_name}
                          </span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.deduct_stock}
                            onChange={(e) => setForm((f) => ({ ...f, deduct_stock: e.target.checked }))}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          Deduct from stock
                        </label>
                      </div>

                      {/* Smooth expand/collapse for inner inputs when deduct_stock is toggled */}
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          form.deduct_stock
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0 pointer-events-none"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className={`grid grid-cols-1 ${form.targetType === "batch" ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3 pt-1`}>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1 min-h-[1.75rem] flex items-end">
                                {form.targetType === "batch" ? `Dose per Head (${subUnitLabel})` : `Dose Administered (${subUnitLabel})`}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={subUnitLabel === 'ml' ? 'e.g. 5' : 'e.g. 1'}
                                value={form.dose_per_head}
                                onChange={(e) => setForm((f) => ({ ...f, dose_per_head: e.target.value }))}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                            </div>

                            {form.targetType === "batch" && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1 min-h-[1.75rem] flex items-end">
                                  Head Count (multiplier)
                                </label>
                                <div className="h-9 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 flex items-center">
                                  {batchCount} head
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1 min-h-[1.75rem] flex items-end">
                                Stock Deduction
                              </label>
                              <div className="h-9 px-2.5 py-1.5 bg-emerald-100/60 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900 flex items-center">
                                {containerDeductionQty > 0
                                  ? `${containerDeductionQty} ${containerLabel}${hasSub ? ` (${totalSubQty} ${subUnitLabel})` : ''}`
                                  : '0 ' + containerLabel}
                              </div>
                            </div>

                            <div className={`col-span-1 ${form.targetType === "batch" ? "sm:col-span-3" : "sm:col-span-2"} text-[11px] text-slate-600 flex items-center justify-between pt-1`}>
                              <span>Current Stock: <strong>{activeInventoryItem.current_stock_level} {activeInventoryItem.unit_of_measure}</strong></span>
                              {containerDeductionQty > 0 && (
                                <span className={stockAfterDeduction < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-semibold"}>
                                  Stock Remaining: {stockAfterDeduction >= 0 ? stockAfterDeduction : 0} {containerLabel}
                                  {stockAfterDeduction < 0 && " (Warning: Stock will be depleted)"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dosage — only show when NOT deducting from inventory stock */}
            {!isProcedure && !(selectedInventoryItem && form.deduct_stock) && (
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
            )}
            
            <div className={`col-span-2 ${!isProcedure && !(selectedInventoryItem && form.deduct_stock) ? "sm:col-span-1" : ""}`}>
              <label className={labelCls}>Examined By *</label>
              <input
                name="examined_by"
                value={form.examined_by}
                onChange={handleChange}
                placeholder="e.g. Dr. Rachel Vance"
                className={`${inputCls} ${fieldErrors.examined_by ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
              />
              {fieldErrors.examined_by && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.examined_by}
                </p>
              )}
            </div>
            
            {/* Notes — merged into Treatment for routine tasks; shown for clinical logs */}
            {!isRoutineTask && (
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
            )}

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
