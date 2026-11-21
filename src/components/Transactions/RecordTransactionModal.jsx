import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Layers,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";
import AnimatedNotice from "../common/AnimatedNotice";
import toast from "../../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const EXPENSE_CATEGORIES = [
  "Feeds",
  "Medication",
  "Supplements",
  "Veterinary",
  "Labor",
  "Utilities",
  "Maintenance",
  "Other",
];

const isBatchWeaner = (batch) => {
  if (!batch) return false;
  if (batch.marketType) return batch.marketType === "Weaner";
  return (batch.status || "").trim().toLowerCase() === "weaner";
};

const fieldBorderClass = (hasError) =>
  hasError
    ? "border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-500/15"
    : "border-slate-200 bg-white focus:border-emerald-500 focus:ring-emerald-500/20";

function getFieldError(field, rawValue, ctx = {}) {
  const str = String(rawValue ?? "").trim();

  switch (field) {
    case "headsToSell": {
      if (!str) return "Headcount is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Headcount must be at least 1.";
      if (!Number.isInteger(num)) return "Enter a whole number of heads.";
      if (ctx.selectedBatch && num > ctx.selectedBatch.current_count) {
        const avail = ctx.selectedBatch.current_count;
        return `Cannot exceed available count (${avail} head${avail === 1 ? "" : "s"}).`;
      }
      return null;
    }
    case "pricePerHead": {
      if (!str) return "Price per head is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Price per head must be greater than ₱0.";
      return null;
    }
    case "totalScaleWeight": {
      if (!str) return "Scale weight is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Scale weight must be greater than 0 kg.";
      return null;
    }
    case "pricePerKg": {
      if (!str) return "Price per kg is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Price per kg must be greater than ₱0.";
      return null;
    }
    case "buyerName":
      return str ? null : "Buyer name is required.";
    case "saleDate":
      return str ? null : "Sale date is required.";
    case "inventoryQty": {
      if (!str) return "Quantity is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Quantity must be greater than 0.";
      const curStock = Number(ctx.selectedItem?.current_stock_level) || 0;
      const maxCap = Number(ctx.selectedItem?.ideal_stock_level) || 0;
      const unit = ctx.selectedItem?.unit_of_measure || "units";
      if (maxCap > 0 && curStock + num > maxCap + 1e-9) {
        const spaceLeft = Math.max(0, Number((maxCap - curStock).toFixed(4)));
        if (spaceLeft <= 0) {
          return `Already at max capacity (${maxCap} ${unit}). No space left to restock.`;
        }
        return `Exceeds max capacity of ${maxCap} ${unit} (only ${spaceLeft} ${unit} of space left).`;
      }
      return null;
    }
    case "inventoryUnitPrice": {
      if (!str) return "Unit price is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Unit price must be greater than ₱0.";
      return null;
    }
    case "expenseAmount": {
      if (!str) return "Expense amount is required.";
      const num = Number(str);
      if (isNaN(num) || num <= 0) return "Expense amount must be greater than ₱0.";
      return null;
    }
    case "expenseDate":
      return str ? null : "Date incurred is required.";
    default:
      return null;
  }
}

export default function RecordTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  loggedInUser,
}) {
  const [saving, setSaving] = useState(false);
  const { shouldRender, isClosing, requestClose, panelRef, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose, { canClose: !saving });

  const [mainType, setMainType] = useState("sale"); // "sale" | "expense"

  // Options from server
  const [options, setOptions] = useState({ pigs: [], batches: [], inventoryItems: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Sale state
  const [selectedTarget, setSelectedTarget] = useState(""); // e.g. "batch:123" or "pig:456"
  const [headsToSell, setHeadsToSell] = useState("1");
  const [totalScaleWeight, setTotalScaleWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [pricePerHead, setPricePerHead] = useState("");
  const [salePricingMode, setSalePricingMode] = useState("per_kg");
  const [buyerName, setBuyerName] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saleStatus, setSaleStatus] = useState("Completed");
  const [saleNotes, setSaleNotes] = useState("");

  // ─── Expense State ────────────────────────────────────────────────────────
  const [expenseMode, setExpenseMode] = useState("inventory"); // "inventory" | "operational"
  const [expenseCategory, setExpenseCategory] = useState("Feeds");
  const [supplierName, setSupplierName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [inventoryQty, setInventoryQty] = useState("");
  const [inventoryUnitPrice, setInventoryUnitPrice] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expenseMethod, setExpenseMethod] = useState("Cash");
  const [expenseStatus, setExpenseStatus] = useState("Completed");
  const [expenseNotes, setExpenseNotes] = useState("");

  const [errors, setErrors] = useState({});

  // Fetch live active herds, batches & supplies
  useEffect(() => {
    if (!isOpen) return;
    setOptionsLoading(true);
    fetch(`${API_BASE}/api/transactions/options`)
      .then((r) => (r.ok ? r.json() : { pigs: [], batches: [], inventoryItems: [] }))
      .then((data) => {
        setOptions(data);
        if (data.batches?.length > 0) {
          const firstBatch = data.batches[0];
          setSelectedTarget(`batch:${firstBatch.batch_id}`);
          setSalePricingMode(isBatchWeaner(firstBatch) ? "per_head" : "per_kg");
        } else {
          const cullPig = (data.pigs || []).find((p) => p.isHighParity);
          if (cullPig) {
            setSelectedTarget(`pig:${cullPig.pig_id}`);
            setSalePricingMode("per_kg");
            if (cullPig.weight) setTotalScaleWeight(String(cullPig.weight));
          }
        }
        if (data.inventoryItems?.length > 0) {
          setSelectedItemId(data.inventoryItems[0].item_id);
          setInventoryUnitPrice(data.inventoryItems[0].unit_cost || "");
        }
      })
      .catch(() => { })
      .finally(() => setOptionsLoading(false));
  }, [isOpen]);

  const [targetType, targetId] = selectedTarget ? selectedTarget.split(":") : ["batch", ""];
  const isBatch = targetType === "batch";
  const selectedBatch = isBatch ? options.batches.find((b) => b.batch_id === targetId) : null;
  const selectedPig = !isBatch ? options.pigs.find((p) => p.pig_id === targetId) : null;
  const selectedItem = options.inventoryItems.find((i) => i.item_id === selectedItemId);

  const currentItemStock = Number(selectedItem?.current_stock_level) || 0;
  const maxItemCapacity = Number(selectedItem?.ideal_stock_level) || 0;
  const itemSpaceLeft = maxItemCapacity > 0
    ? Math.max(0, Number((maxItemCapacity - currentItemStock).toFixed(4)))
    : null;
  const itemUnitLabel = selectedItem?.unit_of_measure || "units";

  const validationCtx = { selectedBatch, selectedItem };

  // Update unit price and re-check restock quantity against newly selected capacity
  const handleItemSelect = (itemId) => {
    setSelectedItemId(itemId);
    const it = options.inventoryItems.find((i) => i.item_id === itemId);
    if (it) {
      setInventoryUnitPrice(it.unit_cost || "");
      if (it.category) setExpenseCategory(it.category);
      setErrors((prev) => ({
        ...prev,
        item: undefined,
        inventoryUnitPrice: undefined,
        inventoryQty:
          inventoryQty.trim() !== ""
            ? getFieldError("inventoryQty", inventoryQty, { selectedItem: it }) || undefined
            : undefined,
      }));
    }
  };

  const handleTargetChange = (val) => {
    setSelectedTarget(val);
    const [tType, tId] = val ? val.split(":") : ["", ""];
    setErrors((prev) => ({
      ...prev,
      target: undefined,
      headsToSell: undefined,
      totalScaleWeight: undefined,
      pricePerKg: undefined,
      pricePerHead: undefined,
    }));

    if (tType === "pig") {
      const pig = options.pigs.find((p) => p.pig_id === tId);
      setSalePricingMode("per_kg");
      setHeadsToSell("1");
      if (pig && pig.weight) {
        setTotalScaleWeight(String(pig.weight));
      }
    } else {
      const batch = options.batches.find((b) => b.batch_id === tId);
      setSalePricingMode(isBatchWeaner(batch) ? "per_head" : "per_kg");
      setHeadsToSell("1");
    }
  };

  const handleFieldChange = (field, setter) => (e) => {
    const val = e.target.value;
    setter(val);
    if (val.trim() === "") {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      return;
    }
    const msg = getFieldError(field, val, validationCtx);
    setErrors((prev) => ({ ...prev, [field]: msg || undefined }));
  };

  const isWeanerBatch = isBatch && isBatchWeaner(selectedBatch);
  const isPerHeadSale = isWeanerBatch && salePricingMode === "per_head";

  // Derive sale category automatically
  const derivedCategory = !isBatch
    ? "Breeding sows (Culled)"
    : isWeanerBatch
      ? "Weaners"
      : "Fatteners";

  // Compute sale total (per head for weaner default, per kg otherwise)
  const computedSaleTotal = () => {
    if (isPerHeadSale) {
      const qty = parseInt(headsToSell, 10) || 0;
      const rate = parseFloat(pricePerHead) || 0;
      return qty * rate;
    }
    const weight = parseFloat(totalScaleWeight) || 0;
    const rate = parseFloat(pricePerKg) || 0;
    return weight * rate;
  };

  const headsCountNum = isBatch ? parseInt(headsToSell, 10) || 0 : 1;
  const avgWeight = !isPerHeadSale && totalScaleWeight && headsCountNum > 0
    ? (parseFloat(totalScaleWeight) / headsCountNum).toFixed(1)
    : null;

  // Compute expense total for inventory
  const computedInventoryTotal = () => {
    const qty = parseFloat(inventoryQty) || 0;
    const price = parseFloat(inventoryUnitPrice) || 0;
    return qty * price;
  };

  const validate = () => {
    const errs = {};
    if (mainType === "sale") {
      if (!selectedTarget || !targetId) {
        errs.target = "Select an active batch or culled sow.";
      }
      if (isBatch) {
        const headsErr = getFieldError("headsToSell", headsToSell, validationCtx);
        if (headsErr) errs.headsToSell = headsErr;
      }
      if (isPerHeadSale) {
        const headPriceErr = getFieldError("pricePerHead", pricePerHead, validationCtx);
        if (headPriceErr) errs.pricePerHead = headPriceErr;
      } else {
        const weightErr = getFieldError("totalScaleWeight", totalScaleWeight, validationCtx);
        if (weightErr) errs.totalScaleWeight = weightErr;
        const kgPriceErr = getFieldError("pricePerKg", pricePerKg, validationCtx);
        if (kgPriceErr) errs.pricePerKg = kgPriceErr;
      }
      const buyerErr = getFieldError("buyerName", buyerName, validationCtx);
      if (buyerErr) errs.buyerName = buyerErr;
      const saleDateErr = getFieldError("saleDate", saleDate, validationCtx);
      if (saleDateErr) errs.saleDate = saleDateErr;
    } else {
      if (expenseMode === "inventory") {
        if (!selectedItemId) errs.item = "Select an inventory supply.";
        const qtyErr = getFieldError("inventoryQty", inventoryQty, validationCtx);
        if (qtyErr) errs.inventoryQty = qtyErr;
        const unitPriceErr = getFieldError("inventoryUnitPrice", inventoryUnitPrice, validationCtx);
        if (unitPriceErr) errs.inventoryUnitPrice = unitPriceErr;
      } else {
        const amtErr = getFieldError("expenseAmount", expenseAmount, validationCtx);
        if (amtErr) errs.expenseAmount = amtErr;
      }
      const expDateErr = getFieldError("expenseDate", expenseDate, validationCtx);
      if (expDateErr) errs.expenseDate = expDateErr;
    }
    setErrors(errs);
    return {
      isValid: Object.keys(errs).length === 0,
      firstError: Object.values(errs)[0],
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { isValid } = validate();
    if (!isValid) return;
    setSaving(true);

    try {
      if (mainType === "sale") {
        const qty = isBatch ? (parseInt(headsToSell, 10) || 1) : 1;
        const trimmedSaleNotes = saleNotes.trim();
        let total = 0;
        let lineItem;
        let saleSummary = "";
        let toastSummary = "";

        if (isPerHeadSale) {
          const rate = parseFloat(pricePerHead) || 0;
          total = Number((qty * rate).toFixed(2));
          const formattedRate = rate.toLocaleString("en-PH");
          const itemDesc = `${derivedCategory} (${qty} head${qty > 1 ? "s" : ""} @ ₱${formattedRate}/head)`;
          saleSummary = `${qty} head${qty > 1 ? "s" : ""} @ ₱${formattedRate}/head`;
          toastSummary = saleSummary;
          lineItem = {
            pigId: null,
            batchId: selectedBatch?.batch_id,
            itemDescription: itemDesc,
            quantitySold: qty,
            saleWeight: null,
            pricingMode: "per_head",
            unitPrice: rate,
            subtotal: total,
          };
        } else {
          const weight = parseFloat(totalScaleWeight) || 0;
          const rate = parseFloat(pricePerKg) || 0;
          total = Number((weight * rate).toFixed(2));
          const itemDesc = isBatch
            ? `${derivedCategory} (${qty} head${qty > 1 ? "s" : ""}, total ${weight} kg @ ₱${rate}/kg)`
            : `Culled Sow #${selectedPig?.pig_tag || ""} (${weight} kg @ ₱${rate}/kg)`;
          saleSummary = `${weight} kg @ ₱${rate}/kg (${qty} head${qty > 1 ? "s" : ""}${avgWeight ? `, ~${avgWeight} kg/head` : ""})`;
          toastSummary = `${weight} kg @ ₱${rate}/kg`;
          lineItem = {
            pigId: isBatch ? null : selectedPig?.pig_id,
            batchId: isBatch ? selectedBatch?.batch_id : null,
            itemDescription: itemDesc,
            quantitySold: qty,
            saleWeight: weight,
            pricingMode: "per_kg",
            unitPrice: rate,
            pricePerKg: rate,
            subtotal: total,
          };
        }

        const payload = {
          buyerName: buyerName.trim(),
          category: derivedCategory,
          paymentMethod: "Cash",
          paymentStatus: saleStatus,
          transactionDate: saleDate,
          notes: trimmedSaleNotes ? `${trimmedSaleNotes} (${saleSummary})` : saleSummary,
          creator: loggedInUser,
          items: [lineItem],
        };

        const res = await fetch(`${API_BASE}/api/transactions/sale`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to record sale.");

        toast.success(
          "Swine Sale Recorded",
          `Sale of ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${toastSummary}) to ${buyerName.trim()} recorded successfully.`
        );
      } else {
        // Expense
        const isInv = expenseMode === "inventory";
        const amt = isInv ? computedInventoryTotal() : parseFloat(expenseAmount);
        const trimmedExpNotes = expenseNotes.trim();
        const defaultExpDesc = isInv
          ? `Restock ${inventoryQty} ${selectedItem?.unit_of_measure || ""} ${selectedItem?.item_name || ""}`.trim()
          : expenseCategory;

        const payload = {
          category: isInv ? (selectedItem?.category || expenseCategory) : expenseCategory,
          amount: amt,
          supplierName: isInv ? `${selectedItem?.item_name || "Supply"} Restock` : expenseCategory,
          paymentMethod: "Cash",
          paymentStatus: expenseStatus,
          dateIncurred: expenseDate,
          description: trimmedExpNotes || defaultExpDesc,
          creator: loggedInUser,
          inventoryItems: isInv
            ? [
              {
                itemId: selectedItemId,
                quantityBought: parseFloat(inventoryQty),
                unitPrice: parseFloat(inventoryUnitPrice),
                batchNumber: null,
                expirationDate: null,
              },
            ]
            : [],
        };

        const res = await fetch(`${API_BASE}/api/transactions/expense`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to record expense.");

        toast.success(
          "Expense Recorded",
          `Expense of ₱${amt.toLocaleString("en-PH")} logged successfully.`
        );
      }

      if (onSuccess) onSuccess();
      requestClose();
    } catch (err) {
      toast.error("Transaction Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-tx-modal-title"
    >
      <div
        ref={panelRef}
        className={`w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] ${panelClassName}`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 id="record-tx-modal-title" className="text-base font-bold text-slate-900">Record New Transaction</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Record sales to update herd headcount, or expenses to restock supplies.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="Close modal"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Top Type Selector Tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMainType("sale");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${mainType === "sale"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Record Swine Sale (Revenue)
            </button>
            <button
              type="button"
              onClick={() => {
                setMainType("expense");
                setErrors({});
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${mainType === "expense"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              <TrendingDown className="w-4 h-4 text-rose-500" /> Record Expense / Restock
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {mainType === "sale" ? (
            /* ═══════════════════ SWINE SALE SECTION ═══════════════════ */
            <>
              {/* Single Batch / Culled Swine Selector (No category or source dropdowns needed) */}
              <div>
                <label htmlFor="sale-target" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Active Batch / Swine *
                </label>
                <select
                  id="sale-target"
                  value={selectedTarget}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  aria-invalid={!!errors.target}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 transition-colors ${
                    errors.target
                      ? "border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-500/15"
                      : "border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20"
                  }`}
                >
                  {options.batches.length === 0 && options.pigs.length === 0 ? (
                    <option value="">No healthy batches or culled swine available</option>
                  ) : (
                    <>
                      <optgroup label="Active Healthy Batches">
                        {options.batches.map((b) => (
                          <option key={`batch:${b.batch_id}`} value={`batch:${b.batch_id}`}>
                            {b.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Culled Sows (Breeding Herd Retirement)">
                        {options.pigs.filter((p) => p.isHighParity).length > 0 ? (
                          options.pigs
                            .filter((p) => p.isHighParity)
                            .map((p) => (
                              <option key={`pig:${p.pig_id}`} value={`pig:${p.pig_id}`}>
                                {p.label}
                              </option>
                            ))
                        ) : (
                          <option disabled value="">
                            No breeding sows currently at cull parity (less than 5)
                          </option>
                        )}
                      </optgroup>
                    </>
                  )}
                </select>
                <AnimatedNotice show={!!errors.target}>
                  <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.target}</p>
                </AnimatedNotice>
              </div>

              {/* Pricing basis toggle for Weaner batches (defaults to per head) */}
              {isWeanerBatch && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Pricing Basis
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Weaners default to per-head pricing
                    </span>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5 text-xs font-bold">
                    {[
                      { id: "per_head", label: "Per Head" },
                      { id: "per_kg", label: "Per kg" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSalePricingMode(opt.id);
                          setErrors((prev) => ({
                            ...prev,
                            totalScaleWeight: undefined,
                            pricePerKg: undefined,
                            pricePerHead: undefined,
                          }));
                        }}
                        className={`min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${salePricingMode === opt.id
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantities & Pricing */}
              {isPerHeadSale ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
                  <div>
                    <label htmlFor="sale-heads" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                      Heads to Sell *
                    </label>
                    <input
                      id="sale-heads"
                      type="number"
                      min="1"
                      max={selectedBatch?.current_count || 999}
                      value={headsToSell}
                      onChange={handleFieldChange("headsToSell", setHeadsToSell)}
                      aria-invalid={!!errors.headsToSell}
                      placeholder={`Max ${selectedBatch?.current_count || 0}`}
                      className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.headsToSell)}`}
                    />
                    <AnimatedNotice show={!!errors.headsToSell}>
                      <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.headsToSell}</p>
                    </AnimatedNotice>
                  </div>

                  <div>
                    <label htmlFor="sale-price-per-head" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                      Price per Head (₱) *
                    </label>
                    <input
                      id="sale-price-per-head"
                      type="number"
                      min="0"
                      step="1"
                      value={pricePerHead}
                      onChange={handleFieldChange("pricePerHead", setPricePerHead)}
                      aria-invalid={!!errors.pricePerHead}
                      placeholder="e.g. 2800"
                      className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.pricePerHead)}`}
                    />
                    <AnimatedNotice show={!!errors.pricePerHead}>
                      <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.pricePerHead}</p>
                    </AnimatedNotice>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-3">
                  {isBatch ? (
                    <div>
                      <label htmlFor="sale-heads" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Heads to Sell *
                      </label>
                      <input
                        id="sale-heads"
                        type="number"
                        min="1"
                        max={selectedBatch?.current_count || 999}
                        value={headsToSell}
                        onChange={handleFieldChange("headsToSell", setHeadsToSell)}
                        aria-invalid={!!errors.headsToSell}
                        placeholder={`Max ${selectedBatch?.current_count || 0}`}
                        className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.headsToSell)}`}
                      />
                      <AnimatedNotice show={!!errors.headsToSell}>
                        <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.headsToSell}</p>
                      </AnimatedNotice>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="sale-headcount" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Headcount
                      </label>
                      <input
                        id="sale-headcount"
                        type="text"
                        disabled
                        value="1 head (Culled Sow)"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="sale-weight" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate" title="Total Scale Weight (kg)">
                      Scale Weight (kg) *
                    </label>
                    <input
                      id="sale-weight"
                      type="number"
                      min="0"
                      step="0.5"
                      value={totalScaleWeight}
                      onChange={handleFieldChange("totalScaleWeight", setTotalScaleWeight)}
                      aria-invalid={!!errors.totalScaleWeight}
                      placeholder="e.g. 105.0"
                      className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.totalScaleWeight)}`}
                    />
                    <AnimatedNotice show={!!errors.totalScaleWeight}>
                      <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.totalScaleWeight}</p>
                    </AnimatedNotice>
                  </div>

                  <div>
                    <label htmlFor="sale-price-per-kg" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                      Price per kg (₱) *
                    </label>
                    <input
                      id="sale-price-per-kg"
                      type="number"
                      min="0"
                      step="1"
                      value={pricePerKg}
                      onChange={handleFieldChange("pricePerKg", setPricePerKg)}
                      aria-invalid={!!errors.pricePerKg}
                      placeholder="e.g. 220"
                      className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.pricePerKg)}`}
                    />
                    <AnimatedNotice show={!!errors.pricePerKg}>
                      <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.pricePerKg}</p>
                    </AnimatedNotice>
                  </div>
                </div>
              )}

              {/* Buyer Name, Sale Date, Payment Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-3">
                <div>
                  <label htmlFor="sale-buyer" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Buyer / Client Name *
                  </label>
                  <input
                    id="sale-buyer"
                    type="text"
                    value={buyerName}
                    onChange={handleFieldChange("buyerName", setBuyerName)}
                    aria-invalid={!!errors.buyerName}
                    placeholder="e.g. Green Valley Organics"
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.buyerName)}`}
                  />
                  <AnimatedNotice show={!!errors.buyerName}>
                    <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.buyerName}</p>
                  </AnimatedNotice>
                </div>

                <div>
                  <label htmlFor="sale-date" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Sale Date *
                  </label>
                  <input
                    id="sale-date"
                    type="date"
                    value={saleDate}
                    onChange={handleFieldChange("saleDate", setSaleDate)}
                    aria-invalid={!!errors.saleDate}
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.saleDate)}`}
                  />
                  <AnimatedNotice show={!!errors.saleDate}>
                    <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.saleDate}</p>
                  </AnimatedNotice>
                </div>

                <div>
                  <label htmlFor="sale-status" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Payment Status
                  </label>
                  <select
                    id="sale-status"
                    value={saleStatus}
                    onChange={(e) => setSaleStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                  >
                    <option value="Completed">Completed (Paid)</option>
                    <option value="Pending">Pending (Post-dated)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="sale-notes" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notes <span className="font-normal normal-case text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="sale-notes"
                  rows={2}
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Optional pickup details, truck plate, or buyer remarks"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                />
              </div>

              {/* Automatic Effect Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 leading-relaxed">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong className="text-sm font-bold text-emerald-950">
                      Total Revenue: ₱{computedSaleTotal().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    {isPerHeadSale ? (
                      headsCountNum > 0 && pricePerHead && (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          ({headsCountNum} head{headsCountNum > 1 ? "s" : ""} @ ₱{Number(pricePerHead).toLocaleString("en-PH")}/head)
                        </span>
                      )
                    ) : (
                      totalScaleWeight && pricePerKg && (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          ({totalScaleWeight} kg @ ₱{pricePerKg}/kg{avgWeight ? ` • ~${avgWeight} kg/head` : ""})
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    {isBatch
                      ? `Saving will automatically deduct ${headsToSell || 0} heads from ${selectedBatch?.batch_tag || "the batch"}, free pen capacity, and update daily feed forecasts.`
                      : `Saving will archive #${selectedPig?.pig_tag || "the sow"} as Sold (culled) and free up its pen slot immediately.`}
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* ═══════════════════ EXPENSE / RESTOCK SECTION ═══════════════════ */
            <>
              {/* Expense Mode Switch */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseMode("inventory");
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${expenseMode === "inventory"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  Inventory Supply Restock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpenseMode("operational");
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${expenseMode === "operational"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  Operational Expense (Labor, Utilities, Vet)
                </button>
              </div>

              {expenseMode === "inventory" ? (
                <>
                  {/* Select Inventory Supply */}
                  <div>
                    <label htmlFor="expense-supply-item" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Select Inventory Supply to Restock *
                    </label>
                    <select
                      id="expense-supply-item"
                      value={selectedItemId}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      aria-invalid={!!errors.item}
                      className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 transition-colors ${
                        errors.item
                          ? "border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-500/15"
                          : "border-slate-200 bg-slate-50/70 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20"
                      }`}
                    >
                      {options.inventoryItems.length === 0 ? (
                        <option value="">No supplies found in inventory</option>
                      ) : (
                        options.inventoryItems.map((it) => {
                          const maxLvl = Number(it.ideal_stock_level) || 0;
                          return (
                            <option key={it.item_id} value={it.item_id}>
                              {it.item_name} ({it.category} • Stock: {it.current_stock_level}{maxLvl > 0 ? ` / ${maxLvl}` : ""} {it.unit_of_measure})
                            </option>
                          );
                        })
                      )}
                    </select>
                    <AnimatedNotice show={!!errors.item}>
                      <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.item}</p>
                    </AnimatedNotice>
                  </div>

                  {/* Quantity & Unit Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
                    <div>
                      <label htmlFor="expense-inv-qty" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Quantity Purchased ({itemUnitLabel}) *
                      </label>
                      <input
                        id="expense-inv-qty"
                        type="number"
                        min="0.1"
                        step="any"
                        value={inventoryQty}
                        onChange={handleFieldChange("inventoryQty", setInventoryQty)}
                        aria-invalid={!!errors.inventoryQty}
                        placeholder="e.g. 40"
                        className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.inventoryQty)}`}
                      />
                      <AnimatedNotice show={!!errors.inventoryQty}>
                        <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.inventoryQty}</p>
                      </AnimatedNotice>
                      {maxItemCapacity > 0 && !errors.inventoryQty && (
                        <p className={`pt-1 text-[11px] font-medium ${itemSpaceLeft === 0 ? "text-amber-700" : "text-slate-500"}`}>
                          {itemSpaceLeft === 0
                            ? `At full capacity (${currentItemStock} / ${maxItemCapacity} ${itemUnitLabel}).`
                            : `Space left: ${itemSpaceLeft} ${itemUnitLabel} (Max ${maxItemCapacity}).`}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="expense-inv-price" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Unit Price (₱) *
                      </label>
                      <input
                        id="expense-inv-price"
                        type="number"
                        min="0"
                        step="any"
                        value={inventoryUnitPrice}
                        onChange={handleFieldChange("inventoryUnitPrice", setInventoryUnitPrice)}
                        aria-invalid={!!errors.inventoryUnitPrice}
                        placeholder="e.g. 1650"
                        className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.inventoryUnitPrice)}`}
                      />
                      <AnimatedNotice show={!!errors.inventoryUnitPrice}>
                        <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.inventoryUnitPrice}</p>
                      </AnimatedNotice>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Category & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
                    <div>
                      <label htmlFor="expense-category" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Expense Category *
                      </label>
                      <select
                        id="expense-category"
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="expense-amount" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Total Amount (₱) *
                      </label>
                      <input
                        id="expense-amount"
                        type="number"
                        min="0"
                        step="any"
                        value={expenseAmount}
                        onChange={handleFieldChange("expenseAmount", setExpenseAmount)}
                        aria-invalid={!!errors.expenseAmount}
                        placeholder="e.g. 12500"
                        className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.expenseAmount)}`}
                      />
                      <AnimatedNotice show={!!errors.expenseAmount}>
                        <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.expenseAmount}</p>
                      </AnimatedNotice>
                    </div>
                  </div>
                </>
              )}

              {/* Date Incurred & Payment Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
                <div>
                  <label htmlFor="expense-date" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Date Incurred *
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={handleFieldChange("expenseDate", setExpenseDate)}
                    aria-invalid={!!errors.expenseDate}
                    className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold text-slate-800 focus:ring-2 outline-none transition-colors ${fieldBorderClass(!!errors.expenseDate)}`}
                  />
                  <AnimatedNotice show={!!errors.expenseDate}>
                    <p role="alert" className="pt-1 text-[11px] font-medium text-rose-600">{errors.expenseDate}</p>
                  </AnimatedNotice>
                </div>

                <div>
                  <label htmlFor="expense-status" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Payment Status
                  </label>
                  <select
                    id="expense-status"
                    value={expenseStatus}
                    onChange={(e) => setExpenseStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                  >
                    <option value="Completed">Completed (Paid)</option>
                    <option value="Pending">Pending (Loan / Credit / Pay Later)</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="expense-notes" className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Notes <span className="font-normal normal-case text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="expense-notes"
                  rows={2}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Optional receipt reference, supplier invoice, or purchase notes"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                />
              </div>

              {/* Automatic Effect Callout */}
              <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-800 leading-relaxed">
                  <strong>Total Expense: ₱{(expenseMode === "inventory" ? computedInventoryTotal() : parseFloat(expenseAmount) || 0).toLocaleString("en-PH")}</strong>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {expenseMode === "inventory"
                      ? `Saving will automatically increase ${selectedItem?.item_name || "item"} stock by +${inventoryQty || 0} ${selectedItem?.unit_of_measure || ""}, update unit cost, and log a RESTOCK audit trail.`
                      : `Saving will record an operational expense under ${expenseCategory}.`}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${mainType === "sale"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-900 hover:bg-slate-800"
                }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Saving..." : mainType === "sale" ? "Record Swine Sale" : "Record Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

