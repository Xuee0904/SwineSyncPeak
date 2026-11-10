const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

export const BURN_WINDOW_DAYS = 14;

// ─── Sack ↔ kg conversion ────────────────────────────────────────────────
// Sack-based items store the sack size in unit_of_measure, e.g. "sacks (25kg)"
// or "sacks (50kg)". Legacy "sacks" / "bags" rows are treated as 25 kg.
export const SACK_SIZES_KG = [25, 50];

const SACK_UNIT_REGEX = /^(sacks?|bags?)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*kg\s*\))?$/i;
// Medical vials: "vials (100ml)", "vials (50 doses)", "vials (1 dose)"
const VIAL_UNIT_REGEX = /^vials?\s*\(\s*(\d+(?:\.\d+)?)\s*(ml|doses?)\s*\)$/i;
// Supplements: "packs (500g)", "bottles (1000ml)"
const PACK_UNIT_REGEX = /^(packs?|bottles?)\s*\(\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*\)$/i;

const unitString = (unit) => (typeof unit === "string" ? unit : unit?.unit_of_measure);

export function getSackWeightKg(unit) {
  const m = String(unitString(unit) || "").trim().match(SACK_UNIT_REGEX);
  if (!m) return null;
  return m[2] ? Number(m[2]) : 25;
}

export function isSackUnit(unit) {
  return getSackWeightKg(unit) !== null;
}

/**
 * Container metadata for items bought in a container but used in a sub-unit.
 *  "sacks (25kg)"     -> { containerUnit: "sacks",   subUnit: "kg",    size: 25 }
 *  "vials (100ml)"    -> { containerUnit: "vials",   subUnit: "ml",    size: 100 }
 *  "vials (50 doses)" -> { containerUnit: "vials",   subUnit: "doses", size: 50 }
 *  "packs (500g)"     -> { containerUnit: "packs",   subUnit: "g",     size: 500 }
 *  "bottles (1000ml)" -> { containerUnit: "bottles", subUnit: "ml",    size: 1000 }
 * Returns null for plain units (kg, ml, tablets...).
 */
export function getContainerMeta(unit) {
  const raw = String(unitString(unit) || "").trim();
  const sackKg = getSackWeightKg(raw);
  if (sackKg !== null) return { containerUnit: "sacks", subUnit: "kg", size: sackKg };
  const v = raw.match(VIAL_UNIT_REGEX);
  if (v) {
    return {
      containerUnit: "vials",
      subUnit: /^dose/i.test(v[2]) ? "doses" : "ml",
      size: Number(v[1]),
    };
  }
  const p = raw.match(PACK_UNIT_REGEX);
  if (p) {
    return {
      containerUnit: /^bottle/i.test(p[1]) ? "bottles" : "packs",
      subUnit: p[3].toLowerCase(),
      size: Number(p[2]),
    };
  }
  return null;
}

/** "sacks" -> "sack", "vials" -> "vial", "packs" -> "pack", "bottles" -> "bottle". */
export function getContainerSingular(unit) {
  const meta = getContainerMeta(unit);
  return meta ? meta.containerUnit.replace(/s$/, "") : "";
}

export function hasSubUnit(unit) {
  return getContainerMeta(unit) !== null;
}

/** Short unit for display next to numbers: "sacks (25kg)" -> "sacks", "vials (100ml)" -> "vials". */
export function getShortUnit(unit) {
  const raw = unitString(unit);
  return getContainerMeta(raw)?.containerUnit || raw || "";
}

const round2 = (n) => Number((Number(n) || 0).toFixed(2));
// `sizeOrUnit` may be a container size (number) or a unit string / item object.
const resolveSize = (sizeOrUnit) =>
  typeof sizeOrUnit === "number" ? sizeOrUnit : getContainerMeta(sizeOrUnit)?.size || 0;

/** Containers -> sub-units (sacks -> kg, vials -> ml/doses). */
export const toSubUnitQty = (containers, sizeOrUnit) =>
  round2((Number(containers) || 0) * resolveSize(sizeOrUnit));
/** Sub-units -> containers (kg -> sacks, ml/doses -> vials). */
export const fromSubUnitQty = (subQty, sizeOrUnit) => {
  const size = resolveSize(sizeOrUnit);
  return size ? Number(((Number(subQty) || 0) / size).toFixed(4)) : 0;
};
// Backwards-compatible aliases
export const sacksToKg = toSubUnitQty;
export const kgToSacks = fromSubUnitQty;

/** Returns "375 kg" / "800 ml" / "250 doses" for container items, otherwise null. */
export function formatSubUnitEquivalent(qty, unit) {
  const meta = getContainerMeta(unit);
  if (!meta) return null;
  return `${toSubUnitQty(qty, meta.size)} ${meta.subUnit}`;
}
export const formatKgEquivalent = formatSubUnitEquivalent;

/**
 * Extract readable staff name & email from loggedInUser prop.
 */
export function getStaffDetails(loggedInUser) {
  if (!loggedInUser) {
    return { name: "Staff", email: "staff@swinesync.ag", id: null };
  }
  if (typeof loggedInUser === "string") {
    const trimmed = loggedInUser.trim() || "Staff";
    return {
      name: trimmed,
      email: trimmed.includes("@") ? trimmed : "staff@swinesync.ag",
      id: null,
    };
  }
  const name =
    loggedInUser.name ||
    loggedInUser.full_name ||
    loggedInUser.user_metadata?.full_name ||
    loggedInUser.email?.split("@")[0] ||
    "Staff";
  const email = loggedInUser.email || "staff@swinesync.ag";
  const id = loggedInUser.id || loggedInUser.fullId || null;
  return { name, email, id };
}

/**
 * Format transaction notes so positive/negative corrections and the recording staff member
 * are preserved without requiring extra database columns.
 */
export function formatTransactionNotes({ txType, direction, reason, notes, loggedInUser }) {
  const { name } = getStaffDetails(loggedInUser);
  const prefix =
    txType === "CORRECTION" ? (direction === "in" ? "[+] " : "[-] ") : "";
  const baseText = [reason?.trim(), notes?.trim()].filter(Boolean).join(" - ") || "Stock movement";
  return `${prefix}${baseText} • By: ${name}`;
}

/**
 * Detect legacy archive-reason rows in inventory_transactions so they do not
 * distort stock movement sums (total_in / total_out) or burn rates.
 */
export function isLegacyArchiveTx(tx) {
  return (
    tx?.transaction_type === "CORRECTION" &&
    /^Item (Archived|Restored):/i.test((tx?.notes || "").trim())
  );
}

/**
 * Parse a raw inventory_transactions row into structured display metadata.
 */
export function parseTransaction(tx) {
  const rawNotes = (tx?.notes || "").trim();
  const isArchiveLog = isLegacyArchiveTx(tx);

  // Extract "• By: Name" suffix if present
  let cleanNotes = rawNotes;
  let recordedBy = "Staff";
  const byMatch = cleanNotes.match(/\s*•\s*By:\s*([^•]+)$/i);
  if (byMatch) {
    recordedBy = byMatch[1].trim() || "Staff";
    cleanNotes = cleanNotes.slice(0, byMatch.index).trim();
  }

  // Extract direction prefix for CORRECTION rows
  let correctionSign = null;
  if (cleanNotes.startsWith("[+]")) {
    correctionSign = "in";
    cleanNotes = cleanNotes.replace(/^\[\+\]\s*/, "");
  } else if (cleanNotes.startsWith("[-]")) {
    correctionSign = "out";
    cleanNotes = cleanNotes.replace(/^\[-\]\s*/, "");
  }

  let direction;
  if (tx?.transaction_type === "RESTOCK") {
    direction = "in";
  } else if (tx?.transaction_type === "CORRECTION") {
    direction = correctionSign === "in" ? "in" : "out";
  } else {
    direction = "out";
  }

  return {
    ...tx,
    direction,
    isPositive: direction === "in",
    cleanNotes: cleanNotes || "—",
    recordedBy,
    isArchiveLog,
  };
}

/**
 * Supply category classification helper for inventory forecasting and burn rate behavior.
 * - "feed": continuous daily ration, uses adaptive burn rate + growth program daily demand.
 * - "vaccine": milestone-based one-off administration, tracked by upcoming scheduled demand.
 * - "supplement": hybrid: multi-day regimens + scheduled milestones.
 * - "medication": reactive/unpredictable treatments, tracked strictly by par-level/threshold (exempt from burn rate).
 */
export function getSupplyCategory(item) {
  if (!item) return "general";
  const cat = (item.category || "").toLowerCase();
  const name = (item.item_name || "").toLowerCase();
  const unit = (item.unit_of_measure || "").toLowerCase();

  // 1. Vaccine check
  if (
    cat === "vaccines" ||
    cat === "vaccine" ||
    name.includes("vaccine") ||
    name.includes("pcv") ||
    name.includes("prrs") ||
    name.includes("fmd") ||
    name.includes("parvo") ||
    name.includes("erysipelas") ||
    name.includes("mycoplasma") ||
    name.includes("hog cholera") ||
    name.includes("iron injection") ||
    name.includes("iron dextran") ||
    unit.includes("dose")
  ) {
    return "vaccine";
  }

  // 2. Medication check (excludes vaccines)
  if (
    cat === "medication" ||
    cat === "medicine" ||
    cat === "medical" ||
    name.includes("amoxicillin") ||
    name.includes("antibiotic") ||
    name.includes("tylosin") ||
    name.includes("penicillin") ||
    name.includes("flunixin") ||
    name.includes("meloxicam") ||
    name.includes("lincomycin") ||
    name.includes("enrofloxacin")
  ) {
    return "medication";
  }

  // 3. Supplement check
  if (
    cat === "supplements" ||
    cat === "supplement" ||
    name.includes("electrolyte") ||
    name.includes("vitamin") ||
    name.includes("mineral") ||
    name.includes("supplement")
  ) {
    return "supplement";
  }

  // 4. Feed
  if (
    cat === "feed" ||
    name.includes("feed") ||
    name.includes("starter") ||
    name.includes("grower") ||
    name.includes("finisher") ||
    name.includes("pre-starter")
  ) {
    return "feed";
  }

  return "general";
}

/**
 * Parse dosage amount per head from dosage instructions string or supply unit.
 * Examples:
 *  "2 ml per piglet" -> { qty: 2, unit: "ml" }
 *  "1 dose" -> { qty: 1, unit: "doses" }
 *  "5g in water" -> { qty: 5, unit: "g" }
 */
export function parseDosePerHead(dosageInstructions, unitOfMeasure) {
  const containerMeta = getContainerMeta(unitOfMeasure);
  const subUnit = containerMeta?.subUnit || (typeof unitOfMeasure === "string" ? unitOfMeasure.toLowerCase() : "");

  if (dosageInstructions && typeof dosageInstructions === "string") {
    const m = dosageInstructions.match(/(\d+(?:\.\d+)?)\s*(doses?|ml|g|mg|cc|tablets?|capsules?)/i);
    if (m) {
      let unit = m[2].toLowerCase();
      if (unit.startsWith("dose")) unit = "doses";
      return { qty: parseFloat(m[1]), unit };
    }
  }

  // Standard veterinary defaults based on container sub-unit
  if (subUnit === "doses" || /dose/i.test(subUnit)) {
    return { qty: 1, unit: "doses" };
  }
  if (subUnit === "ml" || /ml/i.test(subUnit)) {
    return { qty: 2, unit: "ml" };
  }
  if (subUnit === "g" || /g$/i.test(subUnit)) {
    return { qty: 5, unit: "g" };
  }
  return { qty: 1, unit: subUnit || "units" };
}

/**
 * Evaluate stock status using static thresholds, burn rate, and upcoming milestone demand.
 */
export function getStockStatus(current, threshold, daysUntilLow = null, extra = null) {
  const cur = Number(current) || 0;
  const thr = Number(threshold) || 0;

  if (cur <= 0) {
    return {
      label: "Out of Stock",
      key: "out_of_stock",
      cls: "bg-rose-100 text-rose-700 ring-rose-300",
      barColor: "#ef4444",
    };
  }

  // 1. Critical if severely below threshold OR severely short for scheduled upcoming milestones
  const isSevereMilestoneShortfall =
    extra?.hasUpcomingShortfall && cur <= (Number(extra?.upcomingDemandUnits) || 0) * 0.25;

  if (cur <= thr * 0.25 || isSevereMilestoneShortfall) {
    return {
      label: "Critical",
      key: "critical",
      cls: "bg-rose-50 text-rose-600 ring-rose-200",
      barColor: "#ef4444",
    };
  }

  // 2. Low Stock if at or below threshold
  if (cur <= thr) {
    return {
      label: "Low Stock",
      key: "low_stock",
      cls: "bg-amber-50 text-amber-700 ring-amber-200",
      barColor: "#f59e0b",
    };
  }

  // 3. At Risk if:
  // - Daily burn projects stockout in <= 7 days, OR
  // - Scheduled upcoming milestone demand exceeds current stock, OR
  // - Scheduled upcoming milestone demand will drop remaining stock below threshold
  if (
    (daysUntilLow !== null && daysUntilLow <= 7) ||
    extra?.hasUpcomingShortfall ||
    extra?.willFallBelowThreshold
  ) {
    return {
      label: "At Risk",
      key: "at_risk",
      cls: "bg-amber-50/80 text-amber-700 ring-amber-200",
      barColor: "#f59e0b",
      isMilestoneRisk: Boolean(extra?.hasUpcomingShortfall || extra?.willFallBelowThreshold),
    };
  }

  return {
    label: "Healthy",
    key: "healthy",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    barColor: "#16a34a",
  };
}

export function getStockPercent(current, ideal) {
  const cur = Number(current) || 0;
  const idl = Number(ideal) || 0;
  if (!idl || idl <= 0) return cur > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((cur / idl) * 100)));
}

export function getBarColor(pct) {
  if (pct <= 20) return "bg-rose-500";
  if (pct <= 40) return "bg-amber-400";
  return "bg-emerald-500";
}

/**
 * Aggregate transactions per item and compute adaptive burn rate & days until low/stockout.
 * Incorporates:
 * 1. Adaptive days sampled: divides by actual elapsed days since first use in window rather than rigid 14 days.
 * 2. Growth Program Standard: if no historical usage is recorded yet (new supply), automatically falls back to
 *    prescribed daily demand from active batches and breeder herd enrolled in growth program templates.
 */
export function computeInventoryMetrics(
  items = [],
  transactions = [],
  windowDays = BURN_WINDOW_DAYS,
  growthBatches = [],
  breederSummary = null
) {
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const agg = {};

  transactions.forEach((rawTx) => {
    const tx = parseTransaction(rawTx);
    const id = tx.item_id;
    if (!id) return;

    if (!agg[id]) {
      agg[id] = {
        total_in: 0,
        total_out: 0,
        window_used: 0,
        tx_count: 0,
        earliestTxTime: null,
        transactions: [],
      };
    }

    agg[id].transactions.push(tx);
    agg[id].tx_count += 1;

    // Exclude legacy archive-note entries from stock quantity sums
    if (tx.isArchiveLog) return;

    const qty = Number(tx.quantity) || 0;
    if (tx.isPositive) {
      agg[id].total_in += qty;
    } else {
      agg[id].total_out += qty;
    }

    // Burn rate is driven by USAGE and WASTAGE within the rolling window
    if (tx.transaction_type === "USAGE" || tx.transaction_type === "WASTAGE") {
      const txTime = tx.created_at ? new Date(tx.created_at).getTime() : 0;
      if (txTime >= cutoffMs) {
        agg[id].window_used += qty;
        if (!agg[id].earliestTxTime || txTime < agg[id].earliestTxTime) {
          agg[id].earliestTxTime = txTime;
        }
      }
    }
  });

  // Compute burn-rate forecast per item
  const itemMetrics = {};
  items.forEach((item) => {
    const entry = agg[item.item_id] || {
      total_in: 0,
      total_out: 0,
      window_used: 0,
      tx_count: 0,
      earliestTxTime: null,
      transactions: [],
    };

    const current = Number(item.current_stock_level) || 0;
    const threshold = Number(item.low_stock_threshold) || 0;
    const supplyCategory = getSupplyCategory(item);
    const containerMeta = getContainerMeta(item.unit_of_measure);

    // 1. Calculate Adaptive Historical Daily Burn Rate (if any)
    let daysSampled = windowDays;
    if (entry.earliestTxTime) {
      const elapsedDays = Math.max(1, Math.ceil((Date.now() - entry.earliestTxTime) / (24 * 60 * 60 * 1000)));
      daysSampled = Math.min(windowDays, elapsedDays);
    }
    const rawHistoricalBurn = entry.window_used > 0 ? entry.window_used / daysSampled : 0;
    const historicalDailyBurn = rawHistoricalBurn > 0 ? Number(rawHistoricalBurn.toFixed(2)) : 0;

    let dailyBurnRate = 0;
    let burnRateSource = "none";
    let prescribedDailyDemandUnits = 0;
    let prescribedDailyDemandKg = 0;
    let enrolledBatchesCount = 0;
    let daysUntilLow = null;
    let daysUntilEmpty = null;

    // Upcoming Milestone Demand fields (for Vaccines & Supplements)
    const upcomingMilestonesList = [];
    let upcomingDemandSubUnit = 0;
    let upcomingDemandUnits = 0;
    let upcomingDemandSubUnitLabel = containerMeta?.subUnit || (supplyCategory === "vaccine" ? "doses" : "units");

    // =========================================================================
    // CATEGORY BEHAVIOR BRANCHING
    // =========================================================================

    if (supplyCategory === "medication") {
      // ── MEDICATION: Unpredictable / Reactive sickness treatments ────────────
      // Completely exempt from burn rate forecasting. Evaluated strictly by
      // static Par Level and Low Stock Threshold without projecting fake stockouts.
      dailyBurnRate = 0;
      burnRateSource = "par_level";
      daysUntilLow = null;
      daysUntilEmpty = null;
    } else if (supplyCategory === "vaccine" || supplyCategory === "supplement") {
      // ── VACCINES & SUPPLEMENTS: Milestone-Based Demand ──────────────────────
      // Scan active piglet batches for scheduled upcoming milestones within 14 days
      if (growthBatches && Array.isArray(growthBatches)) {
        growthBatches.forEach((b) => {
          const milestones = b.upcoming_milestones || [];
          milestones.forEach((m) => {
            const matchesId = m.item_id && m.item_id === item.item_id;
            const cleanM = (m.task_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const cleanI = (item.item_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const matchesName = cleanM && cleanI && (cleanM.includes(cleanI) || cleanI.includes(cleanM));

            if (matchesId || (!m.item_id && matchesName)) {
              const { qty: dosePerHead, unit: doseUnit } = parseDosePerHead(m.dosage_instructions, item.unit_of_measure);
              const batchHeads = Number(b.current_count) || 0;
              const subDemand = Number((dosePerHead * batchHeads).toFixed(2));
              const unitDemand = containerMeta?.size ? Number((subDemand / containerMeta.size).toFixed(4)) : subDemand;

              upcomingDemandSubUnit += subDemand;
              upcomingDemandUnits += unitDemand;
              upcomingDemandSubUnitLabel = doseUnit || containerMeta?.subUnit || upcomingDemandSubUnitLabel;
              upcomingMilestonesList.push({
                batch_tag: b.batch_tag,
                task_name: m.task_name,
                days_until_due: m.days_until_due,
                count: batchHeads,
                dosePerHead,
                doseUnit,
                subDemand,
                unitDemand,
              });
              enrolledBatchesCount++;
            }
          });
        });
      }

      upcomingDemandSubUnit = Number(upcomingDemandSubUnit.toFixed(2));
      upcomingDemandUnits = Number(upcomingDemandUnits.toFixed(2));

      if (supplyCategory === "vaccine") {
        // Vaccines are single milestone events ("one and done"), not continuous daily feed
        dailyBurnRate = 0;
        burnRateSource = upcomingDemandUnits > 0 ? "milestone" : "none";
        daysUntilLow = null;
        daysUntilEmpty = null;
      } else {
        // Supplements: Hybrid (multi-day usage regimens + scheduled growth milestones)
        if (historicalDailyBurn > 0) {
          dailyBurnRate = historicalDailyBurn;
          burnRateSource = upcomingDemandUnits > 0 ? "hybrid" : "historical";
          if (current <= threshold) {
            daysUntilLow = 0;
          } else if (dailyBurnRate > 0) {
            daysUntilLow = Math.floor((current - threshold) / dailyBurnRate);
          }
          if (current <= 0) {
            daysUntilEmpty = 0;
          } else if (dailyBurnRate > 0) {
            daysUntilEmpty = Math.floor(current / dailyBurnRate);
          }
        } else {
          dailyBurnRate = 0;
          burnRateSource = upcomingDemandUnits > 0 ? "milestone" : "par_level";
          daysUntilLow = null;
          daysUntilEmpty = null;
        }
      }
    } else {
      // ── FEED & GENERAL SUPPLIES: Continuous Daily Consumption ────────────────
      if (growthBatches && Array.isArray(growthBatches)) {
        growthBatches.forEach((b) => {
          const feed = b.current_feed;
          if (feed && feed.item_id === item.item_id) {
            const dailyKg =
              Number(feed.total_daily_feed_kg) ||
              (Number(feed.daily_consumption_per_head) || 0) * (Number(b.current_count) || 0);
            if (dailyKg > 0) {
              prescribedDailyDemandKg += dailyKg;
              enrolledBatchesCount++;
            }
          }
        });
      }

      // Add Breeder Herd demand if this item is selected for breeders
      const breederFeedId = typeof localStorage !== 'undefined' ? localStorage.getItem('swinesync_breeder_feed_item_id') : null;
      if (breederSummary && breederFeedId === item.item_id) {
        const breederHeads = Number(breederSummary.total_breeders) || 0;
        const breederRate = parseFloat(localStorage.getItem('swinesync_breeder_rate_per_head')) || 2.0;
        prescribedDailyDemandKg += breederHeads * breederRate;
      }

      if (containerMeta && containerMeta.size > 0) {
        prescribedDailyDemandUnits = Number((prescribedDailyDemandKg / containerMeta.size).toFixed(2));
      } else {
        prescribedDailyDemandUnits = Number(prescribedDailyDemandKg.toFixed(2));
      }

      dailyBurnRate = historicalDailyBurn;
      burnRateSource = "historical";

      if (dailyBurnRate <= 0 && prescribedDailyDemandUnits > 0) {
        dailyBurnRate = prescribedDailyDemandUnits;
        burnRateSource = "prescribed";
      } else if (dailyBurnRate <= 0) {
        burnRateSource = "none";
      }

      if (current <= threshold) {
        daysUntilLow = 0;
      } else if (dailyBurnRate > 0) {
        daysUntilLow = Math.floor((current - threshold) / dailyBurnRate);
      }

      if (current <= 0) {
        daysUntilEmpty = 0;
      } else if (dailyBurnRate > 0) {
        daysUntilEmpty = Math.floor(current / dailyBurnRate);
      }
    }

    // Milestone Shortfall & Risk Evaluation
    const hasUpcomingShortfall = upcomingDemandUnits > 0 && current < upcomingDemandUnits;
    const shortfallUnits = hasUpcomingShortfall ? Number((upcomingDemandUnits - current).toFixed(2)) : 0;
    const shortfallSubUnit = containerMeta?.size ? toSubUnitQty(shortfallUnits, containerMeta.size) : shortfallUnits;
    const willFallBelowThreshold =
      !hasUpcomingShortfall && upcomingDemandUnits > 0 && (current - upcomingDemandUnits <= threshold);
    const earliestDueDays =
      upcomingMilestonesList.length > 0 ? Math.min(...upcomingMilestonesList.map((m) => m.days_until_due)) : null;

    itemMetrics[item.item_id] = {
      total_in: Number(entry.total_in.toFixed(2)),
      total_out: Number(entry.total_out.toFixed(2)),
      window_used: Number(entry.window_used.toFixed(2)),
      daysSampled,
      supplyCategory,
      dailyBurnRate,
      historicalDailyBurn,
      prescribedDailyDemand: prescribedDailyDemandUnits,
      prescribedDailyDemandKg: Number(prescribedDailyDemandKg.toFixed(2)),
      burnRateSource,
      enrolledBatchesCount,
      daysUntilLow,
      daysUntilEmpty,
      tx_count: entry.tx_count,
      transactions: entry.transactions,
      // Milestone Forecasting Data
      upcomingMilestones: upcomingMilestonesList,
      upcomingDemandSubUnit,
      upcomingDemandUnits,
      upcomingDemandSubUnitLabel,
      upcomingBatchesCount: upcomingMilestonesList.length,
      hasUpcomingShortfall,
      shortfallUnits,
      shortfallSubUnit,
      willFallBelowThreshold,
      earliestDueDays,
    };
  });

  return itemMetrics;
}

/**
 * Non-blocking helper to record inventory actions in the Admin activity_logs table.
 */
export async function logInventoryActivity({
  loggedInUser,
  event_title,
  event_desc,
  status = "SUCCESS",
  user_bg_color = "bg-emerald-100 text-emerald-700",
}) {
  const { name, email } = getStaffDetails(loggedInUser);
  try {
    await fetch(`${API_BASE}/api/admin/activity-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: name,
        user_email: email,
        event_title,
        event_desc,
        status,
        user_bg_color,
      }),
    });
  } catch {
    // Non-blocking audit log
  }
}

