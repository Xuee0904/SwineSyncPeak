import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Newspaper, ArrowRight, Flame, Globe2, Megaphone, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Static local farm announcements
const localFarmAnnouncements = [
  {
    id: 'local-announcement-1',
    title: 'New Visitor Biosecurity Protocol Now in Effect',
    summary: 'A revised on-site visitor protocol has been added to protect the herd from external disease introduction. Hand disinfection and 72-hour isolation rules now apply.',
    content: 'All visitors must have no contact with other swine operations within the past 72 hours. Hand disinfection is mandatory at the lobby. Our caretakers and facilities are disinfected daily, and we wash down paths immediately after visitor departures. For more detailed instructions on on-site requirements, please check the "Safety Protocols" section above.',
    category: 'announcement',
    date: 'January 1, 2026',
    author: 'Ambo & Ang\'s Oink Yard',
    important: true,
    color: 'border-l-4 border-l-amber-500'
  },
  {
    id: 'local-announcement-2',
    title: "Ambo & Ang's Oink Yard Relocating to New Address Starting March 13, 2024",
    summary: "We are transitioning all operations to our new facility starting March 13, 2024, coinciding with the scheduled conclusion of our current property lease agreement.",
    content: "To support long-term operational stability and herd health, Ambo & Ang's Oink Yard is relocating all animal housing and logistics to our new address starting March 13, 2024. This transition is scheduled to coincide with the conclusion of our current agricultural land lease agreement. We have secured a stable, specialized facility to ensure zero disruption to feeding schedules, veterinary treatments, or stock deliveries during the move. Updated address details and logistical instructions will be shared with our partners and suppliers shortly. Please direct any questions to management.",
    category: 'announcement',
    date: 'February 15, 2024',
    author: "Ambo & Ang's Oink Yard",
    important: true,
    color: 'border-l-4 border-l-indigo-500'
  }
];

// Localized Philippine Swine Disease fallbacks to display if NewsAPI is unconfigured or rate-limited
const defaultOfflineDiseaseNews = [
  {
    id: 'offline-disease-1',
    title: 'Bureau of Animal Industry (BAI) Monitors African Swine Fever (ASF) Status in Philippine Provinces',
    summary: 'The Department of Agriculture and the Bureau of Animal Industry continue to deploy localized containment strategies, biosecurity zoning, and strict movement checks across regional borders.',
    content: 'African Swine Fever (ASF) continues to be actively monitored by the Bureau of Animal Industry (BAI) across the Philippines. Biosecurity guidelines are continuously updated for commercial and backyard raisers alike. The Department of Agriculture encourages farmers to maintain strict quarantine procedures, chemical foot-baths, and avoid feeding kitchen scraps (swill feeding) to secure livestock. Strict municipal animal inspection checkpoints remain active across major provincial borders.',
    category: 'disease',
    date: 'June 2026',
    author: 'Philippine Bureau of Animal Industry (BAI)',
    important: false,
    url: 'https://www.bai.gov.ph',
    color: 'border-l-4 border-l-rose-500'
  },
  {
    id: 'offline-disease-2',
    title: 'National Federation of Hog Farmers Inc. Promotes Elevated Farm Disinfection Campaigns',
    summary: 'Local agricultural organizations push for elevated sanitization standards in local hog farms to secure the country’s pork supply against disease threats.',
    content: 'The National Federation of Hog Farmers, in collaboration with local veterinary boards, has launched an active biosecurity education drive across the Visayas and Mindanao regions. This movement highlights the critical importance of regular, documented pen washdowns, vehicle tire spraying, and mandatory isolation periods for any animals arriving from external trading areas. Implementing these standards shields local farms from external biological vectors.',
    category: 'disease',
    date: 'May 2026',
    author: 'National Federation of Hog Farmers Inc.',
    important: false,
    url: 'https://www.da.gov.ph',
    color: 'border-l-4 border-l-rose-500'
  }
];

// ─── News Detail Modal Component (With Scroll-Lock Fix) ───
function NewsDetailModal({ article, onClose }) {
  // Automatically locks scrolling and hides the scrollbar track when open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left max-h-[90vh] flex flex-col animate-fade-in">
        {/* Dynamic header accent bar */}
        <div className={`h-2.5 w-full shrink-0 ${
          article.category === 'disease' ? 'bg-rose-500' : 'bg-indigo-500'
        }`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer z-20"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Scroll Body */}
        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto">
          {/* Header area with padding guard to prevent text collision */}
          <div className="space-y-2 pr-10">
            <span className="inline-block px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full font-bold uppercase text-[9px] tracking-wider text-slate-500">
              {article.category === 'disease' ? 'Swine News' : 'Farm Announcement'}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {article.title}
            </h2>
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 border-t border-slate-50">
              <span>Author: {article.author}</span>
              <span>{article.date}</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {article.content || article.summary}
          </div>

          {/* Footer Action */}
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer mt-2"
          >
            Dismiss Briefing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main News Component ───
export default function News() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [liveDiseaseNews, setLiveDiseaseNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    async function fetchLiveNews() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/philippines-swine-news`);
        if (!response.ok) throw new Error('API unreachable');
        
        const data = await response.json();

        // Client-side safety net: discard any article that slipped through
        // the server filter and doesn't mention swine/pig/hog in its title or summary.
        const SWINE_KEYWORDS = [
          'swine', 'pig', 'hog', 'pork', 'piglet', 'sow', 'boar',
          'asf', 'african swine fever', 'foot-and-mouth', 'fmd',
          'livestock', 'veterinary', 'porcine', 'piggery',
        ];
        const isSwineRelated = (art) => {
          const text = `${art.title ?? ''} ${art.summary ?? ''}`.toLowerCase();
          return SWINE_KEYWORDS.some(kw => text.includes(kw));
        };

        const swineArticles = (data.articles ?? []).filter(isSwineRelated);

        if (swineArticles.length > 0) {
          setLiveDiseaseNews(swineArticles);
        } else {
          // No relevant live news — fall back to curated local content
          console.warn('No swine-related articles passed client filter. Using offline fallback.');
          setLiveDiseaseNews(defaultOfflineDiseaseNews);
        }
      } catch (err) {
        console.warn('Could not load live news, using local fallback archives:', err.message);
        setLiveDiseaseNews(defaultOfflineDiseaseNews);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveNews();
  }, []);

  const newsItems = [...localFarmAnnouncements, ...liveDiseaseNews];

  const categories = [
    { id: 'all',          label: 'All Updates',        icon: Newspaper },
    { id: 'disease',      label: 'Local Swine News',   icon: Globe2 },
    { id: 'announcement', label: 'Farm Announcements',  icon: Megaphone },
  ];

  const filteredNews = selectedCategory === 'all'
    ? newsItems
    : newsItems.filter(item => item.category === selectedCategory);

  const featured = filteredNews.find(n => n.important);

  const gridNews = (featured && selectedCategory === 'all')
    ? filteredNews.filter(item => item.id !== featured.id)
    : filteredNews;

  // Handle Card Click (External Link vs. Local Modal)
  const handleCardClick = (item) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      setSelectedArticle(item);
    }
  };

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
      {loading ? (
        <div className="flex items-center justify-center py-16 space-x-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs">Connecting to NewsAPI.org feed…</span>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="news-cards-grid">
          
          {/* Featured Critical ASF banner / Important Announcement */}
          {filteredNews.some(n => n.important) && featured && (
            <div 
              onClick={() => handleCardClick(featured)}
              className="lg:col-span-3 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 text-white rounded-3xl p-8 shadow-lg shadow-rose-950/15 relative overflow-hidden flex flex-col justify-between cursor-pointer hover:shadow-xl hover:scale-[1.005] transition-all" 
              id="featured-news-card"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-400/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

              <div className="space-y-4 max-w-2xl relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 border border-white/25 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 fill-white animate-pulse" />
                  {featured.category === 'disease' ? 'Critical Biosafety Warning' : 'Important Announcement'}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-tight text-white">
                  {featured.title}
                </h2>
                <p className="text-sm text-rose-50 leading-relaxed font-medium">
                  {featured.summary}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-4 pt-6 border-t border-white/10 relative z-10">
                <div className="text-left">
                  <span className="text-[10px] text-rose-200 block uppercase font-bold tracking-wider">Bulletin Source</span>
                  <span className="text-sm font-bold text-white block mt-0.5">{featured.author}</span>
                </div>
                <div className="text-xs text-rose-100 font-bold bg-white/15 px-3 py-1.5 rounded-xl border border-white/10">
                  {featured.date}
                </div>
              </div>
            </div>
          )}

          {/* Cards */}
          {gridNews.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item)}
              className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer hover:-translate-y-1 duration-300 ${item.color}`}
              id={`news-card-${item.id}`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {item.date}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full font-bold uppercase text-[9px] tracking-wider text-slate-500">
                    {item.category === 'disease' ? 'Disease Watch' : item.category === 'announcement' ? 'Announcement' : 'Operations'}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-slate-800 leading-snug group-hover:text-primary-700 transition-colors text-base line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Author / Source</span>
                  <span className="text-xs font-bold text-slate-650 text-slate-600 block line-clamp-1">{item.author}</span>
                </div>
                <button
                  className="p-2 bg-slate-50 hover:bg-primary-50 text-slate-400 hover:text-primary-600 rounded-xl transition-all cursor-pointer group-hover:scale-105"
                  aria-label={`Read details: ${item.title}`}
                >
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-primary-600 transition-colors" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {filteredNews.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 space-y-3">
          <div className="text-3xl">🐷</div>
          <p className="text-sm font-semibold text-slate-600">No swine-related articles found</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            The news feed only displays content related to swine health, disease alerts, and farm operations.
            Check back later for fresh updates.
          </p>
        </div>
      )}

      {/* Dynamic News Detail Modal rendered using createPortal */}
      {selectedArticle && createPortal(
        <NewsDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />,
        document.body
      )}

    </div>
  );
}