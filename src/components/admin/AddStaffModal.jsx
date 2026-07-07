import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function AddStaffModal({ isOpen, onClose, onAddSuccess, apiBaseUrl }) {
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Staff' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      setFormError('Please complete all fields.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register account.');
      }

      // Clear internal form variables
      setNewStaff({ name: '', email: '', password: '', role: 'Staff' });
      
      // Fire success callback to reload lists on parent
      onAddSuccess();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left animate-scale-up">
        <div className="h-2 bg-gradient-to-r from-emerald-600 to-primary-500 w-full" />
        
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Staff Account</h3>
            <p className="text-xs text-slate-400 mt-1">Register a new caretaker credential directly inside Supabase Auth.</p>
          </div>

          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Sarah Monroe"
              value={newStaff.name}
              onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
              className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
            <input 
              type="email" 
              required
              placeholder="sarah.m@swinesync.com"
              value={newStaff.email}
              onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
              className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temporary Password</label>
            <input 
              type="password" 
              required
              placeholder="Min. 8 characters"
              value={newStaff.password}
              onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
              className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
            <select 
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all"
            >
              <option value="Staff">Staff (View/Update Logs)</option>
              <option value="Admin">Admin (Full System Privilege)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : (
                'Create Account'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}