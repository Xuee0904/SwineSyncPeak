import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  History,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  Flame,
  Calendar,
  User,
  Package,
} from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";
import { formatTimestamp } from "../../utils/formatTimestamp";
import {
  getStockStatus,
  BURN_WINDOW_DAYS,
  hasSubUnit,
  getShortUnit,
  getContainerMeta,
  formatSubUnitEquivalent,
} from "./inventoryUtils";

const TX_BADGE_MAP = {
  RESTOCK: {
    label: "Restock",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: TrendingUp,
  },
  USAGE: {
    label: "Usage",
    cls: "bg-sky-50 text-sky-700 ring-sky-200",
    icon: TrendingDown,
  },
  WASTAGE: {
    label: "Wastage",
    cls: "bg-rose-50 text-rose-700 ring-rose-200",
    icon: AlertTriangle,
  },
  CORRECTION: {
    label: "Correction",
    cls: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: SlidersHorizontal,
  },
};

export default function TransactionHistoryModal({
  item,
  metrics,
  onClose,
  onAdjustStock,
}) {
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { shouldRender, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(!!item, onClose);

  const transactions = useMemo(() => {
    const list = metrics?.transactions || [];
    // Sort newest first
    return [...list].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }, [metrics]);

  const filteredTx = useMemo(() => {
    if (typeFilter === "ALL") return transactions;
    return transactions.filter((t) => t.transaction_type === typeFilter);
  }, [transactions, typeFilter]);

  if (!shouldRender || !item) return null;

  const status = getStockStatus(
    item.current_stock_level,
    item.low_stock_threshold,
    metrics?.daysUntilLow
  );
  const burnRate = metrics?.dailyBurnRate || 0;
  const daysUntilLow = metrics?.daysUntilLow;
  const daysUntilEmpty = metrics?.daysUntilEmpty;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
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
        className={`w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[88vh] text-left ${panelClassName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                  {item.item_name}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {item.category || "General"} &bull; Unit: {getShortUnit(item.unit_of_measure)}
                {hasSubUnit(item.unit_of_measure) && ` (${item.unit_of_measure})`}{" "}
                {Number(item.unit_cost) > 0 &&
                  (hasSubUnit(item.unit_of_measure)
                    ? `• ₱${Number(item.unit_cost).toFixed(2)}/${getShortUnit(item.unit_of_measure)} (₱${(Number(item.unit_cost) / (getContainerMeta(item.unit_of_measure)?.size || 1)).toFixed(2)}/${getContainerMeta(item.unit_of_measure)?.subUnit === "doses" ? "dose" : getContainerMeta(item.unit_of_measure)?.subUnit})`
                    : `• ₱${Number(item.unit_cost).toFixed(2)}/${item.unit_of_measure}`)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="px-7 pt-4 pb-3 bg-slate-50/70 border-b border-slate-100 shrink-0 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Stock
              </p>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {item.current_stock_level}{" "}
                <span className="text-[11px] font-semibold text-slate-400">
                  {getShortUnit(item.unit_of_measure)}
                </span>
              </p>
              {hasSubUnit(item.unit_of_measure) && (
                <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                  = {formatSubUnitEquivalent(item.current_stock_level, item.unit_of_measure)}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">
                Low alert: {item.low_stock_threshold} &bull; Max cap: {item.ideal_stock_level}
                {hasSubUnit(item.unit_of_measure) && ` (${formatSubUnitEquivalent(item.ideal_stock_level, item.unit_of_measure)})`}
              </p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Restocked
              </p>
              <p className="text-base font-black text-emerald-600 mt-0.5">
                +{metrics?.total_in ?? 0}{" "}
                <span className="text-[11px] font-semibold text-emerald-500">
                  {getShortUnit(item.unit_of_measure)}
                </span>
              </p>
              {hasSubUnit(item.unit_of_measure) && (
                <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                  +{formatSubUnitEquivalent(metrics?.total_in ?? 0, item.unit_of_measure)}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">All-time inflow</p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Used / Wasted
              </p>
              <p className="text-base font-black text-rose-600 mt-0.5">
                -{metrics?.total_out ?? 0}{" "}
                <span className="text-[11px] font-semibold text-rose-400">
                  {getShortUnit(item.unit_of_measure)}
                </span>
              </p>
              {hasSubUnit(item.unit_of_measure) && (
                <p className="text-[10px] font-semibold text-rose-600 mt-0.5">
                  -{formatSubUnitEquivalent(metrics?.total_out ?? 0, item.unit_of_measure)}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">All-time outflow</p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                Burn Rate ({BURN_WINDOW_DAYS}d)
              </p>
              <p className="text-base font-black text-slate-900 mt-0.5">
                {burnRate > 0 ? `${burnRate}` : "0"}{" "}
                <span className="text-[11px] font-semibold text-slate-400">
                  {getShortUnit(item.unit_of_measure)}/day
                </span>
              </p>
              {burnRate > 0 && hasSubUnit(item.unit_of_measure) && (
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  ~{formatSubUnitEquivalent(burnRate, item.unit_of_measure)}/day
                </p>
              )}
              <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
                {burnRate <= 0
                  ? "No usage in last 14d"
                  : daysUntilLow === 0
                    ? daysUntilEmpty !== null
                      ? `~${daysUntilEmpty}d until empty`
                      : "Below threshold"
                    : `~${daysUntilLow}d to low alert`}
              </p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: `All (${transactions.length})` },
                { id: "RESTOCK", label: "Restock" },
                { id: "USAGE", label: "Usage" },
                { id: "WASTAGE", label: "Wastage" },
                { id: "CORRECTION", label: "Correction" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${typeFilter === tab.id
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto px-7 py-4 divide-y divide-slate-100">
          {filteredTx.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-300">
                <Package className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-500">
                No stock movements recorded for this filter.
              </p>
              <p className="text-[11px] text-slate-400">
                Adjust stock to log incoming deliveries, daily usage, or corrections.
              </p>
            </div>
          ) : (
            filteredTx.map((tx) => {
              const meta = TX_BADGE_MAP[tx.transaction_type] || TX_BADGE_MAP.USAGE;
              const Icon = meta.icon;
              const isPos = tx.isPositive;

              return (
                <div
                  key={tx.transaction_id}
                  className="py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/60 -mx-3 px-3 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-inset ${meta.cls}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {tx.cleanNotes}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatTimestamp(tx.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {tx.recordedBy}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {tx.isArchiveLog ? (
                      <span className="text-xs font-bold text-slate-400">
                        Status Note
                      </span>
                    ) : (
                      <div>
                        <span
                          className={`text-sm font-black ${isPos ? "text-emerald-600" : "text-rose-600"
                            }`}
                        >
                          {isPos ? "+" : "-"}
                          {tx.quantity}{" "}
                          <span className="text-[11px] font-semibold">
                            {getShortUnit(item.unit_of_measure)}
                          </span>
                        </span>
                        {hasSubUnit(item.unit_of_measure) && (
                          <div className="text-[10px] font-medium text-slate-400">
                            {isPos ? "+" : "-"}
                            {formatSubUnitEquivalent(tx.quantity, item.unit_of_measure)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-400">
            Audit trail is immutable and protected by row-level security.
          </p>
          <div className="flex items-center gap-2.5">
            {!item.is_archived && onAdjustStock && (
              <button
                type="button"
                onClick={() => {
                  requestClose();
                  onAdjustStock(item);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Adjust Stock
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

