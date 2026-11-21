import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Package, Loader2, Check, PlusCircle, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";
import AnimatedNotice from "../common/AnimatedNotice";
import {
  formatTransactionNotes,
  formatSupplyName,
  findSimilarSupplyItems,
  getStaffDetails,
  logInventoryActivity,
  getContainerMeta,
  getContainerSingular,
  getShortUnit,
  toSubUnitQty,
} from "./inventoryUtils";

// Default unit per category. Feed is bought by the sack (25kg or 50kg) and
// Medical items by the vial (e.g. 100ml bottle or 50-dose vaccine vial), so the
// container size is stored in the unit itself, e.g. "sacks (25kg)", "vials (100ml)".
const CATEGORY_UNITS = {
  Feed: { default: "sacks (25kg)", options: ["sacks (25kg)", "sacks (50kg)", "kg"] },
  Medication: {
    default: "vials (100ml)", options: [
      "vials (50ml)", "vials (100ml)", "vials (250ml)",
      "ml", "tablets", "capsules", "sachets",
    ]
  },
  Supplements: {
    default: "packs (500g)", options: [
      "packs (100g)", "packs (500g)", "packs (1000g)",
      "bottles (500ml)", "bottles (1000ml)",
      "sacks (25kg)", "sacks (50kg)",
      "kg", "g", "ml", "sachets",
    ]
  },
  Medical: {
    default: "vials (100ml)", options: [
      "vials (50ml)", "vials (100ml)", "vials (250ml)",
      "ml", "tablets", "capsules", "sachets",
    ]
  },
  Vaccines: {
    default: "vials (50 doses)", options: [
      "vials (50 doses)", "vials (100ml)", "vials (50ml)", "vials (250ml)",
      "doses", "ml",
    ]
  },
};

const unitLabel = (u) => {
  const meta = getContainerMeta(u);
  if (!meta) return u;
  const noun = meta.containerUnit.charAt(0).toUpperCase() + meta.containerUnit.slice(1);
  return `${noun} (${meta.size} ${meta.subUnit} each)`;
};

// Medical, Medication, and Vaccines items share the same treatment-focused UI labels
const isMedicalCategory = (cat) => cat === "Medical" || cat === "Medication" || cat === "Vaccines";

const EMPTY_FORM = {
  item_name: "",
  category: "Feed",
  unit_of_measure: "sacks (25kg)",
  current_stock_level: "",
  low_stock_threshold: "",
  ideal_stock_level: "",
  unit_cost: "",
};

export default function AddSupplyModal({ item, prefill, onClose, onSaved, onSwitchToAdjust, loggedInUser }) {
  const isEdit = !!item;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null);
  const [lowAlertManuallyEdited, setLowAlertManuallyEdited] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [existingItems, setExistingItems] = useState([]);

  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(
    true,
    onClose
  );

  // Load existing supply names once for live near-duplicate / case guardrail hints
  useEffect(() => {
    let active = true;
    supabase
      .from("inventory_items")
      .select("item_id, item_name, category, is_archived")
      .then(({ data }) => {
        if (active && Array.isArray(data)) setExistingItems(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const nameMatchInfo = useMemo(
    () => findSimilarSupplyItems(form.item_name, existingItems, item?.item_id),
    [form.item_name, existingItems, item?.item_id]
  );

  // Prefill for edit mode or prefill from Growth Program custom item
  useEffect(() => {
    if (item) {
      setForm({
        item_name: item.item_name ?? "",
        category: item.category ?? "Feed",
        unit_of_measure: item.unit_of_measure ?? "kg",
        current_stock_level: item.current_stock_level ?? "",
        low_stock_threshold: item.low_stock_threshold ?? "",
        ideal_stock_level: item.ideal_stock_level ?? "",
        unit_cost: item.unit_cost ?? "",
      });
      setLowAlertManuallyEdited(true);
    } else if (prefill) {
      const cat = prefill.category || "Feed";
      const defaultUnit = CATEGORY_UNITS[cat]?.default ?? "sacks (25kg)";
      setForm({
        ...EMPTY_FORM,
        item_name: prefill.item_name ?? "",
        category: cat,
        unit_of_measure: prefill.unit_of_measure || defaultUnit,
      });
      setLowAlertManuallyEdited(false);
    } else {
      setForm(EMPTY_FORM);
      setLowAlertManuallyEdited(false);
    }
    setSuccessInfo(null);
  }, [item, prefill]);

  const computeStockErrors = (f) => {
    const errs = {};
    const cur = parseFloat(f.current_stock_level);
    const low = parseFloat(f.low_stock_threshold);
    const max = parseFloat(f.ideal_stock_level);

    if (f.ideal_stock_level !== "" && (isNaN(max) || max <= 0)) {
      errs.ideal_stock_level = "Max capacity must be greater than 0";
    } else if (isEdit && !isNaN(cur) && !isNaN(max) && max > 0 && cur > max) {
      errs.ideal_stock_level = `Cannot be lower than current stock (${cur} ${getShortUnit(f.unit_of_measure)})`;
    }
    if (!isEdit && f.current_stock_level !== "") {
      if (isNaN(cur) || cur < 0) {
        errs.current_stock_level = "Enter a valid quantity (0 or more)";
      } else if (!isNaN(max) && max > 0 && cur > max) {
        errs.current_stock_level = `Cannot exceed max capacity (${max} ${getShortUnit(f.unit_of_measure)})`;
      }
    }
    if (f.low_stock_threshold !== "") {
      if (isNaN(low) || low < 0) {
        errs.low_stock_threshold = "Enter a valid threshold (0 or more)";
      } else if (!isNaN(max) && max > 0 && low >= max) {
        errs.low_stock_threshold = "Must be less than max capacity";
      }
    }
    return errs;
  };

  const set = (field) => (e) => {
    const val = e.target.value;
    if (field === "low_stock_threshold") {
      setLowAlertManuallyEdited(val !== "");
    }
    const next = { ...form, [field]: val };
    // Auto-suggest Low Alert at 25% of Max Capacity unless manually edited
    if (field === "ideal_stock_level" && !lowAlertManuallyEdited) {
      const maxVal = parseFloat(val);
      if (!isNaN(maxVal) && maxVal > 0) {
        const suggestedLow = maxVal >= 4 ? Math.round(maxVal * 0.25) : Number((maxVal * 0.25).toFixed(2));
        next.low_stock_threshold = String(suggestedLow);
      } else {
        next.low_stock_threshold = "";
      }
    }
    setForm(next);

    // Live inline validation for capacity/stock fields
    if (["ideal_stock_level", "current_stock_level", "low_stock_threshold"].includes(field)) {
      const live = computeStockErrors(next);
      setErrors(er => ({
        ...er,
        ideal_stock_level: live.ideal_stock_level,
        current_stock_level: live.current_stock_level,
        low_stock_threshold: live.low_stock_threshold,
      }));
    } else {
      setErrors(er => ({ ...er, [field]: undefined }));
    }
  };

  // Auto-update unit_of_measure when category changes
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    const oldCategoryDefault = CATEGORY_UNITS[form.category]?.default;
    const newDefault = CATEGORY_UNITS[newCategory]?.default || "kg";
    setForm(f => {
      const isMed = newCategory === "Medication" || newCategory === "Medical" || newCategory === "Vaccines";
      const next = {
        ...f,
        category: newCategory,
        unit_of_measure: (f.unit_of_measure === "" || f.unit_of_measure === oldCategoryDefault)
          ? newDefault
          : f.unit_of_measure,
      };
      // For medicines (typically 1-bottle standby stock), suggest single-bottle defaults if empty
      if (!isEdit && isMed && (!f.ideal_stock_level || f.ideal_stock_level === "100")) {
        next.ideal_stock_level = "1";
        next.current_stock_level = f.current_stock_level || "1";
        next.low_stock_threshold = "0.25";
      }
      return next;
    });
    setErrors(er => ({ ...er, category: undefined, unit_of_measure: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.item_name.trim()) e.item_name = "Item name is required";
    if (!form.unit_of_measure.trim()) e.unit_of_measure = "Unit is required";
    const cur = parseFloat(form.current_stock_level);
    const low = parseFloat(form.low_stock_threshold);
    const max = parseFloat(form.ideal_stock_level);

    if (form.ideal_stock_level === "" || isNaN(max) || max <= 0) {
      e.ideal_stock_level = "Max capacity is required (> 0)";
    } else if (isEdit && !isNaN(cur) && cur > max) {
      e.ideal_stock_level = `Cannot be lower than current stock (${cur} ${getShortUnit(form.unit_of_measure)})`;
    }
    if (!isEdit) {
      if (form.current_stock_level === "" || isNaN(cur) || cur < 0) {
        e.current_stock_level = "Valid stock quantity is required";
      } else if (!isNaN(max) && max > 0 && cur > max) {
        e.current_stock_level = `Cannot exceed max capacity (${max} ${getShortUnit(form.unit_of_measure)})`;
      }
    }
    if (form.low_stock_threshold === "" || isNaN(low) || low < 0) {
      e.low_stock_threshold = "Low stock threshold is required";
    } else if (!isNaN(max) && max > 0 && low >= max) {
      e.low_stock_threshold = "Must be less than max capacity";
    }
    const cost = parseFloat(form.unit_cost);
    if (form.unit_cost === "" || isNaN(cost) || cost <= 0) {
      e.unit_cost = "Cost per unit is required for financial records (> ₱0)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    setSaving(true);
    try {
      const normalizedName = formatSupplyName(form.item_name);
      const lockedCurrentStock = isEdit
        ? Number(item.current_stock_level) || 0
        : parseFloat(form.current_stock_level);

      // Case-insensitive duplicate name check before saving
      const { data: existingMatches } = await supabase
        .from("inventory_items")
        .select("item_id, item_name, is_archived")
        .ilike("item_name", normalizedName);

      const conflict = (existingMatches || []).find(
        (row) =>
          row.item_name?.trim().toLowerCase() === normalizedName.toLowerCase() &&
          (!isEdit || row.item_id !== item.item_id)
      );

      if (conflict) {
        const dupMsg = conflict.is_archived
          ? `"${conflict.item_name}" already exists in Archived Supplies. Restore it instead of creating a duplicate.`
          : `An item named "${conflict.item_name}" already exists.`;
        setErrors((er) => ({ ...er, item_name: dupMsg }));
        setSaving(false);
        return;
      }

      const payload = {
        item_name: normalizedName,
        category: form.category,
        unit_of_measure: form.unit_of_measure.trim() || "units",
        current_stock_level: lockedCurrentStock,
        low_stock_threshold: parseFloat(form.low_stock_threshold),
        ideal_stock_level: parseFloat(form.ideal_stock_level),
        unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : 0,
        description: isEdit ? (item.description || null) : null,
        is_archived: false,
        last_updated_at: new Date().toISOString(),
      };

      const staff = getStaffDetails(loggedInUser);
      let savedRecord = item ? { ...item, ...payload } : null;

      if (isEdit) {
        const { error } = await supabase
          .from("inventory_items")
          .update(payload)
          .eq("item_id", item.item_id);

        if (error) throw error;

        logInventoryActivity({
          loggedInUser,
          event_title: "Inventory Supply Updated",
          event_desc: `Updated supply details for "${payload.item_name}" (${payload.category}, Threshold: ${payload.low_stock_threshold}, Max: ${payload.ideal_stock_level} ${getShortUnit(payload.unit_of_measure)}).`,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("inventory_items")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        savedRecord = inserted;

        // Automatically log initial stock as RESTOCK transaction if > 0 and record expense
        if (inserted && payload.current_stock_level > 0) {
          let purchaseId = null;
          const totalExp = Number((Number(payload.unit_cost || 0) * payload.current_stock_level).toFixed(2));
          const txCode = `EXP-${Math.floor(10000 + Math.random() * 90000)}`;

          try {
            const { data: expRow } = await supabase
              .from("expenses")
              .insert({
                category: payload.category || "Supplies",
                amount: totalExp > 0 ? totalExp : 0,
                supplier_name: "Initial Inventory Setup",
                payment_method: "Cash",
                date_incurred: new Date().toISOString().split("T")[0],
                description: `Initial stock of ${payload.current_stock_level} ${getShortUnit(payload.unit_of_measure)} for ${payload.item_name}`,
                receipt_no: txCode,
              })
              .select()
              .single();

            if (expRow?.expense_id) {
              const { data: purRow } = await supabase
                .from("inventory_purchases")
                .insert({
                  expense_id: expRow.expense_id,
                  item_id: inserted.item_id,
                  quantity_bought: payload.current_stock_level,
                  unit_price: Number(payload.unit_cost) || 0,
                  subtotal: totalExp,
                  purchase_date: new Date().toISOString().split("T")[0],
                })
                .select()
                .single();
              if (purRow?.purchase_id) purchaseId = purRow.purchase_id;
            }
          } catch (expErr) {
            console.warn("Linked expense setup note:", expErr);
          }

          const { error: initErr } = await supabase.from("inventory_transactions").insert({
            item_id: inserted.item_id,
            purchase_id: purchaseId,
            user_id: staff.id,
            transaction_type: "RESTOCK",
            quantity: payload.current_stock_level,
            notes: formatTransactionNotes({
              txType: "RESTOCK",
              direction: "in",
              reason: "Initial inventory setup",
              notes: "",
              loggedInUser,
            }),
          });
          if (initErr) console.warn("Failed to log initial transaction:", initErr);
        }

        logInventoryActivity({
          loggedInUser,
          event_title: "Inventory Supply Added",
          event_desc: `Registered new supply "${payload.item_name}" (${payload.category}) with initial stock of ${payload.current_stock_level} ${getShortUnit(payload.unit_of_measure)}.`,
        });
      }

      toast.success(
        isEdit ? "Item updated" : "Supply added",
        isEdit ? `"${payload.item_name}" has been updated.` : `"${payload.item_name}" was added to inventory.`
      );

      // Transition to Success Screen consistent with other modules
      setSuccessInfo({
        isEdit,
        item_name: payload.item_name,
        category: payload.category,
        unit_of_measure: payload.unit_of_measure,
        current_stock_level: payload.current_stock_level,
        ideal_stock_level: payload.ideal_stock_level,
      });

      // Refresh parent dataset in background
      if (onSaved) onSaved(true, savedRecord);
    } catch (err) {
      console.error(err);
      const msg = /duplicate key|unique/i.test(err.message || "")
        ? "An item with this name already exists. Please use a different name."
        : err.message || "Something went wrong while saving.";
      if (/duplicate key|unique/i.test(err.message || "")) {
        setErrors(er => ({ ...er, item_name: msg }));
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnother = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSuccessInfo(null);
  };

  const handleSuccessClose = () => {
    setSuccessInfo(null);
    if (onSaved) onSaved();
    requestClose();
  };

  const containerMeta = getContainerMeta(form.unit_of_measure);
  const subUnitLabel = containerMeta?.subUnit === "doses" ? "dose" : containerMeta?.subUnit;
  const kgHint = (val) => {
    const n = parseFloat(val);
    if (!containerMeta || isNaN(n) || n < 0) return null;
    return `= ${toSubUnitQty(n, containerMeta.size)} ${containerMeta.subUnit}`;
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) requestClose();
      }}
      role="dialog"
    >
      <style>{`
        @keyframes modal-panel-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modal-panel-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        .animate-modal-in  { animation: modal-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-modal-out { animation: modal-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
      `}</style>

      <div
        style={{ willChange: "transform, opacity, max-width" }}
        className={[
          "w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left transition-[max-width] duration-300 ease-in-out",
          successInfo ? "max-w-sm" : "max-w-lg",
          panelClassName,
        ].join(" ")}
      >
        {!successInfo ? (
          <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {isEdit ? "Edit Supply Item" : "Add New Supply"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={saving}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-7 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.item_name}
                  onChange={set("item_name")}
                  onBlur={() => {
                    if (form.item_name.trim()) {
                      setForm((f) => ({ ...f, item_name: formatSupplyName(f.item_name) }));
                    }
                  }}
                  placeholder="e.g. Corn Mix (Pre-Starter)"
                  className={`w-full rounded-xl border py-2.5 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${errors.item_name ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                    }`}
                />
                <AnimatedNotice
                  show={!!(errors.item_name || nameMatchInfo.exactMatch || nameMatchInfo.similarMatches.length > 0)}
                >
                  {errors.item_name ? (
                    <p className="pt-1 text-xs text-rose-600">{errors.item_name}</p>
                  ) : nameMatchInfo.exactMatch ? (
                    <div className="pt-1.5">
                      <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 border border-rose-200/80 px-2.5 py-1.5 text-[11px] text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
                        <span>
                          <strong>{formatSupplyName(nameMatchInfo.exactMatch.item_name)}</strong> already exists
                          {nameMatchInfo.exactMatch.is_archived
                            ? " in Archived Supplies. Restore it instead of adding a duplicate."
                            : "."}
                        </span>
                      </div>
                    </div>
                  ) : nameMatchInfo.similarMatches.length > 0 ? (
                    <div className="pt-1.5">
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 text-[11px] text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <span>
                          Similar existing {nameMatchInfo.similarMatches.length === 1 ? "supply" : "supplies"}:{" "}
                          <strong>
                            {nameMatchInfo.similarMatches
                              .map((m) => `${formatSupplyName(m.item_name)}${m.is_archived ? " (Archived)" : ""}`)
                              .join(", ")}
                          </strong>
                          {" — "}double-check to avoid duplicates.
                        </span>
                      </div>
                    </div>
                  ) : null}
                </AnimatedNotice>
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={handleCategoryChange}
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
                  >
                    <option value="Feed">Feed (sacks)</option>
                    <option value="Medication">Medication (vials, ml, tablets…)</option>
                    <option value="Vaccines">Vaccines (vials, doses, ml…)</option>
                    <option value="Supplements">Supplements (packs, bottles, kg…)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit of Measure <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.unit_of_measure}
                    onChange={set("unit_of_measure")}
                    className={`w-full rounded-xl border py-2.5 px-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer ${errors.unit_of_measure ? "border-rose-300 bg-rose-50" : "border-slate-200"
                      }`}
                  >
                    {(() => {
                      const base = CATEGORY_UNITS[form.category]?.options || ["sacks (25kg)", "sacks (50kg)", "kg", "ml", "vials"];
                      const opts = base.includes(form.unit_of_measure) || !form.unit_of_measure
                        ? base
                        : [form.unit_of_measure, ...base];
                      return opts.map(u => (
                        <option key={u} value={u}>{unitLabel(u)}</option>
                      ));
                    })()}
                  </select>
                  {containerMeta && (
                    <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                      1 {getContainerSingular(form.unit_of_measure)} = {containerMeta.size} {containerMeta.subUnit}
                    </p>
                  )}
                  <AnimatedNotice show={!!errors.unit_of_measure}>
                    <p className="pt-1 text-xs text-rose-600">{errors.unit_of_measure}</p>
                  </AnimatedNotice>
                </div>
              </div>

              {/* Stock numbers: Par Level / Max Capacity -> Current Stock -> Low Alert */}
              <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {isMedicalCategory(form.category)
                      ? `Par Level & Thresholds (${getShortUnit(form.unit_of_measure)})`
                      : `Storage Capacity & Thresholds (${getShortUnit(form.unit_of_measure)})`}
                  </p>
                  {form.ideal_stock_level && !isNaN(parseFloat(form.ideal_stock_level)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const maxVal = parseFloat(form.ideal_stock_level);
                        // Medical: reorder at 50% (can't risk running out mid-treatment)
                        // Feed/Supplements: reorder at 25%
                        const pct = isMedicalCategory(form.category) ? 0.5 : 0.25;
                        const suggestedLow = maxVal >= 4 ? Math.round(maxVal * pct) : Number((maxVal * pct).toFixed(2));
                        setForm(f => ({
                          ...f,
                          low_stock_threshold: String(suggestedLow),
                        }));
                        setErrors(er => ({ ...er, low_stock_threshold: undefined }));
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      {isMedicalCategory(form.category) ? "Auto-set Low Alert (50%)" : "Auto-set Low Alert (25%)"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1 min-h-[18px]">
                      <label className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        {isMedicalCategory(form.category) ? "Par Level" : "Max Capacity"} <span className="text-rose-500">*</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={form.ideal_stock_level}
                      onChange={set("ideal_stock_level")}
                      placeholder="e.g. 20"
                      className={`w-full rounded-xl border bg-white py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${errors.ideal_stock_level ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                        }`}
                    />
                    <p className="mt-1 text-[10px] text-slate-400 min-h-[15px]">
                      {kgHint(form.ideal_stock_level) || (isMedicalCategory(form.category) ? "Max stock on hand" : "100% full storage")}
                    </p>
                    <AnimatedNotice show={!!errors.ideal_stock_level}>
                      <p className="pt-0.5 text-[10px] font-semibold text-rose-600">{errors.ideal_stock_level}</p>
                    </AnimatedNotice>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1 min-h-[18px]">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        <span>Current Stock</span>
                        {isEdit ? (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" title="Locked in edit mode" />
                        ) : (
                          <span className="text-rose-500">*</span>
                        )}
                      </label>
                      {!isEdit && form.ideal_stock_level && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, current_stock_level: f.ideal_stock_level }));
                            setErrors(er => ({ ...er, current_stock_level: undefined }));
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Full
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={form.ideal_stock_level || undefined}
                      step="any"
                      disabled={isEdit}
                      readOnly={isEdit}
                      value={form.current_stock_level}
                      onChange={set("current_stock_level")}
                      placeholder="0"
                      className={`w-full rounded-xl border py-2 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${isEdit
                          ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                          : errors.current_stock_level
                            ? "border-rose-300 bg-rose-50 text-slate-800"
                            : "bg-white border-slate-200 text-slate-800 focus:border-emerald-400"
                        }`}
                    />
                    <div className="mt-1 flex items-center justify-between gap-1 text-[10px] min-h-[15px]">
                      {isEdit ? (
                        <>
                          <span className="text-slate-400 truncate">
                            {kgHint(form.current_stock_level) || "Locked"}
                          </span>
                          {onSwitchToAdjust && (
                            <button
                              type="button"
                              onClick={() => onSwitchToAdjust(item)}
                              className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                            >
                              Adjust &rarr;
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">
                          {kgHint(form.current_stock_level) || "On-hand count"}
                        </span>
                      )}
                    </div>
                    <AnimatedNotice show={!!errors.current_stock_level}>
                      <p className="pt-0.5 text-[10px] font-semibold text-rose-600">{errors.current_stock_level}</p>
                    </AnimatedNotice>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1 min-h-[18px]">
                      <label className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        Low Alert <span className="text-rose-500">*</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.low_stock_threshold}
                      onChange={set("low_stock_threshold")}
                      placeholder="Auto (25%)"
                      className={`w-full rounded-xl border bg-white py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${errors.low_stock_threshold ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                        }`}
                    />
                    <p className="mt-1 text-[10px] text-slate-400 min-h-[15px]">
                      {kgHint(form.low_stock_threshold) || "Reorder trigger"}
                    </p>
                    <AnimatedNotice show={!!errors.low_stock_threshold}>
                      <p className="pt-0.5 text-[10px] font-semibold text-rose-600">{errors.low_stock_threshold}</p>
                    </AnimatedNotice>
                  </div>
                </div>
              </div>

              {/* Unit cost */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cost per Unit{containerMeta ? ` (per ${getContainerSingular(form.unit_of_measure)})` : ""} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₱</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.unit_cost}
                    onChange={set("unit_cost")}
                    placeholder="0.00"
                    className={`w-full rounded-xl border py-2.5 pl-7 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${
                      errors.unit_cost ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                    }`}
                  />
                </div>
                {containerMeta && parseFloat(form.unit_cost) > 0 && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                    = ₱{(parseFloat(form.unit_cost) / containerMeta.size).toFixed(2)} per {subUnitLabel}
                  </p>
                )}
                <AnimatedNotice show={!!errors.unit_cost}>
                  <p className="pt-1 text-xs text-rose-600">{errors.unit_cost}</p>
                </AnimatedNotice>
              </div>

              {/* Footer */}
              <div>
                <AnimatedNotice show={!!submitError}>
                  <div className="pb-3">
                    <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl">
                      {submitError}
                    </div>
                  </div>
                </AnimatedNotice>
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60 shadow-sm shadow-emerald-600/20"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isEdit ? "Save Changes" : "Add Supply"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* Consistent In-Modal Success Screen */
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-7 h-7" strokeWidth={2.5} />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                {successInfo.isEdit ? "Changes Saved!" : "Supply Item Added!"}
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                {successInfo.isEdit
                  ? `"${successInfo.item_name}" supply details and thresholds have been updated.`
                  : `"${successInfo.item_name}" was successfully registered in your inventory ledger.`}
              </p>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800 truncate">{successInfo.item_name}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  {successInfo.category}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Current Stock: <span className="font-semibold text-slate-700">{successInfo.current_stock_level} {getShortUnit(successInfo.unit_of_measure)}</span> &bull; Max Capacity: <span className="font-semibold text-slate-700">{successInfo.ideal_stock_level} {getShortUnit(successInfo.unit_of_measure)}</span>
              </p>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex flex-col gap-2.5">
              {!successInfo.isEdit && (
                <button
                  type="button"
                  onClick={handleAddAnother}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Another Supply
                </button>
              )}
              <button
                type="button"
                onClick={handleSuccessClose}
                className={`w-full py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${successInfo.isEdit
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                  : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
