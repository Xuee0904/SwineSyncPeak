import React, { useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  CalendarClock,
  Heart,
  AlertTriangle,
  Dna,
  Activity,
  LayoutGrid,
  List,
  CalendarCheck,
  Sparkles,
} from "lucide-react";
import AddBreedingLogModal from "../components/BreedingLogs/AddBreedingLogModal";
import EditBreedingLogModal from "../components/BreedingLogs/EditBreedingLogModal";
import LogCheckModal from "../components/BreedingLogs/LogCheckModal";
import ArchiveBreedingLogModal from "../components/BreedingLogs/ArchiveBreedingLogModal";
import LogFarrowingModal from "../components/BreedingLogs/LogFarrowingModal";
import AddPigletBatchModal from "../components/SwineManagement/AddPigletBatchModal";
import ReportMiscarriageModal from "../components/BreedingLogs/ReportMiscarriageModal";

// ---- Domain constants ---------------------------------------------------
// A sow's gestation runs exactly 114 days — "3 months, 3 weeks, 3 days".
// Stage markers reflect real swine reproductive biology:
//   Day 0  – Mating / AI
//   Day 21 – Return-to-Heat Check: sow estrus cycles every 18–21 days.
//            If she returns to heat here, the mating FAILED and she must be re-mated.
//   Day 30 – Pregnancy Confirmation: ultrasound or progesterone test to
//            confirm pregnancy after she passed the heat-return window.
//   Day 60 – Mid-Gestation: routine health, weight & nutrition check.
//   Day 100 – Pre-Farrowing: move sow to farrowing crate, begin nest prep.
//   Day 114 – Farrowing: expected delivery date.
const GESTATION_DAYS = 114;
const STAGES = [
  { day: 0,   label: "Mated",       desc: "Mating / AI performed" },
  { day: 21,  label: "Heat Check",  desc: "Return-to-heat window (Day 18–21)" },
  { day: 30,  label: "Preg. Confirm", desc: "Ultrasound / progesterone confirm" },
  { day: 60,  label: "Mid-Gestation", desc: "Health & nutrition check" },
  { day: 100, label: "Pre-Farrow",  desc: "Move to farrowing crate" },
  { day: 114, label: "Farrowing",   desc: "Expected delivery" },
];

const STATUS_META = {
  pregnant: { label: "Pregnant", color: "var(--pine)", tint: "var(--pine-tint)" },
  monitoring: { label: "Monitoring", color: "var(--slate)", tint: "var(--slate-tint)" },
  action: { label: "Action required", color: "var(--brick)", tint: "var(--brick-tint)" },
  failed: { label: "Failed", color: "var(--wheat)", tint: "var(--wheat-tint)" },
  farrowed: { label: "Farrowed", color: "var(--pine)", tint: "var(--pine-tint)" },
  archived: { label: "Archived", color: "var(--ink-soft)", tint: "var(--border)" },
};

function getBreedingMethodMeta(method, boarTag) {
  if (!method) return null;
  const raw = String(method).toLowerCase().replace(/[\s_-]+/g, "");
  const isAI = raw.includes("artific") || raw === "ai";
  const isNatural = raw.includes("natur") || raw === "nm";

  if (isAI) {
    return {
      type: "artificial_insemination",
      label: "Artificial Insemination",
      shortLabel: "AI",
      Icon: Dna,
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100/60",
      description: "Artificial Insemination (AI)",
    };
  }

  if (isNatural) {
    return {
      type: "natural_mating",
      label: "Natural Mating",
      shortLabel: "Natural Mating",
      subLabel: boarTag ? `Boar #${boarTag}` : null,
      Icon: Heart,
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100/60",
      description: boarTag ? `Natural Mating (Boar #${boarTag})` : "Natural Mating",
    };
  }

  return {
    type: "other",
    label: method,
    shortLabel: method,
    Icon: Dna,
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    description: method,
  };
}

// MatingDate is dynamically pulled from the backend using the pig's creation date (fallback).

function getMilestoneDate(matingDateStr, daysOffset) {
  if (!matingDateStr) return null;
  const d = new Date(matingDateStr);
  d.setDate(d.getDate() + daysOffset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  unitColor,
  subtext,
  badge,
  badgeColor,
  isAlert = false,
  isWarning = false,
  loading = false,
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[106px] sm:min-h-[112px] ${
        isAlert
          ? 'border-rose-200/90 ring-1 ring-rose-100/70'
          : isWarning
            ? 'border-amber-200/90 ring-1 ring-amber-100/70'
            : 'border-slate-200/70'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isAlert
              ? 'bg-rose-50 text-rose-600'
              : isWarning
                ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-50 text-slate-500'
          }`}
        >
          {Icon && (React.isValidElement(Icon) ? Icon : <Icon className="w-4 h-4" />)}
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {value}
            </span>
          )}
          {unit && !loading && (
            <span
              className={`text-xs font-semibold ${
                unitColor
                  ? unitColor
                  : isAlert
                    ? 'text-rose-600 font-bold'
                    : isWarning
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-400'
              }`}
            >
              {unit}
            </span>
          )}
          {badge && !loading && (
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-auto shrink-0 ${
                badgeColor ||
                (isAlert
                  ? 'text-rose-700 bg-rose-50 border border-rose-200'
                  : 'text-slate-600 bg-slate-50 border border-slate-200')
              }`}
            >
              {badge}
            </span>
          )}
        </div>

        {subtext && !loading && (
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

function activeStageIndex(day) {
  let idx = 0;
  STAGES.forEach((s, i) => { if (day >= s.day) idx = i; });
  return idx;
}

function GestationRing({ day, status }) {
  const meta = STATUS_META[status];
  const pct = Math.min(100, Math.round((day / GESTATION_DAYS) * 100));
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const overdue = day > GESTATION_DAYS;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0 }}>
      <div className="brl-ring">
        <svg viewBox="0 0 64 64" width="60" height="60">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--track)" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={meta.color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="brl-ring-label">
          <span className="brl-ring-day">{overdue ? GESTATION_DAYS : day}</span>
          <span className="brl-ring-total">/{GESTATION_DAYS}</span>
        </div>
      </div>
      <span className="brl-ring-unit">days</span>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function BreedingLogs({ loggedInUser }) {
  const [sows, setSows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLogData, setEditLogData] = useState(null);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkLogData, setCheckLogData] = useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveLogData, setArchiveLogData] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showFarrowModal, setShowFarrowModal] = useState(false);
  const [farrowLogData, setFarrowLogData] = useState(null);
  const [showPigletModal, setShowPigletModal] = useState(false);
  const [pigletInitialData, setPigletInitialData] = useState(null);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [abortLogData, setAbortLogData] = useState(null);
  const [isAborting, setIsAborting] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"

  React.useEffect(() => {
    const fetchSows = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/breeding-logs?tab=${activeTab}`);
        const json = await res.json();
        setSows(json.data || []);
      } catch (err) {
        console.error("Failed to fetch breeding logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSows();
  }, [activeTab]);

  const refreshLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs?tab=${activeTab}`);
      const json = await res.json();
      setSows(json.data || []);
    } catch (err) {
      console.error("Failed to refresh breeding logs", err);
    }
  };

  const handleSaveBatch = async (batchData) => {
    const payload = { ...batchData, creator: loggedInUser };
    const res = await fetch(`${API_BASE}/api/pigs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to save batch (status ${res.status})`);
    }
  };

  const confirmArchive = async (reason) => {
    if (!archiveLogData) return;
    setIsArchiving(true);
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs/${archiveLogData.breeding_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: loggedInUser, archive_reason: reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to archive record");
      refreshLogs();
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAbort = async (breeding_id) => {
    if (!abortLogData) return;
    setIsAborting(true);
    try {
      const res = await fetch(`${API_BASE}/api/breeding-logs/${breeding_id}/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: loggedInUser }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to report miscarriage");
      toast.success("Miscarriage reported successfully.");
      refreshLogs();
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setIsAborting(false);
    }
  };

  const filtered = sows
    .filter((s) => {
      const matchesFilter =
        filter === "ALL" ||
        s.status === filter ||
        (filter === "pregnant" && (s.status === "pregnant" || s.breeding_status === "pregnant"));
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        s.id.toLowerCase().includes(q) ||
        s.breed.toLowerCase().includes(q) ||
        (s.breeding_method && s.breeding_method.toLowerCase().includes(q)) ||
        (s.boarTag && s.boarTag.toLowerCase().includes(q)) ||
        (s.pen_code && s.pen_code.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    })
    .sort((a, b) => {
      if (activeTab === "active") {
        // 1. Records that need action always appear at the very top
        const aAction = a.status === "action" ? 1 : 0;
        const bAction = b.status === "action" ? 1 : 0;
        if (bAction !== aAction) {
          return bAction - aAction;
        }

        // 2. Then sort by gestation day descending (closest to farrowing first)
        if (b.day !== a.day) {
          return b.day - a.day;
        }

        // 3. Fallback to newest mating date
        return new Date(b.matingDate || 0) - new Date(a.matingDate || 0);
      }

      // History tab: newest mating date first
      return new Date(b.matingDate || 0) - new Date(a.matingDate || 0);
    });

  const totalPregnant = sows.filter((s) => s.status === "pregnant" || s.breeding_status === "pregnant").length;
  const dueThisMonth = sows.filter((s) => s.day >= 90 && s.day <= GESTATION_DAYS).length;
  const actionRequired = sows.filter((s) => s.status === "action").length;
  const activeMatings = sows.length;

  return (
    <div className="brl-root">
      <style>{`
        .brl-root {
          --bg: transparent;
          --surface: #FFFFFF;
          --border: #E3E6DD;
          --ink: #1C2420;
          --ink-soft: #6B756C;
          --pine: #1F6F54;
          --pine-dark: #15503A;
          --pine-tint: #E3EFE9;
          --slate: #4A6B8A;
          --slate-tint: #E4EAF0;
          --wheat: #C98A3C;
          --wheat-tint: #F7ECD9;
          --brick: #B5473F;
          --brick-tint: #F5E3E1;
          --track: #EAEDE4;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          padding: 32px 36px 64px;
          box-sizing: border-box;
        }
        .brl-root * { box-sizing: border-box; }

        .brl-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        .brl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .brl-chip { border: 1px solid var(--border); background: var(--surface); color: var(--ink-soft); padding: 7px 14px; border-radius: 999px; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
        .brl-chip:hover { border-color: var(--pine); color: var(--pine); }
        .brl-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }

        .brl-search { position: relative; width: 250px; max-width: 100%; }
        .brl-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-soft); }
        .brl-search input { width: 100%; padding: 9px 12px 9px 36px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 13.5px; font-weight: 500; color: var(--ink); }
        .brl-search input:focus { outline: 2px solid var(--pine); outline-offset: 1px; }

        .brl-list { display: flex; flex-direction: column; gap: 14px; padding-bottom: 120px; }

        .brl-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; display: flex; gap: 18px; align-items: center; transition: box-shadow 0.15s ease, transform 0.15s ease; position: relative; }
        .brl-card:hover { box-shadow: 0 6px 20px rgba(28,36,32,0.07); transform: translateY(-1px); }

        .brl-ring { position: relative; width: 60px; height: 60px; }
        .brl-ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; gap: 1px; }
        .brl-ring-day { font-size: 15px; font-weight: 800; }
        .brl-ring-total { font-size: 9px; font-weight: 500; color: var(--ink-soft); }
        .brl-ring-unit { font-size: 9px; font-weight: 700; color: var(--ink-soft); letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.65; }

        .brl-card-main { flex: 1; min-width: 0; }
        .brl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .brl-sow-name { font-weight: 700; font-size: 17px; margin: 0; tracking: -0.01em; }
        .brl-sow-sub { font-size: 12.5px; font-weight: 500; color: var(--ink-soft); margin: 2px 0 0; }

        .brl-status-pill { font-size: 11.5px; font-weight: 700; padding: 4px 11px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
        .brl-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: brl-pulse 1.6s ease-in-out infinite; }
        @keyframes brl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @media (prefers-reduced-motion: reduce) { .brl-pulse-dot { animation: none; } }

        .brl-timeline { position: relative; height: 58px; margin: 6px 0 2px; }
        .brl-timeline-track { position: absolute; top: 16px; left: 0; right: 0; height: 4px; background: var(--track); border-radius: 999px; transform: translateY(-50%); }
        .brl-timeline-fill { position: absolute; top: 16px; left: 0; height: 4px; border-radius: 999px; transform: translateY(-50%); }
        .brl-stage { position: absolute; top: 0; display: flex; flex-direction: column; align-items: center; }
        .brl-stage-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--track); border: 2px solid var(--surface); margin-top: 11px; flex-shrink: 0; box-shadow: 0 0 0 1.5px var(--track); transition: all 0.2s ease; }
        .brl-stage-dot.done { background: var(--done-color, var(--pine)); box-shadow: 0 0 0 1.5px var(--done-color, var(--pine)); border-color: var(--surface); }
        .brl-stage-dot.current { width: 14px; height: 14px; margin-top: 9px; box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--current-color, var(--pine)); background: var(--current-color, var(--pine)); border-color: var(--surface); }
        .brl-stage-label { font-size: 10px; font-weight: 600; color: var(--ink-soft); margin-top: 6px; white-space: nowrap; line-height: 1; }
        .brl-stage-label.done { color: var(--ink); font-weight: 700; }
        .brl-stage-date { font-size: 9.5px; font-weight: 500; color: var(--ink-soft); margin-top: 2px; white-space: nowrap; line-height: 1; opacity: 0.75; }

        .brl-card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
        .brl-due { font-size: 12.5px; font-weight: 500; color: var(--ink-soft); }
        .brl-due strong { color: var(--ink); font-weight: 700; }

        .brl-menu-btn { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
        .brl-menu-btn:hover { background: var(--bg); color: var(--ink); }
        .brl-menu { 
          position: absolute; right: 16px; top: 52px; background: var(--surface); 
          border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(28,36,32,0.14); 
          z-index: 50; overflow: hidden; min-width: 160px; transform-origin: top right;
          animation: menuFadeIn 0.15s ease-out forwards;
        }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(-5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes menuFadeInUp {
          from { opacity: 0; transform: scale(0.95) translateY(5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .brl-menu button { width: 100%; text-align: left; padding: 9px 13px; font-size: 13.5px; font-weight: 600; background: none; border: none; cursor: pointer; color: var(--ink); }
        .brl-menu button:hover { background: var(--bg); }

        .brl-ghost { border: 1.5px dashed var(--border); border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--ink-soft); cursor: pointer; background: transparent; font-size: 13.5px; font-weight: 700; transition: border-color 0.15s ease, color 0.15s ease; }
        .brl-ghost:hover { border-color: var(--pine); color: var(--pine); }

        @media (max-width: 640px) {
          .brl-card { flex-direction: column; align-items: flex-start; }
          .brl-stage-label { display: none; }
        }

        /* --- Table View CSS --- */
        .brl-table-container { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: visible; box-shadow: 0 4px 12px rgba(28,36,32,0.03); }
        .brl-table { width: 100%; border-collapse: collapse; text-align: left; }
        .brl-table th { padding: 14px 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); border-bottom: 1px solid var(--border); background: var(--bg); }
        .brl-table td { padding: 16px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .brl-table tr:last-child td { border-bottom: none; }
        .brl-table tbody tr:hover { background: var(--slate-tint); opacity: 0.95; }
        
        .brl-table-sow { font-weight: 700; font-size: 14px; color: var(--ink); margin: 0; }
        .brl-table-sub { font-size: 11px; font-weight: 500; color: var(--ink-soft); margin-top: 2px; }
        .brl-table-timeline { display: flex; align-items: center; gap: 8px; }
        .brl-table-timeline-bar { flex: 1; height: 6px; background: var(--track); border-radius: 999px; overflow: hidden; max-width: 120px; }
        .brl-table-timeline-fill { height: 100%; border-radius: 999px; }
      `}</style>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          icon={Heart}
          label="Pregnant Sows"
          value={totalPregnant}
          unit={totalPregnant === 1 ? "sow" : "sows"}
          loading={loading}
        />
        <StatCard
          icon={CalendarClock}
          label="Upcoming Farrowings"
          value={dueThisMonth}
          unit={dueThisMonth === 1 ? "due this month" : "due this month"}
          unitColor={dueThisMonth > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}
          loading={loading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs Action"
          value={actionRequired}
          unit={actionRequired > 0 ? (actionRequired === 1 ? "action due" : "actions due") : "all normal"}
          unitColor={actionRequired > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}
          isAlert={actionRequired > 0}
          loading={loading}
        />
        <StatCard
          icon={Dna}
          label="Active Matings"
          value={activeMatings}
          unit={activeMatings === 1 ? "cycle" : "cycles"}
          loading={loading}
        />
      </div>

      {/* Controls */}
      <div className="mb-7 flex flex-col gap-4">
        
        {/* Top Row: Tabs, Search, and Add Button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tab Toggle */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl shrink-0">
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setActiveTab('active'); setFilter('ALL'); }}
            >
              Active Matings
            </button>
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setActiveTab('history'); setFilter('ALL'); }}
            >
              History
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-4 flex-1 lg:justify-end">
            <div className="brl-search w-full sm:w-auto">
              <Search size={15} />
              <input type="text" placeholder="Search sow ID or breed…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {/* View Toggle */}
            <div className="flex bg-slate-200/50 p-1 rounded-xl shrink-0 border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${viewMode === "card" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-900/5" : "text-slate-400 hover:text-slate-600"}`}
                title="Card View"
              >
                <LayoutGrid size={16} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${viewMode === "table" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-900/5" : "text-slate-400 hover:text-slate-600"}`}
                title="Table View"
              >
                <List size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Add New Button */}
            {activeTab === 'active' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors w-full sm:w-auto"
              >
                <Plus size={16} /> Log New Mating
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Filters (Only in Active Tab) */}
        {activeTab === 'active' && (
          <div className="flex items-center">
            <div className="brl-chips">
              <button className={`brl-chip ${filter === "ALL" ? "active" : ""}`} onClick={() => setFilter("ALL")}>All</button>
              <button className={`brl-chip ${filter === "pregnant" ? "active" : ""}`} onClick={() => setFilter("pregnant")}>Pregnant</button>
              <button className={`brl-chip ${filter === "monitoring" ? "active" : ""}`} onClick={() => setFilter("monitoring")}>Monitoring</button>
              <button className={`brl-chip ${filter === "action" ? "active" : ""}`} onClick={() => setFilter("action")}>Action required</button>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline list */}
      {viewMode === "table" ? (
        /* --- TABLE VIEW --- */
        <div key="table-view" className="brl-table-container mb-[120px] tab-enter">
          <div className="overflow-x-auto">
            <table className="brl-table">
              <thead>
                <tr>
                  <th>Sow Details</th>
                  <th>Gestation Day</th>
                  <th>Timeline</th>
                  <th>Expected Farrowing</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10">
                      <div className="flex justify-center mb-3"><div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div></div>
                      <span className="text-sm font-semibold text-slate-500">Loading records...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <span className="text-sm font-semibold text-slate-500">No sows found</span>
                    </td>
                  </tr>
                ) : (
                  filtered.map((sow, idx) => {
                    const meta = STATUS_META[sow.status];
                    const methodMeta = getBreedingMethodMeta(sow.breeding_method, sow.boarTag);
                    const overdue = sow.day > GESTATION_DAYS;
                    const fillPct = Math.min(100, (sow.day / GESTATION_DAYS) * 100);
                    const isNearBottom = idx >= filtered.length - 2;

                    return (
                      <tr key={sow.breeding_id || sow.id}>
                        <td>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="brl-table-sow">Sow #{sow.id}</p>
                            {methodMeta && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${methodMeta.badgeClass}`}
                                title={methodMeta.description}
                              >
                                <methodMeta.Icon className="w-2.5 h-2.5 shrink-0" />
                                <span>{methodMeta.label}</span>
                                {methodMeta.subLabel && (
                                  <span className="opacity-75 font-medium text-[9.5px]">· {methodMeta.subLabel}</span>
                                )}
                              </span>
                            )}
                          </div>
                          <p className="brl-table-sub">Parity: {sow.parity} • {sow.breed} • Pen: {sow.pen_code || 'Unassigned'}</p>
                        </td>
                        <td>
                          <span className="font-bold text-slate-800 text-sm">Day {overdue ? GESTATION_DAYS : sow.day}</span>
                          <span className="text-xs text-slate-400 font-medium"> / {GESTATION_DAYS}</span>
                        </td>
                        <td>
                          <div className="brl-table-timeline">
                            <div className="brl-table-timeline-bar">
                              <div className="brl-table-timeline-fill" style={{ width: `${fillPct}%`, background: overdue ? "var(--brick)" : meta.color }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: overdue ? "var(--brick)" : meta.color }}>
                              {Math.round(fillPct)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm font-semibold text-slate-800">{sow.dueDate}</span>
                          {overdue ? (
                            <p className="text-[10px] font-bold text-rose-600 uppercase mt-0.5">Overdue</p>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{GESTATION_DAYS - sow.day} days left</p>
                          )}
                        </td>
                        <td>
                          <span className="brl-status-pill" style={{ background: meta.tint, color: meta.color }}>
                            {sow.status === "action" && <span className="brl-pulse-dot" />}
                            {sow.status === "action" && sow.day >= 100
                              ? (sow.day > GESTATION_DAYS ? "Farrowing Overdue" : "Pre-Farrow Action")
                              : meta.label}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", position: "relative" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            {sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action') && (
                              <button
                                onClick={() => { setFarrowLogData(sow); setShowFarrowModal(true); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                                title="Log Farrowing"
                              >
                                <Sparkles size={13} />
                                Log Farrowing
                              </button>
                            )}
                            {!(sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action')) && sow.status !== 'pregnant' && sow.day >= 21 && (
                              <button
                                onClick={() => { setCheckLogData(sow); setShowCheckModal(true); }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer ${
                                  sow.status === 'action'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                                }`}
                                title={sow.day >= 25 ? 'Log Pregnancy Confirmation Check' : 'Log Heat Return Check'}
                              >
                                <CalendarCheck size={13} />
                                {sow.day >= 25 ? 'Log Preg Check' : 'Log Heat Check'}
                              </button>
                            )}
                            <button className="brl-menu-btn" onClick={() => {
                              const id = sow.breeding_id || sow.id;
                              setOpenMenu(openMenu === id ? null : id);
                            }}>
                              <MoreVertical size={16} />
                            </button>
                          </div>
                          {openMenu === (sow.breeding_id || sow.id) && (
                            <div className="brl-menu" style={{ right: 20, ...(isNearBottom ? { bottom: 40, top: 'auto' } : { top: 40 }) }}>
                              {sow.status !== 'pregnant' && sow.day >= 21 && (
                                <button onClick={() => { setCheckLogData(sow); setShowCheckModal(true); setOpenMenu(null); }}>Log new check</button>
                              )}
                              {sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action') && (
                                <button style={{ color: 'var(--pine)' }} onClick={() => { setFarrowLogData(sow); setShowFarrowModal(true); setOpenMenu(null); }}>
                                  Log farrowing
                                </button>
                              )}
                              <button onClick={() => { setEditLogData(sow); setShowEditModal(true); setOpenMenu(null); }}>Edit mating record</button>
                              <button onClick={() => { setAbortLogData(sow); setShowAbortModal(true); setOpenMenu(null); }} style={{ color: "var(--wheat)" }}>Report Miscarriage</button>
                              <button onClick={() => { setArchiveLogData(sow); setShowArchiveModal(true); setOpenMenu(null); }} style={{ color: "var(--brick)" }}>Archive record</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* --- CARD VIEW --- */
        <div key="card-view" className="brl-list tab-enter">
          {loading ? (
            <div className="flex flex-col gap-3.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="brl-card animate-pulse" style={{ pointerEvents: 'none' }}>
                  <div className="w-[60px] h-[60px] rounded-full bg-slate-100 shrink-0" />
                  <div className="flex-1 w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-5 w-32 bg-slate-200 rounded-md" />
                        <div className="h-3 w-48 bg-slate-100 rounded-md" />
                      </div>
                      <div className="h-6 w-24 bg-slate-100 rounded-full" />
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-semibold mb-1">No sows found</h3>
              <p className="text-sm">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            filtered.map((sow) => {
              const meta = STATUS_META[sow.status];
              const methodMeta = getBreedingMethodMeta(sow.breeding_method, sow.boarTag);
              const stageIdx = activeStageIndex(sow.day);
              const overdue = sow.day > GESTATION_DAYS;
              const fillPct = Math.min(100, (sow.day / GESTATION_DAYS) * 100);

              return (
                <div className="brl-card" key={sow.breeding_id || sow.id} style={{ zIndex: openMenu === (sow.breeding_id || sow.id) ? 20 : 1 }}>
                  <GestationRing day={sow.day} status={sow.status} />

                  <div className="brl-card-main">
                    <div className="brl-card-head">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="brl-sow-name">Sow #{sow.id}</p>
                          {methodMeta && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${methodMeta.badgeClass}`}
                              title={methodMeta.description}
                            >
                              <methodMeta.Icon className="w-3 h-3 shrink-0" />
                              <span>{methodMeta.label}</span>
                              {methodMeta.subLabel && (
                                <span className="opacity-75 font-medium text-[10.5px]">· {methodMeta.subLabel}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <p className="brl-sow-sub">{sow.parity === 1 ? "1st" : sow.parity === 2 ? "2nd" : sow.parity === 3 ? "3rd" : `${sow.parity}th`} parity · {sow.breed} · Pen: {sow.pen_code || 'Unassigned'}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {/* ── Inline Quick Action Button ── */}
                        {sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action') && (
                          <button
                            onClick={() => { setFarrowLogData(sow); setShowFarrowModal(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                            title="Log Farrowing Delivery"
                          >
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            Log Farrowing
                          </button>
                        )}
                        {!(sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action')) && sow.status !== 'pregnant' && sow.day >= 21 && (
                          <button
                            onClick={() => { setCheckLogData(sow); setShowCheckModal(true); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                              sow.status === 'action'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                            title={sow.day >= 25 ? 'Log Pregnancy Confirmation Check' : 'Log Heat Return Check'}
                          >
                            <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                            {sow.day >= 25 ? 'Log Preg Check' : 'Log Heat Check'}
                          </button>
                        )}

                        <span className="brl-status-pill" style={{ background: meta.tint, color: meta.color }}>
                          {sow.status === "action" && <span className="brl-pulse-dot" />}
                          {sow.status === "action" && sow.day >= 100
                            ? (sow.day > GESTATION_DAYS ? "Farrowing Overdue" : "Pre-Farrow Action")
                            : meta.label}
                        </span>
                        {activeTab === 'active' && (
                          <div style={{ position: "relative" }}>
                            <button className="brl-menu-btn" onClick={() => {
                              const id = sow.breeding_id || sow.id;
                              setOpenMenu(openMenu === id ? null : id);
                            }}>
                              <MoreVertical size={16} />
                            </button>
                            {openMenu === (sow.breeding_id || sow.id) && (
                              <div className="brl-menu">
                                {sow.status !== 'pregnant' && sow.day >= 21 && (
                                  <button onClick={() => { setCheckLogData(sow); setShowCheckModal(true); setOpenMenu(null); }}>Log new check</button>
                                )}
                                {sow.day >= 100 && (sow.status === 'pregnant' || sow.status === 'action') && (
                                  <button style={{ color: 'var(--pine)' }} onClick={() => { setFarrowLogData(sow); setShowFarrowModal(true); setOpenMenu(null); }}>
                                    Log farrowing
                                  </button>
                                )}
                                <button onClick={() => { setEditLogData(sow); setShowEditModal(true); setOpenMenu(null); }}>Edit mating record</button>
                                <button onClick={() => { setAbortLogData(sow); setShowAbortModal(true); setOpenMenu(null); }} style={{ color: "var(--wheat)" }}>Report Miscarriage</button>
                                <button onClick={() => { setArchiveLogData(sow); setShowArchiveModal(true); setOpenMenu(null); }} style={{ color: "var(--brick)" }}>Archive record</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="brl-timeline">
                      <div className="brl-timeline-track" />
                      <div className="brl-timeline-fill" style={{ width: `${fillPct}%`, background: overdue ? "var(--brick)" : meta.color }} />
                      {STAGES.map((stage, i) => {
                        const done = sow.day >= stage.day;
                        const isCurrent = i === stageIdx && !overdue;
                        const dotColor = overdue ? "var(--brick)" : meta.color;
                        const isFirst = i === 0;
                        const isLast = i === STAGES.length - 1;
                        const milestoneDate = getMilestoneDate(sow.matingDate, stage.day);
                        return (
                          <div
                            key={stage.label}
                            className="brl-stage"
                            style={{
                              left: isLast ? "auto" : `${(stage.day / GESTATION_DAYS) * 100}%`,
                              right: isLast ? "0" : "auto",
                              transform: isFirst ? "translateX(0)" : isLast ? "translateX(0)" : "translateX(-50%)",
                              alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center",
                            }}
                          >
                            <div
                              className={`brl-stage-dot ${done ? "done" : ""} ${isCurrent ? "current" : ""}`}
                              style={{
                                "--done-color": dotColor,
                                "--current-color": dotColor,
                              }}
                            />
                            <span className={`brl-stage-label ${done ? "done" : ""}`}>{stage.label}</span>
                            {milestoneDate && (
                              <span className="brl-stage-date">{milestoneDate}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="brl-card-foot">
                      <span className="brl-due">
                        {overdue
                          ? <>Overdue by <strong style={{ color: "var(--brick)" }}>{sow.day - GESTATION_DAYS} days</strong></>
                          : <>Expected farrowing: <strong>{sow.dueDate}</strong> · {GESTATION_DAYS - sow.day} days to go</>}
                      </span>
                    </div>
                  </div>
                </div>
            );
          })
        )}
        </div>
      )}

      {/* Add Breeding Log Modal */}
      <AddBreedingLogModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        loggedInUser={loggedInUser}
        onSaved={() => {
          refreshLogs();
        }}
      />

      {/* Edit Breeding Log Modal */}
      <EditBreedingLogModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        loggedInUser={loggedInUser}
        initialData={editLogData}
        onSaved={() => {
          refreshLogs();
        }}
      />

      {/* Log Check Modal */}
      <LogCheckModal
        isOpen={showCheckModal}
        onClose={() => setShowCheckModal(false)}
        loggedInUser={loggedInUser}
        initialData={checkLogData}
        onSaved={() => {
          refreshLogs();
        }}
      />

      <LogFarrowingModal
        isOpen={showFarrowModal}
        onClose={() => {
          setShowFarrowModal(false);
          setFarrowLogData(null);
        }}
        onSaved={refreshLogs}
        onRegisterPiglets={(farrowDate) => {
          if (farrowLogData) {
            setPigletInitialData({
              sowId: farrowLogData.sow_id,
              penId: farrowLogData.pen_id || "",
              dateOfBirth: farrowDate || "",
            });
          }
          setShowPigletModal(true);
        }}
        loggedInUser={loggedInUser}
        initialData={farrowLogData}
      />

      <AddPigletBatchModal
        isOpen={showPigletModal}
        onClose={() => {
          setShowPigletModal(false);
          setFarrowLogData(null);
          setPigletInitialData(null);
        }}
        initialData={pigletInitialData}
        onSave={handleSaveBatch}
      />

      {/* Archive Modal */}
      <ArchiveBreedingLogModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setArchiveLogData(null);
        }}
        onConfirm={confirmArchive}
        sowTag={archiveLogData?.tag || archiveLogData?.id}
        isArchiving={isArchiving}
      />

      <ReportMiscarriageModal
        isOpen={showAbortModal}
        onClose={() => {
          setShowAbortModal(false);
          setAbortLogData(null);
        }}
        sowTag={abortLogData?.tag || abortLogData?.id}
        isSubmitting={isAborting}
        onConfirm={() => abortLogData && handleAbort(abortLogData.breeding_id)}
      />
    </div>
  );
}
