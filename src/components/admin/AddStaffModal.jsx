import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Lock, Eye, EyeOff, User, Mail } from 'lucide-react';
import AddStaffSuccessModal from './SuccessAddStaffModal';
import { supabase } from '../../supabaseClient'; // Imported Supabase to retrieve active session token
import useModalAnimation from '../../hooks/useModalAnimation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(name, email, password) {
  const errs = {};
  if (!name.trim()) {
    errs.name = 'Full Name is required.';
  }
  if (!email.trim()) {
    errs.email = 'Email Address is required.';
  } else if (!EMAIL_RE.test(email)) {
    errs.email = 'Enter a valid email address.';
  }
  if (!password) {
    errs.password = 'Temporary password is required.';
  } else if (password.length < 8) {
    errs.password = 'Password must be at least 8 characters.';
  }
  return errs;
}

export default function AddStaffModal({ isOpen, onClose, onAddSuccess, apiBaseUrl, loggedInUser }) {
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Staff' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const { shouldRender, isClosing, requestClose } = useModalAnimation(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setNewStaff({ name: '', email: '', password: '', role: 'Staff' });
      setTouched({ name: false, email: false, password: false });
      setFormError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const fieldErrors = validate(newStaff.name, newStaff.email, newStaff.password);
  const isFormValid = Object.keys(fieldErrors).length === 0;

  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));
  const touchAll = () => setTouched({ name: true, email: true, password: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    touchAll();
    setFormError(null);

    if (!isFormValid) return;

    try {
      setLoading(true);
      
      // Type-safe string extraction to prevent passing objects to the backend
      let creatorString = 'Admin System';
      if (typeof loggedInUser === 'string' && loggedInUser.trim() !== '') {
        creatorString = loggedInUser;
      } else if (loggedInUser && typeof loggedInUser === 'object') {
        creatorString = loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Admin System';
      }

      const payload = {
        ...newStaff,
        creator: creatorString
      };

      // Retrieve the current session token to authenticate with the backend
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Added the secure Bearer token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register account.');
      }

      setCreatedStaff(newStaff);
      setNewStaff({ name: '', email: '', password: '', role: 'Staff' });
      setTouched({ name: false, email: false, password: false });
      setShowSuccess(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setCreatedStaff(null);
    onAddSuccess();
    requestClose();
  };

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-955 placeholder-rose-450 bg-rose-50/20";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      style={{ animation: isClosing ? 'staffModalFadeOut 180ms ease-in forwards' : 'staffModalFadeIn 200ms ease-out' }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
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
        <button
          type="button"
          onClick={requestClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="p-8 space-y-4" noValidate>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Staff Account</h3>
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
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <User className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="e.g. Sarah Monroe"
                value={newStaff.name}
                onChange={(e) => {
                  setNewStaff({ ...newStaff, name: e.target.value });
                  setFormError(null);
                }}
                onBlur={() => touch('name')}
                className={`${inputBase} pl-10 pr-4 ${touched.name && fieldErrors.name ? inputErr : inputOk}`}
              />
            </div>
            {touched.name && fieldErrors.name && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium mt-1 animate-fade-in">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="email"
                placeholder="sarah.m@swinesync.com"
                value={newStaff.email}
                onChange={(e) => {
                  setNewStaff({ ...newStaff, email: e.target.value });
                  setFormError(null);
                }}
                onBlur={() => touch('email')}
                className={`${inputBase} pl-10 pr-4 ${touched.email && fieldErrors.email ? inputErr : inputOk}`}
              />
            </div>
            {touched.email && fieldErrors.email && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium mt-1 animate-fade-in">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temporary Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={newStaff.password}
                onChange={(e) => {
                  setNewStaff({ ...newStaff, password: e.target.value });
                  setFormError(null);
                }}
                onBlur={() => touch('password')}
                className={`${inputBase} pl-10 pr-10 ${touched.password && fieldErrors.password ? inputErr : inputOk}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {touched.password && fieldErrors.password && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium mt-1 animate-fade-in">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
            <select
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="Staff">Staff (View/Update Logs)</option>
              <option value="Admin">Admin (Full System Privilege)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-655 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
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

      <AddStaffSuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        staff={createdStaff}
      />
    </div>
  );
}