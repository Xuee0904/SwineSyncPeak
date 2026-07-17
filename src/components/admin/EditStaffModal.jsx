import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, User, UserCheck, Shield, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
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
        style={{ willChange: 'transform, opacity, max-width' }}
        className={[
          'w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left transition-[max-width] duration-300 ease-in-out',
          showSuccess ? 'max-w-sm' : 'max-w-md',
          panelClassName,
        ].join(' ')}
      >
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm border border-emerald-100/60">
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
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all"
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
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
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
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
                </button>
              </div>
            </form>
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

            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
              <Check className="w-7 h-7 text-emerald-600 animate-bounce" strokeWidth={3} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Changes Saved</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {editedStaffInfo?.name ? (
                  <>
                    Successfully updated access roles and profile parameters for <span className="font-bold text-slate-800">{editedStaffInfo.name}</span>.
                  </>
                ) : (
                  'The caretaker account changes were successfully saved.'
                )}
              </p>
            </div>

            {editedStaffInfo && (editedStaffInfo.oldName || editedStaffInfo.oldRole) && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-left space-y-2 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parameter Changes</p>

                {editedStaffInfo.oldName && editedStaffInfo.oldName !== editedStaffInfo.name && (
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 font-medium">Name:</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 truncate">
                      <span className="line-through text-slate-400 font-normal">{editedStaffInfo.oldName}</span>
                      <span className="text-emerald-600">→</span>
                      <span>{editedStaffInfo.name}</span>
                    </div>
                  </div>
                )}

                {editedStaffInfo.oldRole && editedStaffInfo.oldRole !== editedStaffInfo.role && (
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-500 font-medium">Role:</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="line-through text-slate-400 font-normal">{editedStaffInfo.oldRole}</span>
                      <span className="text-emerald-600">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px]">
                        {editedStaffInfo.role}
                      </span>
                    </div>
                  </div>
                )}

                {((!editedStaffInfo.oldName || editedStaffInfo.oldName === editedStaffInfo.name) && (!editedStaffInfo.oldRole || editedStaffInfo.oldRole === editedStaffInfo.role)) && (
                  <p className="text-[11px] text-slate-500 italic">No parameter discrepancies; existing profile details reaffirmed.</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleSuccessClose()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
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