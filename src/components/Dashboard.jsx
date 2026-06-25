import React from 'react';
import { ShieldCheck, Users, Activity, BarChart3, ChevronRight, Sparkles, Database, Globe, ArrowUpRight } from 'lucide-react';

export default function Dashboard({ scrollToSection }) {
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

  return (
    <div className="space-y-12 pb-16 animate-fade-in" id="dashboard-section">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 text-white rounded-3xl px-6 py-16 sm:px-12 sm:py-20 shadow-xl" id="hero-banner">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 rounded-full bg-swine-500/10 blur-3xl" />
        
        <div className="relative max-w-3xl space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Empowering Modern Livestock Management
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight leading-[1.1] text-white">
            Precision AgTech Ecosystem <br />
            for <span className="bg-gradient-to-r from-primary-400 to-swine-300 bg-clip-text text-transparent">Optimized Swine Operations</span>
          </h1>
          
          <p className="text-lg text-slate-300 leading-relaxed font-light">
            Welcome to SwineSync—the unified public interface and operations portal. Monitor real-time biosecurity parameters, browse genetic categories, enforce compliance guidelines, and empower staff with secure Supabase-backed management tools.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => scrollToSection('protocols')}
              className="px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-600/20 hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              id="hero-protocols-btn"
            >
              Review Safety Protocols
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollToSection('news')}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-sm rounded-xl hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              id="hero-news-btn"
            >
              Latest News
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* KPI Stats Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="text-left">
            <h2 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">Ecosystem Metrics</h2>
            <p className="text-sm text-slate-500">Real-time telemetry and management indicators across the facility.</p>
          </div>
          <span className="text-xs text-slate-400 font-medium italic">Data refreshed 1 minute ago</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                id={`stat-card-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-left space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.title}</span>
                    <div className="text-3xl font-black font-display text-slate-900 tracking-tight pt-1">{stat.value}</div>
                  </div>
                  <div className={`p-3 rounded-xl border ${stat.color} transition-transform group-hover:scale-105`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                {/* Micro SVG Sparkline Chart */}
                <div className="mt-5 h-8 flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={
                        stat.title.includes('Wellness') ? 'text-rose-500' :
                        stat.title.includes('Efficiency') ? 'text-amber-500' :
                        stat.title.includes('Biosecurity') ? 'text-indigo-500' : 'text-primary-600'
                      }
                      points={stat.sparkline.map((val, idx) => {
                        const x = (idx / (stat.sparkline.length - 1)) * 100;
                        const min = Math.min(...stat.sparkline);
                        const max = Math.max(...stat.sparkline);
                        const spread = max - min === 0 ? 1 : max - min;
                        const y = 18 - ((val - min) / spread) * 16;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                  </svg>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Status Trend</span>
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

      {/* Integration readiness / Features Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Capabilities */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 text-left space-y-6 shadow-sm">
          <h3 className="text-xl font-bold font-display text-slate-900">Platform Core Pillars</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 text-primary-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Biosecurity & Traceability</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Strict check-in procedures, isolation guidelines, and automated logging rules prevent cross-contamination.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-swine-50 text-swine-500">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Genetic Pedigree Records</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Explore lineages, weights, health tags, and litter rates within the detailed catalog grid.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Supabase Ready Database</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Fully normalized entity structure prepared for real-time tracking, RFID scanner streams, and webhooks.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Centralized Portal</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enabling seamless data flow between administrative staff, farm hands, veterinarians, and external audits.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick action controls panel */}
        <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white rounded-3xl p-8 text-left flex flex-col justify-between shadow-md">
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-display text-white">Quick Actions</h3>
            <p className="text-xs text-primary-200 leading-relaxed font-light">
              Accelerate your workflow by directly accessing key areas of the SwineSync interface.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => scrollToSection('protocols')}
              className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer group"
              id="qa-protocols-btn"
            >
              <span>Emergency Biosecurity Rules</span>
              <ChevronRight className="w-4 h-4 text-primary-300 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('news')}
              className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer group"
              id="qa-news-btn"
            >
              <span>Read Operations Board</span>
              <ChevronRight className="w-4 h-4 text-primary-300 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('faqs')}
              className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer group"
              id="qa-faqs-btn"
            >
              <span>Browse FAQs</span>
              <ChevronRight className="w-4 h-4 text-primary-300 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="w-full flex items-center justify-between p-3.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer group"
              id="qa-contact-btn"
            >
              <span>Submit Veterinarian Audit Request</span>
              <ChevronRight className="w-4 h-4 text-primary-300 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
