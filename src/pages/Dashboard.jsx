import React, { useState, useEffect, useMemo } from 'react';
import SideNav, { NAV_ITEMS } from '../components/SideNav';
import Admin from './Admin';
import SwineManagement from './SwineManagement';
import PenManagement from './PenManagement';
import BreedingLogs from './BreedingLogs';
import GrowthProgramManagement from './GrowthProgramManagement';
import HealthManagement from './HealthManagement';
import InventoryManagement from './InventoryManagement';
import TransactionRecords from './TransactionRecords';
import DailyFeedingPanel from '../components/Feeding/DailyFeedingPanel';
import PigSnout from '../components/common/PigSnout';
import { supabase } from '../supabaseClient';
import { toast } from '../utils/toast';
import {
  computeInventoryMetrics,
  getStockStatus,
  getStockPercent,
  hasSubUnit,
  getShortUnit,
  formatSubUnitEquivalent,
} from '../components/Inventory/inventoryUtils';
import {
  Sparkles, Database, ArrowUpRight, ChevronRight,
  AlertTriangle,
  ChevronLeft, Menu,
  Users, HeartPulse, Grid3X3, ArrowRight,
  CheckCircle2, RefreshCw, Calendar, Check,
  Dna, TrendingUp, Activity, MapPin, Plus, Syringe,
  Wheat, Package, ArrowDownLeft, Receipt, Wallet,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

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
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-sm transition-all duration-300 overflow-hidden" id={id}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);

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
  const [actionItems, setActionItems] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [dashboardInventory, setDashboardInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // Calendar State (Defaults to current local date)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  // Action Center pagination toggle
  const [showAllActions, setShowAllActions] = useState(false);

  // ─── Parallel Live Data Synchronizer ───
  const loadDashboardData = async () => {
    setDashboardLoading(true);
    setInventoryLoading(true);
    setTransactionsLoading(true);

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
        financeTxRes,
        financeSummaryRes,
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
        fetch(`${API_BASE}/api/transactions?limit=5`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/transactions/summary`).then(r => r.ok ? r.json() : null).catch(() => null),
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
      setActionItems(tasks);

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

      // 9. Recent Finance Transactions & Summary
      const txData = financeTxRes.status === 'fulfilled' ? financeTxRes.value : null;
      const txList = Array.isArray(txData?.data) ? txData.data : (Array.isArray(txData) ? txData : []);
      setRecentTransactions(txList.slice(0, 5));

      const summaryData = financeSummaryRes.status === 'fulfilled' ? financeSummaryRes.value : null;
      if (summaryData) {
        setTransactionSummary(summaryData);
      }
    } catch (err) {
      console.warn('[Dashboard] Error syncing live modules:', err);
    } finally {
      setDashboardLoading(false);
      setInventoryLoading(false);
      setTransactionsLoading(false);
    }
  };

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

  const getUserRole = () => {
    if (!loggedInUser) return 'Staff';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.role || 'Staff';
    }
    return 'Staff';
  };

  const now = new Date();
  const isCurrentMonthView = calMonth.year === now.getFullYear() && calMonth.month === now.getMonth();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" id="staff-portal">
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => setMobileNav(false)}
        onLogout={onLogout}
        loggedInUser={loggedInUser}
        mobileOpen={mobileNav}
      />

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-w-0 overflow-hidden">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">
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
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{pigStats.total}</span>
                    <span className="text-xs font-semibold text-slate-400">heads</span>
                  </div>
                </button>

                {/* 2. Herd Health Status */}
                <button
                  onClick={() => setActiveTab('health_management')}
                  className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between ${pigStats.sick > 0 || pigStats.quarantine > 0
                    ? 'border-rose-200/90 hover:border-rose-300 ring-1 ring-rose-100/70'
                    : 'border-slate-200/70 hover:border-emerald-300'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Herd Health</span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${pigStats.sick > 0 || pigStats.quarantine > 0
                      ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100/80'
                      : 'bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600'
                      }`}>
                      <HeartPulse className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{pigStats.healthy}</span>
                    <span className={`text-xs font-semibold ${pigStats.sick > 0 || pigStats.quarantine > 0 ? 'text-slate-400' : 'text-emerald-600'
                      }`}>healthy</span>
                    {(pigStats.sick > 0 || pigStats.quarantine > 0) && (
                      <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full ml-1 shrink-0">
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
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-purple-50 text-slate-500 group-hover:text-purple-600 flex items-center justify-center transition-colors">
                      <Dna className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{breedingStats.activeCount}</span>
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
                    <span className="text-2xl sm:text-3xl font-black text-slate-900">{marketStats.total}</span>
                    <span className="text-xs font-semibold text-emerald-600">heads</span>
                  </div>
                </button>
              </div>

              {/* ─── ROW 2: TODAY'S FEEDING PANEL (Full Width to Prevent Table Clipping) ─── */}
              <div id="daily-feeding-container">
                <DailyFeedingPanel variant="dashboard" onUpdated={loadDashboardData} />
              </div>

              {/* ─── ROW 3: SPLIT OPERATIONAL GRID ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                {/* ── LEFT COLUMN: Actionable Alerts & To-Do (2/3 width) ── */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Active Health Alerts */}
                  <SectionCard
                    title={`Active Health Alerts ${healthAlerts.length > 0 ? `(${healthAlerts.length})` : ''}`}
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
                          {healthAlerts.slice(0, 4).map((alert) => (
                            <div
                              key={alert.id}
                              onClick={() => setActiveTab('health_management')}
                              className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer text-left ${alert.severity === 'high'
                                ? 'hover:border-rose-300'
                                : 'hover:border-amber-300'
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-colors ${alert.severity === 'high'
                                ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
                                }`}>
                                {alert.severity === 'high' ? (
                                  <HeartPulse className="w-4 h-4" />
                                ) : (
                                  <Activity className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 group-hover:text-rose-700 transition-colors truncate">
                                    {alert.tag}
                                  </span>
                                  {alert.pen && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded text-[10px]">
                                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                      {alert.pen}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {alert.summary || alert.desc}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Pill color={alert.severity === 'high' ? 'red' : 'yellow'}>{alert.status}</Pill>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </div>
                          ))}
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
                    title={`Live Action Center ${actionItems.length > 0 ? `(${actionItems.length})` : ''}`}
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
                            const cat = item.category || 'Operations';

                            let iconNode = <Calendar className="w-4 h-4" />;
                            let boxClass = 'bg-slate-50 text-slate-600 group-hover:bg-slate-100 group-hover:text-slate-700';

                            if (cat === 'Breeding') {
                              iconNode = <Dna className="w-4 h-4" />;
                              boxClass = 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700';
                            } else if (cat === 'Veterinary') {
                              iconNode = <Syringe className="w-4 h-4" />;
                              boxClass = 'bg-teal-50 text-teal-600 group-hover:bg-teal-100 group-hover:text-teal-700';
                            } else if (cat === 'Growth' || cat === 'Weaning') {
                              iconNode = <TrendingUp className="w-4 h-4" />;
                              boxClass = 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700';
                            }

                            const u = String(item.urgency || '').toUpperCase();
                            let urgencyClass = 'bg-slate-50 text-slate-600 border-slate-200/80 font-bold';
                            if (u === 'OVERDUE') {
                              urgencyClass = 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold';
                            } else if (u === 'DUE TODAY' || u === 'TODAY' || u === 'ACTION' || u === 'ACTION DUE') {
                              urgencyClass = 'bg-amber-50 text-amber-700 border-amber-200/80 font-bold';
                            } else if (u.includes('1 DAY') || u === 'DUE SOON' || u === 'SOON') {
                              urgencyClass = 'bg-amber-50/70 text-amber-700 border-amber-200/70 font-bold';
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() => item.targetTab && setActiveTab(item.targetTab)}
                                className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer text-left"
                              >
                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-colors ${boxClass}`}>
                                  {iconNode}
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

                  {/* Inventory Watch Card (With 14-Day Burn-Rate Forecast) */}
                  <SectionCard
                    title="Inventory Watch"
                    actionLabel="Manage →"
                    action={() => setActiveTab('inventory')}
                    id="inventory-card"
                  >
                    {inventoryLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="space-y-2 animate-pulse">
                            <div className="flex justify-between">
                              <div className="h-3.5 w-32 bg-slate-100 rounded" />
                              <div className="h-3.5 w-12 bg-slate-100 rounded" />
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full" />
                          </div>
                        ))}
                      </div>
                    ) : dashboardInventory.length === 0 ? (
                      <div className="text-center py-6 space-y-2">
                        <p className="text-xs text-slate-400">No active inventory supplies registered yet.</p>
                        <button
                          onClick={() => setActiveTab('inventory')}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          + Add First Supply
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dashboardInventory.map((item) => {
                          const isOut = item.status.key === 'out_of_stock' || Number(item.current) <= 0;
                          const isLowStock =
                            isOut ||
                            item.status.key === 'critical' ||
                            item.status.key === 'low_stock' ||
                            (item.threshold != null && Number(item.current) <= Number(item.threshold)) ||
                            item.percent <= 10;
                          const isAtRisk = !isLowStock && item.daysUntilLow != null && item.daysUntilLow <= 7;
                          const catCfg = getInventoryCategoryConfig(item.category, item.name);
                          const CatIcon = catCfg.Icon;
                          const subUnitText = hasSubUnit(item.unit) ? formatSubUnitEquivalent(item.current, item.unit) : null;
                          const thresholdRatio = item.threshold && item.ideal > 0 ? (item.threshold / item.ideal) : 0.25;

                          return (
                            <div
                              key={item.id}
                              onClick={() => setActiveTab('inventory')}
                              className={`group w-full p-3 rounded-xl bg-white border transition-all cursor-pointer space-y-2 text-left shadow-2xs hover:shadow-xs ${
                                isLowStock
                                  ? 'border-rose-200/90 hover:border-rose-300'
                                  : 'border-slate-200/80 hover:border-emerald-300'
                              }`}
                            >
                              {/* Row Header: Category Icon + Name & Subunit + Stock/Capacity + % Badge */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    isLowStock ? 'bg-rose-50 border border-rose-100 text-rose-600' : `${catCfg.bg} border ${catCfg.border}`
                                  }`}>
                                    <CatIcon className={`w-4 h-4 ${isLowStock ? 'text-rose-600' : catCfg.color}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold transition-colors truncate ${
                                      isLowStock ? 'text-slate-900 group-hover:text-rose-700' : 'text-slate-900 group-hover:text-emerald-700'
                                    }`}>
                                      {item.name}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                      {catCfg.label}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs font-bold text-slate-800">
                                    {formatCleanNumber(item.current)}{' '}
                                    <span className="text-slate-400 font-normal">
                                      / {formatCleanNumber(item.ideal)} {getShortUnit(item.unit)}
                                    </span>
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                      isLowStock
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                    }`}
                                  >
                                    {isOut ? 'Empty' : isLowStock ? `Low • ${item.percent}%` : `${item.percent}%`}
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar with Synced Reorder Threshold Marker */}
                              <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isLowStock ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                                />
                                <div
                                  className={`absolute top-0 bottom-0 w-[2px] z-10 -translate-x-1/2 ${
                                    isLowStock ? 'bg-rose-300' : 'bg-slate-300'
                                  }`}
                                  style={{ left: `${Math.min(Math.max(thresholdRatio * 100, 0), 100)}%` }}
                                  title={`Reorder threshold: ${Math.round(thresholdRatio * 100)}%`}
                                />
                              </div>

                              {/* Context Line: 2-State (Good Buffer vs Low Stock/Depleted) */}
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                {isOut ? (
                                  <div className="flex items-center gap-1.5 text-rose-700 font-medium truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                    <span className="truncate">Stock depleted • Immediate restock required</span>
                                  </div>
                                ) : isLowStock ? (
                                  <div className="flex items-center gap-1.5 text-rose-700 font-medium truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                    <span className="truncate">
                                      Below reorder threshold ({formatCleanNumber(item.threshold)} {getShortUnit(item.unit)})
                                      {item.daysUntilEmpty != null ? ` • Est. ${item.daysUntilEmpty}d until empty` : ''}
                                    </span>
                                  </div>
                                ) : isAtRisk ? (
                                  <div className="flex items-center gap-1.5 text-slate-600 font-medium truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                    <span className="truncate">
                                      Est. <strong className="text-slate-800 font-bold">{item.daysUntilLow} {item.daysUntilLow === 1 ? 'day' : 'days'}</strong> to reorder threshold
                                      {item.dailyBurnRate > 0 && ` (~${formatCleanNumber(item.dailyBurnRate)} ${getShortUnit(item.unit)}/day)`}
                                    </span>
                                  </div>
                                ) : item.dailyBurnRate > 0 ? (
                                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                                    <span className="truncate">Burn rate: ~{formatCleanNumber(item.dailyBurnRate)} {getShortUnit(item.unit)}/day</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                                    <span>Stable stock buffer</span>
                                  </div>
                                )}

                                {subUnitText && (
                                  <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                    {subUnitText}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* ── RIGHT COLUMN: Farm Schedule (1/3 width) ── */}
                <div className="space-y-5">
                  {/* Farm Schedule Calendar */}
                  <SectionCard
                    title="Farm Schedule"
                    id="farm-calendar"
                    action={!isCurrentMonthView ? jumpToToday : undefined}
                    actionLabel={!isCurrentMonthView ? "Jump to Today" : undefined}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer transition-colors"
                        aria-label="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800">
                        {MONTH_NAMES[calMonth.month]} {calMonth.year}
                      </span>
                      <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer transition-colors"
                        aria-label="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 mb-1">
                      {DAY_LABELS.map(d => (
                        <div key={d} className="text-center text-[9px] font-bold text-slate-400 py-1">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-1">
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayEvts = currentMonthEvents.filter(e => e.day === day);
                        const hasEvt = dayEvts.length > 0;
                        const todayObj = new Date();
                        const isToday = day === todayObj.getDate() && calMonth.month === todayObj.getMonth() && calMonth.year === todayObj.getFullYear();
                        const isSelected = selectedDay === day;

                        const dayStyle = isSelected
                          ? (isToday
                              ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-300 ring-offset-1'
                              : 'bg-emerald-50 text-emerald-800 font-bold border-2 border-emerald-500 shadow-2xs')
                          : (isToday
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-slate-600 group-hover:bg-slate-100 font-medium');

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(prev => prev === day ? null : day)}
                            className="flex flex-col items-center py-0.5 cursor-pointer group"
                            aria-label={`Day ${day}${hasEvt ? `, ${dayEvts.length} event(s)` : ''}`}
                          >
                            <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full transition-colors ${dayStyle}`}>
                              {day}
                            </span>
                            <div className="flex items-center justify-center gap-0.5 h-1.5 mt-1">
                              {hasEvt ? (
                                dayEvts.length === 1 ? (
                                  <span className={`w-1.5 h-1.5 rounded-full ${EVENT_COLORS[dayEvts[0].type] || 'bg-teal-500'}`} />
                                ) : (
                                  dayEvts.slice(0, 3).map((e, idx) => (
                                    <span
                                      key={idx}
                                      className={`w-1 h-1 rounded-full ${EVENT_COLORS[e.type] || 'bg-teal-500'}`}
                                    />
                                  ))
                                )
                              ) : (
                                <span className="w-1.5 h-1.5 opacity-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

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

                  {/* ─── Recent Farm Transactions Card ─── */}
                  <SectionCard
                    title="Recent Transactions"
                    id="recent-transactions"
                    action={() => setActiveTab('transactions')}
                    actionLabel="View Ledger →"
                  >
                    {/* Cashflow Summary Strip (3-Column Balance) */}
                    <div className="grid grid-cols-3 gap-1 p-2 rounded-xl bg-slate-50 border border-slate-100 mb-3 text-center">
                      <div className="flex flex-col items-center justify-center py-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sales</span>
                        <span className="text-xs font-black text-emerald-700">
                          ₱{(transactionSummary?.raw?.totalSales || 0).toLocaleString('en-PH')}
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-center py-0.5 border-x border-slate-200">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Margin</span>
                        <span className={`text-xs font-black ${
                          (transactionSummary?.raw?.totalSales || 0) >= (transactionSummary?.raw?.totalExpenses || 0)
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}>
                          {(transactionSummary?.raw?.totalSales || 0) >= (transactionSummary?.raw?.totalExpenses || 0) ? '+' : ''}
                          ₱{((transactionSummary?.raw?.totalSales || 0) - (transactionSummary?.raw?.totalExpenses || 0)).toLocaleString('en-PH')}
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-center py-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expenses</span>
                        <span className="text-xs font-black text-slate-700">
                          ₱{(transactionSummary?.raw?.totalExpenses || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                    </div>

                    {/* Transactions Feed */}
                    {transactionsLoading ? (
                      <div className="space-y-2 py-1 animate-pulse">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 bg-slate-100/80 rounded-xl" />
                        ))}
                      </div>
                    ) : recentTransactions.length === 0 ? (
                      <div className="w-full flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-slate-50/60 border border-slate-100">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1.5">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-700">No transactions recorded yet</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 max-w-[210px] leading-relaxed">
                          Sales and farm expenses will appear here once logged.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white overflow-hidden">
                        {recentTransactions.map((tx) => {
                          const isSale = (tx.type || '').toLowerCase() === 'sale';
                          const isPending = (tx.status || '').toLowerCase() === 'pending';
                          const amt = Number(tx.amount || 0);

                          let partyTitle = tx.party || tx.category || 'Transaction';

                          // 1. If generic "Inventory Delivery" or "General Supplier", extract real supply item name from notes
                          if (partyTitle === 'Inventory Delivery' || partyTitle === 'General Supplier') {
                            if (tx.notes && /^Restock(?:ed)?\b/i.test(tx.notes)) {
                              const matchItem = tx.notes.match(/^Restock(?:ed)?\s+\d+(?:\.\d+)?\s*(?:sacks?|vials?|packs?|bags?|bottles?|doses?|kg)?\s*(?:\([^\)]+\)\s*)?(?:of\s+)?(.+)/i);
                              if (matchItem && matchItem[1]) {
                                partyTitle = matchItem[1].trim();
                              }
                            } else if (tx.items?.[0]?.name) {
                              partyTitle = tx.items[0].name.replace(/^Restock(?:ed)?\s+\d+.*?(?:of\s+)?/i, '').trim();
                            } else {
                              partyTitle = tx.category || 'Supply Purchase';
                            }
                          } else if (partyTitle === 'Initial Inventory Setup') {
                            if (tx.notes) {
                              const matchFor = tx.notes.match(/for\s+(.+)/i);
                              if (matchFor && matchFor[1]) {
                                partyTitle = matchFor[1].trim();
                              }
                            }
                          }

                          // 2. Strip redundant trailing words like "Restock" or "Setup" to keep pure item names
                          partyTitle = partyTitle.replace(/\s+(Restock|Setup)$/i, '').trim();

                          // Timestamp formatting: e.g. "Nov 10, 2026 • 9:05 PM"
                          const timeString = tx.time || '';
                          const dateDetails = tx.date ? (timeString ? `${tx.date} • ${timeString}` : tx.date) : 'Recent';

                          const formattedAmt = amt === 0
                            ? '₱0'
                            : `${isSale ? '+' : '-'}₱${amt.toLocaleString('en-PH')}`;

                          return (
                            <div
                              key={tx.id || tx.rawId}
                              onClick={() => setActiveTab('transactions')}
                              className="group w-full flex items-center justify-between gap-3 p-2.5 hover:bg-slate-50/90 transition-colors cursor-pointer text-left"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSale
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/80'
                                    : 'bg-slate-50 text-slate-500 border border-slate-200/60'
                                }`}>
                                  {isSale ? (
                                    <ArrowUpRight className="w-4 h-4" />
                                  ) : (
                                    <ArrowDownLeft className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                    {partyTitle}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {dateDetails}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className={`text-xs font-black block ${
                                  amt === 0
                                    ? 'text-slate-400 font-semibold'
                                    : isSale
                                      ? 'text-emerald-700'
                                      : 'text-slate-700'
                                }`}>
                                  {formattedAmt}
                                </span>
                                {isPending && (
                                  <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            </main>
          )}

          {activeTab === 'admin' && (
            <main className="p-5 lg:p-6">
              <Admin loggedInUser={loggedInUser} />
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
              <HealthManagement loggedInUser={loggedInUser} setActiveTab={setActiveTab} />
            </main>
          )}

          {activeTab === 'inventory' && (
            <main>
              <InventoryManagement loggedInUser={loggedInUser} />
            </main>
          )}

          {activeTab === 'transactions' && (
            <main>
              <TransactionRecords loggedInUser={loggedInUser} />
            </main>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'admin' && activeTab !== 'swine_management' && activeTab !== 'pen_management' && activeTab !== 'breeding_logs' && activeTab !== 'growth' && activeTab !== 'health_management' && activeTab !== 'inventory' && activeTab !== 'transactions' && (
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
                  ← Back to Dashboard
                </button>
              </div>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
