import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Loader2, Lock, Unlock, ShieldCheck, History, Info, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function ArchiveStaffModal({ isOpen, onClose, staff, onArchiveConfirm, loggedInUser, apiBaseUrl }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [archiveType, setArchiveType] = useState(null);

  const { shouldRender, requestClose, overlayClassName, panelClassName } = 
    useModalAnimation(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!shouldRender || !staff) return null;

  const isArchiving = !staff.isArchived;

  const handleToggleArchive = async () => {
    try {
      setLoading(true);
      setError(null);

      let creatorString = 'Admin System';
      if (typeof loggedInUser === 'string' && loggedInUser.trim() !== '') {
        creatorString = loggedInUser;
      } else if (loggedInUser && typeof loggedInUser === 'object') {
        creatorString = loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Admin System';
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`${apiBaseUrl}/api/admin/users/${staff.fullId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: staff.name,
          role: staff.role,
          is_archived: isArchiving, 
          creator: creatorString,
          targetRole: staff.role
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update credentials.');
      }

      setArchiveType(isArchiving);
      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onArchiveConfirm(archiveType);
    requestClose();
  };

  return createPortal(
    <div 
      className={`fixed inset-0 lg:left-60 z-40 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => e.target === e.currentTarget && requestClose()} 
      role="dialog"
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
        style={{ willChange: 'transform, opacity, max-width' }}
        className={[
          'w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left transition-[max-width] duration-300 ease-in-out',
          showSuccess ? 'max-w-sm' : 'max-w-md',
          panelClassName,
        ].join(' ')}
      >
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            {/* Header matching redesigned modals */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                  isArchiving 
                    ? 'bg-rose-50 text-rose-600 border-rose-100/60' 
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100/60'
                }`}>
                  {isArchiving ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {isArchiving ? 'Archive Staff Account' : 'Restore Staff Account'}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate max-w-[210px]" title={staff.email}>
                    {staff.email}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={requestClose} 
                className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 pt-6 space-y-5">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-left animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* User Profile Card */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100/80">
                <img 
                  src={staff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'Staff')}&background=0D8ABC&color=fff`} 
                  alt={staff.name} 
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{staff.name || 'Staff Member'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{staff.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                  (staff.role || '').toLowerCase() === 'admin' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200/50'
                }`}>
                  {staff.role}
                </span>
              </div>

              {/* Concise Warning Message */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
                isArchiving 
                  ? 'bg-rose-50/70 border-rose-100 text-rose-900 font-medium' 
                  : 'bg-emerald-50/70 border-emerald-100 text-emerald-900 font-medium'
              }`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isArchiving ? 'text-rose-600' : 'text-emerald-600'}`} />
                <div>
                  <p className="font-bold">
                    {isArchiving ? 'Are you sure you want to archive this account?' : 'Are you sure you want to restore this account?'}
                  </p>
                  <p className="text-[11px] mt-1 opacity-90">
                    {isArchiving 
                      ? 'They will immediately lose portal login and system access capabilities.' 
                      : 'They will immediately regain portal login and system access capabilities.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={requestClose} 
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleToggleArchive}
                  disabled={loading} 
                  className={`flex-1 py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 ${
                    isArchiving 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  }`}
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…</>
                  ) : isArchiving ? (
                    <><Lock className="w-3.5 h-3.5" /> Confirm Archive</>
                  ) : (
                    <><Unlock className="w-3.5 h-3.5" /> Confirm Restore</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={() => handleSuccessClose()}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm ${
              archiveType 
                ? 'bg-rose-50 border-rose-100 text-rose-600' 
                : 'bg-emerald-50 border-emerald-100 text-emerald-600'
            }`}>
              {archiveType ? <Lock className="w-7 h-7 animate-bounce" strokeWidth={2.5} /> : <Check className="w-7 h-7 animate-bounce" strokeWidth={3} />}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {archiveType ? 'Account Archived' : 'Account Restored'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {staff?.name ? (
                  <>
                    The caretaker credentials for <span className="font-bold text-slate-800">{staff.name}</span> have been successfully {archiveType ? 'archived and suspended' : 'restored to active status'}.
                  </>
                ) : (
                  `The staff account has been successfully ${archiveType ? 'archived' : 'restored'}.`
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSuccessClose()}
              className={`w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 ${
                archiveType 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}