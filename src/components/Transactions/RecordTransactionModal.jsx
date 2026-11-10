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
import toast from "../../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const PAYMENT_METHODS = [
  "Cash",
  "Bank transfer",
  "GCash",
  "Check",
  "Over the counter",
];

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

export default function RecordTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  loggedInUser,
}) {
  const { shouldRender, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [mainType, setMainType] = useState("sale"); // "sale" | "expense"

  // Options from server
  const [options, setOptions] = useState({ pigs: [], batches: [], inventoryItems: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ─── Sale State ───────────────────────────────────────────────────────────
  const [selectedTarget, setSelectedTarget] = useState(""); // e.g. "batch:123" or "pig:456"
  const [headsToSell, setHeadsToSell] = useState("1");
  const [totalScaleWeight, setTotalScaleWeight] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saleStatus, setSaleStatus] = useState("Completed");

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

  const [saving, setSaving] = useState(false);
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
          setSelectedTarget(`batch:${data.batches[0].batch_id}`);
        } else if (data.pigs?.length > 0) {
          setSelectedTarget(`pig:${data.pigs[0].pig_id}`);
        }
        if (data.inventoryItems?.length > 0) {
          setSelectedItemId(data.inventoryItems[0].item_id);
          setInventoryUnitPrice(data.inventoryItems[0].unit_cost || "");
        }
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, [isOpen]);

  // Update unit price when inventory item changes
  const handleItemSelect = (itemId) => {
    setSelectedItemId(itemId);
    const it = options.inventoryItems.find((i) => i.item_id === itemId);
    if (it) {
      setInventoryUnitPrice(it.unit_cost || "");
      if (it.category) setExpenseCategory(it.category);
    }
  };

  const [targetType, targetId] = selectedTarget ? selectedTarget.split(":") : ["batch", ""];
  const isBatch = targetType === "batch";
  const selectedBatch = isBatch ? options.batches.find((b) => b.batch_id === targetId) : null;
  const selectedPig = !isBatch ? options.pigs.find((p) => p.pig_id === targetId) : null;
  const selectedItem = options.inventoryItems.find((i) => i.item_id === selectedItemId);

  const handleTargetChange = (val) => {
    setSelectedTarget(val);
    const [tType, tId] = val ? val.split(":") : ["", ""];
    if (tType === "pig") {
      const pig = options.pigs.find((p) => p.pig_id === tId);
      setHeadsToSell("1");
      if (pig && pig.weight) {
        setTotalScaleWeight(String(pig.weight));
      }
    } else {
      setHeadsToSell("1");
    }
  };

  // Derive sale category automatically
  const derivedCategory = !isBatch
    ? "Breeding sows (Culled)"
    : selectedBatch?.marketType === "Weaner"
    ? "Piglets"
    : "Finisher hogs";

  // Compute sale total: strictly PHP per kilogram
  const computedSaleTotal = () => {
    const weight = parseFloat(totalScaleWeight) || 0;
    const rate = parseFloat(pricePerKg) || 0;
    return weight * rate;
  };

  const headsCountNum = isBatch ? parseInt(headsToSell) || 0 : 1;
  const avgWeight = totalScaleWeight && headsCountNum > 0
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
        const qty = parseInt(headsToSell);
        if (isNaN(qty) || qty <= 0) {
          errs.headsToSell = "Enter valid headcount.";
        } else if (selectedBatch && qty > selectedBatch.current_count) {
          errs.headsToSell = `Cannot exceed available count (${selectedBatch.current_count}).`;
        }
      }
      const weight = parseFloat(totalScaleWeight);
      if (isNaN(weight) || weight <= 0) {
        errs.totalScaleWeight = "Scale weight is required (> 0 kg).";
      }
      const rate = parseFloat(pricePerKg);
      if (isNaN(rate) || rate <= 0) {
        errs.pricePerKg = "Price per kg is required (> ₱0).";
      }
      if (!buyerName.trim()) {
        errs.buyerName = "Buyer / Client name is required.";
      }
    } else {
      // Expense
      if (expenseMode === "inventory") {
        if (!selectedItemId) errs.item = "Select an inventory supply.";
        const qty = parseFloat(inventoryQty);
        if (isNaN(qty) || qty <= 0) errs.inventoryQty = "Enter a valid quantity.";
        const price = parseFloat(inventoryUnitPrice);
        if (isNaN(price) || price <= 0) errs.inventoryUnitPrice = "Enter a valid unit price.";
      } else {
        const amt = parseFloat(expenseAmount);
        if (isNaN(amt) || amt <= 0) errs.expenseAmount = "Enter a valid expense amount (> ₱0).";
      }
    }
    setErrors(errs);
    return {
      isValid: Object.keys(errs).length === 0,
      firstError: Object.values(errs)[0],
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { isValid, firstError } = validate();
    if (!isValid) {
      toast.error("Required Field Missing", firstError || "Please check required fields.");
      return;
    }
    setSaving(true);

    try {
      if (mainType === "sale") {
        const qty = isBatch ? (parseInt(headsToSell) || 1) : 1;
        const weight = parseFloat(totalScaleWeight) || 0;
        const rate = parseFloat(pricePerKg) || 0;
        const total = weight * rate;

        const itemDesc = isBatch
          ? `${derivedCategory} (${qty} head${qty > 1 ? "s" : ""}, total ${weight} kg @ ₱${rate}/kg)`
          : `Culled Sow #${selectedPig?.pig_tag || ""} (${weight} kg @ ₱${rate}/kg)`;

        const payload = {
          buyerName: buyerName.trim(),
          category: derivedCategory,
          paymentMethod: "Cash",
          paymentStatus: saleStatus,
          transactionDate: saleDate,
          notes: `${weight} kg @ ₱${rate}/kg (${qty} head${qty > 1 ? "s" : ""}${avgWeight ? `, ~${avgWeight} kg/head` : ""})`,
          creator: loggedInUser,
          items: [
            {
              pigId: isBatch ? null : selectedPig?.pig_id,
              batchId: isBatch ? selectedBatch?.batch_id : null,
              itemDescription: itemDesc,
              quantitySold: qty,
              saleWeight: weight,
              unitPrice: rate,
              pricePerKg: rate,
              subtotal: total,
            },
          ],
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
          `Sale of ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${weight} kg @ ₱${rate}/kg) to ${buyerName.trim()} recorded successfully.`
        );
      } else {
        // Expense
        const isInv = expenseMode === "inventory";
        const amt = isInv ? computedInventoryTotal() : parseFloat(expenseAmount);

        const payload = {
          category: isInv ? (selectedItem?.category || expenseCategory) : expenseCategory,
          amount: amt,
          supplierName: isInv ? `${selectedItem?.item_name || "Supply"} Restock` : expenseCategory,
          paymentMethod: "Cash",
          paymentStatus: expenseStatus,
          dateIncurred: expenseDate,
          description: isInv
            ? `Restock ${inventoryQty} ${selectedItem?.unit_of_measure || ""} ${selectedItem?.item_name || ""}`.trim()
            : expenseCategory,
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
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) requestClose();
      }}
      role="dialog"
    >
      <div
        className={`w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] ${panelClassName}`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record New Transaction</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Record sales to update herd headcount, or expenses to restock supplies.
            </p>
          </div>
          <button
            onClick={requestClose}
            disabled={saving}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
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
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                mainType === "sale"
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
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                mainType === "expense"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <TrendingDown className="w-4 h-4 text-rose-500" /> Record Expense / Restock
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {mainType === "sale" ? (
            /* ═══════════════════ SWINE SALE SECTION ═══════════════════ */
            <>
              {/* Single Batch / Culled Swine Selector (No category or source dropdowns needed) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Select Active Batch / Swine *
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
                            No breeding sows currently at cull parity (parity ≥ 5)
                          </option>
                        )}
                      </optgroup>
                    </>
                  )}
                </select>
                {errors.target && <p className="text-[11px] text-rose-500 mt-1">{errors.target}</p>}
              </div>

              {/* Quantities & Pricing: Heads, Scale Weight (kg), Price per kg (₱) */}
              <div className="grid grid-cols-3 gap-3">
                {isBatch ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                      Heads to Sell *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBatch?.current_count || 999}
                      value={headsToSell}
                      onChange={(e) => setHeadsToSell(e.target.value)}
                      placeholder={`Max ${selectedBatch?.current_count || 0}`}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                    {errors.headsToSell && <p className="text-[10px] text-rose-500 mt-1">{errors.headsToSell}</p>}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                      Headcount
                    </label>
                    <input
                      type="text"
                      disabled
                      value="1 head (Culled Sow)"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate" title="Total Scale Weight (kg)">
                    Scale Weight (kg) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={totalScaleWeight}
                    onChange={(e) => setTotalScaleWeight(e.target.value)}
                    placeholder="e.g. 105.0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  {errors.totalScaleWeight && <p className="text-[10px] text-rose-500 mt-1">{errors.totalScaleWeight}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Price per kg (₱) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    placeholder="e.g. 220"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  {errors.pricePerKg && <p className="text-[10px] text-rose-500 mt-1">{errors.pricePerKg}</p>}
                </div>
              </div>

              {/* Buyer Name, Sale Date, Payment Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Buyer / Client Name *
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Green Valley Organics"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  {errors.buyerName && <p className="text-[11px] text-rose-500 mt-1">{errors.buyerName}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Sale Date *
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Payment Status
                  </label>
                  <select
                    value={saleStatus}
                    onChange={(e) => setSaleStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                  >
                    <option value="Completed">Completed (Paid)</option>
                    <option value="Pending">Pending (Post-dated)</option>
                  </select>
                </div>
              </div>

              {/* Automatic Effect Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-800 leading-relaxed">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong className="text-sm font-bold text-emerald-950">
                      Total Revenue: ₱{computedSaleTotal().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    {totalScaleWeight && pricePerKg && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        ({totalScaleWeight} kg @ ₱{pricePerKg}/kg{avgWeight ? ` • ~${avgWeight} kg/head` : ""})
                      </span>
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
                  onClick={() => setExpenseMode("inventory")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    expenseMode === "inventory"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Inventory Supply Restock
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseMode("operational")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    expenseMode === "operational"
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
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Select Inventory Supply to Restock *
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      {options.inventoryItems.length === 0 ? (
                        <option value="">No supplies found in inventory</option>
                      ) : (
                        options.inventoryItems.map((it) => (
                          <option key={it.item_id} value={it.item_id}>
                            {it.item_name} ({it.category} • Current stock: {it.current_stock_level} {it.unit_of_measure})
                          </option>
                        ))
                      )}
                    </select>
                    {errors.item && <p className="text-[11px] text-rose-500 mt-1">{errors.item}</p>}
                  </div>

                  {/* Quantity & Unit Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Quantity Purchased ({selectedItem?.unit_of_measure || "units"}) *
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={inventoryQty}
                        onChange={(e) => setInventoryQty(e.target.value)}
                        placeholder="e.g. 40"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      {errors.inventoryQty && <p className="text-[10px] text-rose-500 mt-1">{errors.inventoryQty}</p>}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Unit Price (₱) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inventoryUnitPrice}
                        onChange={(e) => setInventoryUnitPrice(e.target.value)}
                        placeholder="e.g. 1650"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      {errors.inventoryUnitPrice && <p className="text-[10px] text-rose-500 mt-1">{errors.inventoryUnitPrice}</p>}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Category & Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Expense Category *
                      </label>
                      <select
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
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                        Total Amount (₱) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="e.g. 12500"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      {errors.expenseAmount && <p className="text-[10px] text-rose-500 mt-1">{errors.expenseAmount}</p>}
                    </div>
                  </div>
                </>
              )}

              {/* Date Incurred & Payment Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Date Incurred *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                    Payment Status
                  </label>
                  <select
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
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                mainType === "sale"
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

