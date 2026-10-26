import { Baby, Users, ShieldAlert, PiggyBank } from "lucide-react";
import { DEFAULT_CAPACITY } from "../../config/farmLayout";

// ---- Pen types (client-approved). Types are shown as neutral labels; ----
// ---- color is reserved for availability (adviser recommendation). ----
export const SECTIONS = {
  B: { label: "Boar Pen", short: "Boar", desc: "Max capacity: 1 (Solitary)", icon: PiggyBank, defaultCapacity: DEFAULT_CAPACITY.B },
  S: { label: "Sow Pen", short: "Sow", desc: "Gestation & Farrowing (sow + piglets)", icon: Baby, defaultCapacity: DEFAULT_CAPACITY.S },
  W: { label: "Weaned / Fattening", short: "Weaned", desc: "Growing & Finishing", icon: Users, defaultCapacity: DEFAULT_CAPACITY.W },
  Q: { label: "Quarantine / Isolation", short: "Quarantine", desc: "Sick & Observation", icon: ShieldAlert, defaultCapacity: DEFAULT_CAPACITY.Q },
};

export const TYPE_BADGE_CLASS = "bg-white/80 text-slate-700 border-slate-200";

// Normalizes legacy / free-text pen types to a section key
export function getSectionKey(sec) {
  if (!sec) return "S";
  const s = String(sec).trim().toUpperCase();
  if (SECTIONS[s]) return s;
  if (s.includes("BOAR")) return "B";
  if (s.includes("SOW") || s.includes("GEST") || s.includes("FARR")) return "S";
  if (s.includes("WEAN") || s.includes("FATT") || s.includes("GROW") || s.includes("FINISH") || s.includes("NURS")) return "W";
  if (s.includes("QUAR") || s.includes("ISOL") || s.includes("SICK")) return "Q";
  return "S";
}

// Out-of-service pattern (used for archived pens)
export const OOS_PATTERN = {
  backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,0.18) 0 6px, transparent 6px 12px)",
};

/**
 * Availability status (adviser-approved):
 *  green  = vacant (no swine housed)
 *  yellow = partially occupied (housed, still has slots)
 *  red    = full
 *  grey   = out of service (archived)
 */
export function getPenStatus(pen) {
  if (pen?.is_archived) {
    return {
      key: "oos",
      label: "Out of service",
      tile: "bg-slate-100 border-slate-300 text-slate-500",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-300",
      bar: "bg-slate-300",
      dot: "bg-slate-400",
    };
  }
  const occ = Number(pen?.occupancy || 0);
  const cap = Number(pen?.capacity || 0);
  if (occ <= 0) {
    return {
      key: "vacant",
      label: "Vacant",
      tile: "bg-emerald-50 border-emerald-300 text-emerald-950 hover:border-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      bar: "bg-emerald-500",
      dot: "bg-emerald-500",
    };
  }
  if (cap > 0 && occ >= cap) {
    return {
      key: "full",
      label: "Full",
      tile: "bg-rose-50 border-rose-300 text-rose-950 hover:border-rose-500",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/60",
      bar: "bg-rose-500",
      dot: "bg-rose-500",
    };
  }
  return {
    key: "partial",
    label: "Partially occupied",
    tile: "bg-amber-50 border-amber-300 text-amber-950 hover:border-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/60",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  };
}

export const STATUS_LEGEND = [
  { key: "vacant", label: "Vacant", dot: "bg-emerald-500" },
  { key: "partial", label: "Partially occupied", dot: "bg-amber-500" },
  { key: "full", label: "Full", dot: "bg-rose-500" },
  { key: "oos", label: "Out of service", dot: "bg-slate-300", striped: true },
];

export function isAdminUser(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}
