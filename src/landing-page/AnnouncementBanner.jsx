import React, { useState } from 'react';
import { Megaphone, Calendar, ShieldCheck, ChevronDown } from 'lucide-react';

// Farm announcements
export const FARM_ANNOUNCEMENTS = [
  {
    id: 'announcement-biosecurity-2026',
    tag: 'Announcement',
    title: 'New Visitor Biosecurity Protocol in Effect',
    summary: 'Hand disinfection and 72-hour isolation rules now apply for all visitors before entry.',
    content: 'All on-site visitors must have had zero contact with external swine operations or livestock markets within the preceding 72 hours. Mandatory hand disinfection and boot sanitation stations are positioned at the entrance lobby. Facilities and visitor pathways are disinfected daily to ensure complete herd biosecurity.',
    date: 'January 2026',
    author: "Ambo & Ang's Oink Yard Administration",
  }
];

export default function AnnouncementBanner() {
  const [activeAnnouncement] = useState(FARM_ANNOUNCEMENTS[0]);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeAnnouncement) return null;

  return (
    <aside aria-label="Important announcement" className="w-full mb-6 animate-fade-in">
      <div className="rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-lg backdrop-blur-md text-white transition-all overflow-hidden">
        {/* Main Ribbon Header Row */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {activeAnnouncement.tag}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">
              <span className="font-semibold text-white">{activeAnnouncement.title}</span>
              {!isExpanded && (
                <span className="hidden md:inline text-slate-400"> — {activeAnnouncement.summary}</span>
              )}
            </p>
          </div>

          <div className="flex items-center shrink-0">
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? 'Show less' : 'Read details'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Smooth Expandable Content Panel */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 border-t border-slate-800' : 'grid-rows-[0fr] opacity-0'
            }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-950/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pb-2 border-b border-slate-800/80">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {activeAnnouncement.author}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {activeAnnouncement.date}
                </span>
              </div>

              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
                <p className="font-semibold text-emerald-300">{activeAnnouncement.summary}</p>
                <p className="text-slate-300">{activeAnnouncement.content}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
