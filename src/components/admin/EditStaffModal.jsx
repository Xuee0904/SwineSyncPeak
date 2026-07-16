import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, User, UserCheck, Shield } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import SuccessEditStaffModal from './SuccessEditStaffModal';
import useModalAnimation from '../../hooks/useModalAnimation';

export default function EditStaffModal({ isOpen, onClose, staff, onEditSuccess, loggedInUser, apiBaseUrl }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [editedStaffInfo, setEditedStaffInfo] = useState(null);

  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } = 
    useModalAnimation(isOpen, onClose);

  useEffect(() => {
    if (staff && isOpen) {
      setName(staff.name || '');
      setRole(staff.role || 'Staff');
      setError(null);
      setShowSuccess(false);
      setEditedStaffInfo(null);
    }
  }, [staff, isOpen]);

  if (!shouldRender || !staff) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }

    try {
      setLoading(true);

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
          name: name.trim(),
          role,
          creator: creatorString,
          targetRole: staff.role
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update credentials.');
      }

      setEditedStaffInfo({ 
        name: name.trim(),
        oldName: staff.name,
        role: role,
        oldRole: staff.role
      });
      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setEditedStaffInfo(null);
    onEditSuccess();
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
        className={[
          'w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left',
          panelClassName,
        ].join(' ')}
      >
        {/* Header matching redesigned modals */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm border border-indigo-100/60">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Edit Staff Account</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate max-w-[200px]" title={staff.email}>
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

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Input: Full Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <User className="w-3.5 h-3.5" />
              </span>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }} 
                required
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all" 
              />
            </div>
          </div>

          {/* Input: Access Role */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer" 
              >
                <option value="Staff">Staff (View & Update Telemetry/Logs)</option>
                <option value="Admin">Admin (Full System & Account Management Privilege)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={requestClose} 
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <SuccessEditStaffModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        staff={editedStaffInfo}
      />
    </div>,
    document.body
  );
}