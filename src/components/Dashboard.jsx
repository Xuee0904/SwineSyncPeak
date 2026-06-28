import React, { useState } from 'react';
import Catalog from './Catalog';
import {
  ShieldCheck, Users, Activity, BarChart3, ChevronRight, Sparkles,
  Database, Globe, ArrowUpRight, LayoutDashboard, TrendingUp,
  ClipboardList, Receipt, Settings, Calendar as CalendarIcon, Baby
} from 'lucide-react';

export default function Dashboard({ scrollToSection, loggedInUser }) {
  const [activeSideTab, setActiveSideTab] = useState('dashboard');

  const sideNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'swine_management', label: 'Swine Management', icon: Users },
    { id: 'growth_program', label: 'Growth Program', icon: TrendingUp },
    { id: 'health_management', label: 'Health Management', icon: Activity },
    { id: 'breeding_logs', label: 'Breeding Logs', icon: Baby },
    { id: 'inventory', label: 'Inventory Management', icon: ClipboardList },
    { id: 'transactions', label: 'Transaction Records', icon: Receipt },
    { id: 'admin', label: 'Admin Settings', icon: Settings },
  ];

  const calendarEvents = [
    { date: 5, month: 'Jun', title: 'Fan timer adjustments', type: 'ops' },
    { date: 10, month: 'Jun', title: 'Nursery B Vaccinations', type: 'health' },
    { date: 12, month: 'Jun', title: 'Database Schema Sync', type: 'tech' },
    { date: 15, month: 'Jun', title: 'Nursery Feed Transition', type: 'feed' },
    { date: 18, month: 'Jun', title: 'Q3 Biosecurity Audit', type: 'safety' },
  ];

  const stats = [
    {
      title: 'Active Swine Herd',
      value: '1,482',
      change: '+4.2%',
      changeType: 'positive',
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      sparkline: [20, 25, 23, 28, 30, 35, 34, 38, 42]
    },
    {
      title: 'Biosecurity Index',
      value: '98.4%',
      change: 'Optimal',
      changeType: 'positive',
      icon: ShieldCheck,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      sparkline: [95, 96, 95.8, 97.2, 97.5, 98, 98.1, 98.4, 98.4]
    },
    {
      title: 'Feed Efficiency (FCR)',
      value: '2.68',
      change: '-0.12 FCR',
      changeType: 'positive',
      icon: BarChart3,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      sparkline: [2.9, 2.85, 2.8, 2.76, 2.72, 2.7, 2.68, 2.68, 2.68]
    },
    {
      title: 'Livestock Wellness',
      value: 'Excellent',
      change: '0 Alerts',
      changeType: 'neutral',
      icon: Activity,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      sparkline: [10, 8, 5, 4, 2, 1, 0, 0, 0]
    }
  ];

  // Configure modular display elements based on user context
  const showSidebar = !!loggedInUser;
  const showCalendar = !!loggedInUser && activeSideTab === 'dashboard';

  // Calculate grid layout sizes
  const mainColSpan = (showSidebar && showCalendar) 
    ? 'lg:col-span-6' 
    : (showSidebar && !showCalendar)
      ? 'lg:col-span-9'
      : 'lg:col-span-12';

  return (
    <div className="animate-fade-in text-left pb-16" id="dashboard-section">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT COLUMN: SIDE NAVIGATION (Staff Only) ── */}
        {showSidebar && (
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">System Navigation</h3>
              <nav className="space-y-1">
                {sideNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSideTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSideTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 shadow-sm border-l-4 border-primary-600'
                          : 'text-slate-650 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-slate-450'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        )}

        {/* ── CENTER COLUMN: ACTIVE TAB INTERFACE ── */}
        <main className={`${mainColSpan} space-y-10`}>
          
          {/* View Tab A: Dashboard Overview */}
          {activeSideTab === 'dashboard' && (
            <>
              {/* Conditional Banner based on login status */}
              {loggedInUser ? (
                /* Secured Staff Welcome Greeting Banner */
                <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-md">
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-emerald-500/10 blur-3xl pointer-events-none" />
                  <div className="relative space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Secure Staff Session
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-snug text-white">
                      Welcome back, {loggedInUser}
                    </h1>
                    <p className="text-xs text-slate-350 leading-relaxed font-light max-w-xl">
                      System status is nominal. All RFID telemetry scanner nodes are online. Use the navigation panel on the left to manage animal profiles, growth indexes, and compliance checks.
                    </p>
                  </div>
                </section>
              ) : (
                /* Public Facing Hero Banner for Guests */
                <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 text-white rounded-3xl p-6 sm:p-8 shadow-md">
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-primary-500/20 blur-3xl pointer-events-none" />
                  <div className="relative space-y-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-300 text-[10px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      Precision Agriculture Portal
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-snug">
                      Optimized Swine Operations
                    </h1>
                    <p className="text-xs text-slate-300 leading-relaxed font-light">
                      Monitor real-time telemetry, check biosecurity guidelines, and browse catalog categories across sectors A, B, and C.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={() => scrollToSection('protocols')}
                        className="px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        Protocols
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => scrollToSection('catalog')}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        View Catalog
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Ecosystem Telemetry Stats Grid */}
              <section className="space-y-4">
                <h2 className="text-base font-extrabold font-display text-slate-900 uppercase tracking-wider pl-1">Ecosystem Telemetry</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={i}
                        className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.title}</span>
                            <div className="text-2xl font-black font-display text-slate-900 tracking-tight">{stat.value}</div>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${stat.color} transition-transform group-hover:scale-105`}>
                            <Icon className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-semibold uppercase">Trend</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            stat.changeType === 'positive' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
                          }`}>
                            {stat.change}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* View Tab B: Swine Management Catalog View */}
          {activeSideTab === 'swine_management' && (
            <Catalog loggedInUser={loggedInUser} />
          )}

          {/* Fallback View Tabs: System Integration Placeholders */}
          {activeSideTab !== 'dashboard' && activeSideTab !== 'swine_management' && (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-850 text-base">Module Under Integration</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Database synchronization is completing parameters setup for this administrative panel.
                </p>
              </div>
            </div>
          )}

        </main>

        {/* ── RIGHT COLUMN: FARM CALENDAR PANEL (Staff Dashboard Only) ── */}
        {showCalendar && (
          <section className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary-655 text-primary-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Farm Calendar</h3>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">June 2026</span>
              </div>

              {/* Simulated Calendar Grid */}
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-700">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const dayNum = i + 1;
                    const hasEvent = calendarEvents.some(e => e.date === dayNum);
                    return (
                      <div
                        key={i}
                        className={`py-1.5 rounded-lg flex items-center justify-center relative ${
                          hasEvent 
                            ? 'bg-primary-50 text-primary-700 font-bold' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {dayNum}
                        {hasEvent && (
                          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Event Items List */}
              <div className="space-y-3 pt-3 border-t border-slate-50">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Upcoming Items</h4>
                <div className="space-y-2.5">
                  {calendarEvents.map((event, idx) => (
                    <div key={idx} className="flex gap-3 text-xs items-start">
                      <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-lg p-1.5 w-10 shrink-0">
                        <span className="font-bold text-slate-850 leading-none">{event.date}</span>
                        <span className="text-[8px] uppercase text-slate-400 font-bold mt-0.5">{event.month}</span>
                      </div>
                      <div className="text-left">
                        <span className="font-semibold text-slate-800 line-clamp-1">{event.title}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block mt-0.5">
                          {event.type === 'ops' ? 'Operations' :
                           event.type === 'health' ? 'Veterinary' :
                           event.type === 'tech' ? 'System Tech' : 'Feeding Nutrition'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}