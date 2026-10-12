import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
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
  Archive,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "../utils/toast";
import VaccinationFormModal from "../components/HealthManagement/VaccinationFormModal";
import AddHealthLogModal from "../components/HealthManagement/AddHealthLogModal";
import Pagination from "../components/common/Pagination";
import ExportDropdown from "../components/common/ExportDropdown";

// Export column definitions
const vaccinationExportColumns = [
  { header: "Pig/Herd ID", accessor: "pigHerdId" },
  { header: "Type", accessor: "pigType" },
  { header: "Vaccine Name", accessor: "vaccineName" },
  { header: "Date Given", accessor: "dateGiven" },
  { header: "Next Due Date", accessor: "nextDue" },
  { header: "Veterinarian", accessor: "vet" },
  { header: "Dosage", accessor: "dosage" },
  { header: "Status", accessor: (r) => (r.status === "alert" ? "Overdue" : "Logged") },
];

const archivedVaccinationExportColumns = [
  { header: "Pig/Herd ID", accessor: "pigHerdId" },
  { header: "Type", accessor: "pigType" },
  { header: "Vaccine Name", accessor: "vaccineName" },
  { header: "Date Given", accessor: "dateGiven" },
  { header: "Veterinarian", accessor: "vet" },
  { header: "Dosage", accessor: "dosage" },
];

const healthEventsExportColumns = [
  { header: "Date", accessor: "date" },
  { header: "Swine/Herd ID", accessor: "swineId" },
  { header: "Event Type", accessor: "eventType" },
  { header: "Medication", accessor: "medication" },
  { header: "Veterinarian", accessor: "vet" },
  { header: "Status", accessor: (r) => r.status || "—" },
];

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

function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || 'bg-white'} p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || 'bg-slate-50'}`}>
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
          {badge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function HealthManagement({ setActiveTab, loggedInUser }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vetFilter, setVetFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vacModal, setVacModal] = useState(false);
  const [editVacRecord, setEditVacRecord] = useState(null);
  const [prefillVac, setPrefillVac] = useState(null);
  const [healthModal, setHealthModal] = useState(false);
  const [prefillHealth, setPrefillHealth] = useState(null);
  const [activeGrowthTask, setActiveGrowthTask] = useState(null);

  const [vaccinationRegistry, setVaccinationRegistry] = useState([]);
  const [archivedRegistry, setArchivedRegistry] = useState([]);
  const [healthEventsLog, setHealthEventsLog] = useState([]);
  const [growthTasks, setGrowthTasks] = useState([]);
  const [tasksPage, setTasksPage] = useState(1);
  const TASKS_PER_PAGE = 5;
  const [taskQuery, setTaskQuery] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [vacRes, vacArchivedRes, healthRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/vaccination-records?t=` + Date.now()),
        fetch(`${API_BASE}/api/vaccination-records?archived=true&t=` + Date.now()),
        fetch(`${API_BASE}/api/health-logs?t=` + Date.now()),
        fetch(`${API_BASE}/api/growth-tasks?status=pending&t=` + Date.now())
      ]);
      const vacData = await vacRes.json();
      const vacArchivedData = await vacArchivedRes.json();
      const healthData = await healthRes.json();
      const tasksData = await tasksRes.json();

      const mapVacRow = (v) => {
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
      };

      setVaccinationRegistry((vacData.data || []).map(mapVacRow));
      setArchivedRegistry((vacArchivedData.data || []).map(mapVacRow));

      setHealthEventsLog((healthData.data || []).map(h => ({
        date: new Date(h.log_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        swineId: h.pigs?.pig_tag || h.piglet_batches?.batch_tag || (h.pig_id ? `Pig ${h.pig_id.substring(0, 8)}` : `Batch ${h.batch_id?.substring(0, 8)}`),
        eventType: h.treatment ? "Treatment" : h.diagnosis ? "Check-up" : "Log",
        medication: h.medication_name || "None",
        vet: h.recorded_by || "System",
        status: h.status
      })));

      // FEED tasks are routine husbandry, not health events — managed in Growth Program Management
      setGrowthTasks((tasksData.data || []).filter(t => t.activity_type !== 'FEED'));
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

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const given = new Date(row._raw?.administered_date);
        if (dateFrom && given < new Date(dateFrom)) matchesDate = false;
        if (dateTo) {
          const toEnd = new Date(dateTo);
          toEnd.setHours(23, 59, 59, 999);
          if (given > toEnd) matchesDate = false;
        }
      }

      return matchesQuery && matchesStatus && matchesVet && matchesDate;
    });
  }, [vaccinationRegistry, query, statusFilter, vetFilter, dateFrom, dateTo]);

  const filteredArchivedRegistry = useMemo(() => {
    return archivedRegistry.filter((row) => {
      if (query.trim() === "") return true;
      return [row.id, row.pigHerdId, row.vaccineName, row.vet]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
    });
  }, [archivedRegistry, query]);

  const overdueVacCount = vaccinationRegistry.filter((r) => {
    if (!r.nextDueDate) return false;
    return new Date(r.nextDueDate) < new Date();
  }).length;

  const dueSoonVacCount = vaccinationRegistry.filter((r) => {
    if (!r.nextDueDate) return false;
    const due = new Date(r.nextDueDate);
    const now = new Date();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const overdueTasksCount = growthTasks.filter(task => {
    if (!task.due_date) return false;
    return new Date(task.due_date) < new Date();
  }).length;

  const dueSoonTasksCount = growthTasks.filter(task => {
    if (!task.due_date) return false;
    const due = new Date(task.due_date);
    const now = new Date();
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const totalOverdueCount = overdueVacCount + overdueTasksCount;
  const totalDueSoonCount = dueSoonVacCount + dueSoonTasksCount;

  const activeTreatmentsCount = healthEventsLog.filter(h =>
    ["sick", "monitoring"].includes(h.status)
  ).length;

  const filteredGrowthTasks = useMemo(() => {
    return growthTasks.filter(task => {
      const q = taskQuery.toLowerCase();
      const matchesQuery =
        taskQuery.trim() === "" ||
        task.task_name?.toLowerCase().includes(q) ||
        task.piglet_batches?.batch_tag?.toLowerCase().includes(q) ||
        task.growth_programs?.name?.toLowerCase().includes(q);

      const matchesType = taskTypeFilter === "all" || task.activity_type === taskTypeFilter;

      const isOverdue = new Date(task.due_date) < new Date();
      let matchesStatus = true;
      if (taskStatusFilter === "overdue") matchesStatus = isOverdue;
      else if (taskStatusFilter === "upcoming") matchesStatus = !isOverdue;

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [growthTasks, taskQuery, taskTypeFilter, taskStatusFilter]);

  const totalTaskPages = Math.ceil(filteredGrowthTasks.length / TASKS_PER_PAGE) || 1;
  const safeTasksPage = Math.min(Math.max(1, tasksPage), totalTaskPages);
  const paginatedGrowthTasks = useMemo(() => {
    const start = (safeTasksPage - 1) * TASKS_PER_PAGE;
    return filteredGrowthTasks.slice(start, start + TASKS_PER_PAGE);
  }, [filteredGrowthTasks, safeTasksPage]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8">

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Syringe className="w-6 h-6 text-emerald-600" />}
            label="Vaccinations logged"
            value={String(vaccinationRegistry.length)}
            badge="This quarter"
            badgeColor="bg-emerald-100 text-emerald-700"
            accentColor="bg-emerald-50"
            loading={loading}
          />
          <StatCard
            icon={<CalendarClock className="w-6 h-6 text-sky-600" />}
            label="Upcoming schedules"
            value={String(totalDueSoonCount)}
            badge="Next 7 days"
            badgeColor="bg-sky-100 text-sky-700"
            accentColor="bg-sky-50"
            loading={loading}
          />
          <StatCard
            icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
            label="Overdue alerts"
            value={String(totalOverdueCount)}
            badge="Needs attention"
            badgeColor="bg-rose-100 text-rose-700"
            accentColor="bg-rose-50"
            loading={loading}
          />
          <StatCard
            icon={<Stethoscope className="w-6 h-6 text-amber-600" />}
            label="Active treatments"
            value={String(activeTreatmentsCount)}
            badge="Currently ongoing"
            badgeColor="bg-amber-100 text-amber-700"
            accentColor="bg-amber-50"
            loading={loading}
          />
        </div>

        {/* Growth Program Tasks (To-Do List) */}
        {growthTasks.length > 0 && (
          <div className="mt-8 rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
            <div className="bg-emerald-50/50 flex flex-col border-b border-emerald-100">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 shrink-0">
                  <h3 className="font-semibold">Growth Program Tasks</h3>
                  <span className="bg-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
                    {filteredGrowthTasks.length} PENDING
                  </span>
                </div>
              </div>
              <div className="px-4 pb-4 flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={taskQuery}
                    onChange={(e) => { setTaskQuery(e.target.value); setTasksPage(1); }}
                    placeholder="Search tasks, batch..."
                    className="w-48 rounded-lg border border-emerald-200 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <select
                  value={taskTypeFilter}
                  onChange={(e) => { setTaskTypeFilter(e.target.value); setTasksPage(1); }}
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All Types</option>
                  <option value="VACCINATION">Vaccination</option>
                  <option value="MEDICATION">Medication</option>
                  <option value="PROCEDURE">Procedure</option>
                  <option value="SUPPLEMENT">Supplement</option>
                </select>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => { setTaskStatusFilter(e.target.value); setTasksPage(1); }}
                  className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="all">All Status</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {paginatedGrowthTasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No tasks match your filters.
                </div>
              ) : (
                paginatedGrowthTasks.map(task => {
                  const isOverdue = new Date(task.due_date) < new Date();
                  const dueText = isOverdue ? 'Overdue' : 'Due ' + new Date(task.due_date).toLocaleDateString();

                  return (
                    <div key={task.task_id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full ${isOverdue ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.task_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {task.activity_type} &middot; Batch: <span className="font-medium text-slate-700">{task.piglet_batches?.batch_tag}</span> &middot; Program: {task.growth_programs?.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                          {dueText}
                        </span>
                        <button
                          onClick={() => {
                            setActiveGrowthTask(task);
                            if (task.activity_type === 'VACCINATION') {
                              setPrefillVac({
                                targetType: 'batch',
                                batch_id: task.batch_id,
                                vaccine_name: task.task_name,
                                administered_date: new Date().toISOString().split('T')[0]
                              });
                              setVacModal(true);
                            } else {
                              setPrefillHealth({
                                targetType: 'batch',
                                batch_id: task.batch_id,
                                treatment: task.task_name,
                                isProcedure: task.activity_type === 'PROCEDURE',
                                medication_name: task.activity_type === 'MEDICATION' ? task.task_name : '',
                                status: task.activity_type === 'MEDICATION' ? 'sick' : 'healthy',
                                log_date: new Date().toISOString().split('T')[0] + 'T09:00'
                              });
                              setHealthModal(true);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Log It
                        </button>
                      </div>
                    </div>
                  );
                }))}
            </div>
            {filteredGrowthTasks.length > TASKS_PER_PAGE && (
              <Pagination
                currentPage={safeTasksPage}
                totalPages={totalTaskPages}
                onPageChange={setTasksPage}
                totalItems={filteredGrowthTasks.length}
                itemsPerPage={TASKS_PER_PAGE}
                itemName="tasks"
              />
            )}
          </div>
        )}

        {/* Vaccination Registry */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Vaccination Registry</h2>
              {/* Active / Archived toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${!showArchived
                      ? 'bg-white shadow-sm text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${showArchived
                      ? 'bg-white shadow-sm text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Archived
                </button>
              </div>
            </div>
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
              {!showArchived && (
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
              )}
              <ExportDropdown
                data={showArchived ? filteredArchivedRegistry : filteredRegistry}
                columns={showArchived ? archivedVaccinationExportColumns : vaccinationExportColumns}
                filename={showArchived ? "archived_vaccination_registry" : "vaccination_registry"}
                pdfTitle={showArchived ? "Archived Vaccination Registry" : "Vaccination Registry"}
              />
              {!showArchived && (
                <button
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                  type="button"
                  onClick={() => { setEditVacRecord(null); setVacModal(true); }}
                >
                  <Plus className="h-4 w-4" />
                  Add Vaccination Schedule
                </button>
              )}
            </div>
          </div>

          {/* Filter panel — only available in Active view, animated open/close */}
          <div
            aria-hidden={!(filtersOpen && !showArchived)}
            className={`grid transition-all duration-300 ease-in-out ${filtersOpen && !showArchived ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
          >
          <div className="min-h-0 overflow-hidden">
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
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {(statusFilter !== "all" || vetFilter !== "all" || dateFrom || dateTo || query) && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setVetFilter("all");
                    setDateFrom("");
                    setDateTo("");
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
          </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Pig/Herd ID</th>
                  <th className="px-5 py-3 font-medium">Vaccine name</th>
                  <th className="px-5 py-3 font-medium">Date given</th>
                  {!showArchived && <th className="px-5 py-3 font-medium">Next due date</th>}
                  <th className="px-5 py-3 font-medium">Veterinarian</th>
                  <th className="px-5 py-3 font-medium">Dosage</th>
                  {!showArchived && <th className="px-5 py-3 font-medium">Status</th>}
                  {!showArchived && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                      {!showArchived && <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded" /></td>}
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded" /></td>
                      {!showArchived && <td className="px-5 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full" /></td>}
                    </tr>
                  ))
                ) : showArchived ? (
                  filteredArchivedRegistry.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                        {archivedRegistry.length === 0 ? "No archived records yet." : "No archived records match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredArchivedRegistry.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="text-slate-800">{row.pigHerdId}</div>
                          <div className="text-xs text-slate-400">{row.pigType}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{row.vaccineName}</td>
                        <td className="px-5 py-4 text-slate-600">{row.dateGiven}</td>
                        <td className="px-5 py-4 text-slate-600">{row.vet}</td>
                        <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                      </tr>
                    ))
                  )
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditVacRecord(row); setVacModal(true); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-emerald-300 transition-colors"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            disabled={archivingId === row._raw.vaccination_id}
                            onClick={async () => {
                              if (!confirm(`Archive vaccination record for ${row.pigHerdId}?`)) return;
                              setArchivingId(row._raw.vaccination_id);
                              try {
                                const res = await fetch(`${API_BASE}/api/vaccination-records/${row._raw.vaccination_id}/archive`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ performed_by: "Admin" }),
                                });
                                if (!res.ok) throw new Error("Failed to archive");
                                toast.success("Record archived.");
                                fetchData();
                              } catch (e) {
                                toast.error(e.message);
                              } finally {
                                setArchivingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                          >
                            <Archive className="h-3 w-3" /> Archive
                          </button>
                        </div>
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
            <ExportDropdown
              data={healthEventsLog}
              columns={healthEventsExportColumns}
              filename="health_events_log"
              pdfTitle="Health Events Log"
            />
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

      {/* Modals */}
      <VaccinationFormModal
        open={vacModal}
        onClose={() => {
          setVacModal(false);
          setEditVacRecord(null);
          setPrefillVac(null);
          setActiveGrowthTask(null);
        }}
        editRecord={editVacRecord}
        prefillData={prefillVac}
        currentUser={loggedInUser}
        onSuccess={async (createdLog) => {
          if (activeGrowthTask) {
            await fetch(`${API_BASE}/api/growth-tasks/${activeGrowthTask.task_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed', linked_vaccination_id: createdLog?.vaccination_id })
            });
          }
          fetchData();
        }}
      />

      <AddHealthLogModal
        open={healthModal}
        onClose={() => {
          setHealthModal(false);
          setPrefillHealth(null);
          setActiveGrowthTask(null);
        }}
        prefillData={prefillHealth}
        currentUser={loggedInUser}
        onSuccess={async (createdLog) => {
          if (activeGrowthTask) {
            await fetch(`/api/growth-tasks/${activeGrowthTask.task_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed', linked_health_id: createdLog?.health_id })
            });
          }
          fetchData();
        }}
      />
    </div>
  );
}
