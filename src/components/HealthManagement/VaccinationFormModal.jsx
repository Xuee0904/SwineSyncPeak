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

// Quick interval shortcuts for boosters (calculated from administered date)
const BOOSTER_INTERVALS = [
  { label: "+2 wks", days: 14 },
  { label: "+1 mo", days: 30 },
  { label: "+3 mos", days: 90 },
  { label: "+6 mos", days: 180 },
  { label: "+1 yr", days: 365 },
];

const EMPTY_FORM = {
  targetType: "pig",
  pig_id: "",
  batch_id: "",
  vaccine_name: "",
  vaccine_name_custom: "",
  item_id: "",
  deduct_stock: true,
  dose_per_head: "",
  administered_date: "",
  dosage: "",
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
  const [inventoryVaccines, setInventoryVaccines] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [cachedInventoryItem, setCachedInventoryItem] = useState(null);

  const selectedInventoryItem = inventoryVaccines.find(i => i.item_id === form.item_id);

  useEffect(() => {
    if (selectedInventoryItem) {
      setCachedInventoryItem(selectedInventoryItem);
    }
  }, [selectedInventoryItem]);

  // Load pigs, batches & inventory vaccines when modal opens
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
            .in("category", ["Medical", "Vaccines"])
            .order("item_name")
        ]);

        const all = pigsRes.data || [];
        setPigs(all.filter((x) => x.category !== "Piglet Batch"));
        setBatches(all.filter((x) => x.category === "Piglet Batch"));
        if (invRes.data) setInventoryVaccines(invRes.data.filter(isVaccineItem));
      } catch {
        setApiError("Failed to load pigs/batches or inventory supplies.");
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
      const matchInv = inventoryVaccines.find(
        (i) => i.item_id === editRecord._raw.item_id || i.item_name.toLowerCase() === (editRecord._raw.vaccine_name || "").toLowerCase()
      );
      setForm({
        targetType: editRecord._raw.pig_id ? "pig" : "batch",
        pig_id: editRecord._raw.pig_id || "",
        batch_id: editRecord._raw.batch_id || "",
        vaccine_name: matchInv ? matchInv.item_name : "Other",
        vaccine_name_custom: matchInv ? "" : (editRecord._raw.vaccine_name || ""),
        item_id: matchInv ? matchInv.item_id : (editRecord._raw.item_id || ""),
        deduct_stock: false,
        dose_per_head: "",
        administered_date: editRecord._raw.administered_date || "",
        dosage: editRecord._raw.dosage || "",
        booster_due_date: editRecord._raw.booster_due_date || "",
        administered_by: editRecord._raw.administered_by || "",
        recorded_by: editRecord._raw.recorded_by || userName,
      });
    } else if (prefillData) {
      const matchInv = inventoryVaccines.find(
        (i) => (prefillData.item_id && i.item_id === prefillData.item_id) ||
               (prefillData.vaccine_name && i.item_name.toLowerCase() === prefillData.vaccine_name.toLowerCase())
      );
      const itemId = prefillData.item_id || prefillData.inventoryItem?.item_id || matchInv?.item_id || "";
      const vacName = matchInv ? matchInv.item_name : (prefillData.vaccine_name || "");
      const isCustom = !matchInv && !!vacName;

      setForm({
        ...EMPTY_FORM,
        targetType: prefillData.targetType || "batch",
        pig_id: prefillData.targetType === "pig" ? (prefillData.pig_id || prefillData.id || "") : "",
        batch_id: prefillData.targetType === "batch" ? (prefillData.batch_id || prefillData.id || "") : "",
        administered_date: prefillData.administered_date || new Date().toISOString().slice(0, 10),
        vaccine_name: isCustom ? "Other" : vacName,
        vaccine_name_custom: isCustom ? vacName : "",
        item_id: itemId,
        deduct_stock: !!itemId,
        dose_per_head: "",
        booster_due_date: "",
        recorded_by: userName,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        administered_date: new Date().toISOString().slice(0, 10),
        recorded_by: userName
      });
    }
    setFieldErrors({});
    setConfirmArchive(false);
    setArchiveReason("");
  }, [editRecord, prefillData, currentUser, open]);

  if (!shouldRender) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear the error for this field as user types
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleBoosterIntervalClick = (days) => {
    const baseDate = form.administered_date || new Date().toISOString().slice(0, 10);
    const newBoosterDate = addDays(baseDate, days);
    setForm((f) => ({
      ...f,
      administered_date: f.administered_date || baseDate,
      booster_due_date: newBoosterDate,
    }));
  };

  const handleClearBoosterDate = () => {
    setForm((f) => ({ ...f, booster_due_date: "" }));
  };

  const effectiveVaccineName =
    form.vaccine_name === "Other" ? form.vaccine_name_custom : form.vaccine_name;

  const selectedAnimal = form.targetType === "pig"
    ? pigs.find(p => String(p.id) === String(form.pig_id))
    : batches.find(b => String(b.id) === String(form.batch_id));
  
  const minDate = editRecord?._raw?.date_of_birth || prefillData?.date_of_birth || prefillData?.dateOfBirth || selectedAnimal?.date_of_birth;
  const minDateFormatted = minDate ? String(minDate).slice(0, 10) : null;

  const activeInventoryItem = selectedInventoryItem || cachedInventoryItem;
  const selectedBatch = batches.find(b => String(b.id) === String(form.batch_id));
  const batchCount = form.targetType === "batch" ? (selectedBatch?.current_count || prefillData?.headCount || 1) : 1;
  const containerMeta = activeInventoryItem ? getContainerMeta(activeInventoryItem.unit_of_measure) : null;
  const subUnitLabel = containerMeta?.subUnit || activeInventoryItem?.unit_of_measure || "doses";
  const containerLabel = activeInventoryItem ? getShortUnit(activeInventoryItem.unit_of_measure) : "";
  const doseNum = parseFloat(form.dose_per_head) || 0;
  const totalSubQty = Number((doseNum * batchCount).toFixed(2));
  const containerDeductionQty = containerMeta ? fromSubUnitQty(totalSubQty, containerMeta.size) : totalSubQty;
  const currentStockNum = Number(activeInventoryItem?.current_stock_level || 0);
  const stockAfterDeduction = Number((currentStockNum - containerDeductionQty).toFixed(2));
  const hasSub = !!containerMeta;

  const handleVaccineChange = (e) => {
    const val = e.target.value;
    if (val.startsWith("inv:")) {
      const itemId = val.replace("inv:", "");
      const inv = inventoryVaccines.find(i => i.item_id === itemId);
      setForm((f) => ({
        ...f,
        item_id: itemId,
        vaccine_name: inv ? inv.item_name : "",
        vaccine_name_custom: "",
        deduct_stock: true,
      }));
    } else if (val === "Other") {
      setForm((f) => ({
        ...f,
        item_id: "",
        vaccine_name: "Other",
        deduct_stock: false,
      }));
    } else {
      const matchInv = inventoryVaccines.find(i => i.item_name.toLowerCase() === val.toLowerCase());
      setForm((f) => ({
        ...f,
        item_id: matchInv ? matchInv.item_id : "",
        vaccine_name: val,
        vaccine_name_custom: "",
        deduct_stock: !!matchInv,
      }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!effectiveVaccineName.trim()) errs.vaccine_name = "Vaccine name is required.";
    if (!form.administered_date) errs.administered_date = "Date administered is required.";
    else if (minDateFormatted && form.administered_date < minDateFormatted) errs.administered_date = `Cannot be before birthdate (${new Date(minDateFormatted).toLocaleDateString()})`;
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
      // Determine final dosage text
      let finalDosage = form.dosage;
      if (!finalDosage && doseNum > 0) {
        finalDosage = form.targetType === "batch"
          ? `${doseNum} ${subUnitLabel}/head (${totalSubQty} ${subUnitLabel} total)`
          : `${doseNum} ${subUnitLabel}`;
      }

      const willDeduct = form.deduct_stock && selectedInventoryItem && containerDeductionQty > 0;

      const payload = {
        vaccine_name: effectiveVaccineName,
        administered_date: form.administered_date,
        dosage: finalDosage || null,
        lot_number: editRecord ? (form.lot_number || null) : null,
        booster_due_date: form.booster_due_date || null,
        administered_by: form.administered_by,
        recorded_by: form.recorded_by,
        pig_id: form.targetType === "pig" ? form.pig_id : null,
        batch_id: form.targetType === "batch" ? form.batch_id : null,
        performed_by: form.recorded_by,
        item_id: willDeduct ? selectedInventoryItem.item_id : (form.item_id || null),
        quantity_deducted: willDeduct ? containerDeductionQty : null,
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
      
      onSuccess(json.data);
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

            {/* Vaccine name dropdown */}
            <div className="col-span-2">
              <label className={labelCls}>Vaccine Name *</label>
              <div className="relative">
                <select
                  name="vaccine_name"
                  value={form.item_id ? `inv:${form.item_id}` : form.vaccine_name}
                  onChange={handleVaccineChange}
                  className={`${selectCls} ${fieldErrors.vaccine_name ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
                >
                  <option value="">— Select a vaccine —</option>
                  {inventoryVaccines.map((inv) => (
                    <option key={inv.item_id} value={`inv:${inv.item_id}`}>
                      {inv.item_name} ({inv.current_stock_level} {inv.unit_of_measure})
                    </option>
                  ))}
                  <option value="Other">Other (not in inventory)</option>
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
              {/* Inventory Stock Deduction Panel — smoothly pops up and collapses */}
              <div
                className={`grid transition-all duration-300 ease-out ${
                  selectedInventoryItem
                    ? "grid-rows-[1fr] opacity-100 mt-3.5"
                    : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  {activeInventoryItem && (
                    <div
                      className={`rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-3 shadow-sm transform transition-all duration-300 ease-out origin-top ${
                        selectedInventoryItem
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
                                placeholder={subUnitLabel === 'ml' ? 'e.g. 2' : 'e.g. 1'}
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

            {/* Dates */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Date Administered *</label>
              <input
                type="date"
                name="administered_date"
                value={form.administered_date}
                onChange={handleChange}
                min={minDateFormatted || undefined}
                className={`${inputCls} ${fieldErrors.administered_date ? "border-rose-400 ring-1 ring-rose-200" : ""}`}
              />
              {fieldErrors.administered_date && (
                <p className="field-error mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.administered_date}
                </p>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>
                Booster Due Date
                <span className="ml-1 text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                name="booster_due_date"
                value={form.booster_due_date}
                onChange={handleChange}
                className={inputCls}
              />
              {/* Quick interval pills */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-400 mr-0.5">Quick:</span>
                {BOOSTER_INTERVALS.map((intv) => {
                  const baseDate = form.administered_date || new Date().toISOString().slice(0, 10);
                  const expectedDate = addDays(baseDate, intv.days);
                  const isActive = form.booster_due_date === expectedDate;
                  return (
                    <button
                      key={intv.label}
                      type="button"
                      onClick={() => handleBoosterIntervalClick(intv.days)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                    >
                      {intv.label}
                    </button>
                  );
                })}
                {form.booster_due_date && (
                  <button
                    type="button"
                    onClick={handleClearBoosterDate}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-rose-600 cursor-pointer ml-auto"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Dosage — only show when NOT deducting from inventory stock */}
            {!(selectedInventoryItem && form.deduct_stock) && (
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Dosage</label>
                <input
                  name="dosage"
                  value={form.dosage}
                  onChange={handleChange}
                  placeholder="e.g. 2 ml"
                  className={inputCls}
                />
              </div>
            )}

            {/* Administered by */}
            <div className={!(selectedInventoryItem && form.deduct_stock) ? "col-span-2 sm:col-span-1" : "col-span-2"}>
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
