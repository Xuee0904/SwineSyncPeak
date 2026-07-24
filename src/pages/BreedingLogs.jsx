import React, { useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  CalendarClock,
  Heart,
  AlertTriangle,
  Baby,
  Activity,
} from "lucide-react";
import AddBreedingLogModal from "../components/BreedingLogs/AddBreedingLogModal";
import EditBreedingLogModal from "../components/BreedingLogs/EditBreedingLogModal";
import LogCheckModal from "../components/BreedingLogs/LogCheckModal";
import ArchiveBreedingLogModal from "../components/BreedingLogs/ArchiveBreedingLogModal";
import LogFarrowingModal from "../components/BreedingLogs/LogFarrowingModal";
import AddPigletBatchModal from "../components/SwineManagement/AddPigletBatchModal";
import toast from "../utils/toast";

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

// MatingDate is dynamically pulled from the backend using the pig's creation date (fallback).

function getMilestoneDate(matingDateStr, daysOffset) {
  if (!matingDateStr) return null;
  const d = new Date(matingDateStr);
  d.setDate(d.getDate() + daysOffset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || "bg-white"} p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || "bg-slate-50"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
          )}
          {badge && !loading && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor || "bg-slate-100 text-slate-600"}`}>
              {badge}
            </span>
          )}
        </div>
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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
  const [activeTab, setActiveTab] = useState("active");

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
      toast.success("Breeding record archived successfully!");
      setShowArchiveModal(false);
      setArchiveLogData(null);
      refreshLogs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAbort = async (breeding_id) => {
    if (!window.confirm("Are you sure you want to report a miscarriage? This will mark the cycle as failed and return the sow to Healthy status.")) return;
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
    }
  };

  const filtered = sows.filter((s) => {
    const matchesFilter = filter === "ALL" || s.status === filter;
    const q = query.trim().toLowerCase();
    const matchesQuery = q === "" || s.id.toLowerCase().includes(q) || s.breed.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  const totalPregnant = sows.filter((s) => s.status === "pregnant").length;
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

        .brl-list { display: flex; flex-direction: column; gap: 14px; }

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
        .brl-menu { position: absolute; right: 16px; top: 52px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(28,36,32,0.14); z-index: 10; overflow: hidden; min-width: 150px; }
        .brl-menu button { width: 100%; text-align: left; padding: 9px 13px; font-size: 13.5px; font-weight: 600; background: none; border: none; cursor: pointer; color: var(--ink); }
        .brl-menu button:hover { background: var(--bg); }

        .brl-ghost { border: 1.5px dashed var(--border); border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--ink-soft); cursor: pointer; background: transparent; font-size: 13.5px; font-weight: 700; transition: border-color 0.15s ease, color 0.15s ease; }
        .brl-ghost:hover { border-color: var(--pine); color: var(--pine); }

        @media (max-width: 640px) {
          .brl-card { flex-direction: column; align-items: flex-start; }
          .brl-stage-label { display: none; }
        }
      `}</style>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          icon={<Heart className="w-6 h-6 text-emerald-600" />}
          label="Pregnant Sows"
          value={totalPregnant}
          badge="HEALTHY"
          badgeColor="bg-emerald-100 text-emerald-700"
          accentColor="bg-emerald-50"
        />
        <StatCard
          icon={<CalendarClock className="w-6 h-6 text-amber-500" />}
          label="Upcoming Farrowings"
          value={dueThisMonth}
          badge="PENDING"
          badgeColor="bg-amber-100 text-amber-700"
          accentColor="bg-amber-50"
        />
        <StatCard
          icon={<AlertTriangle className={`w-6 h-6 ${actionRequired ? "text-rose-600" : "text-slate-400"}`} />}
          label="Needs Action"
          value={actionRequired}
          badge={actionRequired ? "CRITICAL" : "OK"}
          badgeColor={actionRequired ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}
          accentColor={actionRequired ? "bg-rose-50" : "bg-slate-50"}
          bg={actionRequired ? "bg-rose-50/60" : "bg-white"}
        />
        <StatCard
          icon={<Activity className="w-6 h-6 text-indigo-500" />}
          label="Active Matings"
          value={activeMatings}
          badge="TOTAL"
          badgeColor="bg-indigo-100 text-indigo-700"
          accentColor="bg-indigo-50"
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
      <div className="brl-list">
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
            const stageIdx = activeStageIndex(sow.day);
            const overdue = sow.day > GESTATION_DAYS;
            const fillPct = Math.min(100, (sow.day / GESTATION_DAYS) * 100);

            return (
              <div className="brl-card" key={sow.id} style={{ zIndex: openMenu === sow.id ? 20 : 1 }}>
                <GestationRing day={sow.day} status={sow.status} />

                <div className="brl-card-main">
                  <div className="brl-card-head">
                    <div>
                      <p className="brl-sow-name">Sow #{sow.id}</p>
                      <p className="brl-sow-sub">{sow.parity === 1 ? "1st" : sow.parity === 2 ? "2nd" : sow.parity === 3 ? "3rd" : `${sow.parity}th`} parity · {sow.breed}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="brl-status-pill" style={{ background: meta.tint, color: meta.color }}>
                        {sow.status === "action" && <span className="brl-pulse-dot" />}
                        {meta.label}
                      </span>
                      {activeTab === 'active' && (
                        <div style={{ position: "relative" }}>
                          <button className="brl-menu-btn" onClick={() => setOpenMenu(openMenu === sow.id ? null : sow.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {openMenu === sow.id && (
                            <div className="brl-menu">
                              <button onClick={() => setOpenMenu(null)}>View full log</button>
                              <button onClick={() => { setCheckLogData(sow); setShowCheckModal(true); setOpenMenu(null); }}>Log new check</button>
                              {(sow.status === 'pregnant' || sow.status === 'action' || sow.day >= 100) && (
                                <button style={{ color: 'var(--pine)' }} onClick={() => { setFarrowLogData(sow); setShowFarrowModal(true); setOpenMenu(null); }}>
                                  Log farrowing
                                </button>
                              )}
                              <button onClick={() => { setEditLogData(sow); setShowEditModal(true); setOpenMenu(null); }}>Edit mating record</button>
                              <button onClick={() => { handleAbort(sow.breeding_id); setOpenMenu(null); }} style={{ color: "var(--wheat)" }}>Report Miscarriage</button>
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

      {/* Add Breeding Log Modal */}
      <AddBreedingLogModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        loggedInUser={loggedInUser}
        onSaved={() => {
          toast.success("Breeding log saved successfully!");
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
          toast.success("Breeding log updated successfully!");
          setShowEditModal(false);
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
          toast.success("Milestone check recorded successfully!");
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
          if (!isArchiving) {
            setShowArchiveModal(false);
            setArchiveLogData(null);
          }
        }}
        onConfirm={confirmArchive}
        sowTag={archiveLogData?.tag || archiveLogData?.id}
        isArchiving={isArchiving}
      />
    </div>
  );
}
