import React, { useState, useMemo, useCallback, useRef } from "react";
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
  Wheat,
  Pill,
  Syringe,
  ChevronDown,
  ChevronUp,
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
  BURN_WINDOW_DAYS,
  getStockStatus,
  getStockPercent,
  getBarColor,
  parseTransaction,
  logInventoryActivity,
  hasSubUnit,
  getShortUnit,
  formatSubUnitEquivalent,
  getContainerMeta,
  toSubUnitQty,
} from "../components/Inventory/inventoryUtils";

// ----- Constants -----
const ITEMS_PER_PAGE = 8;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

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
    header: "Daily Burn Rate / Demand",
    accessor: (r) => {
      if (r.burnRateSource === "par_level") return "Par-Level (No Burn)";
      if (r.upcomingDemandSubUnit > 0 && r.dailyBurnRate <= 0) {
        return `Upcoming: ${r.upcomingDemandSubUnit} ${r.upcomingDemandSubUnitLabel} (14d)`;
      }
      if (r.dailyBurnRate > 0) {
        const sourceLabel = r.burnRateSource === "prescribed" ? " (prescribed)" : "";
        return `${r.dailyBurnRate} ${r.unit_of_measure}/day${sourceLabel}`;
      }
      return "0";
    },
  },
  {
    header: "Days Until Low",
    accessor: (r) => {
      if (r.burnRateSource === "par_level") return "Par-Level";
      if (r.hasUpcomingShortfall) return `Short ${r.shortfallSubUnit} in ${r.earliestDueDays}d`;
      if (r.upcomingDemandSubUnit > 0 && r.dailyBurnRate <= 0) return `Covered (${r.earliestDueDays}d)`;
      return r.daysUntilLow != null ? `${r.daysUntilLow}d` : "Stable";
    },
  },
  {
    header: "Status",
    accessor: (r) =>
      getStockStatus(
        r.current_stock_level,
        r.low_stock_threshold,
        r.daysUntilLow,
        r
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

export function getCategoryIconConfig(category) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("feed")) {
    return {
      Icon: Wheat,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    };
  }
  if (cat.includes("vaccin")) {
    return {
      Icon: Syringe,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    };
  }
  if (
    cat.includes("medic") ||
    cat.includes("health")
  ) {
    return {
      Icon: Pill,
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-100",
    };
  }
  if (cat.includes("suppl")) {
    return {
      Icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
    };
  }
  return {
    Icon: Package,
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-100",
  };
}

// ----- CriticalStockCard Helpers -----
function toTitleCase(name) {
  if (!name || typeof name !== "string") return "";
  if (/[A-Z]/.test(name)) return name;
  return name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function formatStatQty(n, unit, appendUnit = true) {
  const num = Number(n) || 0;
  const u = String(unit || "").trim().toLowerCase();
  const isContinuous = ["kg", "g", "mg", "ml", "l", "liters", "litres"].includes(u);
  const formatted = isContinuous
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(num)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(num));
  return unit && appendUnit ? `${formatted} ${unit}` : formatted;
}

function getRunwayInsight(item, metrics, current, statusKey) {
  const cat = (item?.category || "").toLowerCase();
  const isMedication =
    metrics?.burnRateSource === "par_level" ||
    metrics?.supplyCategory === "medication" ||
    cat.includes("medic");

  if (isMedication) {
    if (current <= 0) return "Out of stock";
    if (statusKey === "critical") return "Immediate restock needed";
    if (statusKey === "low") return "Below par-level threshold";
    return "Par-level buffer maintained";
  }

  const isVaccine =
    metrics?.burnRateSource === "vaccine_milestone" ||
    metrics?.supplyCategory === "vaccine" ||
    cat.includes("vaccin");

  const hasUpcoming = (metrics?.upcomingDemandSubUnit || 0) > 0;
  const burnRate = Number(metrics?.dailyBurnRate) || 0;

  // Vaccine or milestone items with upcoming schedule
  if (hasUpcoming && burnRate <= 0) {
    const days = metrics.earliestDueDays ?? 0;
    const dayText = days === 0 ? "today" : `in ${days}d`;
    if (metrics?.hasUpcomingShortfall) {
      return `${metrics.shortfallSubUnit} ${metrics.upcomingDemandSubUnitLabel || "units"} short ${dayText}`;
    }
    return `Scheduled: ${metrics.upcomingDemandSubUnit} ${metrics.upcomingDemandSubUnitLabel || "units"} ${dayText}`;
  }

  if (isVaccine && !hasUpcoming && burnRate <= 0) {
    if (current <= 0) return "Out of stock";
    if (statusKey === "critical") return "Critical · Restock required";
    if (statusKey === "low") return "Low stock · Reorder soon";
    return "No scheduled doses (14d)";
  }

  // Items with daily burn rate (Feeds, Supplements, etc.)
  let daysOfSupply = null;
  if (burnRate > 0) {
    daysOfSupply = Math.floor(current / burnRate);
  } else if (metrics?.total_out > 0) {
    const fallbackBurn = metrics.total_out / 30;
    if (fallbackBurn > 0) {
      daysOfSupply = Math.floor(current / fallbackBurn);
    }
  }

  if (daysOfSupply !== null && !isNaN(daysOfSupply) && isFinite(daysOfSupply) && daysOfSupply >= 0) {
    if (current <= 0) return "Out of stock";
    if (daysOfSupply > 365) {
      return statusKey === "healthy" ? ">1 year supply remaining" : ">1 year supply left";
    }
    if (statusKey === "healthy") {
      return `~${daysOfSupply} days of supply remaining`;
    }
    return `~${daysOfSupply} days of supply left`;
  }

  // Fallback for items with no consumption history recorded yet
  if (current <= 0) return "Out of stock";
  if (statusKey === "critical") return "Immediate restock needed";
  if (statusKey === "low") return "Reorder threshold reached";
  return "Adequate supply buffer";
}

// ----- CriticalStockCard -----
function CriticalStockCard({ item, metrics, onAdjust, onViewHistory }) {
  if (!item) return null;
  const current = Number(item.current_stock_level) || 0;
  const capacity = Number(item.ideal_stock_level) || 1;
  const level = capacity > 0 ? current / capacity : 0;
  const pct = Math.round(Math.min(Math.max(level * 100, 0), 100));

  const rawUnit = item.unit_of_measure || "";
  const unitLabel = getShortUnit(rawUnit);

  // Unified Threshold System
  const thresholdRatio = item.low_stock_threshold && capacity > 0
    ? item.low_stock_threshold / capacity
    : 0.25;
  const criticalRatio = 0.10; // Exactly 10% of max capacity

  // Single source of truth evaluation (3 tiers: Critical, Low Stock, Healthy)
  let statusKey = "healthy";
  if (
    current <= 0 ||
    level <= criticalRatio ||
    pct <= 10 ||
    (metrics?.hasUpcomingShortfall && current <= (metrics?.upcomingDemandUnits || 0) * 0.10)
  ) {
    statusKey = "critical";
  } else if (
    current <= item.low_stock_threshold ||
    level <= thresholdRatio ||
    metrics?.hasUpcomingShortfall ||
    metrics?.willFallBelowThreshold
  ) {
    statusKey = "low";
  }

  const CONFIG = {
    critical: {
      label: current <= 0 ? "Out of Stock" : (metrics?.hasUpcomingShortfall ? "Shortfall" : "Critical"),
      barClass: "bg-rose-500",
      badgeClass: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 border border-rose-200",
      dotClass: "bg-rose-500 animate-pulse",
      buttonClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-2xs",
      buttonLabel: "Restock",
    },
    low: {
      label: metrics?.hasUpcomingShortfall ? "Shortfall" : "Low Stock",
      barClass: "bg-amber-500",
      badgeClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 border border-amber-200",
      dotClass: "bg-amber-500",
      buttonClass: "bg-amber-500 hover:bg-amber-600 text-white shadow-2xs",
      buttonLabel: "Restock",
    },
    healthy: {
      label: "Healthy",
      barClass: "bg-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 border border-emerald-200",
      dotClass: "bg-emerald-500",
      buttonClass: "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300",
      buttonLabel: "Adjust",
    },
  };

  const cfg = CONFIG[statusKey];
  const displayName = toTitleCase(item.item_name || "Unnamed Item");
  const catCfg = getCategoryIconConfig(item.category);
  const CategoryIcon = catCfg.Icon;

  const containerMeta = getContainerMeta(rawUnit);
  let subUnitQtyText = null;
  if (containerMeta) {
    const subQty = toSubUnitQty(current, containerMeta.size);
    subUnitQtyText = formatStatQty(subQty, containerMeta.subUnit, true);
  }

  const runwayInsight = getRunwayInsight(item, metrics, current, statusKey);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-between gap-3 hover:shadow-md hover:border-slate-300 transition-all">
      <div className="space-y-3">
        {/* Top Header Row: Category Icon + Item Name on Left, Status Badge on Right */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${catCfg.bg} border ${catCfg.border}`}>
              <CategoryIcon className={`w-4 h-4 ${catCfg.color}`} />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
                {item.category || "General"}
              </span>
              <h4 className="text-sm font-bold text-slate-900 leading-tight truncate" title={displayName}>
                {displayName}
              </h4>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
            {cfg.label}
          </span>
        </div>

        {/* Stock Figures & Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <div className="min-w-0 truncate">
              <span className="text-sm font-extrabold text-slate-900">
                {formatStatQty(current, unitLabel, false)}
              </span>
              <span className="text-slate-500 font-medium ml-1">
                of {formatStatQty(capacity, unitLabel, false)} {unitLabel}
              </span>
              {subUnitQtyText && (
                <span className="text-slate-400 font-normal ml-1.5 text-[11px]" title={subUnitQtyText}>
                  ({subUnitQtyText})
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-500 shrink-0">
              {pct}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${displayName}: ${pct}% in stock`}
            className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${cfg.barClass}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Row: Supply Runway Insight on Left, Action Buttons on Right */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/80">
        <p
          className={`text-xs font-medium truncate min-w-0 flex-1 ${statusKey === "critical"
              ? "text-rose-600 font-semibold"
              : statusKey === "low"
                ? "text-amber-700 font-semibold"
                : "text-slate-500"
            }`}
          title={runwayInsight}
        >
          {runwayInsight}
        </p>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onViewHistory}
            aria-label={`View stock history for ${displayName}`}
            title="View Stock History"
            className="p-1.5 rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onAdjust}
            className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${cfg.buttonClass}`}
          >
            {cfg.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ----- StatusPill -----
function StatusPill({ current, threshold, daysUntilLow, extra }) {
  const s = getStockStatus(current, threshold, daysUntilLow, extra);
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  // viewTab: "active" | "history" | "archived"
  const [viewTab, setViewTab] = useState("active");

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [prefillSupply, setPrefillSupply] = useState(null);
  const [unlinkedGuidelines, setUnlinkedGuidelines] = useState([]);
  const [growthData, setGrowthData] = useState(null);
  const [unregisteredOpen, setUnregisteredOpen] = useState(false);
  const [unregisteredPage, setUnregisteredPage] = useState(1);
  const [adjustItem, setAdjustItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [archiveData, setArchiveData] = useState(null); // { item, isArchiving: boolean }
  const [deletingId, setDeletingId] = useState(null);

  const viewArchived = viewTab === "archived";
  const viewHistory = viewTab === "history";

  // Sliding tab indicator animation refs & state
  const [tabPillStyle, setTabPillStyle] = useState({ left: 2, width: 0, opacity: 0 });
  const activeTabRef = useRef(null);
  const historyTabRef = useRef(null);
  const archivedTabRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, txRes, unlinkedData, activeBatchesRes] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("*")
          .order("last_updated_at", { ascending: false }),
        supabase
          .from("inventory_transactions")
          .select("*")
          .order("created_at", { ascending: false }),
        fetch(`${API_BASE}/api/growth/unlinked-guidelines`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${API_BASE}/api/growth/active-feed-batches`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
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
      if (activeBatchesRes) {
        setGrowthData(activeBatchesRes);
      }
      if (Array.isArray(unlinkedData)) {
        const seen = new Set();
        const unique = [];
        for (const g of unlinkedData) {
          // Vaccines are on-demand ("one and done") and not stocked in inventory
          if ((g.activity_type || "").toUpperCase() === "VACCINATION") continue;
          const name = (g.task_name || "").trim();
          if (!name) continue;
          const key = `${name.toLowerCase()}::${(g.activity_type || "").toUpperCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(g);
          }
        }
        setUnlinkedGuidelines(unique);
      }
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

  // Compute per-item adaptive metrics (14-day window + growth program demand)
  const itemMetrics = useMemo(
    () =>
      computeInventoryMetrics(
        items,
        transactions,
        BURN_WINDOW_DAYS,
        growthData?.batches,
        growthData?.breeder_summary
      ),
    [items, transactions, growthData]
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

  // Tab indicator sliding animation effect
  const updateTabPill = useCallback(() => {
    const refMap = {
      active: activeTabRef.current,
      history: historyTabRef.current,
      archived: archivedTabRef.current,
    };
    const target = refMap[viewTab];
    if (target) {
      setTabPillStyle({
        left: target.offsetLeft,
        width: target.offsetWidth,
        opacity: 1,
      });
    }
  }, [viewTab]);

  React.useEffect(() => {
    updateTabPill();
    window.addEventListener("resize", updateTabPill);
    return () => window.removeEventListener("resize", updateTabPill);
  }, [updateTabPill, activeItems.length, transactions.length, archivedItems.length]);

  // Unregistered Growth Supplies pagination (4 items per page)
  const UNREG_PER_PAGE = 4;
  const totalUnregPages = Math.max(1, Math.ceil(unlinkedGuidelines.length / UNREG_PER_PAGE));
  const safeUnregPage = Math.min(Math.max(1, unregisteredPage), totalUnregPages);
  const paginatedUnregistered = useMemo(() => {
    const start = (safeUnregPage - 1) * UNREG_PER_PAGE;
    return unlinkedGuidelines.slice(start, start + UNREG_PER_PAGE);
  }, [unlinkedGuidelines, safeUnregPage]);

  // Derived stats for active inventory
  const lowOrAtRiskItems = useMemo(
    () =>
      activeItems.filter((i) => {
        const m = itemMetrics[i.item_id];
        return (
          i.current_stock_level <= i.low_stock_threshold ||
          m?.hasUpcomingShortfall ||
          m?.willFallBelowThreshold
        );
      }),
    [activeItems, itemMetrics]
  );
  const criticalItems = useMemo(
    () =>
      activeItems.filter((i) => {
        const m = itemMetrics[i.item_id];
        const cur = Number(i.current_stock_level) || 0;
        const capacity = Number(i.ideal_stock_level) || 0;
        const isTenPercent = capacity > 0 ? cur <= capacity * 0.10 : cur <= (Number(i.low_stock_threshold) || 0) * 0.25;
        return (
          cur <= 0 ||
          isTenPercent ||
          (m?.hasUpcomingShortfall && cur <= (m?.upcomingDemandUnits || 0) * 0.10)
        );
      }),
    [activeItems, itemMetrics]
  );
  const healthyItems = useMemo(
    () =>
      activeItems.filter((i) => {
        const m = itemMetrics[i.item_id];
        return (
          i.current_stock_level > i.low_stock_threshold &&
          !m?.hasUpcomingShortfall &&
          !m?.willFallBelowThreshold
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
            mA?.daysUntilLow,
            mA
          );
          const stB = getStockStatus(
            b.current_stock_level,
            b.low_stock_threshold,
            mB?.daysUntilLow,
            mB
          );
          const priority = {
            out_of_stock: 0,
            critical: 1,
            low_stock: 2,
            healthy: 3,
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

  // Filtered and sorted rows depending on active tab
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
        return matchesQ && matchesCat;
      });
    }

    const currentDataset = viewArchived ? archivedItems : activeItems;
    const filteredItems = currentDataset.filter((item) => {
      const matchesQ =
        q === "" ||
        item.item_name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);

      const matchesCat = matchesCategoryFilter(item.category);
      return matchesQ && matchesCat;
    });

    if (viewArchived) {
      return filteredItems.sort((a, b) => a.item_name.localeCompare(b.item_name));
    }

    // Active items: Display the most low stock at the top of the list and so on
    const statusPriority = {
      out_of_stock: 0,
      critical: 1,
      low_stock: 2,
      healthy: 3,
    };

    return filteredItems.sort((a, b) => {
      const mA = itemMetrics[a.item_id];
      const mB = itemMetrics[b.item_id];
      const stA = getStockStatus(a.current_stock_level, a.low_stock_threshold, mA?.daysUntilLow, mA);
      const stB = getStockStatus(b.current_stock_level, b.low_stock_threshold, mB?.daysUntilLow, mB);

      const prioA = statusPriority[stA.key] ?? 5;
      const prioB = statusPriority[stB.key] ?? 5;

      if (prioA !== prioB) {
        return prioA - prioB;
      }

      const pctA = getStockPercent(a.current_stock_level, a.ideal_stock_level);
      const pctB = getStockPercent(b.current_stock_level, b.ideal_stock_level);
      if (pctA !== pctB) {
        return pctA - pctB;
      }

      return (Number(a.current_stock_level) || 0) - (Number(b.current_stock_level) || 0);
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
        burnRateSource: m.burnRateSource,
        upcomingDemandSubUnit: m.upcomingDemandSubUnit,
        upcomingDemandSubUnitLabel: m.upcomingDemandSubUnitLabel,
        hasUpcomingShortfall: m.hasUpcomingShortfall,
        shortfallSubUnit: m.shortfallSubUnit,
        earliestDueDays: m.earliestDueDays,
        willFallBelowThreshold: m.willFallBelowThreshold,
      };
    });
  }, [filtered, itemMetrics, viewHistory]);

  // Permanent Delete for Archived items
  const handlePermanentDelete = async (item) => {
    if (
      !window.confirm(
        `Permanently remove "${item.item_name}" and all historical stock movements? This action CANNOT be undone.`
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

  const handleSaved = async (keepOpen, savedItem) => {
    if (prefillSupply?.guideline && savedItem?.item_id) {
      const g = prefillSupply.guideline;
      const apiBase = import.meta.env.VITE_API_BASE_URL || "";
      try {
        await fetch(`${apiBase}/api/growth/guidelines/link-inventory`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guideline_id: g.guideline_id,
            item_id: savedItem.item_id,
            item_name: savedItem.item_name,
            original_task_name: g.task_name,
            activity_type: g.activity_type,
          }),
        });
      } catch (err) {
        console.warn("Failed to link guideline via API, falling back to direct update:", err);
        await supabase
          .from("growth_program_guidelines")
          .update({ item_id: savedItem.item_id, task_name: savedItem.item_name })
          .eq("guideline_id", g.guideline_id);
      }
      setPrefillSupply(null);
    }
    fetchAll();
    if (!keepOpen) {
      setAddModal(false);
      setEditItem(null);
      setPrefillSupply(null);
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
      <div className="p-5 lg:p-6 space-y-6">
        {/* Top Section: Critical Stock & Growth Program Alerts (smoothly animates on tab switch) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${!viewArchived && !viewHistory
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
        >
          <div className="overflow-hidden">
            <div
              className={`p-1 -m-1 space-y-6 pb-2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${!viewArchived && !viewHistory
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-4 opacity-0"
                }`}
            >
              <section className="space-y-3">

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

              {/* Collapsible Unregistered Supplies Alert Card */}
              {unlinkedGuidelines.length > 0 && (
                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-800">
                      Unregistered Growth Program Supplies
                    </h3>

                    <button
                      type="button"
                      onClick={() => setUnregisteredOpen((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 transition-colors cursor-pointer shrink-0"
                    >
                      <span>{unregisteredOpen ? "Collapse" : `Review Supplies (${unlinkedGuidelines.length})`}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${unregisteredOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                  </div>

                  {/* Smooth Animated Accordion Container (CSS Grid Transition) */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${unregisteredOpen
                      ? "grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-slate-100"
                      : "grid-rows-[0fr] opacity-0"
                      }`}
                  >
                    <div className="overflow-hidden space-y-3">
                      {/* 4 Items per page with fade transition */}
                      <div key={safeUnregPage} className="space-y-2 animate-in fade-in duration-200">
                        {paginatedUnregistered.map((g) => {
                          const typeMap = {
                            FEED: "Feed",
                            MEDICATION: "Medication",
                            SUPPLEMENT: "Supplements",
                          };
                          const mappedCat = typeMap[(g.activity_type || "").toUpperCase()] || "Feed";
                          const progName = g.growth_programs?.name || "Growth Program";
                          const catCfg = getCategoryIconConfig(mappedCat);
                          const CatIcon = catCfg.Icon;
                          return (
                            <div
                              key={g.guideline_id}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100 shadow-2xs hover:border-slate-200 transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-8 h-8 rounded-lg ${catCfg.bg} border ${catCfg.border} flex items-center justify-center shrink-0`}>
                                  <CatIcon className={`w-4 h-4 ${catCfg.color}`} />
                                </div>
                                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
                                  <h4
                                    className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                                    title={g.task_name}
                                  >
                                    {g.task_name}
                                  </h4>
                                  <span className="text-slate-300 hidden sm:inline">&bull;</span>
                                  <p className="text-xs text-slate-500 font-medium truncate">
                                    {progName} &bull; Day {g.days_after_birth}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditItem(null);
                                  setPrefillSupply({
                                    item_name: g.task_name,
                                    category: mappedCat,
                                    description: `Added from Growth Program "${progName}" (Day ${g.days_after_birth})`,
                                    guideline: g,
                                  });
                                  setAddModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-2xs shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add to Inventory
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls (when more than 4 items) */}
                      {totalUnregPages > 1 && (
                        <div className="flex items-center justify-between pt-2 px-1 text-xs border-t border-slate-100/80">
                          <span className="text-slate-400 font-medium text-[11px]">
                            Showing {(safeUnregPage - 1) * UNREG_PER_PAGE + 1}–
                            {Math.min(safeUnregPage * UNREG_PER_PAGE, unlinkedGuidelines.length)} of{" "}
                            {unlinkedGuidelines.length} supplies
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeUnregPage <= 1}
                              onClick={() => setUnregisteredPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              Prev
                            </button>
                            <span className="text-[11px] font-bold text-slate-600 px-1">
                              {safeUnregPage} / {totalUnregPages}
                            </span>
                            <button
                              type="button"
                              disabled={safeUnregPage >= totalUnregPages}
                              onClick={() =>
                                setUnregisteredPage((p) => Math.min(totalUnregPages, p + 1))
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Supply Ledger & Transaction History */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-bold text-slate-800 transition-colors duration-200">
                  {viewHistory
                    ? "Stock Movement Audit Log"
                    : viewArchived
                      ? "Archived Supplies Ledger"
                      : "Supply Ledger"}
                </h2>

                {/* Active / Transaction History / Archived Tabs */}
                <div className="relative flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 isolate">
                  {/* Sliding active pill indicator */}
                  <span
                    className="absolute top-0.5 bottom-0.5 bg-white rounded-md shadow-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                    style={{
                      left: `${tabPillStyle.left}px`,
                      width: `${tabPillStyle.width}px`,
                      opacity: tabPillStyle.opacity,
                    }}
                  />

                  <button
                    ref={activeTabRef}
                    onClick={() => switchTab("active")}
                    className={`relative z-10 px-3 py-1 text-xs font-bold rounded-md transition-colors duration-200 cursor-pointer ${viewTab === "active"
                      ? `${tabPillStyle.opacity === 0 ? "bg-white shadow-xs " : ""}text-slate-900`
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                    id="inventory-tab-active"
                  >
                    Active ({activeItems.length})
                  </button>
                  <button
                    ref={historyTabRef}
                    onClick={() => switchTab("history")}
                    className={`relative z-10 px-3 py-1 text-xs font-bold rounded-md transition-colors duration-200 cursor-pointer flex items-center gap-1.5 ${viewTab === "history"
                      ? `${tabPillStyle.opacity === 0 ? "bg-white shadow-xs " : ""}text-slate-900`
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                    id="inventory-tab-history"
                  >
                    Stock Movements ({transactions.length})
                  </button>
                  <button
                    ref={archivedTabRef}
                    onClick={() => switchTab("archived")}
                    className={`relative z-10 px-3 py-1 text-xs font-bold rounded-md transition-colors duration-200 cursor-pointer ${viewTab === "archived"
                      ? `${tabPillStyle.opacity === 0 ? "bg-white shadow-xs " : ""}text-slate-900`
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                    id="inventory-tab-archived"
                  >
                    Archived ({archivedItems.length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                      ? "inventory_stock_movements"
                      : viewArchived
                        ? "inventory_archived_ledger"
                        : "inventory_active_ledger"
                  }
                  pdfTitle={
                    viewHistory
                      ? "Inventory Stock Movement Audit Log"
                      : viewArchived
                        ? "Archived Supply Ledger"
                        : "Active Supply Ledger"
                  }
                />
                {!viewArchived && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditItem(null);
                      setPrefillSupply(null);
                      setAddModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                    id="inventory-add-supply-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add New Supply
                  </button>
                )}
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
                      ? "Search movements by item name, category, reason/notes, or staff..."
                      : "Search items by name, or category"
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
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${categoryFilter === cat.id
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {categoryFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("all");
                      setPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div key={viewTab} className="overflow-x-auto tab-crossfade">
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
                                className={`text-sm font-extrabold ${tx.isPositive
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
                        {[...Array(5)].map((_, j) => (
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
                        colSpan={5}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        {query || categoryFilter !== "all"
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
                      const catCfg = getCategoryIconConfig(item.category);
                      const CatIcon = catCfg.Icon;
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
                              <div className={`w-8 h-8 rounded-lg ${catCfg.bg} border ${catCfg.border} flex items-center justify-center shrink-0`}>
                                <CatIcon className={`w-4 h-4 ${catCfg.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 group-hover/title:text-emerald-600 transition-colors truncate">
                                  {item.item_name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {item.category || "General"} &bull;{" "}
                                  {item.unit_of_measure}
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
                                  {m.dailyBurnRate > 0 ? (
                                    <span
                                      className={`text-[10px] font-semibold mt-0.5 ${m.daysUntilLow != null &&
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
                                  ) : m.upcomingDemandSubUnit > 0 ? (
                                    <span
                                      className={`text-[10px] font-semibold mt-0.5 ${m.hasUpcomingShortfall
                                          ? "text-rose-600 font-bold"
                                          : m.willFallBelowThreshold
                                            ? "text-amber-600"
                                            : "text-slate-400"
                                        }`}
                                      title={`Scheduled in next 14 days for ${m.upcomingBatchesCount} batch(es)`}
                                    >
                                      {m.hasUpcomingShortfall
                                        ? `Short ${m.shortfallSubUnit} ${m.upcomingDemandSubUnitLabel} in ${m.earliestDueDays}d`
                                        : `Upcoming: ${m.upcomingDemandSubUnit} ${m.upcomingDemandSubUnitLabel} (${m.earliestDueDays}d)`}
                                    </span>
                                  ) : m.burnRateSource === "par_level" || m.supplyCategory === "medication" ? (
                                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                                      Par-level tracked
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              {/* Status */}
                              <td className="px-4 py-4 text-center">
                                <StatusPill
                                  current={item.current_stock_level}
                                  threshold={item.low_stock_threshold}
                                  daysUntilLow={m.daysUntilLow}
                                  extra={m}
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
                                    title="View Stock Movements"
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
                                    title="View Stock Movements"
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
            itemName={viewHistory ? "stock movements" : "inventory items"}
            disabled={loading}
          />
        </section>
      </div>

      {/* Add / Edit Supply Modal */}
      {addModal && (
        <AddSupplyModal
          item={editItem}
          prefill={prefillSupply}
          onClose={() => {
            setAddModal(false);
            setEditItem(null);
            setPrefillSupply(null);
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
          onOpenAdjust={(target) => {
            setArchiveData(null);
            setAdjustItem(target);
          }}
          loggedInUser={loggedInUser}
        />
      )}
    </div>
  );
}
