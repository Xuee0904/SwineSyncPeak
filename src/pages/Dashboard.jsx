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
  AlertTriangle, CheckSquare, Square,
  Bell, ChevronLeft, Settings, Menu,
  Users, HeartPulse, Grid3X3, ArrowRight,
  CheckCircle2, RefreshCw, Calendar, Check,
  Dna,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const EVENT_COLORS = {
  breeding: 'bg-purple-500',
  health: 'bg-rose-500',
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

// ─── Upgraded Section Card Component ───
function SectionCard({ title, action, actionLabel, children, id }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-sm transition-all duration-300 overflow-hidden" id={id}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        {action && (
          <button
            onClick={action}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            {actionLabel}
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
    activeCount: 0, dueSoonCount: 0, marketReadyHeads: 0,
  });
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [dashboardInventory, setDashboardInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // Calendar State (Defaults to current local date)
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  // Completed Action Items Cache (Session-persistent)
  const [completedTaskIds, setCompletedTaskIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem('swinesync_dashboard_completed_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleTodo = (id) => {
    setCompletedTaskIds((prev) => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        sessionStorage.setItem('swinesync_dashboard_completed_tasks', JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

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
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/api/pigs/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/pens`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/health-logs`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/vaccination-records`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/breeding-logs`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/growth/active-feed-batches`).then(r => r.ok ? r.json() : null).catch(() => null),
        supabase.from('inventory_items').select('*').eq('is_archived', false).order('last_updated_at', { ascending: false }),
        supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false }),
      ]);

      const today = new Date();

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

      // 3. Health Alerts (Live Sick & Monitoring)
      const healthLogs = healthRes.status === 'fulfilled' ? (healthRes.value?.data || healthRes.value || []) : [];
      const activeAlerts = (healthLogs || [])
        .filter(h => !h.is_archived && ['sick', 'monitoring'].includes(String(h.status || '').toLowerCase()))
        .map(h => {
          const isSick = String(h.status || '').toLowerCase() === 'sick';
          const tag = h.pigs?.pig_tag
            ? `Pig #${h.pigs.pig_tag}`
            : h.piglet_batches?.batch_tag
              ? `Batch ${h.piglet_batches.batch_tag}`
              : 'Herd Animal';
          const pen = h.pigs?.pens?.pen_code
            ? `Pen ${h.pigs.pens.pen_code}`
            : h.piglet_batches?.pens?.pen_code
              ? `Pen ${h.piglet_batches.pens.pen_code}`
              : '';
          return {
            id: h.health_id,
            tag,
            pen: pen || 'Assigned Pen',
            status: h.status || (isSick ? 'Sick' : 'Monitoring'),
            severity: isSick ? 'high' : 'medium',
            desc: h.diagnosis || h.symptoms || 'Clinical health observation under staff watch',
            date: h.log_date ? new Date(h.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          };
        });
      setHealthAlerts(activeAlerts);

      // 4. Breeding Cycles
      const breedingLogs = breedingRes.status === 'fulfilled' ? (breedingRes.value?.data || breedingRes.value || []) : [];
      const activeCycles = breedingLogs.filter(b => !b.is_archived && ['pending', 'pregnant'].includes(String(b.breeding_status || '').toLowerCase()));
      const dueSoonChecks = breedingLogs.filter(b => !b.is_archived && (
        b.status === 'action' ||
        (Number(b.day) >= 110 && Number(b.day) <= 116)
      ));

      // 5. Growth Batches & Market Readiness
      const growthData = growthBatchesRes.status === 'fulfilled' ? growthBatchesRes.value : null;
      const activeBatches = Array.isArray(growthData) ? growthData : (growthData?.batches || []);
      const breederSummary = growthData?.breeder_summary || null;

      let marketReadyCount = 0;
      activeBatches.forEach(b => {
        const age = Number(b.age_in_days) || 0;
        const count = Number(b.current_count) || 0;
        if ((age >= 28 && age < 90) || age >= 150) {
          marketReadyCount += count;
        }
      });

      setBreedingStats({
        activeCount: activeCycles.length,
        dueSoonCount: dueSoonChecks.length,
        marketReadyHeads: marketReadyCount,
      });

      // 6. Action Center Task Synthesis (Breeding + Boosters + Milestones)
      const tasks = [];

      // Breeding Actions
      breedingLogs.forEach(b => {
        if (b.is_archived) return;
        const day = Number(b.day) || 0;
        if (b.status === 'action') {
          if (b.breeding_status === 'pending') {
            const hasHeat = !!b.heat_check_date;
            tasks.push({
              id: `br_act_${b.breeding_id}`,
              text: hasHeat ? `Pregnancy Check Due: Sow #${b.tag}` : `Day 21 Heat Check: Sow #${b.tag}`,
              sub: `Mated ${b.matingDate || ''} • Parity ${b.parity || 1} • Action needed`,
              urgency: day > 30 ? 'OVERDUE' : 'ACTION',
              targetTab: 'breeding_logs',
              category: 'Breeding',
            });
          } else if (b.breeding_status === 'pregnant' && day >= 114) {
            tasks.push({
              id: `br_farr_${b.breeding_id}`,
              text: `Farrowing Overdue: Sow #${b.tag} (Day ${day})`,
              sub: `Gestation target reached (114d) • Pen inspection required`,
              urgency: 'OVERDUE',
              targetTab: 'breeding_logs',
              category: 'Breeding',
            });
          }
        } else if (b.breeding_status === 'pregnant' && day >= 110 && day < 114) {
          tasks.push({
            id: `br_near_${b.breeding_id}`,
            text: `Farrowing Watch: Sow #${b.tag} (Day ${day})`,
            sub: `Expected around ${b.dueDate || 'in ' + (114 - day) + ' days'} • Prepare farrowing pen`,
            urgency: 'SOON',
            targetTab: 'breeding_logs',
            category: 'Breeding',
          });
        }
      });

      // Vaccine Boosters Due
      const vaxList = vaxRes.status === 'fulfilled' ? (vaxRes.value?.data || vaxRes.value || []) : [];
      vaxList.forEach(v => {
        if (v.is_archived || !v.booster_due_date) return;
        const bDate = new Date(v.booster_due_date);
        const diffDays = Math.ceil((bDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          const targetName = v.pigs?.pig_tag
            ? `Pig #${v.pigs.pig_tag}`
            : v.piglet_batches?.batch_tag
              ? `Batch ${v.piglet_batches.batch_tag}`
              : 'Herd Animal';
          tasks.push({
            id: `vax_${v.vaccination_id}`,
            text: `Booster: ${v.vaccine_name} for ${targetName}`,
            sub: `Due: ${bDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • Dosage: ${v.dosage || 'Standard'}`,
            urgency: diffDays < 0 ? 'OVERDUE' : diffDays === 0 ? 'TODAY' : `${diffDays}D`,
            targetTab: 'health_management',
            category: 'Health',
          });
        }
      });

      // Growth Milestones Due
      activeBatches.forEach(b => {
        (b.upcoming_milestones || []).forEach(m => {
          if (m.days_until_due <= 7) {
            tasks.push({
              id: `growth_${b.batch_id}_${m.guideline_id || m.task_name}`,
              text: `${m.task_name} (Batch ${b.batch_tag})`,
              sub: `${m.activity_type} • ${b.pen_code ? 'Pen ' + b.pen_code : 'No pen assigned'} • ${m.days_until_due <= 0 ? 'Due Today' : `In ${m.days_until_due} days`}`,
              urgency: m.days_until_due < 0 ? 'OVERDUE' : m.days_until_due === 0 ? 'TODAY' : `${m.days_until_due}D`,
              targetTab: 'growth',
              category: 'Growth',
            });
          }
        });
      });

      const urgencyWeight = { OVERDUE: 0, TODAY: 1, ACTION: 2, SOON: 3 };
      tasks.sort((a, b) => (urgencyWeight[a.urgency] ?? 4) - (urgencyWeight[b.urgency] ?? 4));
      setActionItems(tasks);

      // 7. Calendar Events Synthesis
      const evts = [];
      breedingLogs.forEach(b => {
        if (b.is_archived) return;
        if (b.expected_farrowing_date) {
          evts.push({
            dateStr: b.expected_farrowing_date,
            title: `Farrowing: Sow #${b.tag}`,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
        if (b.heat_check_date) {
          evts.push({
            dateStr: b.heat_check_date,
            title: `Heat Check: Sow #${b.tag}`,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
        if (b.preg_check_date) {
          evts.push({
            dateStr: b.preg_check_date,
            title: `Preg Check: Sow #${b.tag}`,
            type: 'breeding',
            targetTab: 'breeding_logs',
          });
        }
      });

      vaxList.forEach(v => {
        if (v.is_archived || !v.booster_due_date) return;
        const targetName = v.pigs?.pig_tag ? `#${v.pigs.pig_tag}` : v.piglet_batches?.batch_tag ? v.piglet_batches.batch_tag : '';
        evts.push({
          dateStr: v.booster_due_date,
          title: `Booster: ${v.vaccine_name} ${targetName ? '(' + targetName + ')' : ''}`,
          type: 'health',
          targetTab: 'health_management',
        });
      });

      activeBatches.forEach(b => {
        (b.upcoming_milestones || []).forEach(m => {
          const targetDate = new Date(today.getTime() + (m.days_until_due * 86400000));
          evts.push({
            dateStr: targetDate.toISOString().split('T')[0],
            title: `${m.task_name} (${b.batch_tag})`,
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

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
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
        const d = new Date(e.dateStr);
        return d.getFullYear() === calMonth.year && d.getMonth() === calMonth.month;
      })
      .map(e => {
        const d = new Date(e.dateStr);
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

  const getInitialsSafe = () => {
    if (!loggedInUser) return '?';
    if (typeof loggedInUser === 'string') return loggedInUser.charAt(0).toUpperCase();
    if (typeof loggedInUser === 'object') {
      const name = loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || '';
      return name.charAt(0).toUpperCase() || '?';
    }
    return '?';
  };

  const getUserRole = () => {
    if (!loggedInUser) return 'Staff';
    if (typeof loggedInUser === 'string') return loggedInUser;
    if (typeof loggedInUser === 'object') {
      return loggedInUser.role || 'Staff';
    }
    return 'Staff';
  };

  const urgentTasksCount = actionItems.filter(t => !completedTaskIds.includes(t.id) && ['OVERDUE', 'TODAY', 'ACTION'].includes(t.urgency)).length;
  const totalNotificationCount = healthAlerts.length + urgentTasksCount;

  const handleBellClick = () => {
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
    setTimeout(() => {
      const target = healthAlerts.length > 0
        ? document.getElementById('health-alerts-card')
        : document.getElementById('todo-card');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleSettingsClick = () => {
    const role = getUserRole().toLowerCase();
    if (role === 'admin') {
      setActiveTab('admin');
    } else {
      toast.info('Admin access required to modify facility parameters.');
    }
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleBellClick}
              className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              title={`${totalNotificationCount} active alerts & priority items`}
            >
              <Bell className="w-5 h-5" />
              {totalNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-2 h-2 rounded-full bg-rose-500 border border-white" />
              )}
            </button>
            <button
              onClick={handleSettingsClick}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              title="System Administration"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center select-none cursor-pointer">
              {getInitialsSafe()}
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
                  title="View Swine Herd Management"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Herd</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">{pigStats.total}</span>
                      <span className="text-xs font-semibold text-slate-400">heads</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      {pigStats.sows} Sows • {pigStats.boars} Boars • {pigStats.piglets} Piglets
                    </p>
                  </div>
                </button>

                {/* 2. Herd Health Status */}
                <button
                  onClick={() => setActiveTab('health_management')}
                  className={`border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between ${
                    pigStats.sick > 0 || pigStats.quarantine > 0
                      ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                      : 'bg-white border-slate-200/70 hover:border-emerald-300'
                  }`}
                  title="View Herd Health Management"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Herd Health</span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      pigStats.sick > 0 || pigStats.quarantine > 0
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <HeartPulse className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">{pigStats.healthy}</span>
                      <span className="text-xs font-semibold text-emerald-600">healthy</span>
                    </div>
                    <p className="text-[11px] font-semibold mt-1 truncate">
                      {pigStats.sick > 0 || pigStats.quarantine > 0 ? (
                        <span className="text-rose-600 font-bold">
                          {pigStats.sick} Sick • {pigStats.quarantine} Quarantine
                        </span>
                      ) : (
                        <span className="text-emerald-700">100% In Good Condition</span>
                      )}
                    </p>
                  </div>
                </button>

                {/* 3. Pen Capacity & Occupancy */}
                <button
                  onClick={() => setActiveTab('pen_management')}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                  title="View Pen Layout & Occupancy"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pen Capacity</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <Grid3X3 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">
                        {penStats.occupiedPens}/{penStats.totalPens}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">pens</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      {penStats.occupancyPercent}% Occupied ({penStats.occupiedHeads}/{penStats.totalCapacity} hd)
                    </p>
                  </div>
                </button>

                {/* 4. Breeding & Growth Pipeline */}
                <button
                  onClick={() => setActiveTab('breeding_logs')}
                  className="bg-white border border-slate-200/70 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left cursor-pointer group flex flex-col justify-between"
                  title="View Breeding Cycles & Growth"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Breeding & Growth</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                      <Dna className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">{breedingStats.activeCount}</span>
                      <span className="text-xs font-semibold text-slate-400">active sows</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      {breedingStats.dueSoonCount > 0 ? `${breedingStats.dueSoonCount} checks due` : 'Cycles normal'} • {breedingStats.marketReadyHeads} mkt ready
                    </p>
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
                    title={`⚠️ Active Health Alerts ${healthAlerts.length > 0 ? `(${healthAlerts.length})` : ''}`}
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
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer shrink-0"
                        >
                          View Logs →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {healthAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
                              alert.severity === 'high'
                                ? 'bg-rose-50/70 border-rose-100 hover:border-rose-200'
                                : 'bg-amber-50/70 border-amber-100 hover:border-amber-200'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg mt-0.5 ${
                              alert.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              🐷
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs font-bold text-slate-900 truncate">{alert.tag}</p>
                                <div className="flex items-center gap-1.5">
                                  <Pill color={alert.severity === 'high' ? 'red' : 'yellow'}>{alert.status}</Pill>
                                  <button
                                    onClick={() => setActiveTab('health_management')}
                                    className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 cursor-pointer ml-1 inline-flex items-center gap-0.5"
                                    title="View in Health Management"
                                  >
                                    Inspect <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">{alert.desc}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-medium">
                                <span>{alert.pen}</span>
                                {alert.date && <span>• Logged {alert.date}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Live Action Center (Synthesized To-Do) */}
                  <SectionCard
                    title="Live Action Center"
                    id="todo-card"
                    action={() => loadDashboardData()}
                    actionLabel="Refresh Data"
                  >
                    {actionItems.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">All Routine Tasks On Schedule</p>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          No immediate farrowing checks, overdue boosters, or critical stock alerts require attention today.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pb-1 border-b border-slate-50">
                          <span>{actionItems.filter(t => completedTaskIds.includes(t.id)).length} of {actionItems.length} completed</span>
                          <span className="text-[10px] text-slate-400">Click item to open module</span>
                        </div>
                        {actionItems.map(item => {
                          const isDone = completedTaskIds.includes(item.id);
                          const urgencyColor =
                            item.urgency === 'OVERDUE' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                            item.urgency === 'TODAY' || item.urgency === 'ACTION' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            item.urgency === 'SOON' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-slate-100 text-slate-600 border-slate-200';

                          return (
                            <div
                              key={item.id}
                              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                isDone
                                  ? 'bg-slate-50/80 border-slate-100 opacity-60'
                                  : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-xs'
                              }`}
                            >
                              <button
                                onClick={() => toggleTodo(item.id)}
                                className="cursor-pointer shrink-0 mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
                                title={isDone ? "Mark as pending" : "Mark as completed"}
                              >
                                {isDone ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-500 fill-emerald-100" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                    {item.text}
                                  </span>
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${urgencyColor}`}>
                                    {item.urgency}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed truncate">{item.sub}</p>
                              </div>
                              {item.targetTab && (
                                <button
                                  onClick={() => setActiveTab(item.targetTab)}
                                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1"
                                  title={`Jump to ${item.category}`}
                                >
                                  <span>Open</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* ── RIGHT COLUMN: Farm Schedule & Inventory Watch (1/3 width) ── */}
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
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800">
                        {MONTH_NAMES[calMonth.month]} {calMonth.year}
                      </span>
                      <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer transition-colors"
                        title="Next Month"
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

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(prev => prev === day ? null : day)}
                            className="flex flex-col items-center py-0.5 cursor-pointer group"
                            title={hasEvt ? `${dayEvts.length} event(s) on ${MONTH_NAMES[calMonth.month]} ${day}` : `Day ${day}`}
                          >
                            <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                              isSelected
                                ? 'bg-slate-900 text-white font-bold ring-2 ring-emerald-500'
                                : isToday
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-600 group-hover:bg-slate-100'
                            }`}>
                              {day}
                            </span>
                            {hasEvt ? (
                              <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${EVENT_COLORS[dayEvts[0].type] || 'bg-emerald-500'}`} />
                            ) : (
                              <span className="w-1.5 h-1.5 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Dynamic Agenda Section */}
                    <div className="mt-4 pt-3.5 border-t border-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">
                          {selectedDay !== null
                            ? `Events on ${MONTH_NAMES[calMonth.month].slice(0, 3)} ${selectedDay}`
                            : 'Upcoming This Month'}
                        </span>
                        {selectedDay !== null && (
                          <button
                            onClick={() => setSelectedDay(null)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                          >
                            Show All
                          </button>
                        )}
                      </div>

                      {displayedEvents.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-2 italic text-center">
                          {selectedDay !== null
                            ? 'No events scheduled for this day.'
                            : 'No events scheduled for this month.'}
                        </p>
                      ) : (
                        displayedEvents.map((evt, i) => (
                          <button
                            key={i}
                            onClick={() => evt.targetTab && setActiveTab(evt.targetTab)}
                            className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer group"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_COLORS[evt.type] || 'bg-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                                {evt.title}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                {EVENT_LABELS[evt.type] || 'Event'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">
                              {MONTH_NAMES[calMonth.month].slice(0, 3)} {evt.day}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
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
                      <div className="space-y-4">
                        {dashboardInventory.map((item) => {
                          const isCritical =
                            item.status.key === 'out_of_stock' ||
                            item.status.key === 'critical';
                          const isLow = item.status.key === 'low_stock';
                          const isLowOrCritical = isCritical || isLow;
                          const isAtRisk = item.daysUntilLow != null && item.daysUntilLow <= 7;

                          return (
                            <div key={item.id} className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-semibold text-slate-700 truncate">{item.name}</span>
                                  <span className="text-[10px] font-medium text-slate-400">
                                    ({item.current}/{item.ideal} {getShortUnit(item.unit)}
                                    {hasSubUnit(item.unit) && ` • ${formatSubUnitEquivalent(item.current, item.unit)}`})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isCritical && (
                                    <Pill color="red">{item.status.label}</Pill>
                                  )}
                                  {isLow && (
                                    <Pill color="yellow">{item.status.label}</Pill>
                                  )}
                                  <span className="text-xs font-bold text-slate-500">{item.percent}%</span>
                                </div>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                                />
                              </div>
                              {isAtRisk && (
                                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>
                                    <strong>{item.name}</strong> will hit low stock in{' '}
                                    <strong>{item.daysUntilLow} {item.daysUntilLow === 1 ? 'day' : 'days'}</strong>
                                    {item.dailyBurnRate > 0 &&
                                      ` (~${item.dailyBurnRate} ${getShortUnit(item.unit)}/day${hasSubUnit(item.unit) ? ` • ${formatSubUnitEquivalent(item.dailyBurnRate, item.unit)}/day` : ""
                                      })`} — restock soon.
                                  </span>
                                </p>
                              )}
                              {isLowOrCritical && item.dailyBurnRate > 0 && item.daysUntilEmpty != null && (
                                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-600">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>
                                    Burning <strong>~{item.dailyBurnRate} {getShortUnit(item.unit)}/day{hasSubUnit(item.unit) ? ` (${formatSubUnitEquivalent(item.dailyBurnRate, item.unit)}/day)` : ""}</strong> — est.{' '}
                                    <strong>{item.daysUntilEmpty} {item.daysUntilEmpty === 1 ? 'day' : 'days'}</strong> until empty.
                                  </span>
                                </p>
                              )}
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
