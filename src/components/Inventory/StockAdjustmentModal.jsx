import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUpDown, Loader2, TrendingUp, TrendingDown, CheckCircle2, Users } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";
import {
  formatTransactionNotes,
  getStaffDetails,
  logInventoryActivity,
  getContainerMeta,
  getContainerSingular,
  getShortUnit,
  toSubUnitQty,
  fromSubUnitQty,
} from "./inventoryUtils";

function getDefaultReason(type, category) {
  if (type === "in") return "Purchase/Delivery";
  const cat = (category || "").toLowerCase();
  if (cat === "medical" || cat === "medication" || cat === "vaccines") return "Used in treatment";
  if (cat === "feed" || cat === "supplements") return "Used in feeding";
  return "Used in feeding";
}

// Medical, Medication, and legacy Vaccines items share the same treatment-focused reasons
const isMedicalCategory = (cat) =>
  cat === "Medical" || cat === "Medication" || cat === "Vaccines";

export default function StockAdjustmentModal({ item, onClose, onSaved, loggedInUser }) {
  // Container items (sacks -> kg, vials -> ml / doses): stock is stored in containers,
  // but usage can be entered in the sub-unit. `sackKg` is the container size.
  const containerMeta = getContainerMeta(item?.unit_of_measure);
  const sackKg = containerMeta?.size || null;
  const subUnit = containerMeta?.subUnit || "";
  const containerNoun = getContainerSingular(item?.unit_of_measure);
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const unitName = getShortUnit(item?.unit_of_measure);

  const [form, setForm] = useState(() => ({
    type: "in",
    quantity: "",
    inputUnit: "stock", // "stock" = item's own unit (sacks/vials), "kg" = the sub-unit (kg / ml / doses) for container items
    reason: getDefaultReason("in", item?.category),
    feedTarget: "breeders", // "breeders" | "batch" | "general"
    selectedBatchId: "",
  }));
  const [activeBatches, setActiveBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "";
    fetch(`${apiBase}/api/growth/active-feed-batches`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const batchList = Array.isArray(data) ? data : (data?.batches || []);
        if (batchList.length > 0) {
          setActiveBatches(batchList);
          // Default to matching batch if this feed item is linked to an active batch
          const matchingBatch = batchList.find((b) => b.current_feed?.item_id === item?.item_id);
          if (matchingBatch) {
            setForm((f) => ({
              ...f,
              feedTarget: "batch",
              selectedBatchId: matchingBatch.batch_id,
            }));
          } else {
            setForm((f) => ({ ...f, selectedBatchId: batchList[0].batch_id }));
          }
        }
      })
      .catch(() => { });
  }, [item?.item_id]);

  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(
    true,
    onClose
  );

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const handleTypeSwitch = (nextType) => {
    setForm(f => ({
      ...f,
      type: nextType,
      // Deliveries arrive in whole containers; daily use is measured in the sub-unit (kg / ml / doses)
      inputUnit: sackKg && nextType === "out" ? "kg" : "stock",
      quantity: "",
      reason: getDefaultReason(nextType, item?.category),
    }));
    setErrors({});
  };

  const handleInputUnitSwitch = (nextUnit) => {
    setForm(f => {
      const n = parseFloat(f.quantity);
      let converted = "";
      if (!isNaN(n) && n > 0 && sackKg) {
        converted = nextUnit === "kg"
          ? String(toSubUnitQty(n, sackKg))
          : String(fromSubUnitQty(n, sackKg));
      }
      return { ...f, inputUnit: nextUnit, quantity: converted };
    });
    setErrors({});
  };

  const inKg = !!sackKg && form.inputUnit === "kg";
  // Quantity expressed in the item's own unit (sacks for sack items)
  const toStockQty = (raw) => {
    const n = parseFloat(raw);
    if (isNaN(n)) return 0;
    return inKg ? fromSubUnitQty(n, sackKg) : n;
  };
  const stockQty = toStockQty(form.quantity);

  const currentLevel = parseFloat(item?.current_stock_level) || 0;
  const maxCapacity = parseFloat(item?.ideal_stock_level) || 0;
  const spaceLeft = maxCapacity > 0 ? Math.max(0, Number((maxCapacity - currentLevel).toFixed(4))) : 0;

  // Show "15 sacks" plus "(375 kg)" / "8 vials" plus "(800 ml)" for container items
  const fmt = (n) => {
    const base = `${Number(Number(n).toFixed(2))} ${unitName}`;
    return sackKg ? `${base} (${toSubUnitQty(n, sackKg)} ${subUnit})` : base;
  };

  const previewRemaining = () => {
    if (form.type === "in") return Number((currentLevel + stockQty).toFixed(4));
    if (form.type === "out") return Math.max(0, Number((currentLevel - stockQty).toFixed(4)));
    return currentLevel;
  };

  const validate = () => {
    const e = {};
    const raw = parseFloat(form.quantity);
    if (!form.quantity || isNaN(raw) || raw <= 0) {
      e.quantity = "Enter a valid quantity";
    } else if (form.type === "in" && maxCapacity > 0 && form.reason !== "Correction" && currentLevel + stockQty > maxCapacity + 1e-9) {
      e.quantity = `Exceeds max capacity of ${fmt(maxCapacity)} — only ${fmt(spaceLeft)} of space left`;
    } else if (form.type === "out" && stockQty > currentLevel + 1e-9) {
      e.quantity = `Cannot deduct more than current stock (${fmt(currentLevel)})`;
    }
    if (!form.reason.trim()) e.reason = "Reason is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    // Stored quantity is always in the item's own unit (sacks for sack items)
    const qty = Number(stockQty.toFixed(4));
    const newRemaining = previewRemaining();
    const qtyLabel = inKg
      ? `${parseFloat(form.quantity)} ${subUnit} (${qty} ${unitName})`
      : `${qty} ${unitName}`;

    // Map to transaction_type enum: ('RESTOCK', 'USAGE', 'WASTAGE', 'CORRECTION')
    let txType = "USAGE";
    if (form.type === "in") {
      txType = form.reason === "Correction" ? "CORRECTION" : "RESTOCK";
    } else {
      if (form.reason === "Correction") {
        txType = "CORRECTION";
      } else if (form.reason === "Expired/Spoiled" || form.reason === "Damaged") {
        txType = "WASTAGE";
      } else {
        txType = "USAGE";
      }
    }

    try {
      // 1. Update current stock in master catalog
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({
          current_stock_level: newRemaining,
          last_updated_at: new Date().toISOString(),
        })
        .eq("item_id", item.item_id);

      if (updateError) throw updateError;

      // 2. Log transaction in inventory_transactions ledger
      const staff = getStaffDetails(loggedInUser);

      let feedTargetDesc = "";
      let selectedBatch = null;
      if (form.type === "out" && form.reason === "Used in feeding") {
        if (form.feedTarget === "breeders") {
          feedTargetDesc = "Breeder Herd (Sows & Boars)";
        } else if (form.feedTarget === "batch") {
          selectedBatch = activeBatches.find((b) => b.batch_id === form.selectedBatchId);
          feedTargetDesc = selectedBatch
            ? `Batch ${selectedBatch.batch_tag} (${selectedBatch.current_count} heads)`
            : "Piglet Batch";
        } else {
          feedTargetDesc = "General Feeding";
        }
      }

      const noteDetails = [
        feedTargetDesc ? `Target: ${feedTargetDesc}` : "",
        inKg ? `Entered as ${parseFloat(form.quantity)} ${subUnit}` : "",
      ].filter(Boolean).join(" - ");

      const formattedNotes = formatTransactionNotes({
        txType,
        direction: form.type,
        reason: form.reason,
        notes: noteDetails,
        loggedInUser,
      });

      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          item_id: item.item_id,
          user_id: staff.id,
          transaction_type: txType,
          quantity: qty,
          notes: formattedNotes,
        });

      if (txError) console.warn("Failed to record transaction log:", txError);

      // If feed was given to a specific piglet batch, record in batch_activity_logs as well
      if (form.type === "out" && form.reason === "Used in feeding" && selectedBatch) {
        const feedKg = inKg ? parseFloat(form.quantity) : toSubUnitQty(qty, sackKg || 25);
        await supabase
          .from("batch_activity_logs")
          .insert({
            batch_id: selectedBatch.batch_id,
            activity_type: "FEED",
            amount_given: feedKg,
            performed_by: staff.name,
          })
          .then(() => { })
          .catch((err) => console.warn("Failed to record batch feed log:", err));
      }

      // 3. Log activity in Admin Audit Trail
      logInventoryActivity({
        loggedInUser,
        event_title: form.type === "in" ? "Inventory Restocked" : "Inventory Stock Used/Adjusted",
        event_desc: `${item.item_name}: ${form.type === "in" ? "+" : "-"}${qtyLabel} (${form.reason}${feedTargetDesc ? ` - ${feedTargetDesc}` : ""}) → ${fmt(newRemaining)} remaining.`,
        user_bg_color: form.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
      });

      toast.success(
        "Stock updated",
        `${item.item_name}: ${form.type === "in" ? "+" : "-"}${qtyLabel} → ${fmt(newRemaining)} remaining`
      );

      // Transition to Success Screen consistent with other modules
      setSuccessInfo({
        item_name: item.item_name,
        type: form.type,
        qty,
        qtyLabel,
        unit: unitName,
        previousLevel: currentLevel,
        newRemaining,
        newRemainingLabel: fmt(newRemaining),
        reason: form.reason,
      });

      // Notify parent to refresh in background
      if (onSaved) onSaved(true);
    } catch (err) {
      console.error(err);
      setErrors(er => ({ ...er, submit: err.message || "Failed to update stock." }));
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessInfo(null);
    if (onSaved) onSaved();
    requestClose();
  };

  if (!shouldRender || !item) return null;

  const remaining = previewRemaining();

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
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
          successInfo ? "max-w-sm" : "max-w-md",
          panelClassName,
        ].join(" ")}
      >
        {!successInfo ? (
          <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                  <ArrowUpDown className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Stock Adjustment</h2>
                  <p className="text-[11px] text-slate-400 truncate max-w-[240px]">{item.item_name}</p>
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

            {/* Current stock & Max Capacity banner */}
            <div className="px-7 pt-4">
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Current Stock / {isMedicalCategory(item?.category) ? "Par Level" : "Max Capacity"}
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    {Number(currentLevel.toFixed(2))}{" "}
                    <span className="text-xs font-semibold text-slate-400">
                      / {maxCapacity} {unitName}
                    </span>
                  </p>
                  {sackKg && (
                    <p className="text-[11px] font-semibold text-slate-500">
                      {toSubUnitQty(currentLevel, sackKg)} {subUnit} / {toSubUnitQty(maxCapacity, sackKg)} {subUnit}
                    </p>
                  )}
                  <p className="text-[10px] font-semibold text-slate-400">
                    {spaceLeft > 0
                      ? `${fmt(spaceLeft)} space available`
                      : isMedicalCategory(item?.category) ? "At par level" : "At full storage capacity"}
                  </p>
                </div>
                {form.quantity && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">After Adjustment</p>
                    <p
                      className={`text-lg font-black ${maxCapacity > 0 && remaining > maxCapacity
                        ? "text-amber-600"
                        : remaining < currentLevel
                          ? "text-rose-600"
                          : "text-emerald-600"
                        }`}
                    >
                      {Number(remaining.toFixed(2))} <span className="text-xs font-semibold">{unitName}</span>
                    </p>
                    {sackKg && (
                      <p className="text-[11px] font-semibold text-slate-500">{toSubUnitQty(remaining, sackKg)} {subUnit}</p>
                    )}
                    {maxCapacity > 0 && remaining > maxCapacity && (
                      <p className="text-[10px] font-bold text-amber-600">Over max capacity</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-7 py-5 space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeSwitch("in")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${form.type === "in"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Stock In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeSwitch("out")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${form.type === "out"
                      ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    Stock Out (-)
                  </button>
                </div>
              </div>

              {/* Quantity + Quick Chips */}
              {(() => {
                const factor = inKg ? sackKg : 1;
                // Typical sub-unit amounts: kg for feed, syringe ml for injectables, doses for vaccines
                const SUB_PRESETS = { kg: [5, 10], ml: [2, 5, 10], doses: [1, 5, 10], g: [50, 100, 250] };
                const presets = inKg
                  ? [...new Set([...(SUB_PRESETS[subUnit] || [5, 10]), sackKg])]
                  : [1, 5, 10];
                const spaceInput = Number((spaceLeft * factor).toFixed(2));
                const currentInput = Number((currentLevel * factor).toFixed(2));
                const suffix = inKg ? subUnit : unitName;
                const rawNum = parseFloat(form.quantity);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                      <label className="block text-xs font-semibold text-slate-700">
                        Quantity <span className="text-rose-500">*</span>
                      </label>

                      {/* container / sub-unit input toggle (sacks <-> kg, vials <-> ml / doses) */}
                      {sackKg && (
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                          {[
                            { id: "stock", label: capitalize(unitName) },
                            { id: "kg", label: subUnit === "kg" ? "Kg" : subUnit === "doses" ? "Doses" : subUnit },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleInputUnitSwitch(opt.id)}
                              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${form.inputUnit === opt.id
                                  ? "bg-white text-slate-900 shadow-sm"
                                  : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Quantity Chips */}
                    <div className="flex items-center gap-1 flex-wrap mb-1.5">
                      {presets.map((preset) => {
                        const disabled =
                          (form.type === "in" && maxCapacity > 0 && preset > spaceInput && form.reason !== "Correction") ||
                          (form.type === "out" && preset > currentInput);
                        const isSack = inKg && preset === sackKg;
                        return (
                          <button
                            key={preset}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              const cur = parseFloat(form.quantity) || 0;
                              const nextVal = Number((cur + preset).toFixed(2));
                              setForm(f => ({ ...f, quantity: String(nextVal) }));
                              setErrors(er => ({ ...er, quantity: undefined }));
                            }}
                            className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {form.type === "in" ? "+" : "-"}{preset}{inKg ? ` ${subUnit}` : ""}{isSack ? ` (1 ${containerNoun})` : ""}
                          </button>
                        );
                      })}
                      {form.type === "in" && spaceInput > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, quantity: String(spaceInput) }));
                            setErrors(er => ({ ...er, quantity: undefined }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Fill to Max (+{spaceInput} {suffix})
                        </button>
                      )}
                      {form.type === "out" && currentInput > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm(f => ({ ...f, quantity: String(currentInput) }));
                            setErrors(er => ({ ...er, quantity: undefined }));
                          }}
                          className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          All ({currentInput} {suffix})
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={form.quantity}
                        onChange={set("quantity")}
                        placeholder="0"
                        className={`w-full rounded-xl border py-2.5 px-3 pr-16 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors ${errors.quantity ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                          }`}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{suffix}</span>
                    </div>
                    {sackKg && !isNaN(rawNum) && rawNum > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                        {inKg
                          ? `${rawNum} ${subUnit} = ${Number(fromSubUnitQty(rawNum, sackKg).toFixed(3))} ${unitName}`
                          : `${rawNum} ${unitName} = ${toSubUnitQty(rawNum, sackKg)} ${subUnit}`}
                      </p>
                    )}
                    {errors.quantity && <p className="mt-1 text-xs text-rose-600 field-error">{errors.quantity}</p>}
                  </div>
                );
              })()}

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.reason}
                  onChange={set("reason")}
                  className={`w-full rounded-xl border py-2.5 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors cursor-pointer ${errors.reason ? "border-rose-300 bg-rose-50" : "border-slate-200 focus:border-emerald-400"
                    }`}
                >
                  <option value="" >Select reason...</option>
                  {form.type === "in" ? (
                    <>
                      <option value="Purchase/Delivery">Purchase</option>
                      <option value="Return/Refund">Return / Refund</option>
                      <option value="Correction">Stock Correction</option>
                      <option value="Transfer In">Transfer In</option>
                      <option value="Other">Other</option>
                    </>
                  ) : isMedicalCategory(item?.category) ? (
                    <>
                      <option value="Used in treatment">Used in Treatment</option>
                      <option value="Used in vaccination">Used in Vaccination</option>
                      <option value="Expired/Spoiled">Expired / Spoiled</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Transfer Out">Transfer Out</option>
                      <option value="Correction">Stock Correction</option>
                      <option value="Other">Other</option>
                    </>
                  ) : (
                    <>
                      <option value="Used in feeding">Used in Feeding</option>
                      <option value="Used in treatment">Used in Treatment</option>
                      <option value="Expired/Spoiled">Expired / Spoiled</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Transfer Out">Transfer Out</option>
                      <option value="Correction">Stock Correction</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
                {errors.reason && <p className="mt-1 text-xs text-rose-600 field-error">{errors.reason}</p>}
              </div>

              {/* Feeding Target Selection (shown when adjusting out for feeding) */}
              {form.type === "out" && form.reason === "Used in feeding" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-900">
                      Who was fed?
                    </label>
                    <span className="text-[10px] text-amber-700 font-semibold">Select Target Herd</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "breeders", label: "Sows & Boars" },
                      { id: "batch", label: "Piglet Batch" },
                      { id: "general", label: "General" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, feedTarget: opt.id }))}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${form.feedTarget === opt.id
                            ? "bg-white border-amber-400 text-amber-900 shadow-2xs"
                            : "bg-white/60 border-amber-200/70 text-amber-700 hover:bg-white"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {form.feedTarget === "breeders" && (
                    <p className="text-[11px] text-amber-800">
                      Logs this feed deduction for the breeding herd (lactating/gestating sows and boars).
                    </p>
                  )}

                  {form.feedTarget === "general" && (
                    <p className="text-[11px] text-amber-800">
                      Logs this feed deduction for general barn distribution without tagging a specific batch.
                    </p>
                  )}

                  {form.feedTarget === "batch" && (
                    <div className="space-y-2 pt-0.5">
                      <select
                        value={form.selectedBatchId}
                        onChange={(e) => setForm((f) => ({ ...f, selectedBatchId: e.target.value }))}
                        className="w-full rounded-xl border border-amber-300 bg-white py-2 px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
                      >
                        {activeBatches.length === 0 ? (
                          <option value="">No active batches found</option>
                        ) : (
                          activeBatches.map((b) => (
                            <option key={b.batch_id} value={b.batch_id}>
                              {b.batch_tag} ({b.current_count} heads{b.current_feed ? ` • ~${b.current_feed.total_daily_feed_kg} kg/day` : ""})
                            </option>
                          ))
                        )}
                      </select>

                      {/* Quick preset for batch daily estimated intake */}
                      {(() => {
                        const b = activeBatches.find((x) => x.batch_id === form.selectedBatchId);
                        const estKg = b?.current_feed?.total_daily_feed_kg;
                        if (!estKg || estKg <= 0) return null;
                        return (
                          <div className="flex items-center justify-between gap-2 pt-0.5 bg-white/70 rounded-lg p-2 border border-amber-200/70">
                            <span className="text-[10.5px] text-amber-900 leading-tight">
                              Estimated intake: <strong>{estKg} kg/day</strong> ({b.current_count} heads × {b.current_feed.daily_consumption_per_head} kg)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (inKg) {
                                  setForm((f) => ({ ...f, quantity: String(estKg) }));
                                } else {
                                  const sacks = fromSubUnitQty(estKg, sackKg || 25);
                                  setForm((f) => ({ ...f, quantity: String(Number(sacks.toFixed(2))) }));
                                }
                                setErrors((er) => ({ ...er, quantity: undefined }));
                              }}
                              className="text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              Use ~{estKg} kg
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              {errors.submit && (
                <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl">
                  {errors.submit}
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={requestClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 shadow-sm ${form.type === "in"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    }`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {form.type === "in" ? "Record Stock In" : "Record Stock Out"}
                </button>
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
              <h4 className="text-xl font-black text-slate-900">Stock Adjusted!</h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                <span className="font-bold text-slate-700">"{successInfo.item_name}"</span> stock level has been successfully updated.
              </p>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Adjustment:</span>
                <span className={`font-bold ${successInfo.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {successInfo.type === "in" ? "+" : "-"}{successInfo.qty} {successInfo.unit} ({successInfo.reason})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">New Current Stock:</span>
                <span className="font-extrabold text-slate-900">
                  {successInfo.newRemaining} {successInfo.unit}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
