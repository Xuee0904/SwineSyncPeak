import React, { useState, useEffect } from 'react';
import Catalog from '../landing-page/Catalog';
import SideNav, { NAV_ITEMS } from '../components/SideNav';
import Admin from './Admin';
import SwineManagement from './SwineManagement';
import {
  Sparkles, Database, ArrowUpRight, ChevronRight,
  AlertTriangle, CheckSquare, Square,
  Bell, ChevronLeft, Settings, Menu,
} from 'lucide-react';

const LOW_THRESHOLD = 15;
const INVENTORY = [
  { name: 'Supplements',      percent: 8,  dailyUsage: 0.8, color: '#ef4444' },
  { name: 'High Protein Mix', percent: 42, dailyUsage: 3.5, color: '#f59e0b' },
  { name: 'Grower Feed',      percent: 85, dailyUsage: 4.2, color: '#16a34a' },
  { name: 'Amoxicillin',      percent: 30, dailyUsage: 2.8, color: '#f59e0b' },
  { name: 'Iron Injection',   percent: 60, dailyUsage: 1.5, color: '#16a34a' },
];

function daysUntilLow(percent, dailyUsage) {
  if (percent <= LOW_THRESHOLD) return null;
  const days = Math.floor((percent - LOW_THRESHOLD) / dailyUsage);
  return days <= 7 ? days : null;
}

const HEALTH_ALERTS = [
  { tag: 'Sow #402',   pen: 'Pen A2', status: 'High Fever',        severity: 'high'   },
  { tag: 'Batch #12',  pen: 'Pen 4',  status: 'Atypical Coughing', severity: 'medium' },
];

const TODO_ITEMS = [
  { id: 't1', text: 'Vaccinate Batch #12',          sub: 'Scheduled for Pen 4 & 5 • High Priority',          urgency: 'TODAY',  done: false },
  { id: 't2', text: 'Check Sow ID 402 Gestation',   sub: 'Day 110 monitoring • Biosecurity Alert pending',    urgency: 'URGENT', done: false },
  { id: 't3', text: 'Bio-Security Perimeter Check',  sub: 'Routine weekly inspection of fence lines',          urgency: 'WED',    done: false },
];

const EVENTS = [
  { date: 5,  title: 'Fan Timer Adjustments',   type: 'ops'    },
  { date: 10, title: 'Nursery B Vaccinations',  type: 'health' },
  { date: 12, title: 'Database Schema Sync',    type: 'tech'   },
  { date: 15, title: 'Nursery Feed Transition', type: 'feed'   },
  { date: 18, title: 'Q3 Biosecurity Audit',    type: 'safety' },
  { date: 27, title: 'Active Day',              type: 'active' },
];

const EVENT_COLORS = {
  ops: 'bg-amber-400', health: 'bg-rose-500', tech: 'bg-indigo-500',
  feed: 'bg-emerald-500', safety: 'bg-rose-700', active: 'bg-emerald-600',
};
const EVENT_LABELS = {
  ops: 'Operations', health: 'Veterinary', tech: 'System Tech',
  feed: 'Feeding', safety: 'Safety', active: 'Active Day',
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function Pill({ children, color = 'slate' }) {
  const map = {
    red:   'bg-red-100    text-red-700    border-red-200',
    yellow:'bg-amber-100  text-amber-700  border-amber-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-100  text-slate-600  border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${map[color]}`}>
      {children}
    </span>
  );
}

// ─── Upgraded Section Card Component (Defined borders & hover scaling) ───
function SectionCard({ title, action, actionLabel, children, id }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-200/90 transition-all duration-300 overflow-hidden" id={id}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-50">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action && (
          <button onClick={action} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer">
            {actionLabel}
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Dashboard({ scrollToSection, loggedInUser, onLogout }) {
  const [activeTab,   setActiveTab]  = useState('dashboard');
  const [todos,       setTodos]      = useState(TODO_ITEMS);
  const [calMonth,    setCalMonth]   = useState({ year: 2026, month: 9 });
  const [mobileNav,   setMobileNav]  = useState(false);
  const [pigStats,    setPigStats]   = useState({ total: 0, healthy: 0, sick: 0, quarantine: 0 });

  useEffect(() => {
    fetch('/api/pigs/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setPigStats({
          total:      d.total ?? 0,
          healthy:    d.healthy ?? 0,
          sick:       d.sick ?? 0,
          quarantine: d.quarantine ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  const firstDay    = new Date(calMonth.year, calMonth.month, 1).getDay();
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const prevMonth   = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth   = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const toggleTodo     = id => setTodos(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const completedTodos = todos.filter(t => t.done).length;

  const getInitialsSafe = () => {
    if (!loggedInUser) return '?';
    if (typeof loggedInUser === 'string') return loggedInUser.charAt(0).toUpperCase();
    if (typeof loggedInUser === 'object') {
      const name = loggedInUser.name || loggedInUser.user_metadata?.full_name || loggedInUser.email || '';
      return name.charAt(0).toUpperCase() || '?';
    }
    return '?';
  };

  if (!loggedInUser) {
    return (
      <div className="animate-fade-in text-left pb-16" id="dashboard-section">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #16a34a 0%, transparent 60%)' }} />
          <div className="relative space-y-5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Precision Agriculture Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight leading-snug">
              Optimized Swine Operations
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Monitor real-time herd telemetry, review biosecurity guidelines, and browse our swine catalog across all facility sectors.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={() => scrollToSection?.('protocols')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                View Protocols <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => scrollToSection?.('catalog')}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
                Swine Catalog <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

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

      <div className="flex-1 flex flex-col ml-0 lg:ml-60 min-w-0 overflow-hidden">
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
              {activeTab === 'pen_management'
                ? 'Swine Management'
                : NAV_ITEMS.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer">
              <Bell className="w-5 h-5" />
              {HEALTH_ALERTS.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border border-white" />
              )}
            </button>
            <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer">
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
            <main className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                <SectionCard title="⚠️ Active Health Alerts" id="health-alerts-card">
                  {HEALTH_ALERTS.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No active health alerts — herd is healthy.</p>
                  ) : (
                    <div className="space-y-3">
                      {HEALTH_ALERTS.map((alert, i) => (
                        <div key={i} className={`flex items-center gap-4 p-3.5 rounded-xl border ${
                          alert.severity === 'high' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
                        }`}>
                          <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-xl
                            ${alert.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                            🐷
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{alert.tag}</p>
                            <p className="text-[11px] text-slate-500">{alert.pen}</p>
                          </div>
                          <Pill color={alert.severity === 'high' ? 'red' : 'yellow'}>{alert.status}</Pill>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="To-Do"
                  id="todo-card"
                  action={() => {}}
                  actionLabel={`${completedTodos}/${todos.length} done`}
                >
                  <div className="space-y-2.5">
                    {todos.map(todo => (
                      <button
                        key={todo.id}
                        onClick={() => toggleTodo(todo.id)}
                        className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          todo.done
                            ? 'bg-slate-50 border-slate-100 opacity-60'
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                        }`}
                      >
                        {todo.done
                          ? <CheckSquare className="w-5 h-5 text-emerald-500 fill-emerald-100 shrink-0 mt-0.5" />
                          : <Square className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${todo.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {todo.text}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{todo.sub}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          todo.urgency === 'TODAY'  ? 'bg-emerald-100 text-emerald-700' :
                          todo.urgency === 'URGENT' ? 'bg-rose-100    text-rose-700'    :
                                                      'bg-slate-100   text-slate-500'
                        }`}>{todo.urgency}</span>
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Inventory" actionLabel="Manage Inventory" action={() => setActiveTab('inventory')} id="inventory-card">
                  <div className="space-y-4">
                    {INVENTORY.map((item, i) => {
                      const isLow = item.percent <= LOW_THRESHOLD;
                      const days  = daysUntilLow(item.percent, item.dailyUsage);
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                            <div className="flex items-center gap-2">
                              {isLow && <Pill color="red">Low Stock</Pill>}
                              <span className="text-xs font-bold text-slate-500">{item.percent}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
                          </div>
                          {!isLow && days !== null && (
                            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>
                                <strong>{item.name}</strong> will hit low stock in{' '}
                                <strong>{days} {days === 1 ? 'day' : 'days'}</strong> — consider restocking soon.
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-5">
                {/* Visual stats cards with upgraded shadow elevations */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Herd',  value: pigStats.total,      color: 'text-slate-900',   bg: 'bg-white'       },
                    { label: 'Healthy',     value: pigStats.healthy,    color: 'text-emerald-600', bg: 'bg-emerald-50'  },
                    { label: 'Sick',        value: pigStats.sick,       color: 'text-amber-600',   bg: 'bg-amber-50'    },
                    { label: 'Quarantine',  value: pigStats.quarantine, color: 'text-rose-600',    bg: 'bg-rose-50'     },
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} border border-slate-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow text-center`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                <SectionCard title="Farm Schedule" id="farm-calendar">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-700">
                      {MONTH_NAMES[calMonth.month]} {calMonth.year}
                    </span>
                    <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 cursor-pointer">
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
                      const evt = EVENTS.find(e => e.date === day);
                      const isToday = day === 27 && calMonth.month === 9 && calMonth.year === 2026;
                      return (
                        <div key={day} className="flex flex-col items-center py-0.5">
                          <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors
                            ${isToday ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                            {day}
                          </span>
                          {evt && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${EVENT_COLORS[evt.type]}`} />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-50 space-y-2.5">
                    {EVENTS.slice(0, 4).map((evt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${EVENT_COLORS[evt.type]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-slate-700 truncate">{evt.title}</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">{EVENT_LABELS[evt.type]}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{calMonth.monthName} {evt.date}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </main>
          )}

          {activeTab === 'admin' && (
            <main className="p-5 lg:p-6">
              <Admin loggedInUser={loggedInUser} />
            </main>
          )}

          {(activeTab === 'swine_management' || activeTab === 'pen_management') && (
            <main>
              <SwineManagement
                loggedInUser={loggedInUser}
                activeSubTab={activeTab === 'pen_management' ? 'pen_management' : undefined}
              />
            </main>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'admin' && activeTab !== 'swine_management' && activeTab !== 'pen_management' && (
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