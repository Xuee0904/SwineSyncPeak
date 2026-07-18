import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  MoreVertical,
  Search,
  Copy,
  Check,
  Pencil,
  Trash2,
  Eye,
  X,
  PiggyBank,
  Gauge,
  Grid3X3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import toast from "../utils/toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// ---- Sections mapping & styling (Client-approved types) ------------
const SECTIONS = {
  B: { label: "Boar Pen", desc: "Max capacity: 1 (Solitary)", color: "text-blue-800", bg: "bg-blue-50 border-blue-200/60", defaultCapacity: 1 },
  S: { label: "Sow Pen", desc: "Gestation & Farrowing", color: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200/60", defaultCapacity: 10 },
  W: { label: "Weaned / Fattening", desc: "Growing & Finishing", color: "text-amber-800", bg: "bg-amber-50 border-amber-200/60", defaultCapacity: 20 },
  Q: { label: "Quarantine / Isolation", desc: "Sick & Observation", color: "text-rose-800", bg: "bg-rose-50 border-rose-200/60", defaultCapacity: 5 },
};

function getStatus(occupancy, capacity) {
  if (occupancy <= 0) return { label: "Empty", tone: "empty", badgeClass: "bg-slate-100 text-slate-600 border-slate-200/60" };
  const pct = capacity > 0 ? occupancy / capacity : 0;
  if (pct >= 1) return { label: "At capacity", tone: "full", badgeClass: "bg-rose-50 text-rose-700 border-rose-200/60" };
  if (pct >= 0.85) return { label: "Near capacity", tone: "warn", badgeClass: "bg-amber-50 text-amber-700 border-amber-200/60" };
  return { label: "Available", tone: "ok", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/60" };
}

function truncateId(id) {
  if (!id) return "N/A";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
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

export default function PenManagement({ loggedInUser }) {
  const [pens, setPens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const menuRef = useRef(null);

  // Form states for modal
  const [newPenCode, setNewPenCode] = useState("");
  const [newPenSection, setNewPenSection] = useState("S");
  const [newPenCapacity, setNewPenCapacity] = useState("10");

  const fetchPens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/all`);
      if (!res.ok) throw new Error("Failed to load pens data.");
      const json = await res.json();
      setPens(json.data || []);
    } catch (error) {
      console.error("Error fetching pens:", error);
      toast.error("Failed to fetch pens data from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPens();
  }, [fetchPens]);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredPens = pens.filter((p) => {
    const matchesSection = activeSection === "ALL" || p.section === activeSection;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q === "" ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q));
    return matchesSection && matchesQuery;
  });

  const totalCapacity = pens.reduce((sum, p) => sum + Number(p.capacity || 0), 0);
  const totalOccupancy = pens.reduce((sum, p) => sum + Number(p.occupancy || 0), 0);
  const utilization = totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

  function copyId(id) {
    if (!id) return;
    try {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      /* ignore */
    }
  }

  const handleAddPen = async (e) => {
    e.preventDefault();
    if (!newPenCode.trim()) {
      toast.error("Please enter a valid pen code");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newPenCode.trim().toUpperCase(),
          section: newPenSection,
          capacity: newPenSection === "B" ? 1 : (Number(newPenCapacity) || SECTIONS[newPenSection]?.defaultCapacity || 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pen.");

      toast.success(`Added pen ${newPenCode.trim().toUpperCase()}`);
      setShowAddModal(false);
      setNewPenCode("");
      setNewPenSection("S");
      setNewPenCapacity("10");
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error creating pen.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePen = async (id, code) => {
    try {
      const res = await fetch(`${API_BASE}/api/pens/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete pen.");
      setOpenMenu(null);
      toast.success(`${code || "Pen"} has been deleted.`);
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error deleting pen.");
    }
  };

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in font-sans text-slate-800">
      {/* Stats Grid at the very top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Grid3X3 className="w-6 h-6 text-emerald-600" />}
          label="Total Pens"
          value={pens.length}
          badge="PENS"
          badgeColor="bg-emerald-100 text-emerald-700"
          accentColor="bg-emerald-50"
          loading={loading}
        />
        <StatCard
          icon={<PiggyBank className="w-6 h-6 text-amber-500" />}
          label="Pigs Housed / Capacity"
          value={`${totalOccupancy} / ${totalCapacity}`}
          badge="OCCUPANCY"
          badgeColor="bg-amber-100 text-amber-600"
          accentColor="bg-amber-50"
          loading={loading}
        />
        <StatCard
          icon={<Gauge className={`w-6 h-6 ${utilization >= 90 ? "text-rose-600" : "text-indigo-600"}`} />}
          label="Facility Utilization"
          value={`${utilization}%`}
          badge={utilization >= 90 ? "CRITICAL" : "OPTIMAL"}
          badgeColor={utilization >= 90 ? "bg-rose-500 text-white" : "bg-indigo-100 text-indigo-700"}
          accentColor={utilization >= 90 ? "bg-rose-50" : "bg-indigo-50"}
          bg={utilization >= 90 ? "bg-rose-50/60" : "bg-white"}
          loading={loading}
        />
      </div>

      {/* Filter Chips, Search Bar & Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSection("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            }`}
          >
            All Sections
          </button>
          {Object.entries(SECTIONS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSection === key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeSection === key ? "bg-emerald-400" : "bg-slate-400"}`} />
              {s.label} ({key})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search pen code or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={fetchPens}
            disabled={loading}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Pens"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Pen
          </button>
        </div>
      </div>

      {/* Pen Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-5 w-20 bg-slate-100 rounded-lg" />
                <div className="h-4 w-4 bg-slate-100 rounded" />
              </div>
              <div className="h-6 w-28 bg-slate-100 rounded-md" />
              <div className="h-3 w-40 bg-slate-100 rounded" />
              <div className="h-2 bg-slate-100 rounded-full w-full" />
              <div className="flex justify-between items-center pt-2">
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-5 w-16 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPens.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            <Grid3X3 className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Pens Found</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {query || activeSection !== "ALL"
              ? "Try adjusting your section filter or search terms."
              : "No pen records exist in the database yet. Click 'Add Pen' to create your first facility pen."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPens.map((pen) => {
            const section = SECTIONS[pen.section] || SECTIONS.S || { label: pen.section || "Sow Pen", color: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200/60" };
            const status = getStatus(pen.occupancy, pen.capacity);
            const pct = pen.capacity > 0 ? Math.min(100, Math.round((pen.occupancy / pen.capacity) * 100)) : 0;

            const barColor =
              status.tone === "full"
                ? "bg-rose-500"
                : status.tone === "warn"
                ? "bg-amber-500"
                : status.tone === "empty"
                ? "bg-slate-300"
                : "bg-emerald-500";

            return (
              <div
                key={pen.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 transition-all duration-200 p-5 relative flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Section Badge & Dropdown */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase border ${section.bg} ${section.color}`}>
                      {section.label} ({pen.section})
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu(openMenu === pen.id ? null : pen.id)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenu === pen.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[150px] py-1 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenMenu(null)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" /> View details
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenMenu(null)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" /> Edit pen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePen(pen.id, pen.code)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete pen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Code */}
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{pen.code}</h3>

                  {/* Progress Bar Track */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden my-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Occupancy & Status Badge */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50/80 mt-1">
                  <div className="text-xs font-bold text-slate-800">
                    {pen.occupancy} <span className="font-normal text-slate-400">/ {pen.capacity} pigs</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${status.badgeClass}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Ghost Card to Add New Pen */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/20 cursor-pointer transition-all duration-200 min-h-[190px] group active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-50 group-hover:bg-emerald-100/60 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <span className="font-bold text-xs tracking-wide">Add New Pen</span>
          </button>
        </div>
      )}

      {/* Portal-based Add Pen Modal matching system design */}
      {showAddModal &&
        createPortal(
          <div
            className="fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) setShowAddModal(false);
            }}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/60 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                    <Grid3X3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">Add New Pen</h3>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Configure pen facility</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddPen} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Pen Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    placeholder="e.g. PEN-A3"
                    value={newPenCode}
                    onChange={(e) => setNewPenCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Section (Pen Type) *
                  </label>
                  <select
                    value={newPenSection}
                    disabled={submitting}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewPenSection(val);
                      if (val === "B") {
                        setNewPenCapacity("1");
                      } else {
                        setNewPenCapacity(String(SECTIONS[val]?.defaultCapacity || 10));
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {Object.entries(SECTIONS).map(([key, s]) => (
                      <option key={key} value={key}>
                        {s.label} ({key}) — {s.desc}
                      </option>
                    ))}
                  </select>
                  {SECTIONS[newPenSection]?.desc && (
                    <p className="text-[11px] font-medium text-slate-500 mt-1">
                      ℹ️ {SECTIONS[newPenSection].desc}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Capacity (Pigs) *
                  </label>
                  <input
                    type="number"
                    required
                    disabled={submitting || newPenSection === "B"}
                    min="1"
                    placeholder="e.g. 10"
                    value={newPenSection === "B" ? "1" : newPenCapacity}
                    onChange={(e) => setNewPenCapacity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {newPenSection === "B" && (
                    <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                      <span>⚠️ Max capacity is locked to 1 since boars fight other pigs.</span>
                    </p>
                  )}
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {submitting ? "Saving..." : "Save Pen"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}