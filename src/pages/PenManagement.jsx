import React, { useState, useEffect, useCallback } from "react";
import {
  Grid3X3,
  ArrowRightLeft,
  Users,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import toast from "../utils/toast";
import AddPenModal from "../components/PenManagement/AddPenModal";
import SwineTransferModal from "../components/PenManagement/SwineTransferModal";
import EditPenModal from "../components/PenManagement/EditPenModal";
import ArchivePenModal from "../components/PenManagement/ArchivePenModal";
import ViewPenModal from "../components/PenManagement/ViewPenModal";
import FarmMap from "../components/PenManagement/FarmMap";
import { ALL_SLOTS } from "../config/farmLayout";
import {
  SECTIONS,
  getPenStatus,
  STATUS_LEGEND,
  isAdminUser,
} from "../components/PenManagement/penStatus";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function StatCard({
  label,
  value,
  unit,
  badge,
  badgeColor,
  icon,
  iconBg,
  iconColor,
  alert,
  alertBorder,
  loading,
}) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200/70 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[96px]">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
          <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="h-7 w-24 bg-slate-100 animate-pulse rounded mt-1" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[96px] ${
        alert
          ? alertBorder || "border-rose-200/90 ring-1 ring-rose-100/70"
          : "border-slate-200/70"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
            iconBg || (alert ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500")
          } ${iconColor || ""}`}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
        {badge && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1 shrink-0 ${
              badgeColor || "text-slate-600 bg-slate-100 border border-slate-200"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PenManagement({ loggedInUser }) {
  const [pens, setPens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("ALL"); // pen type filter
  const [statusFilter, setStatusFilter] = useState("ALL");   // availability filter
  const [addSlot, setAddSlot] = useState(null);              // layout slot being set up
  const [editingPen, setEditingPen] = useState(null);
  const [archivingPen, setArchivingPen] = useState(null);
  const [viewingPen, setViewingPen] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourcePenId, setTransferSourcePenId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const isAdmin = isAdminUser(loggedInUser);

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

  const inServicePens = pens.filter((p) => !p.is_archived);
  const outOfServiceCount = pens.length - inServicePens.length;

  // Out-of-service pens are excluded from capacity & utilization
  const totalCapacity = inServicePens.reduce((sum, p) => sum + Number(p.capacity || 0), 0);
  const totalOccupancy = inServicePens.reduce((sum, p) => sum + Number(p.occupancy || 0), 0);
  const utilization = totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;
  const availableSlots = Math.max(0, totalCapacity - totalOccupancy);

  const statusCounts = pens.reduce((acc, p) => {
    const k = getPenStatus(p).key;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const vacantPensCount = statusCounts["vacant"] || 0;

  /* ─── Handlers ─────────────────────────────────────────────── */
  const handleAddPen = async ({ code, section, capacity, onSuccess }) => {
    if (!code.trim()) {
      toast.error("Please enter a valid pen code");
      return;
    }
    setSubmitting(true);
    try {
      const finalCapacity = section === "B" ? 1 : (Number(capacity) || SECTIONS[section]?.defaultCapacity || 10);
      const res = await fetch(`${API_BASE}/api/pens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          section: section,
          capacity: finalCapacity,
          creator: loggedInUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pen.");

      if (typeof onSuccess === "function") {
        onSuccess({ code: code.trim().toUpperCase(), section, capacity: finalCapacity });
      } else {
        setAddSlot(null);
      }
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error creating pen.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitializeLayout = async () => {
    const existing = new Set(pens.map((p) => String(p.code || "").toUpperCase()));
    const missing = ALL_SLOTS.filter((s) => !existing.has(s.code)).map((s) => ({
      code: s.code,
      section: s.defaultSection,
      capacity: s.defaultCapacity,
    }));
    if (missing.length === 0) {
      toast.success("All farm pens are already set up.");
      return;
    }
    setInitializing(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pens: missing, creator: loggedInUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize farm layout.");
      toast.success(`Farm layout initialized: ${data.created ?? missing.length} pen(s) created.`);
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error initializing farm layout.");
    } finally {
      setInitializing(false);
    }
  };

  const handleUpdatePen = async ({ id, code, section, capacity, onSuccess }) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          section,
          capacity,
          creator: loggedInUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update pen.");

      if (typeof onSuccess === "function") {
        onSuccess({ code: code.trim().toUpperCase(), section, capacity });
      } else {
        setEditingPen(null);
      }
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error updating pen.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchivePen = async ({ id, code, reason, onSuccess }) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/${id}/archive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: loggedInUser,
          code,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set pen out of service.");

      if (typeof onSuccess === "function") {
        onSuccess({ code });
      } else {
        setArchivingPen(null);
      }
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error setting pen out of service.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnarchivePen = async (id, code) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/${id}/unarchive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: loggedInUser,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to return pen to service.");

      toast.success(`${code || "Pen"} is back in service.`);
      fetchPens();
    } catch (err) {
      toast.error(err.message || "Error returning pen to service.");
    } finally {
      setSubmitting(false);
    }
  };

  const chipClass = (active) =>
    `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${active
      ? "bg-slate-900 text-white shadow-sm"
      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
    }`;

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in font-sans text-slate-800">
      {/* ─── LIVE STAT STRIP (Dashboard-Style 4-Card Grid) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Pens In Service */}
        <StatCard
          label="Pens In Service"
          value={inServicePens.length}
          unit={`/ ${pens.length} active`}
          icon={<Grid3X3 className="w-4 h-4" />}
          alert={outOfServiceCount > 0}
          alertBorder="border-amber-200/90 ring-1 ring-amber-100/70"
          badge={outOfServiceCount > 0 ? `${outOfServiceCount} maintenance` : null}
          badgeColor="text-amber-700 bg-amber-50 border border-amber-200"
          iconBg={outOfServiceCount > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}
          loading={loading}
        />

        {/* 2. Total Pigs Housed */}
        <StatCard
          label="Pigs Housed"
          value={totalOccupancy}
          unit="heads"
          badge={utilization >= 90 ? `${utilization}% near cap` : null}
          badgeColor="text-rose-700 bg-rose-50 border border-rose-200"
          icon={<Users className="w-4 h-4" />}
          alert={utilization >= 90}
          alertBorder="border-rose-200/90 ring-1 ring-rose-100/70"
          iconBg={utilization >= 90 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"}
          loading={loading}
        />

        {/* 3. Available Capacity */}
        <StatCard
          label="Available Capacity"
          value={availableSlots}
          unit="slots free"
          badge={availableSlots === 0 ? "at capacity" : null}
          badgeColor="text-rose-700 bg-rose-50 border border-rose-200"
          icon={<TrendingUp className="w-4 h-4" />}
          alert={availableSlots === 0}
          alertBorder="border-rose-200/90 ring-1 ring-rose-100/70"
          iconBg={availableSlots === 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"}
          loading={loading}
        />

        {/* 4. Vacant Pens */}
        <StatCard
          label="Vacant Pens"
          value={vacantPensCount}
          unit="pens ready"
          icon={<Sparkles className="w-4 h-4" />}
          iconBg="bg-slate-50 text-slate-500"
          loading={loading}
        />
      </div>

      {/* Streamlined Filter Chips & Actions (Single-Row Consolidated Bar) */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs p-3.5 sm:p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
        {/* Filters Container */}
        <div className="flex flex-wrap items-center gap-y-2.5 gap-x-4">
          {/* Pen Type */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-0.5">
              Type:
            </span>
            <button
              type="button"
              onClick={() => setActiveSection("ALL")}
              className={chipClass(activeSection === "ALL")}
            >
              All
            </button>
            {Object.entries(SECTIONS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={chipClass(activeSection === key)}
              >
                {s.short}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0 mx-1" />

          {/* Availability Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-0.5">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={chipClass(statusFilter === "ALL")}
            >
              All
            </button>
            {STATUS_LEGEND.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatusFilter(s.key)}
                className={chipClass(statusFilter === s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          id="transfer-swine"
          type="button"
          onClick={() => {
            setTransferSourcePenId("");
            setShowTransferModal(true);
          }}
          className="self-start xl:self-center flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs hover:shadow-sm"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> Transfer Swine
        </button>
      </div>

      {/* ═══ FARM MAP ═══ */}
      <FarmMap
        pens={pens}
        loading={loading}
        isAdmin={isAdmin}
        activeSection={activeSection}
        statusFilter={statusFilter}
        onPenClick={(p) => setViewingPen(p)}
        onAddSlot={(slot) => setAddSlot(slot)}
        onInitialize={handleInitializeLayout}
        initializing={initializing}
      />

      {/* Add Pen Modal – only opened from an empty map slot (code locked) */}
      <AddPenModal
        isOpen={Boolean(addSlot)}
        onClose={() => setAddSlot(null)}
        onAdd={handleAddPen}
        sections={SECTIONS}
        submitting={submitting}
        presetCode={addSlot?.code}
        presetSection={addSlot?.defaultSection}
        presetCapacity={addSlot?.defaultCapacity}
      />

      <EditPenModal
        isOpen={Boolean(editingPen)}
        onClose={() => setEditingPen(null)}
        onUpdate={handleUpdatePen}
        pen={editingPen}
        sections={SECTIONS}
        submitting={submitting}
      />

      <ArchivePenModal
        isOpen={Boolean(archivingPen)}
        onClose={() => setArchivingPen(null)}
        onArchive={handleArchivePen}
        pen={archivingPen}
        submitting={submitting}
      />

      <ViewPenModal
        isOpen={Boolean(viewingPen)}
        onClose={() => setViewingPen(null)}
        pen={viewingPen}
        sections={SECTIONS}
        loggedInUser={loggedInUser}
        isAdmin={isAdmin}
        onEdit={(updatedPen, wasSaved) => {
          if (wasSaved) {
            fetchPens();
          }
        }}
        onArchive={(p) => setArchivingPen(p)}
        onReturnToService={(p) => {
          setViewingPen(null);
          handleUnarchivePen(p.id, p.code);
        }}
        onTransferSwine={(p) => {
          setViewingPen(null);
          setTransferSourcePenId(p.id);
          setShowTransferModal(true);
        }}
      />

      {showTransferModal && (
        <SwineTransferModal
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setTransferSourcePenId("");
          }}
          pens={pens}
          onSuccess={fetchPens}
          user={loggedInUser}
          initialSourcePenId={transferSourcePenId}
        />
      )}
    </div>
  );
}