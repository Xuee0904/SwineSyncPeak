import React, { useState, useEffect } from 'react';
import { Megaphone, ArrowRight, X, Calendar, ShieldCheck, ChevronRight } from 'lucide-react';

// Farm announcements
export const FARM_ANNOUNCEMENTS = [
  {
    id: 'announcement-biosecurity-2026',
    tag: 'Biosecurity Notice',
    title: 'New Visitor Biosecurity Protocol in Effect',
    summary: 'Hand disinfection and 72-hour isolation rules now apply for all visitors before entry.',
    content: 'All on-site visitors must have had zero contact with external swine operations or livestock markets within the preceding 72 hours. Mandatory hand disinfection and boot sanitation stations are positioned at the entrance lobby. Facilities and visitor pathways are disinfected daily to ensure complete herd biosecurity.',
    date: 'January 2026',
    author: "Ambo & Ang's Oink Yard Administration",
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  }
];

export default function AnnouncementBanner() {
  const [activeAnnouncement, setActiveAnnouncement] = useState(FARM_ANNOUNCEMENTS[0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Lock body scroll when announcement modal is open
  useEffect(() => {
    if (!modalOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [modalOpen]);

  if (dismissed || !activeAnnouncement) return null;

  return (
    <>
      {/* Top Banner Ribbon inside / above Hero */}
      <aside aria-label="Important announcement" className="w-full mb-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 shadow-md backdrop-blur-sm text-white transition-all">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              {activeAnnouncement.tag}
            </span>
            <p className="text-xs font-medium text-slate-200 truncate">
              <span className="font-semibold text-white">{activeAnnouncement.title}</span>
              <span className="hidden md:inline text-slate-400"> — {activeAnnouncement.summary}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer"
            >
              Read details
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
              title="Dismiss announcement"
              aria-label="Dismiss announcement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Detailed Announcement Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left flex flex-col">
            {/* Top accent bar */}
            <div className="h-2 w-full bg-emerald-600 shrink-0" />

            {/* Close button */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 sm:p-8 space-y-4">
              <div className="space-y-2 pr-6">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  {activeAnnouncement.tag}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {activeAnnouncement.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
                  <span>{activeAnnouncement.author}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {activeAnnouncement.date}
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-600 leading-relaxed space-y-3 pt-2">
                <p className="font-medium text-slate-800">{activeAnnouncement.summary}</p>
                <p className="text-slate-600">{activeAnnouncement.content}</p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setModalOpen(false)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Close Notice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
