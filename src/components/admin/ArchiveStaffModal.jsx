import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient'; // Imported Supabase to retrieve active session token
import useModalAnimation from '../../hooks/useModalAnimation';

export default function ArchiveStaffModal({ isOpen, onClose, staff, onArchiveConfirm, loggedInUser, apiBaseUrl }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { shouldRender, isClosing, requestClose } = useModalAnimation(isOpen, onClose);

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

      // Retrieve the current session token to authenticate with the backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`${apiBaseUrl}/api/admin/users/${staff.fullId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Added the secure Bearer token
        },
        body: JSON.stringify({
          name: staff.name,
          role: staff.role,
          is_archived: isArchiving, // true = suspend, false = restore
          creator: creatorString,
          targetRole: staff.role
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update credentials.');
      }

      onArchiveConfirm(isArchiving);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      style={{ animation: isClosing ? 'staffModalFadeOut 180ms ease-in forwards' : 'staffModalFadeIn 200ms ease-out' }}
      onClick={(e) => e.target === e.currentTarget && requestClose()} 
      role="dialog"
    >
      <style>{`
        @keyframes staffModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes staffModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes staffModalScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes staffModalScaleOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.94) translateY(10px); }
        }
      `}</style>

      <div 
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left"
        style={{ animation: isClosing ? 'staffModalScaleOut 180ms ease-in forwards' : 'staffModalScaleIn 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className={`h-2 w-full ${isArchiving ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        <button onClick={requestClose} className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 space-y-5 text-center">
          <div className={`mx-auto w-14 h-14 rounded-full border flex items-center justify-center ${
            isArchiving ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}>
            <AlertTriangle className="w-7 h-7" strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">
              {isArchiving ? 'Archive Staff Account?' : 'Restore Staff Account?'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isArchiving ? (
                <>Are you sure you want to temporarily suspend login permissions for <span className="font-bold text-slate-700">{staff.name}</span> ({staff.email})? Their system data will remain completely intact.</>
              ) : (
                <>Restore active status and login capabilities for <span className="font-bold text-slate-700">{staff.name}</span> ({staff.email}) immediately?</>
              )}
            </p>
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border-rose-100 rounded-xl flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={requestClose} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-655 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleToggleArchive}
              disabled={loading} 
              className={`flex-1 py-3 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                isArchiving ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…</> : isArchiving ? 'Archive Account' : 'Restore Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}