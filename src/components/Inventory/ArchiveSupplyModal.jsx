import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2, Unlock, Check, Package, Archive, RotateCcw, ArrowUpDown } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";
import { supabase } from "../../supabaseClient";
import { toast } from "../../utils/toast";
import { logInventoryActivity } from "./inventoryUtils";

const REASON_OPTIONS = [
  "Discontinued / Phased Out",
  "Seasonal Supply - End of Rotation",
  "Supplier Unavailable / Brand Changed",
  "Replaced by Alternative Product",
  "Damaged / Expired Batch Removed",
  "Other (Specify below)",
];

export default function ArchiveSupplyModal({
  isOpen,
  onClose,
  archiveData,
  onConfirmSuccess,
  onOpenAdjust,
  loggedInUser,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(
    isOpen,
    onClose
  );

  const item = archiveData?.item;
  const isArchiving = archiveData?.isArchiving ?? true;
  const hasActiveStock = isArchiving && Number(item?.current_stock_level || 0) > 0;

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setError(null);
      setSelectedReason(REASON_OPTIONS[0]);
      setCustomReason("");
      setReasonError("");
    }
  }, [isOpen]);

  if (!shouldRender || !item) return null;

  const handleToggleArchive = async () => {
    try {
      setReasonError("");
      if (hasActiveStock) {
        setError(`Cannot archive "${item.item_name}" while it still has ${item.current_stock_level} ${item.unit_of_measure} recorded in stock. Adjust stock to 0 first.`);
        return;
      }
      let finalReason = null;
      if (isArchiving) {
        const isOther = selectedReason.startsWith("Other");
        if (isOther && !customReason.trim()) {
          setReasonError("Please specify the custom archive reasoning.");
          return;
        }
        finalReason = isOther ? customReason.trim() : selectedReason;
      }

      setLoading(true);
      setError(null);

      const updatePayload = {
        is_archived: isArchiving,
        last_updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from("inventory_items")
        .update(updatePayload)
        .eq("item_id", item.item_id);

      if (updateErr) throw updateErr;

      // Log archive/restore action to Admin activity_logs (without distorting stock movement totals)
      logInventoryActivity({
        loggedInUser,
        event_title: isArchiving ? "Inventory Supply Archived" : "Inventory Supply Restored",
        event_desc: isArchiving
          ? `Archived supply "${item.item_name}". Reason: ${finalReason || "N/A"}.`
          : `Restored supply "${item.item_name}" to active inventory.`,
        user_bg_color: isArchiving ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
      });

      toast.success(
        isArchiving ? "Item archived" : "Item restored",
        isArchiving
          ? `"${item.item_name}" has been moved to archived inventory.`
          : `"${item.item_name}" has been returned to active inventory.`
      );

      setShowSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err.message || `Failed to ${isArchiving ? "archive" : "restore"} item.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onConfirmSuccess) onConfirmSuccess(archiveData);
    requestClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) requestClose();
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
          showSuccess ? "max-w-sm" : "max-w-md",
          panelClassName,
        ].join(" ")}
      >
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-7 pt-7 pb-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isArchiving ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {isArchiving ? <Archive className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {isArchiving ? "Archive Supply Item" : "Restore Supply Item"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isArchiving ? "Remove item from active inventory ledger" : "Return item to active tracking"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={loading}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-7 pt-5 space-y-5">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-left animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Item Profile Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-xs">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{item.item_name}</p>
                  <p className="text-xs font-medium text-slate-500">
                    Category: <span className="font-semibold text-slate-700">{item.category || "General"}</span> &bull; Stock: <span className="font-semibold text-slate-700">{item.current_stock_level} {item.unit_of_measure}</span>
                  </p>
                </div>
              </div>

              {/* Context Notice */}
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isArchiving
                  ? "Archiving hides this item from active inventory lists and reorder alerts. Past transactions remain safe and preserved. You can restore it anytime from the Archived tab."
                  : "Restoring this item will make it available again in active inventory management, stock adjustments, and usage logs."}
              </p>

              {/* Active Stock Blocking Notice or Archive Reason */}
              {hasActiveStock ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2 text-left">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Cannot Archive Item with Remaining Stock</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This supply currently has <strong>{item.current_stock_level} {item.unit_of_measure}</strong> recorded in stock.
                    To protect inventory integrity and prevent ghost warehouse stock, you must deplete or adjust the quantity to <strong>0</strong> before archiving.
                  </p>
                </div>
              ) : isArchiving ? (
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reason for Archiving <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedReason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      setReasonError("");
                    }}
                    disabled={loading}
                    className="w-full bg-white border border-slate-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-all cursor-pointer disabled:opacity-60"
                  >
                    {REASON_OPTIONS.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {selectedReason.startsWith("Other") && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Please specify reason..."
                        value={customReason}
                        onChange={(e) => {
                          setCustomReason(e.target.value);
                          setReasonError("");
                        }}
                        disabled={loading}
                        required
                        className="w-full bg-white border border-slate-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none transition-all"
                      />
                    </div>
                  )}
                  {reasonError && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                      <span>•</span> {reasonError}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={loading}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {hasActiveStock ? "Close" : "Cancel"}
                </button>
                {hasActiveStock ? (
                  onOpenAdjust && (
                    <button
                      type="button"
                      onClick={() => onOpenAdjust(item)}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" /> Adjust Stock to 0
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleArchive}
                    disabled={loading}
                    className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isArchiving
                        ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                        : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
                      </>
                    ) : isArchiving ? (
                      <>
                        <Archive className="w-3.5 h-3.5" /> Confirm Archive
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> Confirm Restore
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm ${
                isArchiving
                  ? "bg-rose-50 border-rose-100 text-rose-600"
                  : "bg-emerald-50 border-emerald-100 text-emerald-600"
              }`}
            >
              {isArchiving ? (
                <Archive className="w-7 h-7" strokeWidth={2.5} />
              ) : (
                <Check className="w-7 h-7" strokeWidth={3} />
              )}
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Item {isArchiving ? "Archived!" : "Restored!"}
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                <span className="font-bold text-slate-700">"{item.item_name}"</span> has been successfully {isArchiving ? "archived and hidden from active lists" : "restored to active inventory"}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className={`w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${
                isArchiving
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              }`}
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
