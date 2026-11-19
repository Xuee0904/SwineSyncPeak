import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import SideNav, { NAV_ITEMS } from '../components/SideNav';
import Admin from './Admin';
import Approvals from './Approvals';
import MySubmissions from './MySubmissions';
import SwineManagement from './SwineManagement';
import PenManagement from './PenManagement';
import BreedingLogs from './BreedingLogs';
import GrowthProgramManagement from './GrowthProgramManagement';
import HealthManagement from './HealthManagement';
import InventoryManagement from './InventoryManagement';
import TransactionRecords from './TransactionRecords';
import PigSnout from '../components/common/PigSnout';
import { supabase } from '../supabaseClient';
import { toast } from '../utils/toast';
import { isAdminUser, canAccessTab, isValidTab } from '../utils/rbac';
import {
  computeInventoryMetrics,
  getStockStatus,
  getStockPercent,
  getShortUnit,
} from '../components/Inventory/inventoryUtils';
import {
  Sparkles, Database, ChevronRight,
  AlertTriangle, ShieldAlert,
  ChevronLeft, Menu, Bell,
  Users, HeartPulse, Grid3X3, ArrowRight,
  CheckCircle2, RefreshCw, Calendar, Check,
  Dna, TrendingUp, Activity, MapPin, Plus, Syringe,
  Wheat, Package,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const getModuleIcon = (tabId) => {
  for (const item of NAV_ITEMS) {
    if (item.id === tabId) return item.icon;
    if (item.children) {
      const child = item.children.find(c => c.id === tabId);
      if (child) return child.icon;
    }
  }
  return Calendar;
};

const EVENT_COLORS = {
  breeding: 'bg-purple-500',
  health: 'bg-teal-500',
  growth: 'bg-blue-500',
  feed: 'bg-emerald-500',
  ops: 'bg-amber-400',
};

const EVENT_LABELS = {
  breeding: 'Breeding',
  health: 'Veterinary',
  growth: 'Growth Task',
  feed: 'Feeding',
  ops: 'Operations',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function Pill({ children, color = 'slate' }) {
  const map = {
    red: 'bg-red-100    text-red-700    border-red-200',
    yellow: 'bg-amber-100  text-amber-700  border-amber-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100   text-blue-700   border-blue-200',
    slate: 'bg-slate-100  text-slate-600  border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

function formatCleanNumber(n, maxDecimals = 1) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

function getInventoryCategoryConfig(category, name) {
  const cat = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (cat.includes('feed') || n.includes('feed') || n.includes('starter') || n.includes('grower') || n.includes('finisher')) {
    return {
      Icon: Wheat,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200/80',
      label: 'Feed',
    };
  }
  if (
    cat.includes('vaccin') ||
    cat.includes('medic') ||
    n.includes('vaccine') ||
    n.includes('injection') ||
    n.includes('pcv') ||
    n.includes('mycoplasma') ||
    n.includes('iron')
  ) {
    return {
      Icon: Syringe,
      color: 'text-teal-700',
      bg: 'bg-teal-50',
      border: 'border-teal-200/80',
      label: 'Veterinary',
    };
  }
  return {
    Icon: Package,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200/80',
    label: 'Supply',
  };
}

// ─── Upgraded Section Card Component ───
function SectionCard({ title, action, actionLabel, children, id }) {
  const displayLabel = typeof actionLabel === 'string' ? actionLabel.replace(/\s*→\s*$/, '') : actionLabel;
  const hasArrow = typeof actionLabel === 'string' && actionLabel.includes('→');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-300 overflow-hidden" id={id}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        {action && (
          <button
            onClick={action}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-0.5 group/act"
          >
            <span>{displayLabel}</span>
            {hasArrow && (
              <ChevronRight className="w-3.5 h-3.5 group-hover/act:translate-x-0.5 transition-transform" />
            )}
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Dashboard({ scrollToSection, loggedInUser, onLogout }) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = sessionStorage.getItem('swinesync_active_tab');
      if (saved && isValidTab(saved) && canAccessTab(loggedInUser, saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'dashboard';
  });
  const [mobileNav, setMobileNav] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const isAdmin = isAdminUser(loggedInUser);

  useEffect(() => {
    try {
      sessionStorage.setItem('swinesync_active_tab', activeTab);
    } catch {
      // Ignore storage access errors
    }
  }, [activeTab]);

  const handleTabChange = useCallback((nextTab) => {
    if (!canAccessTab(loggedInUser, nextTab)) {
      toast.error('Access denied', 'Administrative privileges are required for that section.');
      try {
        sessionStorage.setItem('swinesync_active_tab', 'dashboard');
      } catch {
        // Ignore storage errors
      }
      setActiveTab('dashboard');
      return;
    }
    try {
      sessionStorage.setItem('swinesync_active_tab', nextTab);
    } catch {
      // Ignore storage errors
    }
    setActiveTab(nextTab);
  }, [loggedInUser]);

  // Live Module Data States
  const [pigStats, setPigStats] = useState({
    total: 0, sows: 0, boars: 0, piglets: 0, batches: 0, healthy: 0, sick: 0, quarantine: 0,
  });
  const [penStats, setPenStats] = useState({
    totalPens: 0, occupiedPens: 0, totalCapacity: 0, occupiedHeads: 0, occupancyPercent: 0, fullOrNearFull: 0,
  });
  const [breedingStats, setBreedingStats] = useState({
    activeCount: 0, dueSoonCount: 0, gestatingCount: 0,
  });
  const [marketStats, setMarketStats] = useState({
    total: 0, weaners: 0, finishers: 0,
  });
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [baseActionItems, setBaseActionItems] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [dashboardInventory, setDashboardInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingApprovalsList, setPendingApprovalsList] = useState([]);

  // Calendar State (Defaults to current local date)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  // Action Center pagination toggle
  const [showAllActions, setShowAllActions] = useState(false);

  // Header notification bell dropdown
  const NOTIF_LIMIT = 10;
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('swinesync_read_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const persistReadIds = (ids) => {
    setReadNotifIds(ids);
    try {
      localStorage.setItem('swinesync_read_notifications', JSON.stringify(ids.slice(-200)));
    } catch {
      // ignore storage issues
    }
  };

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  // ─── Parallel Live Data Synchronizer ───
  const loadDashboardData = async () => {
    setDashboardLoading(true);
    setInventoryLoading(true);

    try {
      const [
        statsRes,
        pensRes,
        healthRes,
        vaxRes,
        breedingRes,
        growthBatchesRes,
        itemsRes,
        txRes,
        sickPigsRes,
        sickBatchesRes,
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/api/pigs/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/pens`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/health-logs`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/vaccination-records`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/breeding-logs`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/growth/active-feed-batches`).then(r => r.ok ? r.json() : null).catch(() => null),
        supabase.from('inventory_items').select('*').eq('is_archived', false).order('last_updated_at', { ascending: false }),
        supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('pigs').select('pig_id, pig_tag, gender, status, pen_id, pens(pen_code)').in('status', ['sick', 'quarantine', 'Sick', 'Quarantine']).eq('is_archived', false),
        supabase.from('piglet_batches').select('batch_id, batch_tag, status, current_count, pen_id, pens(pen_code)').in('status', ['sick', 'quarantine', 'Sick', 'Quarantine']).eq('is_archived', false),
      ]);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // 1. Pig Stats
      const statsData = statsRes.status === 'fulfilled' ? statsRes.value : null;
      if (statsData) {
        setPigStats({
          total: statsData.total ?? 0,
          sows: statsData.sows ?? 0,
          boars: statsData.boars ?? 0,
          piglets: statsData.piglets ?? 0,
          batches: statsData.batches ?? 0,
          healthy: statsData.healthy ?? 0,
          sick: statsData.sick ?? 0,
          quarantine: statsData.quarantine ?? 0,
        });
      }

      // 2. Pen Stats
      const pensData = pensRes.status === 'fulfilled' ? (pensRes.value?.data || pensRes.value || []) : [];
      if (Array.isArray(pensData)) {
        const totalPens = pensData.length;
        const occupiedPens = pensData.filter(p => (Number(p.occupied) || 0) > 0).length;
        const totalCapacity = pensData.reduce((sum, p) => sum + (Number(p.maxCapacity) || 0), 0);
        const occupiedHeads = pensData.reduce((sum, p) => sum + (Number(p.occupied) || 0), 0);
        const occupancyPercent = totalCapacity > 0 ? Math.round((occupiedHeads / totalCapacity) * 100) : 0;
        const fullOrNearFull = pensData.filter(p => {
          const cap = Number(p.maxCapacity) || 0;
          const occ = Number(p.occupied) || 0;
          return cap > 0 && (occ / cap) >= 0.9;
        }).length;
        setPenStats({ totalPens, occupiedPens, totalCapacity, occupiedHeads, occupancyPercent, fullOrNearFull });
      }

      // 3. Health Alerts (Live Sick & Monitoring: Synchronized from Pigs, Batches & Health Logs)
      const healthLogs = healthRes.status === 'fulfilled' ? (healthRes.value?.data || healthRes.value || []) : [];
      const sickPigsList = sickPigsRes.status === 'fulfilled' ? (sickPigsRes.value?.data || []) : [];
      const sickBatchesList = sickBatchesRes.status === 'fulfilled' ? (sickBatchesRes.value?.data || []) : [];

      const activeAlerts = [];
      const processedPigIds = new Set();
      const processedBatchIds = new Set();

      // Clinical health logs with active sick or monitoring status
      (healthLogs || [])
        .filter(h => !h.is_archived && ['sick', 'monitoring'].includes(String(h.status || '').toLowerCase()))
        .forEach(h => {
          const isSick = String(h.status || '').toLowerCase() === 'sick';
          if (h.pig_id) processedPigIds.add(h.pig_id);
          if (h.batch_id) processedBatchIds.add(h.batch_id);

          const matchedBatch = sickBatchesList.find(b => b.batch_id === h.batch_id);
          const matchedPig = sickPigsList.find(p => p.pig_id === h.pig_id);

          const batchCount = h.piglet_batches?.current_count ?? h.piglet_batches?.total_born_alive ?? matchedBatch?.current_count ?? matchedBatch?.total_born_alive;
          const tag = h.pigs?.pig_tag
            ? `Pig #${h.pigs.pig_tag}`
            : (h.piglet_batches?.batch_tag || matchedBatch?.batch_tag)
              ? `Batch ${h.piglet_batches?.batch_tag || matchedBatch?.batch_tag}${batchCount ? ` (${batchCount} ${batchCount === 1 ? 'head' : 'heads'})` : ''}`
              : 'Herd Animal';

          let pen = h.pigs?.pens?.pen_code
            ? `Pen ${h.pigs.pens.pen_code}`
            : h.piglet_batches?.pens?.pen_code
              ? `Pen ${h.piglet_batches.pens.pen_code}`
              : '';
          if (!pen) {
            if (matchedPig?.pens?.pen_code) pen = `Pen ${matchedPig.pens.pen_code}`;
            else if (matchedBatch?.pens?.pen_code) pen = `Pen ${matchedBatch.pens.pen_code}`;
          }

          const logDateStr = h.log_date ? new Date(h.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          const examinerStr = h.examined_by ? ` by ${h.examined_by}` : h.recorded_by ? ` by ${h.recorded_by}` : '';
          const clinicalDetail = h.diagnosis || h.symptoms || 'Clinical observation under watch';
          const summary = [clinicalDetail, logDateStr ? `Logged ${logDateStr}${examinerStr}` : ''].filter(Boolean).join(' • ');

          activeAlerts.push({
            id: h.health_id,
            tag,
            pen: pen || 'Assigned Pen',
            status: isSick ? 'Sick' : 'Monitoring',
            severity: isSick ? 'high' : 'medium',
            summary,
            desc: clinicalDetail,
            pigId: h.pig_id,
            batchId: h.batch_id,
          });
        });

      // Swine marked as sick/quarantine in herd records (e.g. from Swine Management)
      sickPigsList.forEach(p => {
        if (!processedPigIds.has(p.pig_id)) {
          const isSick = String(p.status || '').toLowerCase() === 'sick';
          const pen = p.pens?.pen_code ? `Pen ${p.pens.pen_code}` : 'Assigned Pen';
          activeAlerts.push({
            id: `pig-${p.pig_id}`,
            tag: `${p.gender === 'Male' ? 'Boar' : p.gender === 'Female' ? 'Sow' : 'Pig'} #${p.pig_tag}`,
            pen,
            status: isSick ? 'Sick' : 'Quarantine',
            severity: isSick ? 'high' : 'medium',
            summary: 'Flagged in Swine Records • Pending Clinical Diagnosis',
            desc: `Marked as ${isSick ? 'Sick' : 'Quarantine'} in herd records`,
            pigId: p.pig_id,
          });
        }
      });

      // Piglet batches marked as sick/quarantine in herd records
      sickBatchesList.forEach(b => {
        if (!processedBatchIds.has(b.batch_id)) {
          const isSick = String(b.status || '').toLowerCase() === 'sick';
          const pen = b.pens?.pen_code ? `Pen ${b.pens.pen_code}` : 'Assigned Pen';
          const count = b.current_count || b.total_born_alive || 1;
          activeAlerts.push({
            id: `batch-${b.batch_id}`,
            tag: `Batch ${b.batch_tag} (${count} ${count === 1 ? 'head' : 'heads'})`,
            pen,
            status: isSick ? 'Sick' : 'Quarantine',
            severity: isSick ? 'high' : 'medium',
            summary: `${count} ${count === 1 ? 'head' : 'heads'} batch • Flagged in Swine Records • Pending Clinical Diagnosis`,
            desc: `${count} head batch marked as ${isSick ? 'Sick' : 'Quarantine'}`,
            batchId: b.batch_id,
          });
        }
      });

      setHealthAlerts(activeAlerts);

      // 4. Breeding Cycles
      const breedingLogs = breedingRes.status === 'fulfilled' ? (breedingRes.value?.data || breedingRes.value || []) : [];
      const activeCycles = breedingLogs.filter(b => !b.is_archived && ['pending', 'pregnant'].includes(String(b.breeding_status || '').toLowerCase()));
      const gestatingCount = activeCycles.filter(b => String(b.breeding_status || '').toLowerCase() === 'pregnant').length;
      const dueSoonChecks = breedingLogs.filter(b => !b.is_archived && (
        b.status === 'action' ||
        (Number(b.day) >= 110 && Number(b.day) <= 116)
      ));

      setBreedingStats({
        activeCount: activeCycles.length,
        dueSoonCount: dueSoonChecks.length,
        gestatingCount,
      });

      // 5. Growth Batches & Market Readiness
      const growthData = growthBatchesRes.status === 'fulfilled' ? growthBatchesRes.value : null;
      const activeBatches = Array.isArray(growthData) ? growthData : (growthData?.batches || []);
      const breederSummary = growthData?.breeder_summary || null;

      let weanersCount = 0;
      let finishersCount = 0;
      activeBatches.forEach(b => {
        const age = Number(b.age_in_days) || 0;
        const count = Number(b.current_count) || 0;
        if (age >= 28 && age < 90) {
          weanersCount += count;
        } else if (age >= 150) {
          finishersCount += count;
        }
      });
      const totalMarketReady = weanersCount + finishersCount;

      setMarketStats({
        total: totalMarketReady,
        weaners: weanersCount,
        finishers: finishersCount,
      });

      // 6. Action Center Task Synthesis (Breeding + Boosters + Milestones)
      const tasks = [];

      // Breeding Actions
      breedingLogs.forEach(b => {
        if (b.is_archived) return;
        const day = Number(b.day) || 0;
        const formattedMating = b.matingDate
          ? new Date(b.matingDate.includes('T') ? b.matingDate : b.matingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const sowLabel = b.tag.toLowerCase().startsWith('sow-') || b.tag.toLowerCase().startsWith('sow')
          ? `Sow ${b.tag.toUpperCase()}`
          : `Sow #${b.tag}`;

        if (b.status === 'action') {
          if (b.breeding_status === 'pending') {
            const hasHeat = !!b.heat_check_date;
            tasks.push({
              id: `br_act_${b.breeding_id}`,
              text: hasHeat ? `Pregnancy Check • ${sowLabel}` : `Day 21 Heat Check • ${sowLabel}`,
              pen: b.pen_code || null,
              sub: `${formattedMating ? `Mated ${formattedMating} • ` : ''}Parity ${b.parity || 1} • Day ${day}`,
              urgency: day > 30 ? 'OVERDUE' : 'ACTION DUE',
              actionLabel: hasHeat ? 'Log Result' : 'Check Heat',
              targetTab: 'breeding_logs',
              category: 'Breeding',
            });
          } else if (b.breeding_status === 'pregnant' && day >= 114) {
            tasks.push({
              id: `br_farr_${b.breeding_id}`,
              text: `Farrowing Overdue • ${sowLabel} (Day ${day})`,
              pen: b.pen_code || null,
              sub: `Gestation target reached (114d) • Pen inspection required`,
              urgency: 'OVERDUE',
              actionLabel: 'Log Farrowing',
              targetTab: 'breeding_logs',
              category: 'Breeding',
            });
          }
        } else if (b.breeding_status === 'pregnant' && day >= 110 && day < 114) {
          tasks.push({
            id: `br_near_${b.breeding_id}`,
            text: `Farrowing Watch • ${sowLabel} (Day ${day})`,
            pen: b.pen_code || null,
            sub: `Expected around ${b.dueDate || 'in ' + (114 - day) + ' days'} • Prepare farrowing pen`,
            urgency: 'DUE SOON',
            actionLabel: 'View Sow',
            targetTab: 'breeding_logs',
            category: 'Breeding',
          });
        }
      });

      // Vaccine Boosters Due
      const vaxList = vaxRes.status === 'fulfilled' ? (vaxRes.value?.data || vaxRes.value || []) : [];
      vaxList.forEach(v => {
        if (v.is_archived || !v.booster_due_date) return;
        const bDateStr = v.booster_due_date.includes('T') ? v.booster_due_date : v.booster_due_date + 'T00:00:00';
        const bDate = new Date(bDateStr);
        const diffDays = Math.round((bDate.getTime() - todayStart.getTime()) / 86400000);
        if (diffDays <= 7) {
          const targetName = v.pigs?.pig_tag
            ? `Pig #${v.pigs.pig_tag}`
            : v.piglet_batches?.batch_tag
              ? `Batch ${v.piglet_batches.batch_tag}`
              : 'Herd Animal';
          const penCode = v.pigs?.pens?.pen_code || v.piglet_batches?.pens?.pen_code || null;
          const urgencyLabel = diffDays < 0 ? 'OVERDUE' : diffDays === 0 ? 'DUE TODAY' : diffDays === 1 ? 'IN 1 DAY' : `IN ${diffDays} DAYS`;
          const cleanVaxName = v.vaccine_name ? v.vaccine_name.replace(/\s+Vaccine$/i, '') : 'Vaccine';
          const cleanDosage = (v.dosage || '1 dose/head').replace(/1\s+doses/gi, '1 dose');
          const formattedDue = bDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          tasks.push({
            id: `vax_${v.vaccination_id}`,
            text: `${cleanVaxName} Booster • ${targetName}`,
            pen: penCode,
            sub: `Due ${formattedDue} • ${cleanDosage}`,
            urgency: urgencyLabel,
            actionLabel: 'Administer',
            targetTab: 'health_management',
            category: 'Veterinary',
          });
        }
      });

      // Weaning Transition Tasks (Sucklings approaching or past 28-day target)
      activeBatches.forEach(b => {
        const statusStr = String(b.status || '').toLowerCase();
        const isSuckling = statusStr === 'suckling' || statusStr === 'nursing';
        if (!isSuckling || !b.date_of_birth) return;

        const dob = new Date(b.date_of_birth.includes('T') ? b.date_of_birth : b.date_of_birth + 'T00:00:00');
        const weanDate = new Date(dob.getTime() + (28 * 86400000));
        const diffDays = Math.round((weanDate.getTime() - todayStart.getTime()) / 86400000);
        const age = Number(b.age_in_days) || Math.max(0, Math.floor((todayStart.getTime() - dob.getTime()) / 86400000));
        const penTag = b.pen_code || null;
        const count = b.current_count || 1;
        const countStr = `${count} ${count === 1 ? 'piglet' : 'piglets'}`;

        // Include when within 7 days of 28-day weaning target (e.g. IN 5 DAYS) or overdue
        if (diffDays <= 7) {
          const urgencyLabel = diffDays < 0
            ? 'OVERDUE'
            : diffDays === 0
              ? 'DUE TODAY'
              : diffDays === 1
                ? 'IN 1 DAY'
                : `IN ${diffDays} DAYS`;

          const formattedWean = weanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const subText = diffDays < 0
            ? `Day ${age} (${Math.abs(diffDays)}d overdue) • Ready for Nursery Pen`
            : diffDays === 0
              ? `Day 28 reached today • Ready for Nursery Pen (${countStr})`
              : `Due ${formattedWean} (Day 28) • ${countStr}`;

          tasks.push({
            id: `wean_${b.batch_id}`,
            text: `Weaning Transition • Batch ${b.batch_tag}`,
            pen: penTag,
            sub: subText,
            urgency: urgencyLabel,
            actionLabel: 'Wean Batch',
            targetTab: 'swine_management',
            category: 'Growth',
          });
        }
      });

      const urgencyWeight = (u) => {
        if (u === 'OVERDUE') return 0;
        if (u === 'TODAY' || u === 'DUE TODAY' || u === 'ACTION' || u === 'ACTION DUE') return 1;
        if (u === 'DUE SOON' || u === 'SOON' || u === 'IN 1 DAY') return 2;
        if (typeof u === 'string' && u.startsWith('IN ')) {
          const match = u.match(/\d+/);
          const days = match ? parseInt(match[0], 10) : 3;
          return 3 + days * 0.1;
        }
        return 4;
      };
      tasks.sort((a, b) => urgencyWeight(a.urgency) - urgencyWeight(b.urgency));

      // Pin Today's Daily Feeding at the top of Live Action Center
      const fedBatchesCount = activeBatches.filter(b => b.current_feed?.fed_today).length;
      const totalBatchesCount = activeBatches.length;
      const breederHeadCount = breederSummary?.total_breeders || 0;
      const hasBreeder = !!breederSummary && breederHeadCount > 0;
      const totalFeedGroups = totalBatchesCount + (hasBreeder ? 1 : 0);
      const fedFeedGroups = fedBatchesCount + (hasBreeder && breederSummary.breeder_fed_today ? 1 : 0);

      if (totalFeedGroups > 0) {
        const allFedToday = fedFeedGroups >= totalFeedGroups;
        const unfedBatchesKg = activeBatches.reduce((sum, b) => (
          b.current_feed && !b.current_feed.fed_today
            ? sum + (Number(b.current_feed.total_daily_feed_kg) || 0)
            : sum
        ), 0);
        let savedBreederRate = 2.0;
        try {
          const saved = localStorage.getItem('swinesync_breeder_rate_per_head');
          if (saved) savedBreederRate = parseFloat(saved) || 2.0;
        } catch {
          // ignore storage access issues
        }
        const unfedBreederKg = hasBreeder && !breederSummary.breeder_fed_today
          ? Number((breederHeadCount * savedBreederRate).toFixed(1))
          : 0;
        const totalRemainingKg = Number((unfedBatchesKg + unfedBreederKg).toFixed(1));
        const groupsLabel = `${totalFeedGroups} ${totalFeedGroups === 1 ? 'group' : 'groups'}`;

        tasks.unshift({
          id: 'daily_feeding_pinned',
          text: "Today's Daily Feeding",
          pen: null,
          sub: allFedToday
            ? `All ${groupsLabel} fed today • Routine feeding complete`
            : `${fedFeedGroups} of ${totalFeedGroups} fed${totalRemainingKg > 0 ? ` • ${totalRemainingKg.toFixed(1)} kg remaining` : ' • Action needed today'}`,
          urgency: allFedToday ? 'ALL FED' : 'DUE TODAY',
          actionLabel: allFedToday ? 'View Log' : 'Feed Herd',
          targetTab: 'growth',
          category: 'Feeding',
          completed: allFedToday,
        });
      }

      setBaseActionItems(tasks);

      // 7. Calendar Events Synthesis
      const evts = [];
      breedingLogs.forEach(b => {
        if (b.is_archived) return;
        const sowLabel = b.tag.toLowerCase().startsWith('sow-') || b.tag.toLowerCase().startsWith('sow')
          ? `Sow ${b.tag.toUpperCase()}`
          : `Sow #${b.tag}`;
        const penTag = b.pen_code ? `Pen ${b.pen_code}` : null;

        if (b.expected_farrowing_date) {
          evts.push({
            id: `br_farr_${b.breeding_id}`,
            dateStr: b.expected_farrowing_date,
            title: `Farrowing • ${sowLabel}`,
            pen: penTag,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
        if (b.heat_check_date) {
          evts.push({
            id: `br_heat_${b.breeding_id}`,
            dateStr: b.heat_check_date,
            title: `Heat Check • ${sowLabel}`,
            pen: penTag,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
        if (b.preg_check_date) {
          evts.push({
            id: `br_preg_${b.breeding_id}`,
            dateStr: b.preg_check_date,
            title: `Preg Check • ${sowLabel}`,
            pen: penTag,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
      });

      vaxList.forEach(v => {
        if (v.is_archived || !v.booster_due_date) return;
        const targetName = v.pigs?.pig_tag
          ? (v.pigs.pig_tag.toLowerCase().startsWith('sow-') || v.pigs.pig_tag.toLowerCase().startsWith('boar-')
            ? v.pigs.pig_tag.toUpperCase()
            : `#${v.pigs.pig_tag}`)
          : v.piglet_batches?.batch_tag
            ? `Batch ${v.piglet_batches.batch_tag}`
            : 'Herd Animal';
        const penTag = v.pigs?.pens?.pen_code
          ? `Pen ${v.pigs.pens.pen_code}`
          : v.piglet_batches?.pens?.pen_code
            ? `Pen ${v.piglet_batches.pens.pen_code}`
            : null;
        const cleanVaxName = v.vaccine_name ? v.vaccine_name.replace(/\s+Vaccine$/i, '') : 'Vaccine';
        evts.push({
          id: `vax_${v.vaccination_id}`,
          dateStr: v.booster_due_date,
          title: `${cleanVaxName} Booster • ${targetName}`,
          pen: penTag,
          type: 'health',
          targetTab: 'health_management',
        });
      });

      activeBatches.forEach(b => {
        const statusStr = String(b.status || '').toLowerCase();
        const isSuckling = statusStr === 'suckling' || statusStr === 'nursing';

        // Add Weaning target date to calendar if batch is suckling
        if (isSuckling && b.date_of_birth) {
          const dob = new Date(b.date_of_birth.includes('T') ? b.date_of_birth : b.date_of_birth + 'T00:00:00');
          const weanDate = new Date(dob.getTime() + (28 * 86400000));
          evts.push({
            id: `cal_wean_${b.batch_id}`,
            dateStr: weanDate.toISOString().split('T')[0],
            title: `Weaning Target • Batch ${b.batch_tag}`,
            pen: b.pen_code ? `Pen ${b.pen_code}` : null,
            type: 'growth',
            targetTab: 'swine_management',
          });
        }

        (b.upcoming_milestones || []).forEach(m => {
          const targetDate = new Date(today.getTime() + (m.days_until_due * 86400000));
          evts.push({
            id: `growth_${b.batch_id}_${m.guideline_id || m.task_name}`,
            dateStr: targetDate.toISOString().split('T')[0],
            title: `${m.task_name} • Batch ${b.batch_tag}`,
            pen: b.pen_code ? `Pen ${b.pen_code}` : null,
            type: 'growth',
            targetTab: 'growth',
          });
        });
      });

      setRawEvents(evts);

      // 8. Inventory Watch (Top 5 At-Risk / Critical)
      const activeItems = itemsRes.status === 'fulfilled' ? (itemsRes.value?.data || []) : [];
      const txs = txRes.status === 'fulfilled' ? (txRes.value?.data || []) : [];
      const metricsMap = computeInventoryMetrics(activeItems, txs, 14, activeBatches, breederSummary);

      const priorityOrder = {
        out_of_stock: 0,
        critical: 1,
        low_stock: 2,
        healthy: 3,
      };

      const enrichedInv = activeItems
        .map(item => {
          const m = metricsMap[item.item_id] || {};
          const percent = getStockPercent(item.current_stock_level, item.ideal_stock_level);
          const status = getStockStatus(item.current_stock_level, item.low_stock_threshold, m.daysUntilLow, m);
          return {
            id: item.item_id,
            name: item.item_name,
            category: item.category || 'General',
            current: item.current_stock_level,
            ideal: item.ideal_stock_level,
            threshold: item.low_stock_threshold,
            unit: item.unit_of_measure,
            percent,
            status,
            dailyBurnRate: m.dailyBurnRate || 0,
            burnRateSource: m.burnRateSource || 'none',
            daysUntilLow: m.daysUntilLow,
            daysUntilEmpty: m.daysUntilEmpty,
            color: status.barColor,
          };
        })
        .sort((a, b) => {
          if (priorityOrder[a.status.key] !== priorityOrder[b.status.key]) {
            return priorityOrder[a.status.key] - priorityOrder[b.status.key];
          }
          return a.percent - b.percent;
        })
        .slice(0, 5);

      setDashboardInventory(enrichedInv);
    } catch (err) {
      console.warn('[Dashboard] Error syncing live modules:', err);
    } finally {
      setDashboardLoading(false);
      setInventoryLoading(false);
    }
  };

  const loadApprovalSummary = useCallback(async () => {
    try {
      const countRes = await fetch(`${API_BASE}/api/approvals/pending-count`);
      if (countRes.ok) {
        const countJson = await countRes.json().catch(() => ({}));
        setPendingApprovalsCount(Number(countJson.count) || 0);
      }

      if (isAdmin) {
        const listRes = await fetch(`${API_BASE}/api/approvals?status=pending`);
        if (listRes.ok) {
          const listJson = await listRes.json().catch(() => ({}));
          setPendingApprovalsList(Array.isArray(listJson.data) ? listJson.data : []);
        }
      } else {
        setPendingApprovalsList([]);
      }
    } catch {
      // ignore background summary fetch failures
    }
  }, [isAdmin]);

  useEffect(() => {
    loadApprovalSummary();
    const handleApprovalSync = () => loadApprovalSummary();
    window.addEventListener('swinesync:approvals-updated', handleApprovalSync);
    window.addEventListener('swinesync_data_updated', handleApprovalSync);
    window.addEventListener('focus', handleApprovalSync);
    return () => {
      window.removeEventListener('swinesync:approvals-updated', handleApprovalSync);
      window.removeEventListener('swinesync_data_updated', handleApprovalSync);
      window.removeEventListener('focus', handleApprovalSync);
    };
  }, [loadApprovalSummary, activeTab]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    loadDashboardData();

    // Automatically re-sync live dashboard data when returning to tab, window focus, or cross-module updates
    const handleRefresh = () => {
      loadDashboardData();
    };

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('swinesync_feeding_updated', handleRefresh);
    window.addEventListener('swinesync_inventory_updated', handleRefresh);
    window.addEventListener('swinesync_data_updated', handleRefresh);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('swinesync_feeding_updated', handleRefresh);
      window.removeEventListener('swinesync_inventory_updated', handleRefresh);
      window.removeEventListener('swinesync_data_updated', handleRefresh);
    };
  }, [activeTab]);

  // Calendar Helpers
  const firstDay = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const prevMonth = () => {
    setSelectedDay(null);
    setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  };
  const nextMonth = () => {
    setSelectedDay(null);
    setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  };
  const jumpToToday = () => {
    const now = new Date();
    setCalMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDay(now.getDate());
  };

  const currentMonthEvents = useMemo(() => {
    return rawEvents
      .filter(e => {
        if (!e.dateStr) return false;
        const d = new Date(e.dateStr.includes('T') ? e.dateStr : e.dateStr + 'T00:00:00');
        return d.getFullYear() === calMonth.year && d.getMonth() === calMonth.month;
      })
      .map(e => {
        const d = new Date(e.dateStr.includes('T') ? e.dateStr : e.dateStr + 'T00:00:00');
        return {
          ...e,
          day: d.getDate(),
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [rawEvents, calMonth]);

  const displayedEvents = useMemo(() => {
    if (selectedDay !== null) {
      return currentMonthEvents.filter(e => e.day === selectedDay);
    }
    const todayObj = new Date();
    const isCurrentMonth = todayObj.getFullYear() === calMonth.year && todayObj.getMonth() === calMonth.month;
    const minDay = isCurrentMonth ? todayObj.getDate() : 1;
    const upcoming = currentMonthEvents.filter(e => e.day >= minDay);
    return upcoming.length > 0 ? upcoming.slice(0, 5) : currentMonthEvents.slice(0, 5);
  }, [currentMonthEvents, selectedDay, calMonth]);

  const getInitials = () => {
    if (!loggedInUser) return '?';
    if (typeof loggedInUser === 'string') return loggedInUser.charAt(0).toUpperCase();
    if (typeof loggedInUser === 'object') {
      const name = loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || '';
      return name.charAt(0).toUpperCase() || '?';
    }
    return '?';
  };

  const getDisplayName = () => {
    if (!loggedInUser) return '';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Staff';
    }
    return '';
  };

  const getUserRole = () => {
    if (!loggedInUser) return 'Staff';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.role || 'Staff';
    }
    return 'Staff';
  };

  const actionItems = useMemo(() => {
    if (!isAdmin || pendingApprovalsCount <= 0) return baseActionItems;
    const summaryRow = {
      id: 'admin_pending_approvals_summary',
      text: `${pendingApprovalsCount} staff submission${pendingApprovalsCount === 1 ? '' : 's'} awaiting review`,
      pen: null,
      sub: 'Open Admin Settings -> Approvals to inspect and approve or reject requests',
      urgency: 'REVIEW',
      actionLabel: 'Review Queue',
      targetTab: 'approvals',
      category: 'Approvals',
      completed: false,
    };
    return [summaryRow, ...baseActionItems];
  }, [isAdmin, pendingApprovalsCount, baseActionItems]);

  const now = new Date();
  const isCurrentMonthView = calMonth.year === now.getFullYear() && calMonth.month === now.getMonth();
  const pendingActionCount = actionItems.filter(item => !item.completed).length;

  // Notifications: derived from live health alerts + pending action items (most urgent first)
  const allNotifications = [
    ...(isAdmin
      ? pendingApprovalsList.slice(0, 5).map((reqItem) => ({
          id: `approval_${reqItem.id}`,
          title: `Approval Needed • ${reqItem.action_label}`,
          sub: `${reqItem.submitted_by_name} • ${reqItem.summary}`,
          targetTab: 'approvals',
          level: 'high',
        }))
      : []),
    ...healthAlerts.map(a => ({
      id: `health_${a.id}`,
      title: `${a.tag} • ${a.status}`,
      sub: [a.pen, a.summary || a.desc].filter(Boolean).join(' • '),
      targetTab: 'health_management',
      level: a.severity === 'high' ? 'high' : 'medium',
    })),
    ...actionItems
      .filter(item => !item.completed)
      .map(item => ({
        id: `action_${item.id}`,
        title: item.text,
        sub: [item.urgency, item.sub].filter(Boolean).join(' • '),
        targetTab: item.targetTab,
        level: String(item.urgency || '').toUpperCase() === 'OVERDUE' ? 'high' : 'normal',
      })),
  ];
  const notifications = allNotifications.slice(0, NOTIF_LIMIT);
  const hiddenNotifCount = Math.max(0, allNotifications.length - notifications.length);
  const unreadCount = allNotifications.filter(n => !readNotifIds.includes(n.id)).length;
  const markNotifRead = (id) => {
    if (!readNotifIds.includes(id)) persistReadIds([...readNotifIds, id]);
  };
  const markAllNotifsRead = () => {
    persistReadIds([...new Set([...readNotifIds, ...allNotifications.map(n => n.id)])]);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" id="staff-portal">
      <SideNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onClose={() => setMobileNav(false)}
        onLogout={onLogout}
        loggedInUser={loggedInUser}
        mobileOpen={mobileNav}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-w-0 overflow-hidden">
        <header className={`sticky top-0 ${notifOpen ? 'z-30' : 'z-10'} h-16 bg-white border-b border-slate-200/80 px-5 lg:px-6 flex items-center justify-between gap-4 shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
              {(() => {
                for (const item of NAV_ITEMS) {
                  if (item.id === activeTab) return item.label;
                  if (item.children) {
                    const child = item.children.find(c => c.id === activeTab);
                    if (child) return child.label;
                  }
                }
                return 'Dashboard';
              })()}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(prev => !prev)}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer ${notifOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white border border-slate-200/90 shadow-lg shadow-slate-900/10 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">
                      Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={markAllNotifsRead}
                      disabled={unreadCount === 0}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-default cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">You're all caught up</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No alerts or pending tasks right now.</p>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                      {notifications.map((n) => {
                        const NIcon = getModuleIcon(n.targetTab);
                        const isRead = readNotifIds.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotifRead(n.id);
                              setNotifOpen(false);
                              if (n.targetTab) setActiveTab(n.targetTab);
                            }}
                            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${isRead ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/70'}`}
                          >
                            <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-slate-100/80 text-slate-600">
                              <NIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs truncate ${isRead ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'}`}>
                                {n.title}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{n.sub}</p>
                            </div>
                            {!isRead && (
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.level === 'high' ? 'bg-rose-500' : 'bg-emerald-500'}`} aria-label="Unread" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {hiddenNotifCount > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 text-center">
                      Showing latest {NOTIF_LIMIT} • +{hiddenNotifCount} more
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-200/80" aria-hidden="true" />

            <div className="flex items-center gap-2.5 pl-1" id="header-profile-badge">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs shadow-emerald-600/20 select-none">
                {getInitials()}
              </div>
              <div className="hidden sm:block min-w-0 text-left">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[140px] leading-tight" title={getDisplayName() || 'Staff'}>
                  {getDisplayName() || 'Staff'}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide truncate mt-0.5">
                  {getUserRole()?.toLowerCase() === 'admin' ? 'Administrator' : 'Staff Portal'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto animate-module-switch" key={activeTab}>
          <style>{`
            @keyframes moduleSlideUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-module-switch {
              animation: moduleSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>

          {activeTab === 'dashboard' && (
            <main className="p-5 lg:p-6 space-y-5">
              {/* ─── ROW 1: LIVE KPI STRIP (4 Clickable Cards Across Full Width) ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Herd */}
                <button
                  onClick={() => setActiveTab('swine_management')}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Herd</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <PigSnout className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900">{pigStats.total}</span>
                    <span className="text-xs font-semibold text-slate-400">heads</span>
                  </div>
                </button>

                {/* 2. Herd Health Status */}
                <button
                  onClick={() => setActiveTab('health_management')}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Herd Health</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <HeartPulse className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900">{pigStats.healthy}</span>
                    <span className="text-xs font-semibold text-slate-400">healthy</span>
                    {(pigStats.sick > 0 || pigStats.quarantine > 0) && (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full ml-1 shrink-0">
                        {pigStats.sick + pigStats.quarantine} under watch
                      </span>
                    )}
                  </div>
                </button>

                {/* 3. Breeding Pipeline */}
                <button
                  onClick={() => setActiveTab('breeding_logs')}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Breeding Pipeline</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <Dna className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900">{breedingStats.activeCount}</span>
                    <span className="text-xs font-semibold text-slate-400">active sows</span>
                  </div>
                </button>

                {/* 4. Market Ready Swine */}
                <button
                  onClick={() => {
                    const role = getUserRole().toLowerCase();
                    setActiveTab(role === 'admin' ? 'transactions' : 'growth');
                  }}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Market Ready Swine</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900">{marketStats.total}</span>
                    <span className="text-xs font-semibold text-slate-400">heads</span>
                  </div>
                </button>
              </div>

              {/* ─── ROW 2: SPLIT OPERATIONAL GRID ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* ── LEFT COLUMN: Actionable Alerts, Tasks & Compact Inventory (7/12 width) ── */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Active Health Alerts */}
                  <SectionCard
                    title={
                      <span className="inline-flex items-center gap-2">
                        Active Health Alerts
                        {healthAlerts.length > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold inline-flex items-center justify-center">
                            {healthAlerts.length}
                          </span>
                        )}
                      </span>
                    }
                    id="health-alerts-card"
                    action={() => setActiveTab('health_management')}
                    actionLabel="Manage Health →"
                  >
                    {healthAlerts.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-emerald-900">Herd Biosecurity & Health Normal</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            No active sickness or quarantine cases reported across any pens. Herd is 100% healthy.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('health_management')}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-3 py-1.5 rounded-xl cursor-pointer shrink-0 transition-colors inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log Health Check</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-2">
                          {healthAlerts.slice(0, 4).map((alert) => {
                            const isHigh = alert.severity === 'high';
                            return (
                              <div
                                key={alert.id}
                                onClick={() => setActiveTab('health_management')}
                                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer text-left ${isHigh
                                  ? 'bg-rose-50/80 border-rose-200/90 hover:bg-rose-50 hover:border-rose-300'
                                  : 'bg-amber-50/75 border-amber-200/90 hover:bg-amber-50 hover:border-amber-300'
                                  }`}
                              >
                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border transition-colors ${isHigh
                                  ? 'bg-white border-rose-200/80 text-rose-600 group-hover:bg-rose-100/70'
                                  : 'bg-white border-amber-200/80 text-amber-600 group-hover:bg-amber-100/70'
                                  }`}>
                                  {isHigh ? (
                                    <HeartPulse className="w-4 h-4" />
                                  ) : (
                                    <Activity className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold transition-colors truncate ${isHigh
                                      ? 'text-rose-950 group-hover:text-rose-700'
                                      : 'text-amber-950 group-hover:text-amber-800'
                                      }`}>
                                      {alert.tag}
                                    </span>
                                    {alert.pen && (
                                      <span className={`inline-flex items-center gap-1 font-semibold bg-white/90 border px-1.5 py-0.5 rounded text-[10px] ${isHigh
                                        ? 'text-rose-800 border-rose-200/70'
                                        : 'text-amber-800 border-amber-200/70'
                                        }`}>
                                        <MapPin className={`w-2.5 h-2.5 ${isHigh ? 'text-rose-400' : 'text-amber-500'}`} />
                                        {alert.pen}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[11px] truncate mt-0.5 ${isHigh ? 'text-rose-800/80' : 'text-amber-800/80'}`}>
                                    {alert.summary || alert.desc}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Pill color={isHigh ? 'red' : 'yellow'}>{alert.status}</Pill>
                                  <ChevronRight className={`w-4 h-4 group-hover:translate-x-0.5 transition-all ${isHigh
                                    ? 'text-rose-300 group-hover:text-rose-600'
                                    : 'text-amber-300 group-hover:text-amber-600'
                                    }`} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Top-4 Cap: Footer Banner when more alerts exist */}
                        {healthAlerts.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('health_management')}
                            className="w-full mt-2.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-rose-50/60 border border-slate-200/80 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-semibold flex items-center justify-between transition-all cursor-pointer group"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>
                                +{healthAlerts.length - 4} more swine requiring health checkup
                              </span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 group-hover:text-rose-700 inline-flex items-center gap-0.5">
                              <span>View All in Health Management</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </SectionCard>

                  {/* Live Action Center (Operational Action Feed) */}
                  <SectionCard
                    title={`Live Action Center ${pendingActionCount > 0 ? `(${pendingActionCount})` : ''}`}
                    id="todo-card"
                  >
                    {actionItems.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-emerald-900">All Routine Tasks On Schedule</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            No overdue heat checks, pending boosters, or weaning transitions require immediate attention.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-2">
                          {(showAllActions ? actionItems : actionItems.slice(0, 4)).map((item) => {
                            const ModuleIcon = getModuleIcon(item.targetTab);

                            const u = String(item.urgency || '').toUpperCase();
                            let urgencyClass = 'bg-slate-50 text-slate-600 border-slate-200/80 font-bold';
                            if (u === 'ALL FED' || u === 'DONE') {
                              urgencyClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold';
                            } else if (u === 'REVIEW') {
                              urgencyClass = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
                            } else if (u === 'OVERDUE') {
                              urgencyClass = 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold';
                            } else if (u === 'DUE TODAY' || u === 'TODAY' || u === 'ACTION' || u === 'ACTION DUE') {
                              urgencyClass = 'bg-slate-800 text-white border-slate-800 font-bold';
                            } else if (u.includes('1 DAY') || u === 'DUE SOON' || u === 'SOON') {
                              urgencyClass = 'bg-slate-50 text-slate-600 border-slate-200 font-bold';
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() => item.targetTab && setActiveTab(item.targetTab)}
                                className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer text-left"
                              >
                                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-slate-100/80 text-slate-600 group-hover:bg-slate-200/70 group-hover:text-slate-900 transition-colors">
                                  <ModuleIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                      {item.text}
                                    </span>
                                    {item.pen && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                        <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                        {item.pen.startsWith('Pen') ? item.pen : `Pen ${item.pen}`}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {item.sub}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                  <span className={`w-[76px] sm:w-[84px] h-7 flex items-center justify-center rounded-lg border text-[10px] uppercase tracking-wider shrink-0 ${urgencyClass}`}>
                                    {item.urgency}
                                  </span>
                                  <div className="w-[104px] sm:w-[114px] h-7 flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 group-hover:text-white bg-emerald-50/90 group-hover:bg-emerald-600 border border-emerald-200/80 group-hover:border-emerald-600 rounded-lg shrink-0 transition-all shadow-2xs">
                                    <span className="truncate">{item.actionLabel || 'Resolve'}</span>
                                    <ChevronRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {actionItems.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setShowAllActions(!showAllActions)}
                            className="w-full mt-2.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 text-xs font-semibold flex items-center justify-between transition-all cursor-pointer group"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>
                                {showAllActions
                                  ? `Showing all ${actionItems.length} operational actions`
                                  : `+${actionItems.length - 4} more operational actions`}
                              </span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 inline-flex items-center gap-0.5">
                              <span>{showAllActions ? 'Show Less' : 'View All'}</span>
                              <ChevronRight className={`w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform ${showAllActions ? 'rotate-90' : ''}`} />
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </SectionCard>

                  {/* Inventory Watch Card (Compact Top 3 Overview) */}
                  <SectionCard
                    title="Inventory Watch"
                    actionLabel="Manage →"
                    action={() => setActiveTab('inventory')}
                    id="inventory-card"
                  >
                    {inventoryLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="space-y-1.5 animate-pulse">
                            <div className="flex justify-between">
                              <div className="h-3.5 w-32 bg-slate-100 rounded" />
                              <div className="h-3.5 w-16 bg-slate-100 rounded" />
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full" />
                          </div>
                        ))}
                      </div>
                    ) : dashboardInventory.length === 0 ? (
                      <div className="text-center py-5 space-y-2">
                        <p className="text-xs text-slate-400">No active inventory supplies registered yet.</p>
                        <button
                          onClick={() => setActiveTab('inventory')}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          + Add First Supply
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dashboardInventory.slice(0, 3).map((item) => {
                          const isOut = item.status.key === 'out_of_stock' || Number(item.current) <= 0;
                          const isLowStock =
                            isOut ||
                            item.status.key === 'critical' ||
                            item.status.key === 'low_stock' ||
                            (item.threshold != null && Number(item.current) <= Number(item.threshold)) ||
                            item.percent <= 10;
                          const catCfg = getInventoryCategoryConfig(item.category, item.name);
                          const CatIcon = catCfg.Icon;
                          const thresholdRatio = item.threshold && item.ideal > 0 ? (item.threshold / item.ideal) : 0.25;

                          return (
                            <div
                              key={item.id}
                              onClick={() => setActiveTab('inventory')}
                              className={`group w-full px-3 py-2.5 rounded-xl border transition-all cursor-pointer space-y-1.5 text-left shadow-2xs hover:shadow-xs ${isLowStock
                                  ? 'bg-rose-50/25 border-rose-200/90 hover:border-rose-300'
                                  : 'bg-white border-slate-200/80 hover:border-emerald-300'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isLowStock ? 'bg-rose-50 border border-rose-100 text-rose-600' : `${catCfg.bg} border ${catCfg.border}`
                                    }`}>
                                    <CatIcon className={`w-3.5 h-3.5 ${isLowStock ? 'text-rose-600' : catCfg.color}`} />
                                  </div>
                                  <span className={`text-xs font-bold truncate transition-colors ${isLowStock ? 'text-slate-900 group-hover:text-rose-700' : 'text-slate-900 group-hover:text-emerald-700'
                                    }`}>
                                    {item.name}
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200/80 shrink-0">
                                      {isOut ? 'Empty' : 'Low Stock'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    <strong className="text-slate-800 font-bold">{formatCleanNumber(item.current)}</strong> / {formatCleanNumber(item.ideal)} {getShortUnit(item.unit)}
                                  </span>
                                  <span
                                    className={`text-[11px] font-extrabold min-w-[34px] text-right ${isLowStock ? 'text-rose-600' : 'text-emerald-600'
                                      }`}
                                  >
                                    {item.percent}%
                                  </span>
                                </div>
                              </div>

                              <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${isLowStock ? 'bg-rose-500' : 'bg-emerald-600'
                                    }`}
                                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                                />
                                <div
                                  className={`absolute top-0 bottom-0 w-[2px] z-10 -translate-x-1/2 ${isLowStock ? 'bg-rose-300' : 'bg-slate-300'
                                    }`}
                                  style={{ left: `${Math.min(Math.max(thresholdRatio * 100, 0), 100)}%` }}
                                  title={`Reorder threshold: ${Math.round(thresholdRatio * 100)}%`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* ── RIGHT COLUMN: Larger Farm Schedule (5/12 width) ── */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Farm Schedule Calendar */}
                  <SectionCard
                    title="Farm Schedule"
                    id="farm-calendar"
                    action={!isCurrentMonthView ? jumpToToday : undefined}
                    actionLabel={!isCurrentMonthView ? "Jump to Today" : undefined}
                  >
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Monthly Overview
                      </span>
                      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-50/70 p-0.5">
                        <button
                          onClick={prevMonth}
                          className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-500 hover:text-slate-800 cursor-pointer transition-all"
                          aria-label="Previous Month"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 px-2 min-w-[110px] text-center">
                          {MONTH_NAMES[calMonth.month]} {calMonth.year}
                        </span>
                        <button
                          onClick={nextMonth}
                          className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-500 hover:text-slate-800 cursor-pointer transition-all"
                          aria-label="Next Month"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
                      const trailingDays = totalCells - (firstDay + daysInMonth);
                      const todayObj = new Date();

                      return (
                        <div className="rounded-xl border border-slate-200/90 overflow-hidden bg-white">
                          <div className="grid grid-cols-7 bg-slate-50/90 border-b border-slate-200/80">
                            {DAY_LABELS.map((d, idx) => (
                              <div
                                key={d}
                                className={`text-center text-[10px] font-bold text-slate-500 py-2 tracking-wider ${idx < 6 ? 'border-r border-slate-200/60' : ''
                                  }`}
                              >
                                {d}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7">
                            {Array.from({ length: firstDay }).map((_, i) => (
                              <div
                                key={`lead-${i}`}
                                className={`min-h-[48px] sm:min-h-[54px] lg:min-h-[58px] bg-slate-50/40 border-b border-slate-200/70 ${i % 7 !== 6 ? 'border-r' : ''
                                  }`}
                              />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1;
                              const cellIndex = firstDay + i;
                              const isLastCol = cellIndex % 7 === 6;
                              const isLastRow = cellIndex >= totalCells - 7;
                              const dayEvts = currentMonthEvents.filter(e => e.day === day);
                              const hasEvt = dayEvts.length > 0;
                              const isToday = day === todayObj.getDate() && calMonth.month === todayObj.getMonth() && calMonth.year === todayObj.getFullYear();
                              const isSelected = selectedDay === day;

                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => setSelectedDay(prev => prev === day ? null : day)}
                                  className={[
                                    'min-h-[48px] sm:min-h-[54px] lg:min-h-[58px] p-1.5 flex flex-col justify-between items-start text-left transition-colors cursor-pointer group relative',
                                    !isLastCol ? 'border-r border-slate-200/70' : '',
                                    !isLastRow ? 'border-b border-slate-200/70' : '',
                                    isSelected
                                      ? 'bg-emerald-50/95 ring-2 ring-inset ring-emerald-500 z-10'
                                      : isToday
                                        ? 'bg-emerald-50/60 ring-1 ring-inset ring-emerald-400/80'
                                        : 'bg-white hover:bg-slate-50/90',
                                  ].join(' ')}
                                  aria-label={`Day ${day}${hasEvt ? `, ${dayEvts.length} event(s)` : ''}`}
                                >
                                  <div className="w-full flex items-center justify-between gap-1">
                                    <span
                                      className={[
                                        'text-[11px] leading-none flex items-center justify-center transition-colors',
                                        isToday
                                          ? 'w-5 h-5 rounded-md bg-emerald-600 text-white font-bold shadow-2xs'
                                          : isSelected
                                            ? 'font-bold text-emerald-800'
                                            : 'font-semibold text-slate-700 group-hover:text-slate-900',
                                      ].join(' ')}
                                    >
                                      {day}
                                    </span>
                                    {isToday && (
                                      <span className="hidden xl:inline-block text-[8px] font-extrabold uppercase tracking-wider text-emerald-700">
                                        Today
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 flex-wrap mt-1">
                                    {hasEvt && dayEvts.slice(0, 3).map((e, idx) => (
                                      <span
                                        key={idx}
                                        className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[e.type] || 'bg-teal-500'}`}
                                      />
                                    ))}
                                    {dayEvts.length > 3 && (
                                      <span className="text-[8px] font-bold text-slate-400 leading-none">
                                        +{dayEvts.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}

                            {Array.from({ length: trailingDays }).map((_, i) => {
                              const cellIndex = firstDay + daysInMonth + i;
                              const isLastCol = cellIndex % 7 === 6;
                              return (
                                <div
                                  key={`trail-${i}`}
                                  className={`min-h-[48px] sm:min-h-[54px] lg:min-h-[58px] bg-slate-50/40 ${!isLastCol ? 'border-r border-slate-200/70' : ''
                                    }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Dynamic Agenda Section with Smooth Height & Content Transitions */}
                    <div className="mt-3 pt-3.5 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800">
                          {selectedDay !== null
                            ? `Events on ${MONTH_NAMES[calMonth.month].slice(0, 3)} ${selectedDay}`
                            : 'Upcoming This Month'}
                        </span>
                        {selectedDay !== null && (
                          <button
                            onClick={() => setSelectedDay(null)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-100 transition-colors cursor-pointer"
                          >
                            Show All
                          </button>
                        )}
                      </div>

                      <div className="relative min-h-[140px]">
                        {dashboardLoading ? (
                          <div className="space-y-2 py-1 animate-pulse">
                            <div className="h-11 bg-slate-100/80 rounded-xl" />
                            <div className="h-11 bg-slate-100/80 rounded-xl" />
                          </div>
                        ) : displayedEvents.length === 0 ? (
                          <div
                            key={selectedDay !== null ? `empty-${selectedDay}` : 'empty-month'}
                            className="w-full flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-slate-50/60 border border-slate-100 animate-fade-in-up"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-100/90 flex items-center justify-center text-slate-400 mb-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <p className="text-[11px] font-semibold text-slate-700">
                              {selectedDay !== null
                                ? `No events on ${MONTH_NAMES[calMonth.month].slice(0, 3)} ${selectedDay}`
                                : 'No events scheduled this month'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[210px] leading-relaxed">
                              All routine herd checks and operations clear for this date.
                            </p>
                          </div>
                        ) : (
                          <div key={selectedDay !== null ? `day-${selectedDay}` : 'upcoming'} className="space-y-1.5 animate-fade-in-up">
                            {displayedEvents.map((evt) => (
                              <button
                                key={evt.id || (evt.dateStr + '_' + evt.title)}
                                onClick={() => evt.targetTab && setActiveTab(evt.targetTab)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-2xs text-left transition-all cursor-pointer group"
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_COLORS[evt.type] || 'bg-slate-400'}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                                    {evt.title}
                                  </p>
                                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                    <span>{EVENT_LABELS[evt.type] || 'Event'}</span>
                                    {evt.pen && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-500 font-semibold">{evt.pen}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                                {selectedDay === null ? (
                                  <span className="text-[10px] font-bold text-slate-500 shrink-0 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                    {MONTH_NAMES[calMonth.month].slice(0, 3)} {evt.day}
                                  </span>
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </main>
          )}

          {!canAccessTab(loggedInUser, activeTab) ? (
            <main className="p-6 flex items-center justify-center min-h-72">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full text-center space-y-3 shadow-xs">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Administrator Access Required</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your account does not have permission to view this section.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  Back to Dashboard
                </button>
              </div>
            </main>
          ) : (
            <>
              {activeTab === 'admin' && isAdmin && (
                <main>
                  <Admin loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'approvals' && isAdmin && (
                <main>
                  <Approvals loggedInUser={loggedInUser} onQueueChanged={loadApprovalSummary} />
                </main>
              )}

              {activeTab === 'my_submissions' && !isAdmin && (
                <main>
                  <MySubmissions loggedInUser={loggedInUser} onQueueChanged={loadApprovalSummary} />
                </main>
              )}

              {activeTab === 'swine_management' && (
                <main>
                  <SwineManagement loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'pen_management' && (
                <main>
                  <PenManagement loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'breeding_logs' && (
                <main>
                  <BreedingLogs loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'growth' && (
                <main className="h-full">
                  <GrowthProgramManagement loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'health_management' && (
                <main>
                  <HealthManagement loggedInUser={loggedInUser} setActiveTab={handleTabChange} />
                </main>
              )}

              {activeTab === 'inventory' && (
                <main>
                  <InventoryManagement loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab === 'transactions' && isAdmin && (
                <main>
                  <TransactionRecords loggedInUser={loggedInUser} />
                </main>
              )}

              {activeTab !== 'dashboard' && activeTab !== 'admin' && activeTab !== 'approvals' && activeTab !== 'my_submissions' && activeTab !== 'swine_management' && activeTab !== 'pen_management' && activeTab !== 'breeding_logs' && activeTab !== 'growth' && activeTab !== 'health_management' && activeTab !== 'inventory' && activeTab !== 'transactions' && (
                <main className="p-5 lg:p-6 flex items-center justify-center min-h-64">
                  <div className="text-center space-y-4 max-w-xs mx-auto animate-fade-in">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
                      <Database className="w-6 h-6 text-slate-300 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Module Under Integration</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        This section is being connected to the database. Check back soon.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </main>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
