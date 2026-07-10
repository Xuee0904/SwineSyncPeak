import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, User } from 'lucide-react';
import SuccessEditStaffModal from './SuccessEditStaffModal'; // Integrated Success Modal
import useModalAnimation from '../../hooks/useModalAnimation';

export default function EditStaffModal({ isOpen, onClose, staff, onEditSuccess, loggedInUser, apiBaseUrl }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // States for handling intermediate success dialogue
  const [showSuccess, setShowSuccess] = useState(false);
  const [editedStaffInfo, setEditedStaffInfo] = useState(null);

  const { shouldRender, isClosing, requestClose } = useModalAnimation(isOpen, onClose);

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

      const res = await fetch(`${apiBaseUrl}/api/admin/users/${staff.fullId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

      // Record updated details to local visual state before showing success modal
      setEditedStaffInfo({ name: name.trim() });
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
    onEditSuccess(); // Reload parent table records
    requestClose(); // Safely unmount with exit animation
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
        <div className="h-2 bg-gradient-to-r from-indigo-500 to-indigo-650 w-full" />
        <button onClick={requestClose} className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Staff Account</h3>
            <p className="text-xs text-slate-400 mt-1">Modify access parameters for {staff.email}.</p>
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
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
                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 outline-none transition-all" 
              />
            </div>
          </div>

          {/* Input: Access Role */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all focus:border-indigo-500" >
              <option value="Staff">Staff (View/Update Logs)</option>
              <option value="Admin">Admin (Full System Privilege)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={requestClose} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5">
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
    </div>
  );
}