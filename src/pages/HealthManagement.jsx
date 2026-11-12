import React, { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import {
  Search,
  Plus,
  Syringe,
  CalendarClock,
  AlertTriangle,
  Stethoscope,
  ChevronDown,
  SlidersHorizontal,
  Pencil,
  Archive,
  X,
  CheckCircle2,
  Pill,
  Scissors,
  Sparkles,
  Clock,
  Calendar,
  ClipboardList,
  Package,
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
  { header: "Type", accessor: "pigType" },
  { header: "Event Type", accessor: "eventType" },
  { header: "Diagnosis / Symptoms", accessor: "diagnosis" },
  { header: "Medication / Treatment", accessor: "medication" },
  { header: "Dosage", accessor: "dosage" },
  { header: "Examined By", accessor: "vet" },
  { header: "Status", accessor: (r) => r.status || "—" },
];

const archivedHealthEventsExportColumns = [
  { header: "Date", accessor: "date" },
  { header: "Swine/Herd ID", accessor: "swineId" },
  { header: "Type", accessor: "pigType" },
  { header: "Event Type", accessor: "eventType" },
  { header: "Diagnosis / Symptoms", accessor: "diagnosis" },
  { header: "Medication / Treatment", accessor: "medication" },
  { header: "Dosage", accessor: "dosage" },
  { header: "Examined By", accessor: "vet" },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const statusStyles = {
  logged: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  alert: "bg-rose-50 text-rose-700 ring-rose-600/20",
  tomorrow: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const healthStatusStyles = {
  sick: "bg-rose-50 text-rose-700 ring-rose-600/20",
  monitoring: "bg-amber-50 text-amber-700 ring-amber-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  healthy: "bg-slate-50 text-slate-700 ring-slate-600/20",
  deceased: "bg-rose-950/10 text-rose-900 ring-rose-900/20 font-bold",
};

function HealthStatusPill({ status }) {
  const s = (status || "healthy").toLowerCase();
  const cls = healthStatusStyles[s] || healthStatusStyles.healthy;
  const label = s === "healthy" ? "Healthy" : s === "deceased" ? "Deceased" : s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function DueBadge({ label }) {
  const isOverdue = label === "Overdue";
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
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

function getTaskActivityMeta(type) {
  switch ((type || '').toUpperCase()) {
    case 'VACCINATION':
      return { Icon: Syringe };
    case 'MEDICATION':
      return { Icon: Pill };
    case 'PROCEDURE':
      return { Icon: Scissors };
    case 'SUPPLEMENT':
      return { Icon: Sparkles };
    default:
      return { Icon: ClipboardList };
  }
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
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[106px] sm:min-h-[112px] ${isAlert
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
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isAlert
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
              className={`text-xs font-semibold ${unitColor
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
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-auto shrink-0 ${badgeColor || (isAlert
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
  const [editHealthRecord, setEditHealthRecord] = useState(null);
  const [prefillHealth, setPrefillHealth] = useState(null);
  const [activeGrowthTask, setActiveGrowthTask] = useState(null);
  const [resolvingHealthId, setResolvingHealthId] = useState(null);
  const [archivingHealthId, setArchivingHealthId] = useState(null);

  const [vaccinationRegistry, setVaccinationRegistry] = useState([]);
  const [archivedRegistry, setArchivedRegistry] = useState([]);
  const [healthEventsLog, setHealthEventsLog] = useState([]);
  const [archivedHealthLog, setArchivedHealthLog] = useState([]);
  const [growthTasks, setGrowthTasks] = useState([]);

  // Pagination & Filtering for Vaccination Registry
  const [vacPage, setVacPage] = useState(1);
  const VAC_PER_PAGE = 8;
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState(null);

  // Pagination & Filtering for Health Events Log
  const [healthPage, setHealthPage] = useState(1);
  const HEALTH_PER_PAGE = 8;
  const [showHealthArchived, setShowHealthArchived] = useState(false);
  const [healthQuery, setHealthQuery] = useState("");
  const [healthStatusFilter, setHealthStatusFilter] = useState("all");
  const [healthDateFrom, setHealthDateFrom] = useState("");
  const [healthDateTo, setHealthDateTo] = useState("");
  const [healthFiltersOpen, setHealthFiltersOpen] = useState(false);

  // Growth Tasks List
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState(null);
  const innerTasksRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animTimeoutRef = useRef(null);
  const [tasksPage, setTasksPage] = useState(1);
  const TASKS_PER_PAGE = 8;
  const [taskQuery, setTaskQuery] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [vacRes, vacArchivedRes, healthRes, healthArchivedRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/vaccination-records?t=` + Date.now()),
        fetch(`${API_BASE}/api/vaccination-records?archived=true&t=` + Date.now()),
        fetch(`${API_BASE}/api/health-logs?t=` + Date.now()),
        fetch(`${API_BASE}/api/health-logs?archived=true&t=` + Date.now()),
        fetch(`${API_BASE}/api/growth-tasks?status=pending&t=` + Date.now())
      ]);
      const vacData = await vacRes.json();
      const vacArchivedData = await vacArchivedRes.json();
      const healthData = await healthRes.json();
      const healthArchivedData = await healthArchivedRes.json();
      const tasksData = await tasksRes.json();

      const mapVacRow = (v) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = v.booster_due_date && new Date(v.booster_due_date) < today;
        return {
          id: v.vaccination_id.substring(0, 8),
          pigHerdId: v.pigs?.pig_tag || v.piglet_batches?.batch_tag || (v.pig_id ? `Pig ${v.pig_id.substring(0, 8)}` : `Batch ${v.batch_id?.substring(0, 8)}`),
          pigType: v.pig_id ? "Individual" : "Batch",
          vaccineName: v.vaccine_name,
          dateGiven: new Date(v.administered_date).toLocaleDateString(),
          rawAdministeredDate: v.administered_date,
          nextDue: v.booster_due_date ? (isOverdue ? "Overdue" : new Date(v.booster_due_date).toLocaleDateString()) : "N/A",
          nextDueDate: v.booster_due_date,
          vet: v.administered_by || "Unknown",
          dosage: v.dosage,
          status: isOverdue ? "alert" : "logged",
          _raw: v,
        };
      };

      const mapHealthRow = (h) => ({
        id: h.health_id.substring(0, 8),
        date: new Date(h.log_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        rawDate: h.log_date,
        swineId: h.pigs?.pig_tag || h.piglet_batches?.batch_tag || (h.pig_id ? `Pig ${h.pig_id.substring(0, 8)}` : `Batch ${h.batch_id?.substring(0, 8)}`),
        pigType: h.pig_id ? "Individual" : "Batch",
        eventType: h.treatment ? "Treatment" : h.diagnosis ? "Check-up" : "Log",
        diagnosis: h.diagnosis || h.symptoms || "Routine",
        medication: h.medication_name || "None",
        dosage: h.dosage || "—",
        vet: h.examined_by || h.recorded_by || "System",
        status: h.status || "healthy",
        _raw: h,
      });

      setVaccinationRegistry((vacData.data || []).map(mapVacRow));
      setArchivedRegistry((vacArchivedData.data || []).map(mapVacRow));
      setHealthEventsLog((healthData.data || []).map(mapHealthRow));
      setArchivedHealthLog((healthArchivedData.data || []).map(mapHealthRow));

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

  const currentVacList = showArchived ? filteredArchivedRegistry : filteredRegistry;
  const totalVacPages = Math.ceil(currentVacList.length / VAC_PER_PAGE) || 1;
  const safeVacPage = Math.min(Math.max(1, vacPage), totalVacPages);
  const paginatedVacRegistry = useMemo(() => {
    const start = (safeVacPage - 1) * VAC_PER_PAGE;
    return currentVacList.slice(start, start + VAC_PER_PAGE);
  }, [currentVacList, safeVacPage]);

  // Health Events filtering & pagination
  const filteredHealthLog = useMemo(() => {
    return healthEventsLog.filter((row) => {
      const q = healthQuery.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        [row.id, row.swineId, row.diagnosis, row.medication, row.vet, row.eventType]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesStatus = healthStatusFilter === "all" || row.status === healthStatusFilter;

      let matchesDate = true;
      if (healthDateFrom || healthDateTo) {
        const given = new Date(row.rawDate);
        if (healthDateFrom && given < new Date(healthDateFrom)) matchesDate = false;
        if (healthDateTo) {
          const toEnd = new Date(healthDateTo);
          toEnd.setHours(23, 59, 59, 999);
          if (given > toEnd) matchesDate = false;
        }
      }

      return matchesQuery && matchesStatus && matchesDate;
    });
  }, [healthEventsLog, healthQuery, healthStatusFilter, healthDateFrom, healthDateTo]);

  const filteredArchivedHealthLog = useMemo(() => {
    return archivedHealthLog.filter((row) => {
      const q = healthQuery.trim().toLowerCase();
      if (q === "") return true;
      return [row.id, row.swineId, row.diagnosis, row.medication, row.vet, row.eventType]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [archivedHealthLog, healthQuery]);

  const currentHealthList = showHealthArchived ? filteredArchivedHealthLog : filteredHealthLog;
  const totalHealthPages = Math.ceil(currentHealthList.length / HEALTH_PER_PAGE) || 1;
  const safeHealthPage = Math.min(Math.max(1, healthPage), totalHealthPages);
  const paginatedHealthLog = useMemo(() => {
    const start = (safeHealthPage - 1) * HEALTH_PER_PAGE;
    return currentHealthList.slice(start, start + HEALTH_PER_PAGE);
  }, [currentHealthList, safeHealthPage]);

  const overdueVacCount = vaccinationRegistry.filter((r) => {
    if (!r.nextDueDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(r.nextDueDate) < today;
  }).length;

  const dueSoonVacCount = vaccinationRegistry.filter((r) => {
    if (!r.nextDueDate) return false;
    const due = new Date(r.nextDueDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const overdueTasksCount = growthTasks.filter(task => {
    if (!task.due_date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(task.due_date) < today;
  }).length;

  const dueSoonTasksCount = growthTasks.filter(task => {
    if (!task.due_date) return false;
    const due = new Date(task.due_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const totalOverdueCount = overdueVacCount + overdueTasksCount;
  const totalDueSoonCount = dueSoonVacCount + dueSoonTasksCount;

  // Count vaccinations administered in the current calendar quarter
  const vaccinationsThisQuarterCount = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(currentYear, currentQuarter * 3, 1, 0, 0, 0, 0);
    const quarterEnd = new Date(currentYear, (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);

    return vaccinationRegistry.filter(r => {
      const dateVal = r.rawAdministeredDate || r._raw?.administered_date;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return d >= quarterStart && d <= quarterEnd;
    }).length;
  }, [vaccinationRegistry]);

  // Count unique pigs/batches whose most recent health log status is sick or monitoring
  const activeTreatmentsCount = useMemo(() => {
    const latestByEntity = new Map();
    // healthEventsLog is already sorted descending by log_date from API
    healthEventsLog.forEach(h => {
      const key = h.swineId;
      if (!latestByEntity.has(key)) latestByEntity.set(key, h.status);
    });
    return Array.from(latestByEntity.values()).filter(s => ["sick", "monitoring"].includes(s)).length;
  }, [healthEventsLog]);

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
    }).sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return aDue - bDue;
    });
  }, [growthTasks, taskQuery, taskTypeFilter, taskStatusFilter]);

  const totalTaskPages = Math.ceil(filteredGrowthTasks.length / TASKS_PER_PAGE) || 1;
  const safeTasksPage = Math.min(Math.max(1, tasksPage), totalTaskPages);
  const paginatedGrowthTasks = useMemo(() => {
    const start = (safeTasksPage - 1) * TASKS_PER_PAGE;
    return filteredGrowthTasks.slice(start, start + TASKS_PER_PAGE);
  }, [filteredGrowthTasks, safeTasksPage]);

  const renderGrowthTaskRow = (task) => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate ? dueDate < today : false;
    const dueFormatted = dueDate
      ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Unscheduled';

    const { Icon: ActivityIcon } = getTaskActivityMeta(task.activity_type);

    return (
      <div key={task.task_id} className="py-2.5 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-slate-50/70 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/70 bg-slate-50 text-slate-500">
            <ActivityIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">{task.task_name}</p>
              {task.inventory_items && (
                <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${Number(task.inventory_items.current_stock_level) > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                  <Package className="w-2.5 h-2.5" /> Stock: {task.inventory_items.current_stock_level} {task.inventory_items.unit_of_measure}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
              <span className="font-semibold text-slate-600 capitalize">
                {task.activity_type?.toLowerCase()}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="font-medium text-slate-600">
                Batch {task.piglet_batches?.batch_tag}
                {task.piglet_batches?.current_count ? ` (${task.piglet_batches.current_count} head)` : ''}
              </span>
              {task.growth_programs?.name && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-400 truncate max-w-xs">{task.growth_programs.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
          {isOverdue ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 ring-1 ring-rose-500/10 shrink-0">
              <Clock className="w-3 h-3 text-rose-500 shrink-0" />
              <span>Overdue &bull; {dueFormatted}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 shrink-0">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Due {dueFormatted}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveGrowthTask(task);
              if (task.activity_type === 'VACCINATION') {
                setPrefillVac({
                  targetType: 'batch',
                  batch_id: task.batch_id,
                  vaccine_name: task.task_name,
                  item_id: task.item_id,
                  inventoryItem: task.inventory_items,
                  headCount: task.piglet_batches?.current_count || 1,
                  administered_date: new Date().toISOString().split('T')[0]
                });
                setVacModal(true);
              } else {
                setPrefillHealth({
                  targetType: 'batch',
                  batch_id: task.batch_id,
                  treatment: task.task_name,
                  isProcedure: task.activity_type === 'PROCEDURE',
                  isGrowthTask: true,
                  activity_type: task.activity_type,
                  medication_name: task.activity_type === 'MEDICATION' ? task.task_name : '',
                  item_id: task.item_id,
                  inventoryItem: task.inventory_items,
                  headCount: task.piglet_batches?.current_count || 1,
                  status: 'healthy',
                  log_date: new Date().toISOString().split('T')[0] + 'T09:00'
                });
                setHealthModal(true);
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 hover:border-emerald-600 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Log Task</span>
          </button>
        </div>
      </div>
    );
  };

  useLayoutEffect(() => {
    if (!innerTasksRef.current) return;
    const updateCollapsedHeight = () => {
      const children = innerTasksRef.current?.children;
      if (children && children.length >= 3) {
        const thirdItem = children[2];
        const innerRect = innerTasksRef.current.getBoundingClientRect();
        const thirdRect = thirdItem.getBoundingClientRect();
        const h = Math.ceil(thirdRect.bottom - innerRect.top);
        if (h > 0) setCollapsedHeight(h);
      } else {
        setCollapsedHeight(null);
      }
    };

    updateCollapsedHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateCollapsedHeight);
      observer.observe(innerTasksRef.current);
      return () => observer.disconnect();
    }
  }, [filteredGrowthTasks]);

  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  const handleToggleAllTasks = useCallback(() => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    if (showAllTasks) {
      setCanScroll(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      setShowAllTasks(false);
    } else {
      setShowAllTasks(true);
      animTimeoutRef.current = setTimeout(() => {
        setCanScroll(true);
      }, 300);
    }
  }, [showAllTasks]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-5 lg:p-6">

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Syringe}
            label="Vaccinations Logged"
            value={vaccinationsThisQuarterCount}
            unit="this quarter"
            loading={loading}
          />
          <StatCard
            icon={CalendarClock}
            label="Upcoming Schedules"
            value={totalDueSoonCount}
            unit="due in 7 days"
            unitColor={totalDueSoonCount > 0 ? "text-sky-600 font-semibold" : "text-slate-400"}
            loading={loading}
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue Alerts"
            value={totalOverdueCount}
            unit={totalOverdueCount > 0 ? "needs attention" : "all clear"}
            unitColor={totalOverdueCount > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}
            isAlert={totalOverdueCount > 0}
            loading={loading}
          />
          <StatCard
            icon={Stethoscope}
            label="Active Treatments"
            value={activeTreatmentsCount}
            unit={activeTreatmentsCount > 0 ? "ongoing" : "none ongoing"}
            unitColor="text-slate-400"
            loading={loading}
          />
        </div>

        {/* Growth Program Tasks (To-Do List) */}
        {growthTasks.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all">
            {/* Panel Header */}
            <div className={`bg-white px-5 py-3.5 ${!isTasksCollapsed ? 'border-b border-slate-100' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => setIsTasksCollapsed(!isTasksCollapsed)}
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">Growth Program Tasks</h3>
                      {overdueTasksCount >= filteredGrowthTasks.length && filteredGrowthTasks.length > 0 ? (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {overdueTasksCount} OVERDUE
                        </span>
                      ) : (
                        <>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {filteredGrowthTasks.length} PENDING
                          </span>
                          {overdueTasksCount > 0 && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {overdueTasksCount} OVERDUE
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {isTasksCollapsed && (
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Click to expand routine protocol tasks</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className={`flex items-center gap-2 flex-wrap sm:flex-nowrap transition-all duration-300 ease-in-out ${
                    isTasksCollapsed ? 'opacity-0 max-w-0 overflow-hidden pointer-events-none' : 'opacity-100 max-w-[650px]'
                  }`}>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={taskQuery}
                        onChange={(e) => { setTaskQuery(e.target.value); }}
                        placeholder="Search tasks..."
                        className="w-36 sm:w-44 rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={taskTypeFilter}
                        onChange={(e) => { setTaskTypeFilter(e.target.value); }}
                        className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer transition-all"
                      >
                        <option value="all">All Types</option>
                        <option value="VACCINATION">Vaccination</option>
                        <option value="MEDICATION">Medication</option>
                        <option value="PROCEDURE">Procedure</option>
                        <option value="SUPPLEMENT">Supplement</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="relative">
                      <select
                        value={taskStatusFilter}
                        onChange={(e) => { setTaskStatusFilter(e.target.value); }}
                        className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 cursor-pointer transition-all"
                      >
                        <option value="all">All Status</option>
                        <option value="overdue">Overdue</option>
                        <option value="upcoming">Upcoming</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTasksCollapsed(!isTasksCollapsed)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all cursor-pointer shrink-0 ml-auto sm:ml-0"
                    title={isTasksCollapsed ? "Expand tasks panel" : "Collapse tasks panel"}
                  >
                    <span>{isTasksCollapsed ? "Show Tasks" : "Collapse"}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${isTasksCollapsed ? '-rotate-90' : 'rotate-180'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Body (Smooth Accordion Animation on Collapse/Expand) */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isTasksCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
              }`}
            >
              <div className="overflow-hidden">
                {filteredGrowthTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No tasks match your filters.
                  </div>
                ) : (
                  /* Single unified list: all tasks (1..22) scroll together with smooth sliding animation */
                  <div
                    ref={scrollContainerRef}
                    style={{
                      maxHeight: filteredGrowthTasks.length > 3
                        ? (showAllTasks ? '380px' : `${collapsedHeight || 180}px`)
                        : 'none'
                    }}
                    className={`transition-[max-height] duration-300 ease-in-out ${
                      canScroll ? 'overflow-y-auto' : 'overflow-hidden'
                    }`}
                  >
                    <div ref={innerTasksRef} className="divide-y divide-slate-100">
                      {filteredGrowthTasks.map(renderGrowthTaskRow)}
                    </div>
                  </div>
                )}

                {/* View All / Show Less Footer Bar */}
                {filteredGrowthTasks.length > 3 && (
                  <button
                    type="button"
                    onClick={handleToggleAllTasks}
                    className="w-full py-2 px-5 bg-slate-50/70 hover:bg-emerald-50/50 border-t border-slate-100 text-slate-600 hover:text-emerald-700 text-xs font-semibold flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>
                        {showAllTasks
                          ? `Showing all ${filteredGrowthTasks.length} pending protocol tasks`
                          : `+${filteredGrowthTasks.length - 3} more pending protocol tasks`}
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 inline-flex items-center gap-1">
                      <span>{showAllTasks ? 'Show Top 3 Only' : 'View All Tasks'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out ${showAllTasks ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                )}
              </div>
            </div>
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
                  paginatedVacRegistry.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                        {archivedRegistry.length === 0 ? "No archived records yet." : "No archived records match your search."}
                      </td>
                    </tr>
                  ) : (
                    paginatedVacRegistry.map((row) => (
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
                ) : paginatedVacRegistry.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                      No records match your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedVacRegistry.map((row) => (
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
          {currentVacList.length > VAC_PER_PAGE && (
            <div className="border-t border-slate-100 p-4">
              <Pagination
                currentPage={safeVacPage}
                totalPages={totalVacPages}
                onPageChange={setVacPage}
                totalItems={currentVacList.length}
                itemsPerPage={VAC_PER_PAGE}
                itemName="records"
              />
            </div>
          )}
        </div>

        {/* Health Events Log */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Health Events Log</h2>
              {/* Active / Archived toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => { setShowHealthArchived(false); setHealthPage(1); }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${!showHealthArchived
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => { setShowHealthArchived(true); setHealthPage(1); }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${showHealthArchived
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Archived
                </button>
              </div>
              {activeTreatmentsCount > 0 && !showHealthArchived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  {activeTreatmentsCount} ACTIVE CASES
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={healthQuery}
                  onChange={(e) => { setHealthQuery(e.target.value); setHealthPage(1); }}
                  placeholder="Search health events..."
                  className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              {!showHealthArchived && (
                <button
                  onClick={() => setHealthFiltersOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  type="button"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${healthFiltersOpen ? "rotate-180" : ""}`}
                  />
                </button>
              )}
              <ExportDropdown
                data={showHealthArchived ? filteredArchivedHealthLog : filteredHealthLog}
                columns={showHealthArchived ? archivedHealthEventsExportColumns : healthEventsExportColumns}
                filename={showHealthArchived ? "archived_health_events_log" : "health_events_log"}
                pdfTitle={showHealthArchived ? "Archived Health Events Log" : "Health Events Log"}
              />
              {!showHealthArchived && (
                <button
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                  type="button"
                  onClick={() => { setEditHealthRecord(null); setPrefillHealth(null); setHealthModal(true); }}
                >
                  <Plus className="h-4 w-4" />
                  Log Health Event
                </button>
              )}
            </div>
          </div>

          {/* Filter panel — only available in Active view, animated open/close */}
          <div
            aria-hidden={!(healthFiltersOpen && !showHealthArchived)}
            className={`grid transition-all duration-300 ease-in-out ${healthFiltersOpen && !showHealthArchived ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500">Status</label>
                  <select
                    value={healthStatusFilter}
                    onChange={(e) => { setHealthStatusFilter(e.target.value); setHealthPage(1); }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="all">All Status</option>
                    <option value="sick">Sick</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                    <option value="healthy">Healthy / Routine</option>
                    <option value="deceased">Deceased / Mortality</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500">Date range</label>
                  <input
                    type="date"
                    value={healthDateFrom}
                    onChange={(e) => { setHealthDateFrom(e.target.value); setHealthPage(1); }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={healthDateTo}
                    onChange={(e) => { setHealthDateTo(e.target.value); setHealthPage(1); }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                {(healthStatusFilter !== "all" || healthDateFrom || healthDateTo || healthQuery) && (
                  <button
                    onClick={() => {
                      setHealthStatusFilter("all");
                      setHealthDateFrom("");
                      setHealthDateTo("");
                      setHealthQuery("");
                      setHealthPage(1);
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
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Swine/Herd ID</th>
                  <th className="px-5 py-3 font-medium">Event type</th>
                  <th className="px-5 py-3 font-medium">Diagnosis / Symptoms</th>
                  <th className="px-5 py-3 font-medium">Medication / Treatment</th>
                  <th className="px-5 py-3 font-medium">Dosage</th>
                  <th className="px-5 py-3 font-medium">Examined By</th>
                  {!showHealthArchived && <th className="px-5 py-3 font-medium">Status</th>}
                  {!showHealthArchived && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                      {!showHealthArchived && <td className="px-5 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>}
                      {!showHealthArchived && <td className="px-5 py-4"><div className="h-6 w-24 bg-slate-200 rounded"></div></td>}
                    </tr>
                  ))
                ) : showHealthArchived ? (
                  paginatedHealthLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {archivedHealthLog.length === 0 ? "No archived health events yet." : "No archived records match your search."}
                      </td>
                    </tr>
                  ) : (
                    paginatedHealthLog.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-4 text-slate-600">{row.date}</td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800">{row.swineId}</div>
                          <div className="text-xs text-slate-400">{row.pigType}</div>
                        </td>
                        <td className="px-5 py-4">
                          <EventTypePill type={row.eventType} />
                        </td>
                        <td className="px-5 py-4 text-slate-600 max-w-[200px] truncate" title={row.diagnosis}>{row.diagnosis}</td>
                        <td className="px-5 py-4 text-slate-600">{row.medication}</td>
                        <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                        <td className="px-5 py-4 text-slate-600">{row.vet}</td>
                      </tr>
                    ))
                  )
                ) : paginatedHealthLog.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">
                      No health events match your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedHealthLog.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-slate-600">{row.date}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">{row.swineId}</div>
                        <div className="text-xs text-slate-400">{row.pigType}</div>
                      </td>
                      <td className="px-5 py-4">
                        <EventTypePill type={row.eventType} />
                      </td>
                      <td className="px-5 py-4 text-slate-600 max-w-[200px] truncate" title={row.diagnosis}>{row.diagnosis}</td>
                      <td className="px-5 py-4 text-slate-600">{row.medication}</td>
                      <td className="px-5 py-4 text-slate-600">{row.dosage}</td>
                      <td className="px-5 py-4 text-slate-600">{row.vet}</td>
                      <td className="px-5 py-4">
                        <HealthStatusPill status={row.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(row.status === "sick" || row.status === "monitoring") && (
                            <button
                              type="button"
                              disabled={resolvingHealthId === row._raw.health_id}
                              onClick={async () => {
                                setResolvingHealthId(row._raw.health_id);
                                try {
                                  const res = await fetch(`${API_BASE}/api/health-logs/${row._raw.health_id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      status: 'resolved',
                                      performed_by: loggedInUser?.name || loggedInUser?.email || 'Admin',
                                    }),
                                  });
                                  if (!res.ok) throw new Error('Failed to resolve health log');
                                  toast.success(`Marked as resolved for ${row.swineId}. Herd status updated.`);
                                  fetchData();
                                } catch (e) {
                                  toast.error(e.message);
                                } finally {
                                  setResolvingHealthId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-50"
                              title="Mark case as resolved (restores swine status to Healthy)"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {resolvingHealthId === row._raw.health_id ? "Saving..." : "Resolve"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditHealthRecord(row);
                              setPrefillHealth(null);
                              setHealthModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-emerald-300 transition-colors"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={archivingHealthId === row._raw.health_id}
                            onClick={async () => {
                              if (!confirm(`Archive health record for ${row.swineId}?`)) return;
                              setArchivingHealthId(row._raw.health_id);
                              try {
                                const res = await fetch(`${API_BASE}/api/health-logs/${row._raw.health_id}/archive`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ performed_by: loggedInUser?.name || loggedInUser?.email || 'Admin' }),
                                });
                                if (!res.ok) throw new Error('Failed to archive');
                                toast.success('Health record archived.');
                                fetchData();
                              } catch (e) {
                                toast.error(e.message);
                              } finally {
                                setArchivingHealthId(null);
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
          {currentHealthList.length > HEALTH_PER_PAGE && (
            <div className="border-t border-slate-100 p-4">
              <Pagination
                currentPage={safeHealthPage}
                totalPages={totalHealthPages}
                onPageChange={setHealthPage}
                totalItems={currentHealthList.length}
                itemsPerPage={HEALTH_PER_PAGE}
                itemName="events"
              />
            </div>
          )}
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
              body: JSON.stringify({ status: 'completed', linked_vaccination_id: createdLog?.vaccination_id, performed_by: loggedInUser?.name || loggedInUser?.email || 'Health Management' })
            });
          }
          fetchData();
        }}
      />

      <AddHealthLogModal
        open={healthModal}
        onClose={() => {
          setHealthModal(false);
          setEditHealthRecord(null);
          setPrefillHealth(null);
          setActiveGrowthTask(null);
        }}
        editRecord={editHealthRecord}
        prefillData={prefillHealth}
        currentUser={loggedInUser}
        onSuccess={async (createdLog) => {
          if (activeGrowthTask) {
            await fetch(`${API_BASE}/api/growth-tasks/${activeGrowthTask.task_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed', linked_health_id: createdLog?.health_id, performed_by: loggedInUser?.name || loggedInUser?.email || 'Health Management' })
            });
          }
          fetchData();
        }}
      />
    </div>
  );
}
