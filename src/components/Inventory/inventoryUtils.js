const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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
 * Evaluate stock status using both static thresholds and optional burn-rate daysUntilLow.
 */
export function getStockStatus(current, threshold, daysUntilLow = null) {
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
  if (cur <= thr * 0.25) {
    return {
      label: "Critical",
      key: "critical",
      cls: "bg-rose-50 text-rose-600 ring-rose-200",
      barColor: "#ef4444",
    };
  }
  if (cur <= thr) {
    return {
      label: "Low Stock",
      key: "low_stock",
      cls: "bg-amber-50 text-amber-700 ring-amber-200",
      barColor: "#f59e0b",
    };
  }
  if (daysUntilLow !== null && daysUntilLow <= 7) {
    return {
      label: "At Risk",
      key: "at_risk",
      cls: "bg-amber-50/80 text-amber-700 ring-amber-200",
      barColor: "#f59e0b",
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
 * Aggregate transactions per item and compute 14-day burn rate & days until low/stockout.
 */
export function computeInventoryMetrics(items = [], transactions = [], windowDays = BURN_WINDOW_DAYS) {
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
      transactions: [],
    };

    const current = Number(item.current_stock_level) || 0;
    const threshold = Number(item.low_stock_threshold) || 0;
    const rawBurn = entry.window_used / windowDays;
    const dailyBurnRate = rawBurn > 0 ? Number(rawBurn.toFixed(2)) : 0;

    let daysUntilLow = null;
    if (current <= threshold) {
      daysUntilLow = 0;
    } else if (dailyBurnRate > 0) {
      daysUntilLow = Math.floor((current - threshold) / dailyBurnRate);
    }

    let daysUntilEmpty = null;
    if (current <= 0) {
      daysUntilEmpty = 0;
    } else if (dailyBurnRate > 0) {
      daysUntilEmpty = Math.floor(current / dailyBurnRate);
    }

    itemMetrics[item.item_id] = {
      total_in: Number(entry.total_in.toFixed(2)),
      total_out: Number(entry.total_out.toFixed(2)),
      window_used: Number(entry.window_used.toFixed(2)),
      dailyBurnRate,
      daysUntilLow,
      daysUntilEmpty,
      tx_count: entry.tx_count,
      transactions: entry.transactions,
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

