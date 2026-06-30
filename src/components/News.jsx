import React, { useState } from 'react';
import { Calendar, Newspaper, ArrowRight, Flame, Globe2, Megaphone, MapPin, ShieldCheck } from 'lucide-react';

export default function News() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  // ── News items: a mix of real-world swine disease reporting (industry) and
  //    internal farm announcements (operations). Update dates/sources as needed.
  const newsItems = [
    {
      id: 1,
      title: 'African Swine Fever Continues to Spread Across Asia and Eastern Europe',
      summary: 'APHIS now designates the entire continent of Africa, much of Asia (China, the Philippines, Vietnam, Indonesia, India), and parts of Eastern Europe as ASF-affected regions. No approved vaccine exists for widespread commercial use.',
      content: 'African Swine Fever (ASF) remains one of the most serious threats to global pig production, food security, and safe trade. The disease is nearly always fatal in domestic pigs and has no approved vaccine for widespread commercial use, though Vietnam has approved two domestically manufactured vaccines for local use. All caretakers should review entry biosecurity protocols, restrict visitor access to pens, and report any unusual mortality or symptoms (fever, loss of appetite, skin hemorrhages) immediately to the on-site veterinarian.',
      category: 'disease',
      date: 'June 2026',
      author: 'Global Biosecurity Monitor / USDA APHIS',
      important: true,
      color: 'border-l-4 border-l-rose-500'
    },
    {
      id: 2,
      title: 'South Korea Strengthens ASF Response After Detection in Livestock Feed',
      summary: 'Authorities confirmed African Swine Fever virus traces in commercial livestock feed, prompting a nationwide review of feed sourcing and milling decontamination procedures.',
      content: 'The Global Swine Disease Monitoring Report noted that South Korea is strengthening its ASF response following virus detection linked to feed supply chains. Twenty outbreaks were confirmed across seven provinces earlier this year. SwineSync feed handlers should verify all incoming feed batches carry valid decontamination certificates and avoid sourcing from unverified suppliers.',
      category: 'disease',
      date: 'May 2026',
      author: 'Swine Health Information Center',
      important: false,
      color: 'border-l-4 border-l-rose-500'
    },
    {
      id: 3,
      title: 'New Visitor Biosecurity Protocol Now in Effect',
      summary: 'A revised on-site visitor protocol has been added to protect the herd from external disease introduction, including ASF. Shower-in/shower-out and 48-hour no-contact rules now apply to all farm visitors.',
      content: 'Effective immediately, all visitors — including vendors, inspectors, and prospective partners — must complete a biosecurity declaration confirming no contact with other swine operations within the past 48 hours. Disposable boot covers and coveralls are mandatory at the entry checkpoint, and personal vehicles are no longer permitted past the outer gate. Front desk staff should direct all visitors to sign in at the new visitor log station before proceeding.',
      category: 'announcement',
      date: 'June 20, 2026',
      author: 'Dr. Evelyn Martinez, Farm Biosecurity Officer',
      important: true,
      color: 'border-l-4 border-l-amber-500'
    },
    {
      id: 4,
      title: 'SwineSync Farm Relocating to New Address Starting August 1, 2026',
      summary: 'Operations will transition to our new, larger facility beginning August 1, 2026. All staff, suppliers, and partners should update their records and logistics accordingly.',
      content: 'To support herd growth and improved biosecurity zoning, SwineSync will relocate all operations to our new facility starting August 1, 2026. The current site will remain operational through a transition period to ensure no disruption to ongoing health protocols or feeding schedules. Updated address details, delivery instructions, and visitor directions will be circulated to all staff and registered partners closer to the moving date. Please direct any logistics questions to the Facility Manager.',
      category: 'announcement',
      date: 'June 22, 2026',
      author: 'David Cross, Facility Manager',
      important: false,
      color: 'border-l-4 border-l-indigo-500'
    },
    {
      id: 5,
      title: 'Routine Vaccination Protocol for Weaners',
      summary: 'The swine veterinary team begins standard immunization batches for nursery sector B next week. Confirm animal registers before the round begins.',
      content: 'This routine round covers mycoplasma and PCV2 vaccinations. Caretakers are requested to verify catalog listings for weaners born between May 1 and May 15 to ensure target tags are registered in the system before vaccination begins.',
      category: 'operations',
      date: 'June 10, 2026',
      author: 'Dr. Evelyn Martinez',
      important: false,
      color: 'border-l-4 border-l-emerald-500'
    },
    {
      id: 6,
      title: 'Foot-and-Mouth Disease Restrictions Ease in Germany',
      summary: 'No new FMD cases have been reported in Germany; the country may regain its FMD-free status within three months, easing trade restrictions on meat and dairy.',
      content: 'According to the Global Swine Disease Monitoring Report, Germany has reported no additional foot-and-mouth disease outbreaks in recent months. If the trend continues, the country could regain its FMD-free status, allowing the removal of current trade restrictions. This is a positive signal for the broader European livestock trade, though ASF risk in the region remains separately elevated.',
      category: 'disease',
      date: 'May 2026',
      author: 'Swine Health Information Center',
      important: false,
      color: 'border-l-4 border-l-rose-500'
    }
  ];

  const categories = [
    { id: 'all',          label: 'All Updates',           icon: Newspaper },
    { id: 'disease',      label: 'Swine Disease Watch',    icon: Globe2 },
    { id: 'announcement', label: 'Farm Announcements',     icon: Megaphone },
    { id: 'operations',   label: 'Operations',             icon: ShieldCheck },
  ];

  const filteredNews = selectedCategory === 'all'
    ? newsItems
    : newsItems.filter(item => item.category === selectedCategory);

  const featured = newsItems.find(n => n.important);

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
              Global swine disease watch, farm-wide announcements, and internal operational updates for SwineSync.
            </p>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="flex flex-wrap gap-2" id="news-filters">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-300 hover:bg-slate-50'
              }`}
              id={`news-filter-btn-${cat.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </section>

      {/* News Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="news-cards-grid">
        {/* Featured alert */}
        {filteredNews.some(n => n.important) && featured && (
          <div className="lg:col-span-3 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white rounded-3xl p-8 shadow-lg shadow-rose-950/15 relative overflow-hidden flex flex-col justify-between" id="featured-news-card">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-400/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

            <div className="space-y-4 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 border border-white/25 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 fill-white animate-pulse" />
                Critical Action Required
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-tight">
                {featured.title}
              </h2>
              <p className="text-sm text-rose-50 leading-relaxed font-medium">
                {featured.summary}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4 pt-6 border-t border-white/10 relative z-10">
              <div className="text-left">
                <span className="text-[10px] text-rose-200 block uppercase font-bold tracking-wider">Source</span>
                <span className="text-sm font-bold text-white block mt-0.5">{featured.author}</span>
              </div>
              <div className="text-xs text-rose-100 font-bold bg-white/15 px-3 py-1.5 rounded-xl border border-white/10">
                {featured.date}
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
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
                <h3 className="font-bold text-slate-800 leading-snug group-hover:text-primary-700 transition-colors text-base">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.summary}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Source</span>
                <span className="text-xs font-bold text-slate-600 block">{item.author}</span>
              </div>
              <button
                onClick={() => alert(`${item.title}\n\n${item.content}`)}
                className="p-2 bg-slate-50 hover:bg-primary-50 text-slate-400 hover:text-primary-600 rounded-xl transition-all cursor-pointer group-hover:scale-105"
                aria-label={`Read full article: ${item.title}`}
                id={`read-article-btn-${item.id}`}
              >
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-primary-600 transition-colors" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {filteredNews.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 text-slate-400 text-xs">
          No news articles found in this category.
        </div>
      )}

      {/* Source disclaimer */}
      <p className="text-[10px] text-slate-400 text-center pt-4">
        Swine Disease Watch items are summarized from USDA APHIS, the Swine Health Information Center, and FAO public reporting. Farm Announcements and Operations updates are internal to SwineSync.
      </p>
    </div>
  );
}