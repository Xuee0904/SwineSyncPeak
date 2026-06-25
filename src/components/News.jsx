import React, { useState } from 'react';
import { Calendar, Tag, ChevronRight, Newspaper, ArrowRight, ShieldCheck, Flame, Info } from 'lucide-react';

export default function News() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const newsItems = [
    {
      id: 1,
      title: 'Facility Biosecurity Audit Scheduled for Q3',
      summary: 'The regional livestock commission will execute the annual Level 3 biosecurity review. Staff must verify checksheets and logbooks.',
      content: 'Detailed preparation steps will be distributed via email next Monday. Lead caretakers must ensure all quarantine locks and shower registers are fully documented. The audit will cover records of feed sources, entry sheets, and medical logs.',
      category: 'safety',
      date: 'June 18, 2026',
      author: 'Dr. Evelyn Martinez',
      important: true,
      color: 'border-l-4 border-l-rose-500'
    },
    {
      id: 2,
      title: 'Optimal Nursery Feed Formulation Release',
      summary: 'A revised feed nutrition blend has been optimized to improve FCR to 2.62 in weaning litters. Review feed hopper settings.',
      content: 'Following a 12-week study, the new grain-soy blend with phytase supplementation shows a 4% increase in daily gain. Barn managers are instructed to transition nursery pens 4 through 8 beginning Wednesday. Monitor water flow meters.',
      category: 'feeds',
      date: 'June 15, 2026',
      author: 'Marcus Vance (Nutritionist)',
      important: false,
      color: 'border-l-4 border-l-amber-500'
    },
    {
      id: 3,
      title: 'Supabase Sync Engine Database Upgrade',
      summary: 'We are completing migration of the RFID swine scanning registers to our primary Supabase backend. Brief downtime expected Thursday.',
      content: 'To prevent record loss, all handwritten entry logs must be completed between 02:00 and 04:00 AM while the database schema completes integration. Once finished, RFID ear tags will synchronize automatically in real-time.',
      category: 'tech',
      date: 'June 12, 2026',
      author: 'Sarah Chen (IT Director)',
      important: false,
      color: 'border-l-4 border-l-indigo-500'
    },
    {
      id: 4,
      title: 'Routine Vaccination Protocol for Weaners',
      summary: 'The swine veterinary team begins standard immunization batches for nursery sector B next week. Confirm animal registers.',
      content: 'This routine round covers mycoplasma and PCV2 vaccinations. caretakers are requested to verify catalog listings for weaners born between May 1 and May 15 to ensure target tags are registered.',
      category: 'safety',
      date: 'June 10, 2026',
      author: 'Dr. Evelyn Martinez',
      important: true,
      color: 'border-l-4 border-l-rose-500'
    },
    {
      id: 5,
      title: 'Energy Conservation Measures in Breeding Barns',
      summary: 'Adjustments to automated fan timers and mist nozzles will reduce energy consumption while maintaining ideal temp standards.',
      content: 'Farrowing rooms will remain at 24°C while gestating areas will adjust to 20°C during evening hours. Report any faulty digital temperature sensors to facility maintenance.',
      category: 'operations',
      date: 'June 05, 2026',
      author: 'David Cross (Facility Manager)',
      important: false,
      color: 'border-l-4 border-l-emerald-500'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Updates' },
    { id: 'safety', label: 'Biosecurity & Health' },
    { id: 'feeds', label: 'Feed & Nutrition' },
    { id: 'tech', label: 'Systems & Databases' },
    { id: 'operations', label: 'Operations' }
  ];

  const filteredNews = selectedCategory === 'all' 
    ? newsItems 
    : newsItems.filter(item => item.category === selectedCategory);

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="news-section">
      {/* Header */}
      <section className="border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-50 text-primary-600">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">News & Announcements</h1>
            <p className="text-sm text-slate-500 mt-1">
              Internal updates, operational directives, and AgTech development updates for SwineSync.
            </p>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="flex flex-wrap gap-2" id="news-filters">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-slate-905 bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-350 hover:bg-slate-50'
            }`}
            id={`news-filter-btn-${cat.id}`}
          >
            {cat.label}
          </button>
        ))}
      </section>

      {/* News Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="news-cards-grid">
        {/* Large Featured Alert Column */}
        {filteredNews.some(n => n.important) && (
          <div className="lg:col-span-3 bg-gradient-to-r from-rose-500 via-rose-600 to-swine-600 text-white rounded-3xl p-8 shadow-lg shadow-rose-950/15 relative overflow-hidden flex flex-col justify-between" id="featured-news-card">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-400/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />
            
            <div className="space-y-4 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 border border-white/25 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 fill-white animate-pulse" />
                Critical Action Required
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-tight">
                {newsItems.find(n => n.important).title}
              </h2>
              <p className="text-sm text-rose-50 leading-relaxed font-medium">
                {newsItems.find(n => n.important).summary}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4 pt-6 border-t border-white/10 relative z-10">
              <div className="text-left">
                <span className="text-[10px] text-rose-200 block uppercase font-bold tracking-wider">Published by</span>
                <span className="text-sm font-bold text-white block mt-0.5">{newsItems.find(n => n.important).author}</span>
              </div>
              <div className="text-xs text-rose-100 font-bold bg-white/15 px-3 py-1.5 rounded-xl border border-white/10">
                {newsItems.find(n => n.important).date}
              </div>
            </div>
          </div>
        )}

        {/* Normal Cards */}
        {filteredNews.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${item.color}`}
            id={`news-card-${item.id}`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.date}
                </span>
                <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full font-bold uppercase text-[9px] tracking-wider text-slate-500">
                  {item.category}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 leading-snug group-hover:text-primary-750 transition-colors text-base">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.summary}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Author</span>
                <span className="text-xs font-bold text-slate-650 text-slate-600 block">{item.author}</span>
              </div>
              <button 
                onClick={() => alert(`Full Article Preview:\n\n${item.title}\n\n${item.content}`)}
                className="p-2 bg-slate-50 hover:bg-primary-50 text-slate-400 hover:text-primary-650 rounded-xl transition-all cursor-pointer group-hover:scale-105"
                aria-label={`Read full article: ${item.title}`}
                id={`read-article-btn-${item.id}`}
              >
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-primary-600 transition-colors" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Info footer */}
      {filteredNews.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
          No news articles found in this category.
        </div>
      )}
    </div>
  );
}
