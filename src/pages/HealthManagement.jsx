import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Download,
  Syringe,
  CalendarClock,
  AlertTriangle,
  Stethoscope,
  ChevronDown,
  SlidersHorizontal,
  Skull,
  ClipboardList,
  ArrowUpRight,
  Pencil,
} from "lucide-react";
import { toast } from "../utils/toast";
import VaccinationFormModal from "../components/HealthManagement/VaccinationFormModal";

// ---------------------------------------------------------------------------
// Data fetched from backend API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const statusStyles = {
  logged: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  alert: "bg-rose-50 text-rose-700 ring-rose-600/20",
  tomorrow: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

function DueBadge({ label }) {
  const isOverdue = label === "Overdue";
  const isTomorrow = label === "Tomorrow";
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }
  if (isTomorrow) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <CalendarClock className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }
  return <span className="text-slate-600">{label}</span>;
}

function StatusPill({ status }) {
  const map = {
    logged: { text: "Logged", cls: statusStyles.logged },
    alert: { text: "Alert", cls: statusStyles.alert },
  };
  const s = map[status] ?? map.logged;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.cls}`}
    >
      {s.text}
    </span>
  );
}

const eventTypeStyles = {
  Vaccination: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Treatment: "bg-rose-50 text-rose-700 ring-rose-600/20",
  "Check-up": "bg-sky-50 text-sky-700 ring-sky-600/20",
};

function EventTypePill({ type }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${eventTypeStyles[type] ?? "bg-slate-50 text-slate-700 ring-slate-600/20"
        }`}
    >
      {type}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, tone, hint, loading }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="flex-1 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {loading ? (
        <div className="mt-4 h-8 w-16 animate-pulse rounded-md bg-slate-200" />
      ) : (
        <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      )}
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      {hint && <p className="mt-2 text-xs font-medium text-slate-400">{hint}</p>}
    </div>
  );
}

function SubModuleCard({ icon: Icon, title, description, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
      type="button"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HealthManagement({ setActiveTab }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vetFilter, setVetFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vacModal, setVacModal] = useState(false);
  const [editVacRecord, setEditVacRecord] = useState(null);

  const [vaccinationRegistry, setVaccinationRegistry] = useState([]);
  const [healthEventsLog, setHealthEventsLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [vacRes, healthRes] = await Promise.all([
        fetch("/api/vaccination-records?t=" + Date.now()),
        fetch("/api/health-logs?t=" + Date.now())
      ]);
      const vacData = await vacRes.json();
      const healthData = await healthRes.json();

      setVaccinationRegistry((vacData.data || []).map(v => {
        const isOverdue = v.booster_due_date && new Date(v.booster_due_date) < new Date();
        return {
          id: v.vaccination_id.substring(0, 8),
          pigHerdId: v.pigs?.pig_tag || v.piglet_batches?.batch_tag || (v.pig_id ? `Pig ${v.pig_id.substring(0, 8)}` : `Batch ${v.batch_id?.substring(0, 8)}`),
          pigType: v.pig_id ? "Individual" : "Batch",
          vaccineName: v.vaccine_name,
          dateGiven: new Date(v.administered_date).toLocaleDateString(),
          nextDue: v.booster_due_date ? (isOverdue ? "Overdue" : new Date(v.booster_due_date).toLocaleDateString()) : "N/A",
          nextDueDate: v.booster_due_date,
          vet: v.administered_by || "Unknown",
          dosage: v.dosage,
          status: isOverdue ? "alert" : "logged",
          _raw: v,
        };
      }));

      setHealthEventsLog((healthData.data || []).map(h => ({
        date: new Date(h.log_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        swineId: h.pigs?.pig_tag || h.piglet_batches?.batch_tag || (h.pig_id ? `Pig ${h.pig_id.substring(0, 8)}` : `Batch ${h.batch_id?.substring(0, 8)}`),
        eventType: h.treatment ? "Treatment" : h.diagnosis ? "Check-up" : "Log",
        medication: h.medication_name || "None",
        vet: h.recorded_by || "System"
      })));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load health data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const vets = useMemo(
    () => Array.from(new Set(vaccinationRegistry.map((r) => r.vet))),
    [vaccinationRegistry]
  );

  const filteredRegistry = useMemo(() => {
    return vaccinationRegistry.filter((row) => {
      const matchesQuery =
        query.trim() === "" ||
        [row.id, row.pigHerdId, row.vaccineName, row.vet]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesVet = vetFilter === "all" || row.vet === vetFilter;
      return matchesQuery && matchesStatus && matchesVet;
    });
  }, [vaccinationRegistry, query, statusFilter, vetFilter]);

  const overdueCount = vaccinationRegistry.filter((r) => r.nextDue === "Overdue").length;
  const dueSoonCount = vaccinationRegistry.filter((r) => r.nextDue === "Tomorrow").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8">

        {/* Stat cards */}
        <div className="flex flex-wrap gap-4">
          <StatCard
            icon={Syringe}
            label="Vaccinations logged"
            value="1,248"
            tone="emerald"
            hint="This quarter"
            loading={loading}
          />
          <StatCard
            icon={CalendarClock}
            label="Upcoming schedules"
            value={String(dueSoonCount + 6)}
            tone="sky"
            hint="Next 7 days"
            loading={loading}
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue alerts"
            value={String(overdueCount)}
            tone="rose"
            hint="Needs attention"
            loading={loading}
          />
          <StatCard
            icon={Stethoscope}
            label="Active treatments"
            value="9"
            tone="amber"
            hint="Currently ongoing"
            loading={loading}
          />
        </div>

        {/* Quick access to sub-modules */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SubModuleCard
            icon={ClipboardList}
            title="Medication & Treatment Logs"
            description="View and record ongoing treatments and medication history."
            accent="bg-sky-50 text-sky-600"
            onClick={() => setActiveTab?.('medication_treatment')}
          />
          <SubModuleCard
            icon={Skull}
            title="Mortality Record"
            description="Log and review mortality entries across batches."
            accent="bg-slate-100 text-slate-600"
            onClick={() => setActiveTab?.('mortality_record')}
          />
        </div>

        {/* Vaccination Registry */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900">Vaccination Registry</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search registry..."
                  className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                />
              </button>
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                type="button"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                  type="button"
                  onClick={() => { setEditVacRecord(null); setVacModal(true); }}
                >
                  <Plus className="h-4 w-4" />
                  Add Vaccination Schedule
                </button>
            </div>
          </div>

          {/* Filter panel */}
          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All</option>
                  <option value="logged">Logged</option>
                  <option value="alert">Alert</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Veterinarian</label>
                <select
                  value={vetFilter}
                  onChange={(e) => setVetFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All</option>
                  {vets.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Date range</label>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {(statusFilter !== "all" || vetFilter !== "all" || query) && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setVetFilter("all");
                    setQuery("");
                  }}
                  className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Pig/Herd ID</th>
                  <th className="px-5 py-3 font-medium">Vaccine name</th>
                  <th className="px-5 py-3 font-medium">Date given</th>
                  <th className="px-5 py-3 font-medium">Next due date</th>
                  <th className="px-5 py-3 font-medium">Veterinarian</th>
                  <th className="px-5 py-3 font-medium">Dosage</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                    </tr>
                  ))
                ) : filteredRegistry.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                      No records match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredRegistry.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="text-slate-800">{row.pigHerdId}</div>
                        <div className="text-xs text-slate-400">{row.pigType}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.vaccineName}</td>
                      <td className="px-5 py-4 text-slate-600">{row.dateGiven}</td>
                      <td className="px-5 py-4">
                        <DueBadge label={row.nextDue} />
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.vet}</td>
                      <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                      <td className="px-5 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => { setEditVacRecord(row); setVacModal(true); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-emerald-300 transition-colors"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Health Events Log */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">Health Events Log</h2>
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              type="button"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Swine/Herd ID</th>
                  <th className="px-5 py-3 font-medium">Event type</th>
                  <th className="px-5 py-3 font-medium">Medication</th>
                  <th className="px-5 py-3 font-medium">Veterinarian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    </tr>
                  ))
                ) : healthEventsLog.length > 0 ? (
                  healthEventsLog.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-slate-600">{row.date}</td>
                      <td className="px-5 py-4 font-medium text-slate-800">{row.swineId}</td>
                      <td className="px-5 py-4">
                        <EventTypePill type={row.eventType} />
                      </td>
                      <td className="px-5 py-4 text-slate-600">{row.medication}</td>
                      <td className="px-5 py-4 text-slate-600">{row.vet}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                      No health events match your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <VaccinationFormModal
        open={vacModal}
        onClose={() => { setVacModal(false); setEditVacRecord(null); }}
        editRecord={editVacRecord}
        onSuccess={fetchData}
      />
    </div>
  );
}
