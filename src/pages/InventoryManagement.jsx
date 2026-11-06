import React, { useState, useMemo, useCallback } from "react";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  SlidersHorizontal,
  Search,
  Pencil,
  ArrowUpDown,
  CheckCircle2,
  Trash2,
  Archive,
  RotateCcw,
  History,
  Flame,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "../utils/toast";
import { supabase } from "../supabaseClient";
import { formatTimestamp } from "../utils/formatTimestamp";
import Pagination from "../components/common/Pagination";
import ExportDropdown from "../components/common/ExportDropdown";
import AddSupplyModal from "../components/Inventory/AddSupplyModal";
import StockAdjustmentModal from "../components/Inventory/StockAdjustmentModal";
import ArchiveSupplyModal from "../components/Inventory/ArchiveSupplyModal";
import TransactionHistoryModal from "../components/Inventory/TransactionHistoryModal";
import {
  computeInventoryMetrics,
  getStockStatus,
  getStockPercent,
  getBarColor,
  parseTransaction,
  logInventoryActivity,
  hasSubUnit,
  getShortUnit,
  formatSubUnitEquivalent,
} from "../components/Inventory/inventoryUtils";

// ----- Constants -----
const ITEMS_PER_PAGE = 8;

const activeExportColumns = [
  { header: "Item Name", accessor: "item_name" },
  { header: "Category", accessor: (r) => r.category || "General" },
  { header: "Unit", accessor: "unit_of_measure" },
  { header: "Max Capacity", accessor: "ideal_stock_level" },
  { header: "Total Restocked", accessor: "total_in" },
  { header: "Total Used/Wasted", accessor: "total_out" },
  { header: "Current Stock", accessor: "current_stock_level" },
  { header: "Low Stock Threshold", accessor: "low_stock_threshold" },
  {
    header: "Daily Burn Rate (14d)",
    accessor: (r) =>
      r.dailyBurnRate > 0 ? `${r.dailyBurnRate} ${r.unit_of_measure}/day` : "0",
  },
  {
    header: "Days Until Low",
    accessor: (r) =>
      r.daysUntilLow != null ? `${r.daysUntilLow}d` : "Stable",
  },
  {
    header: "Status",
    accessor: (r) =>
      getStockStatus(
        r.current_stock_level,
        r.low_stock_threshold,
        r.daysUntilLow
      ).label,
  },
];

const archivedExportColumns = [
  { header: "Item Name", accessor: "item_name" },
  { header: "Category", accessor: (r) => r.category || "General" },
  { header: "Unit", accessor: "unit_of_measure" },
  { header: "Last Stock Level", accessor: "current_stock_level" },
  { header: "Status", accessor: () => "Archived" },
];

const historyExportColumns = [
  { header: "Date & Time", accessor: (r) => formatTimestamp(r.created_at) },
  { header: "Supply Item", accessor: "item_name" },
  { header: "Category", accessor: "category" },
  { header: "Type", accessor: "transaction_type" },
  {
    header: "Movement",
    accessor: (r) =>
      r.isArchiveLog
        ? "Status Note"
        : `${r.isPositive ? "+" : "-"}${r.quantity} ${r.unit_of_measure}`,
  },
  { header: "Reason / Notes", accessor: "cleanNotes" },
  { header: "Recorded By", accessor: "recordedBy" },
];

const TX_TYPE_STYLES = {
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

// ----- StatCard -----
function StatCard({
  icon,
  label,
  value,
  badge,
  accentColor,
  badgeColor,
  loading,
  onClick,
  isActive,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left relative overflow-hidden rounded-2xl border shadow-sm bg-white p-5 flex items-center gap-4 transition-all cursor-pointer ${
        isActive
          ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
          : "border-slate-100 hover:border-slate-200 hover:shadow-md"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {value}
            </h3>
          )}
          {badge && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ----- CriticalStockCard -----
function CriticalStockCard({ item, metrics, onAdjust, onViewHistory }) {
  const pct = getStockPercent(item.current_stock_level, item.ideal_stock_level);
  const burnRate = metrics?.dailyBurnRate || 0;
  const daysUntilLow = metrics?.daysUntilLow ?? null;
  const daysUntilEmpty = metrics?.daysUntilEmpty ?? null;
  const status = getStockStatus(
    item.current_stock_level,
    item.low_stock_threshold,
    daysUntilLow
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onViewHistory}
            title="View Transaction History"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-50 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <History className="w-3 h-3" />
            History
          </button>
          <span
            className={`text-xs font-bold ${
              status.label === "Healthy"
                ? "text-emerald-600"
                : status.label === "Low Stock" || status.label === "At Risk"
                  ? "text-amber-600"
                  : "text-rose-600"
            }`}
          >
            {pct}%
          </span>
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-900 leading-tight truncate">
          {item.item_name}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Max Cap: {item.ideal_stock_level} {getShortUnit(item.unit_of_measure)}
          {hasSubUnit(item.unit_of_measure) && ` (${formatSubUnitEquivalent(item.ideal_stock_level, item.unit_of_measure)})`} &bull; Low:{" "}
          {item.low_stock_threshold}
          {hasSubUnit(item.unit_of_measure) && ` (${formatSubUnitEquivalent(item.low_stock_threshold, item.unit_of_measure)})`}
          {burnRate > 0 && ` • ~${burnRate}/day`}
        </p>
      </div>

      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {status.label === "Critical" || status.label === "Out of Stock" ? (
        <button
          onClick={onAdjust}
          className="text-[11px] font-bold text-rose-600 uppercase tracking-wide self-start hover:text-rose-700 cursor-pointer text-left"
        >
          IMMEDIATE REORDER REQUIRED
          {burnRate > 0 && daysUntilEmpty != null && ` (~${daysUntilEmpty}d left)`}
        </button>
      ) : status.label === "Low Stock" ? (
        <button
          onClick={onAdjust}
          className="text-[11px] font-bold text-amber-600 uppercase tracking-wide self-start hover:text-amber-700 cursor-pointer text-left"
        >
          {item.current_stock_level} {getShortUnit(item.unit_of_measure)}
          {hasSubUnit(item.unit_of_measure) && ` (${formatSubUnitEquivalent(item.current_stock_level, item.unit_of_measure)})`} remaining (Low
          {burnRate > 0 && daysUntilEmpty != null
            ? ` • ~${daysUntilEmpty}d to empty`
            : ""}
          )
        </button>
      ) : status.label === "At Risk" ? (
        <button
          onClick={onAdjust}
          className="text-[11px] font-bold text-amber-600 self-start hover:text-amber-700 cursor-pointer text-left flex items-center gap-1"
        >
          <Flame className="w-3 h-3 shrink-0" />
          <span>
            Hits low stock in {daysUntilLow}{" "}
            {daysUntilLow === 1 ? "day" : "days"}
          </span>
        </button>
      ) : (
        <p className="text-[11px] text-slate-500">
          {item.current_stock_level} {getShortUnit(item.unit_of_measure)}
          {hasSubUnit(item.unit_of_measure) && ` (${formatSubUnitEquivalent(item.current_stock_level, item.unit_of_measure)})`} remaining
          {burnRate > 0 && daysUntilLow != null && ` (~${daysUntilLow}d buffer)`}
        </p>
      )}
    </div>
  );
}

// ----- StatusPill -----
function StatusPill({ current, threshold, daysUntilLow }) {
  const s = getStockStatus(current, threshold, daysUntilLow);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// ====================================================================
// Main Page
// ====================================================================
export default function InventoryManagement({ loggedInUser }) {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  // viewTab: "active" | "history" | "archived"
  const [viewTab, setViewTab] = useState("active");

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [archiveData, setArchiveData] = useState(null); // { item, isArchiving: boolean }
  const [deletingId, setDeletingId] = useState(null);

  const viewArchived = viewTab === "archived";
  const viewHistory = viewTab === "history";

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, txRes] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("*")
          .order("last_updated_at", { ascending: false }),
        supabase
          .from("inventory_transactions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (itemsRes.error) {
        console.error("Error loading inventory items:", itemsRes.error);
        throw itemsRes.error;
      }

      if (txRes.error) {
        console.warn("Warning loading inventory transactions:", txRes.error);
      }

      setItems(itemsRes.data || []);
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
      toast.error(
        "Failed to load inventory data",
        err.message || "Please check database connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Compute per-item metrics & 14-day burn-rate forecasts
  const itemMetrics = useMemo(
    () => computeInventoryMetrics(items, transactions),
    [items, transactions]
  );

  // Map item_id -> item for fast lookup in global transaction history
  const itemMap = useMemo(() => {
    const m = {};
    items.forEach((it) => {
      m[it.item_id] = it;
    });
    return m;
  }, [items]);

  // Enriched transaction list for the Global Transaction History tab
  const enrichedTransactions = useMemo(() => {
    return transactions.map((rawTx) => {
      const parsed = parseTransaction(rawTx);
      const parent = itemMap[rawTx.item_id];
      return {
        ...parsed,
        item: parent || null,
        item_name: parent?.item_name || "Deleted Supply",
        category: parent?.category || "General",
        unit_of_measure: parent?.unit_of_measure || "units",
      };
    });
  }, [transactions, itemMap]);

  // Split Active and Archived
  const activeItems = useMemo(
    () => items.filter((i) => !i.is_archived),
    [items]
  );
  const archivedItems = useMemo(
    () => items.filter((i) => !!i.is_archived),
    [items]
  );

  // Derived stats for active inventory (including burn-rate "At Risk" items)
  const lowOrAtRiskItems = useMemo(
    () =>
      activeItems.filter((i) => {
        const m = itemMetrics[i.item_id];
        return (
          i.current_stock_level <= i.low_stock_threshold ||
          (m?.daysUntilLow != null && m.daysUntilLow <= 7)
        );
      }),
    [activeItems, itemMetrics]
  );
  const criticalItems = useMemo(
    () =>
      activeItems.filter(
        (i) => i.current_stock_level <= i.low_stock_threshold * 0.25
      ),
    [activeItems]
  );
  const healthyItems = useMemo(
    () =>
      activeItems.filter((i) => {
        const m = itemMetrics[i.item_id];
        return (
          i.current_stock_level > i.low_stock_threshold &&
          (m?.daysUntilLow == null || m.daysUntilLow > 7)
        );
      }),
    [activeItems, itemMetrics]
  );

  const criticalDisplay = useMemo(
    () =>
      [...activeItems]
        .sort((a, b) => {
          const mA = itemMetrics[a.item_id];
          const mB = itemMetrics[b.item_id];
          const stA = getStockStatus(
            a.current_stock_level,
            a.low_stock_threshold,
            mA?.daysUntilLow
          );
          const stB = getStockStatus(
            b.current_stock_level,
            b.low_stock_threshold,
            mB?.daysUntilLow
          );
          const priority = {
            out_of_stock: 0,
            critical: 1,
            low_stock: 2,
            at_risk: 3,
            healthy: 4,
          };
          if (priority[stA.key] !== priority[stB.key]) {
            return priority[stA.key] - priority[stB.key];
          }
          return (
            getStockPercent(a.current_stock_level, a.ideal_stock_level) -
            getStockPercent(b.current_stock_level, b.ideal_stock_level)
          );
        })
        .slice(0, 4),
    [activeItems, itemMetrics]
  );

  // Filtered rows depending on active tab
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    const matchesCategoryFilter = (cat) => {
      if (categoryFilter === "all") return true;
      const c = (cat || "Feed").toLowerCase();
      const f = categoryFilter.toLowerCase();
      if (f === "medical") return c === "medical" || c === "medication" || c === "vaccines";
      if (f === "medication") return c === "medication" || (c === "medical" && !cat?.toLowerCase().includes("vaccine"));
      if (f === "vaccines") return c === "vaccines" || (c === "medical" && cat?.toLowerCase().includes("vaccine"));
      return c === f;
    };

    if (viewHistory) {
      return enrichedTransactions.filter((tx) => {
        const matchesQ =
          q === "" ||
          tx.item_name?.toLowerCase().includes(q) ||
          tx.category?.toLowerCase().includes(q) ||
          tx.cleanNotes?.toLowerCase().includes(q) ||
          tx.recordedBy?.toLowerCase().includes(q);
        const matchesCat = matchesCategoryFilter(tx.category);
        const matchesType =
          txTypeFilter === "all" ||
          tx.transaction_type?.toLowerCase() === txTypeFilter.toLowerCase();
        return matchesQ && matchesCat && matchesType;
      });
    }

    const currentDataset = viewArchived ? archivedItems : activeItems;
    return currentDataset.filter((item) => {
      const matchesQ =
        q === "" ||
        item.item_name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);

      const matchesCat = matchesCategoryFilter(item.category);

      if (viewArchived) {
        return matchesQ && matchesCat;
      }

      const m = itemMetrics[item.item_id];
      const st = getStockStatus(
        item.current_stock_level,
        item.low_stock_threshold,
        m?.daysUntilLow
      );
      let matchesSt = true;
      if (statusFilter === "needs_attention") {
        matchesSt = ["low_stock", "critical", "out_of_stock", "at_risk"].includes(
          st.key
        );
      } else if (statusFilter === "critical_group") {
        matchesSt = ["critical", "out_of_stock"].includes(st.key);
      } else if (statusFilter !== "all") {
        matchesSt = st.key === statusFilter;
      }
      return matchesQ && matchesCat && matchesSt;
    });
  }, [
    viewHistory,
    viewArchived,
    enrichedTransactions,
    archivedItems,
    activeItems,
    itemMetrics,
    query,
    categoryFilter,
    statusFilter,
    txTypeFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, safePage]);

  // Export data
  const exportData = useMemo(() => {
    if (viewHistory) return filtered;
    return filtered.map((item) => {
      const m = itemMetrics[item.item_id] || {};
      return {
        ...item,
        total_in: m.total_in ?? 0,
        total_out: m.total_out ?? 0,
        dailyBurnRate: m.dailyBurnRate ?? 0,
        daysUntilLow: m.daysUntilLow ?? null,
      };
    });
  }, [filtered, itemMetrics, viewHistory]);

  // Permanent Delete for Archived items
  const handlePermanentDelete = async (item) => {
    if (
      !window.confirm(
        `Permanently remove "${item.item_name}" and all historical transactions? This action CANNOT be undone.`
      )
    )
      return;
    setDeletingId(item.item_id);
    try {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("item_id", item.item_id);
      if (error) throw error;

      logInventoryActivity({
        loggedInUser,
        event_title: "Inventory Supply Deleted",
        event_desc: `Permanently deleted archived supply "${item.item_name}".`,
        user_bg_color: "bg-rose-100 text-rose-700",
      });

      toast.success(
        "Item deleted",
        `"${item.item_name}" was permanently removed.`
      );
      fetchAll();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed", err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (keepOpen) => {
    fetchAll();
    if (!keepOpen) {
      setAddModal(false);
      setEditItem(null);
    }
  };

  const handleAdjusted = (keepOpen) => {
    fetchAll();
    if (!keepOpen) {
      setAdjustItem(null);
    }
  };

  const handleArchiveSuccess = () => {
    setArchiveData(null);
    fetchAll();
  };

  const switchTab = (nextTab) => {
    setViewTab(nextTab);
    setPage(1);
  };

  // Keep historyItem synced with updated state when modal is open
  const activeHistoryItem = useMemo(() => {
    if (!historyItem) return null;
    return itemMap[historyItem.item_id] || historyItem;
  }, [historyItem, itemMap]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
        {/* Stat Cards (Calculated from Active Items — Clickable to filter) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Package className="w-6 h-6 text-emerald-600" />}
            label="Total Active Supplies"
            value={String(activeItems.length)}
            badge="Show all"
            badgeColor="bg-emerald-100 text-emerald-700"
            accentColor="bg-emerald-50"
            loading={loading}
            isActive={viewTab === "active" && statusFilter === "all"}
            onClick={() => {
              setViewTab("active");
              setStatusFilter("all");
              setPage(1);
            }}
          />
          <StatCard
            icon={<AlertTriangle className="w-6 h-6 text-rose-500" />}
            label="Low / At-Risk Stock"
            value={String(lowOrAtRiskItems.length)}
            badge={lowOrAtRiskItems.length > 0 ? "Action required" : "All good"}
            badgeColor={
              lowOrAtRiskItems.length > 0
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }
            accentColor="bg-rose-50"
            loading={loading}
            isActive={viewTab === "active" && statusFilter === "needs_attention"}
            onClick={() => {
              setViewTab("active");
              setStatusFilter(
                statusFilter === "needs_attention" ? "all" : "needs_attention"
              );
              setPage(1);
            }}
          />
          <StatCard
            icon={<TrendingDown className="w-6 h-6 text-amber-600" />}
            label="Critical Reorder"
            value={String(criticalItems.length)}
            badge={criticalItems.length > 0 ? "Needs reorder" : "Healthy"}
            badgeColor={
              criticalItems.length > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }
            accentColor="bg-amber-50"
            loading={loading}
            isActive={viewTab === "active" && statusFilter === "critical_group"}
            onClick={() => {
              setViewTab("active");
              setStatusFilter(
                statusFilter === "critical_group" ? "all" : "critical_group"
              );
              setPage(1);
            }}
          />
          <StatCard
            icon={<CheckCircle2 className="w-6 h-6 text-sky-600" />}
            label="Healthy Stock Items"
            value={String(healthyItems.length)}
            badge="Above threshold"
            badgeColor="bg-sky-100 text-sky-700"
            accentColor="bg-sky-50"
            loading={loading}
            isActive={viewTab === "active" && statusFilter === "healthy"}
            onClick={() => {
              setViewTab("active");
              setStatusFilter(statusFilter === "healthy" ? "all" : "healthy");
              setPage(1);
            }}
          />
        </div>

        {/* Critical Stock Levels Section (Active / History View) */}
        {!viewArchived ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Critical Stock & Burn-Rate Watch</span>
                {(criticalItems.length > 0 || lowOrAtRiskItems.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </h2>
              <button
                onClick={() => {
                  setEditItem(null);
                  setAddModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                id="inventory-add-supply-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Supply
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="skeleton h-9 w-9 rounded-lg" />
                    <div className="skeleton h-4 w-3/4 rounded-md" />
                    <div className="skeleton h-2 w-full rounded-full" />
                    <div className="skeleton h-3 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            ) : criticalDisplay.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
                No active inventory items yet. Add your first supply above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {criticalDisplay.map((item) => (
                  <CriticalStockCard
                    key={item.item_id}
                    item={item}
                    metrics={itemMetrics[item.item_id]}
                    onAdjust={() => setAdjustItem(item)}
                    onViewHistory={() => setHistoryItem(item)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Viewing Archived Inventory Supplies
                </h3>
                <p className="text-xs text-slate-500">
                  These items are hidden from active feeding regimens, health
                  treatments, and stock alerts. You can restore them to active
                  status at any time.
                </p>
              </div>
            </div>
            <button
              onClick={() => switchTab("active")}
              className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Switch to Active Supplies
            </button>
          </div>
        )}

        {/* Detailed Supply Ledger & Transaction History */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-bold text-slate-800">
                  {viewHistory ? "Stock Movement Audit Log" : "Supply Ledger"}
                </h2>

                {/* Active / Transaction History / Archived Tabs */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                  <button
                    onClick={() => switchTab("active")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      viewTab === "active"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="inventory-tab-active"
                  >
                    Active ({activeItems.length})
                  </button>
                  <button
                    onClick={() => switchTab("history")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewTab === "history"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="inventory-tab-history"
                  >
                    <History className="w-3.5 h-3.5" />
                    Transaction History ({transactions.length})
                  </button>
                  <button
                    onClick={() => switchTab("archived")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      viewTab === "archived"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    id="inventory-tab-archived"
                  >
                    Archived ({archivedItems.length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shadow-sm ${
                    filtersOpen
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {(statusFilter !== "all" ||
                    categoryFilter !== "all" ||
                    txTypeFilter !== "all") && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  )}
                </button>
                <ExportDropdown
                  data={exportData}
                  columns={
                    viewHistory
                      ? historyExportColumns
                      : viewArchived
                        ? archivedExportColumns
                        : activeExportColumns
                  }
                  filename={
                    viewHistory
                      ? "inventory_transaction_history"
                      : viewArchived
                        ? "inventory_archived_ledger"
                        : "inventory_active_ledger"
                  }
                  pdfTitle={
                    viewHistory
                      ? "Inventory Transaction Audit Log"
                      : viewArchived
                        ? "Archived Supply Ledger"
                        : "Active Supply Ledger"
                  }
                />
              </div>
            </div>

            {/* Search & Quick Category Pills Bar */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={
                    viewHistory
                      ? "Search transactions by item name, category, reason/notes, or staff..."
                      : "Search items by name, category, or notes..."
                  }
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
              </div>

              {/* 1-Click Category Quick-Pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: "all", label: "All Categories" },
                    { id: "feed", label: "Feed" },
                    { id: "medication", label: "Medication" },
                    { id: "vaccines", label: "Vaccines" },
                    { id: "supplements", label: "Supplements" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(cat.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        categoryFilter === cat.id
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {(statusFilter !== "all" ||
                  categoryFilter !== "all" ||
                  txTypeFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("all");
                      setCategoryFilter("all");
                      setTxTypeFilter("all");
                      setPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {filtersOpen && (
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {/* Stock Status Filter (Active only) */}
                  {viewTab === "active" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Stock Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setPage(1);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none cursor-pointer"
                      >
                        <option value="all">All Status</option>
                        <option value="needs_attention">All Low & At-Risk</option>
                        <option value="critical_group">All Critical & Out of Stock</option>
                        <option value="healthy">Healthy</option>
                        <option value="at_risk">At Risk (Burn Warning)</option>
                        <option value="low_stock">Low Stock</option>
                        <option value="critical">Critical</option>
                        <option value="out_of_stock">Out of Stock</option>
                      </select>
                    </div>
                  )}

                  {/* Transaction Type Filter (History only) */}
                  {viewHistory && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Transaction Type
                      </label>
                      <select
                        value={txTypeFilter}
                        onChange={(e) => {
                          setTxTypeFilter(e.target.value);
                          setPage(1);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none cursor-pointer"
                      >
                        <option value="all">All Types</option>
                        <option value="restock">Restock (+)</option>
                        <option value="usage">Usage (-)</option>
                        <option value="wastage">Wastage (-)</option>
                        <option value="correction">Correction (+/-)</option>
                      </select>
                    </div>
                  )}

                  {(statusFilter !== "all" ||
                    categoryFilter !== "all" ||
                    txTypeFilter !== "all") && (
                    <button
                      onClick={() => {
                        setStatusFilter("all");
                        setCategoryFilter("all");
                        setTxTypeFilter("all");
                        setPage(1);
                      }}
                      className="self-end px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {viewHistory ? (
              /* ── Global Transaction History Table ── */
              <table className="w-full text-left">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Supply Item
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                      Type
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                      Movement
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Reason / Notes
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                      Recorded By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div
                              className="skeleton h-4 rounded-md"
                              style={{ width: j === 4 ? "80%" : "60%" }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        No stock movements match your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((tx) => {
                      const meta =
                        TX_TYPE_STYLES[tx.transaction_type] ||
                        TX_TYPE_STYLES.USAGE;
                      const Icon = meta.icon;
                      return (
                        <tr
                          key={tx.transaction_id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatTimestamp(tx.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {tx.item ? (
                              <button
                                type="button"
                                onClick={() => setHistoryItem(tx.item)}
                                className="text-left group/item cursor-pointer"
                              >
                                <p className="text-xs font-bold text-slate-900 group-hover/item:text-emerald-600 transition-colors">
                                  {tx.item_name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {tx.category}
                                </p>
                              </button>
                            ) : (
                              <div>
                                <p className="text-xs font-semibold text-slate-500">
                                  {tx.item_name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {tx.category}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${meta.cls}`}
                            >
                              <Icon className="w-3 h-3" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {tx.isArchiveLog ? (
                              <span className="text-xs font-semibold text-slate-400">
                                Status Note
                              </span>
                            ) : (
                              <span
                                className={`text-sm font-extrabold ${
                                  tx.isPositive
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {tx.isPositive ? "+" : "-"}
                                {tx.quantity}{" "}
                                <span className="text-xs font-semibold">
                                  {getShortUnit(tx.unit_of_measure)}
                                </span>
                              </span>
                            )}
                            {!tx.isArchiveLog && hasSubUnit(tx.unit_of_measure) && (
                              <span className="text-[10px] text-slate-400 block font-medium">
                                {tx.isPositive ? "+" : "-"}
                                {formatSubUnitEquivalent(tx.quantity, tx.unit_of_measure)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 max-w-xs">
                            <p className="text-xs text-slate-700 truncate" title={tx.cleanNotes}>
                              {tx.cleanNotes}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              <User className="w-3 h-3 text-slate-400" />
                              {tx.recordedBy}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* ── Active / Archived Supply Ledger Table ── */
              <table className="w-full text-left">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Item Details
                    </th>
                    {!viewArchived ? (
                      <>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Max Capacity
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Restocked
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Used / Wasted
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Current Stock
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Status
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Category
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Last Stock Level
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                          Archived Status
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(viewArchived ? 5 : 7)].map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div
                              className="skeleton h-4 rounded-md"
                              style={{ width: j === 0 ? "80%" : "55%" }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={viewArchived ? 5 : 7}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        {query ||
                        statusFilter !== "all" ||
                        categoryFilter !== "all"
                          ? "No items match your search or filter criteria."
                          : viewArchived
                            ? "No archived supplies found."
                            : "No inventory items found. Add your first supply to get started."}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((item) => {
                      const m = itemMetrics[item.item_id] || {
                        total_in: 0,
                        total_out: 0,
                        dailyBurnRate: 0,
                        daysUntilLow: null,
                        daysUntilEmpty: null,
                      };
                      const pct = getStockPercent(
                        item.current_stock_level,
                        item.ideal_stock_level
                      );
                      return (
                        <tr
                          key={item.item_id}
                          className="hover:bg-slate-50/70 transition-colors group"
                        >
                          {/* Item Details */}
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setHistoryItem(item)}
                              className="flex items-center gap-3 text-left cursor-pointer group/title"
                              title="Click to view movement history"
                            >
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 group-hover/title:text-emerald-600 transition-colors truncate">
                                  {item.item_name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {item.category || "General"} &bull;{" "}
                                  {item.unit_of_measure}
                                  {m.dailyBurnRate > 0 &&
                                    (hasSubUnit(item.unit_of_measure)
                                      ? ` • Burn: ${m.dailyBurnRate} ${getShortUnit(item.unit_of_measure)}/d (${formatSubUnitEquivalent(m.dailyBurnRate, item.unit_of_measure)}/d)`
                                      : ` • Burn: ${m.dailyBurnRate} ${item.unit_of_measure}/d`)}
                                </p>
                              </div>
                            </button>
                          </td>

                          {!viewArchived ? (
                            <>
                              {/* Ideal Level */}
                              <td className="px-4 py-4 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-sm font-medium text-slate-600">
                                    {item.ideal_stock_level}{" "}
                                    {getShortUnit(item.unit_of_measure)}
                                  </span>
                                  {hasSubUnit(item.unit_of_measure) && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      ({formatSubUnitEquivalent(item.ideal_stock_level, item.unit_of_measure)})
                                    </span>
                                  )}
                                  <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                    <div
                                      className={`h-full rounded-full ${getBarColor(pct)}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* Restocked */}
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-semibold text-emerald-600">
                                  +{m.total_in}
                                </span>
                                {hasSubUnit(item.unit_of_measure) && m.total_in > 0 && (
                                  <span className="text-[10px] text-emerald-500 font-medium block">
                                    +{formatSubUnitEquivalent(m.total_in, item.unit_of_measure)}
                                  </span>
                                )}
                              </td>
                              {/* Used/Wasted */}
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-semibold text-rose-500">
                                  -{m.total_out}
                                </span>
                                {hasSubUnit(item.unit_of_measure) && m.total_out > 0 && (
                                  <span className="text-[10px] text-rose-400 font-medium block">
                                    -{formatSubUnitEquivalent(m.total_out, item.unit_of_measure)}
                                  </span>
                                )}
                              </td>
                              {/* Current Stock + Burn Forecast */}
                              <td className="px-4 py-4 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-bold text-slate-900">
                                    {item.current_stock_level}{" "}
                                    {getShortUnit(item.unit_of_measure)}
                                  </span>
                                  {hasSubUnit(item.unit_of_measure) && (
                                    <span className="text-[10px] font-semibold text-emerald-700">
                                      ({formatSubUnitEquivalent(item.current_stock_level, item.unit_of_measure)})
                                    </span>
                                  )}
                                  {m.dailyBurnRate > 0 && (
                                    <span
                                      className={`text-[10px] font-semibold mt-0.5 ${
                                        m.daysUntilLow != null &&
                                        m.daysUntilLow <= 7
                                          ? "text-amber-600"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {m.daysUntilLow === 0
                                        ? m.daysUntilEmpty != null
                                          ? `~${m.daysUntilEmpty}d to empty`
                                          : "Below threshold"
                                        : `~${m.daysUntilLow}d to low`}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* Status */}
                              <td className="px-4 py-4 text-center">
                                <StatusPill
                                  current={item.current_stock_level}
                                  threshold={item.low_stock_threshold}
                                  daysUntilLow={m.daysUntilLow}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Category */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                                  {item.category || "General"}
                                </span>
                              </td>
                              {/* Last Stock */}
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-semibold text-slate-700">
                                  {item.current_stock_level}{" "}
                                  {getShortUnit(item.unit_of_measure)}
                                </span>
                                {hasSubUnit(item.unit_of_measure) && (
                                  <span className="text-[10px] text-slate-400 block font-medium">
                                    ({formatSubUnitEquivalent(item.current_stock_level, item.unit_of_measure)})
                                  </span>
                                )}
                              </td>
                              {/* Archived Badge */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                                  <Archive className="w-3 h-3 text-slate-500" />
                                  Archived
                                </span>
                              </td>
                            </>
                          )}

                          {/* Actions (Always visible for fast desktop & tablet access) */}
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {!viewArchived ? (
                                <>
                                  <button
                                    onClick={() => setAdjustItem(item)}
                                    title="Adjust Stock In / Out"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 transition-colors cursor-pointer"
                                  >
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    Adjust
                                  </button>
                                  <button
                                    onClick={() => setHistoryItem(item)}
                                    title="View Transaction History"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    History
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditItem(item);
                                      setAddModal(true);
                                    }}
                                    title="Edit Item"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setArchiveData({ item, isArchiving: true })
                                    }
                                    title="Archive Item"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setHistoryItem(item)}
                                    title="View Transaction History"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    History
                                  </button>
                                  <button
                                    onClick={() =>
                                      setArchiveData({
                                        item,
                                        isArchiving: false,
                                      })
                                    }
                                    title="Restore Item"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => handlePermanentDelete(item)}
                                    title="Delete Permanently"
                                    disabled={deletingId === item.item_id}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemName={viewHistory ? "transactions" : "inventory items"}
            disabled={loading}
          />
        </section>
      </div>

      {/* Add / Edit Supply Modal */}
      {addModal && (
        <AddSupplyModal
          item={editItem}
          onClose={() => {
            setAddModal(false);
            setEditItem(null);
          }}
          onSaved={handleSaved}
          loggedInUser={loggedInUser}
        />
      )}

      {/* Stock Adjustment Modal */}
      {adjustItem && (
        <StockAdjustmentModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onSaved={handleAdjusted}
          loggedInUser={loggedInUser}
        />
      )}

      {/* Per-Item Transaction History Modal */}
      {activeHistoryItem && (
        <TransactionHistoryModal
          item={activeHistoryItem}
          metrics={itemMetrics[activeHistoryItem.item_id]}
          onClose={() => setHistoryItem(null)}
          onAdjustStock={(target) => setAdjustItem(target)}
        />
      )}

      {/* Archive / Restore Modal */}
      {archiveData && (
        <ArchiveSupplyModal
          isOpen={!!archiveData}
          archiveData={archiveData}
          onClose={() => setArchiveData(null)}
          onConfirmSuccess={handleArchiveSuccess}
          loggedInUser={loggedInUser}
        />
      )}
    </div>
  );
}
