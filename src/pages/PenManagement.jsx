import React, { useState, useEffect, useCallback } from "react";
import {
  PiggyBank,
  Gauge,
  Grid3X3,
  ArrowRightLeft,
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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
  const [activeSection, setActiveSection] = useState("ALL"); // pen type filter
  const [statusFilter, setStatusFilter] = useState("ALL");   // availability filter
  const [addSlot, setAddSlot] = useState(null);              // layout slot being set up
  const [editingPen, setEditingPen] = useState(null);
  const [archivingPen, setArchivingPen] = useState(null);
  const [viewingPen, setViewingPen] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
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

  const statusCounts = pens.reduce((acc, p) => {
    const k = getPenStatus(p).key;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

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
      {/* Stats Grid at the very top */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Grid3X3 className="w-6 h-6 text-emerald-600" />}
          label="Pens In Service"
          value={`${inServicePens.length} / ${pens.length}`}
          badge={outOfServiceCount > 0 ? `${outOfServiceCount} OUT` : "PENS"}
          badgeColor={outOfServiceCount > 0 ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}
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

      {/* Streamlined Filter Chips & Actions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Filter Rows */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-20 shrink-0">Pen type</span>
            <button type="button" onClick={() => setActiveSection("ALL")} className={chipClass(activeSection === "ALL")}>
              All Types
            </button>
            {Object.entries(SECTIONS).map(([key, s]) => (
              <button key={key} type="button" onClick={() => setActiveSection(key)} className={chipClass(activeSection === key)}>
                {s.short}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-20 shrink-0">Availability</span>
            <button type="button" onClick={() => setStatusFilter("ALL")} className={chipClass(statusFilter === "ALL")}>
              All
            </button>
            {STATUS_LEGEND.map((s) => (
              <button key={s.key} type="button" onClick={() => setStatusFilter(s.key)} className={chipClass(statusFilter === s.key)}>
                {s.label} ({statusCounts[s.key] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          id="transfer-swine"
          type="button"
          onClick={() => setShowTransferModal(true)}
          className="self-start md:self-center flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm"
        >
          <ArrowRightLeft className="w-4 h-4" strokeWidth={2.5} /> Transfer Swine
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
      />

      {showTransferModal && (
        <SwineTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          pens={pens}
          onSuccess={fetchPens}
          user={loggedInUser}
        />
      )}
    </div>
  );
}