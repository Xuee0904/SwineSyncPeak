import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, User, Mail, Shield, Clock, Calendar, CheckCircle2, AlertCircle, FileText, ChevronRight, Search } from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function StaffDetailModal({ isOpen, onClose, staff, allLogs = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const { shouldRender, requestClose, overlayClassName, panelClassName } = 
    useModalAnimation(isOpen, onClose);

  if (!shouldRender || !staff) return null;

  // Filter logs specifically for this staff member + keyword + action category
  const staffLogs = allLogs.filter((log) => {
    if (!log) return false;
    const logEmail = (log.user_email || '').toLowerCase();
    const staffEmail = (staff.email || '').toLowerCase();
    const logName = (log.user_name || '').toLowerCase();
    const staffName = (staff.name || '').toLowerCase();

    const matchesStaff = (logEmail && staffEmail && logEmail === staffEmail) || 
                         (logName && staffName && (logName.includes(staffName) || staffName.includes(logName)));
    if (!matchesStaff) return false;

    // Action Category Filter
    if (actionFilter !== 'ALL') {
      const title = (log.event_title || '').toLowerCase();
      const desc = (log.event_desc || '').toLowerCase();
      const combined = `${title} ${desc}`;

      if (actionFilter === 'ADD' && !combined.includes('create') && !combined.includes('add') && !combined.includes('new') && !combined.includes('register')) {
        return false;
      }
      if (actionFilter === 'EDIT' && !combined.includes('edit') && !combined.includes('update') && !combined.includes('change') && !combined.includes('modify')) {
        return false;
      }
      if (actionFilter === 'ARCHIVE' && !combined.includes('archive') && !combined.includes('restore') && !combined.includes('delete')) {
        return false;
      }
    }

    // Keyword Search
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const titleMatches = (log.event_title || '').toLowerCase().includes(q);
      const descMatches = (log.event_desc || '').toLowerCase().includes(q);
      if (!titleMatches && !descMatches) return false;
    }

    return true;
  });

  const isTargetAdmin = (staff.role || '').toLowerCase() === 'admin';

  return createPortal(
    <div 
      className={`fixed inset-0 lg:left-60 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => e.target === e.currentTarget && requestClose()} 
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes modal-panel-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modal-panel-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        .animate-modal-in  { animation: modal-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-modal-out { animation: modal-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
      `}</style>

      <div 
        className={[
          'w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left flex flex-col max-h-[85vh]',
          panelClassName,
        ].join(' ')}
      >
        {/* Modal Header */}
        <div className="px-8 pt-7 pb-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-slate-50/40">
          <div className="flex items-center gap-4">
            <img 
              src={staff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'Staff')}&background=0D8ABC&color=fff`} 
              alt={staff.name} 
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white shadow-md shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                  {staff.name || 'Staff Profile'}
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                  isTargetAdmin 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs'
                }`}>
                  {isTargetAdmin ? <Shield className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : null}
                  {staff.role}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-[10px] text-slate-600 ml-1">
                  <span className={`w-2 h-2 rounded-full ${
                    staff.status === 'Active' ? 'bg-emerald-500 shadow-xs shadow-emerald-500' : staff.status === 'Archived' ? 'bg-rose-500' : 'bg-slate-400'
                  }`} />
                  {staff.status}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {staff.email}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={requestClose} 
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-8 pt-6 space-y-6 overflow-y-auto flex-1 no-scrollbar">
          {/* Activity Logs Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 shrink-0">
                <FileText className="w-4 h-4 text-emerald-600" />
                Staff Activity Audit Trail
              </h4>

              {/* Filter Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search Bar */}
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter logs..."
                    className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Action Category Pills */}
                <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/60 text-[10px] font-bold">
                  {['ALL', 'ADD', 'EDIT', 'ARCHIVE'].map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setActionFilter(act)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        actionFilter === act 
                          ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {act === 'ALL' ? 'All' : act === 'ADD' ? 'Add' : act === 'EDIT' ? 'Edit' : 'Archive'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {staffLogs.length > 0 ? (
              <div className="space-y-2">
                {staffLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const dateFormatted = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeFormatted = dateObj.toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  });

                  return (
                    <div 
                      key={log.log_id} 
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-2xs hover:border-slate-300/80 transition-all flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{log.event_title}</span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            log.status === 'SUCCESS' ? 'bg-emerald-500' : log.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-amber-400'
                          }`} title={log.status} />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{log.event_desc}</p>
                      </div>
                      <div className="text-right shrink-0 text-slate-400 font-medium">
                        <span className="block text-[11px] font-bold text-slate-600">{dateFormatted}</span>
                        <span className="block text-[10px]">{timeFormatted}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
                <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No Activity Logs Found</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  This account has not yet triggered any recorded database actions or system transactions.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-slate-50/60 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            type="button" 
            onClick={requestClose} 
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
