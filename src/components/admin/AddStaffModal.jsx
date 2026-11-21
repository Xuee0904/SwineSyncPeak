import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, Lock, Eye, EyeOff, User, Mail, UserPlus, Info, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import useModalAnimation from '../../hooks/useModalAnimation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_STAFF_FORM = { name: '', email: '', password: '', role: 'Staff' };

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
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [newStaff, setNewStaff] = useState(INITIAL_STAFF_FORM);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setNewStaff(INITIAL_STAFF_FORM);
      setTouched({ name: false, email: false, password: false });
      setFormError(null);
      setCreatedStaff(null);
      setShowPassword(false);
      setShowSuccess(false);
      setLoading(false);
    }
  }

  const { shouldRender, isClosing, requestClose, panelRef, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

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

      let creatorString = 'Admin System';
      if (typeof loggedInUser === 'string' && loggedInUser.trim() !== '') {
        creatorString = loggedInUser;
      } else if (loggedInUser && typeof loggedInUser === 'object') {
        creatorString = loggedInUser.user_metadata?.full_name || loggedInUser.email || 'Admin System';
      }

      const payload = {
        ...newStaff,
        role: 'Staff',
        creator: creatorString,
      };

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register account.');
      }

      setCreatedStaff(newStaff);
      setNewStaff(INITIAL_STAFF_FORM);
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

  const inputBase =
    'w-full min-h-[44px] bg-white border rounded-xl py-2.5 outline-none transition-all motion-reduce:transition-none text-xs font-medium';
  const inputOk =
    'border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-500';
  const inputErr =
    'border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/15 text-slate-900 placeholder-slate-500 bg-rose-50/30';

  const nameHasError = Boolean(touched.name && fieldErrors.name);
  const emailHasError = Boolean(touched.email && fieldErrors.email);
  const passwordHasError = Boolean(touched.password && fieldErrors.password);

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-40 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-staff-modal-title"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={panelRef}
        style={{ willChange: 'transform, opacity, max-width' }}
        className={[
          'w-full max-h-[92dvh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-100 relative text-left transition-[max-width] duration-300 ease-in-out motion-reduce:transition-none',
          showSuccess ? 'max-w-sm' : 'max-w-md',
          panelClassName,
        ].join(' ')}
      >
        {!showSuccess ? (
          <div>
            <div className="px-6 sm:px-8 pt-7 sm:pt-8 pb-4 flex items-center justify-between gap-3 border-b border-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/60 shrink-0">
                  <UserPlus className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 id="add-staff-modal-title" className="text-lg font-bold text-slate-900 leading-tight">
                    Add Staff Account
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 sm:px-8 pt-6 pb-8 space-y-4" noValidate>
              <div
                aria-hidden={!formError}
                className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${formError ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
              >
                {formError && (
                  <div
                    role="alert"
                    className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-staff-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 pointer-events-none">
                    <User className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <input
                    id="add-staff-name"
                    type="text"
                    placeholder="Enter full name"
                    value={newStaff.name}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, name: e.target.value });
                      setFormError(null);
                    }}
                    onBlur={() => touch('name')}
                    aria-invalid={nameHasError}
                    aria-describedby={nameHasError ? 'add-staff-name-error' : undefined}
                    className={`${inputBase} pl-10 pr-4 ${nameHasError ? inputErr : inputOk}`}
                  />
                </div>
                <div
                  aria-hidden={!nameHasError}
                  className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${nameHasError ? 'max-h-12 opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}
                >
                  {nameHasError && (
                    <p id="add-staff-name-error" role="alert" className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-staff-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 pointer-events-none">
                    <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <input
                    id="add-staff-email"
                    type="email"
                    placeholder="email@example.com"
                    value={newStaff.email}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, email: e.target.value });
                      setFormError(null);
                    }}
                    onBlur={() => touch('email')}
                    aria-invalid={emailHasError}
                    aria-describedby={emailHasError ? 'add-staff-email-error' : undefined}
                    className={`${inputBase} pl-10 pr-4 ${emailHasError ? inputErr : inputOk}`}
                  />
                </div>
                <div
                  aria-hidden={!emailHasError}
                  className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${emailHasError ? 'max-h-12 opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}
                >
                  {emailHasError && (
                    <p id="add-staff-email-error" role="alert" className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="add-staff-password" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Temporary Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 pointer-events-none">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                  <input
                    id="add-staff-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={newStaff.password}
                    onChange={(e) => {
                      setNewStaff({ ...newStaff, password: e.target.value });
                      setFormError(null);
                    }}
                    onBlur={() => touch('password')}
                    aria-invalid={passwordHasError}
                    aria-describedby={passwordHasError ? 'add-staff-password-error' : undefined}
                    className={`${inputBase} pl-10 pr-12 ${passwordHasError ? inputErr : inputOk}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 w-11 min-h-[44px] flex items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                  </button>
                </div>
                <div
                  aria-hidden={!passwordHasError}
                  className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${passwordHasError ? 'max-h-12 opacity-100 mt-1.5' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}
                >
                  {passwordHasError && (
                    <p id="add-staff-password-error" role="alert" className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  System Access Role
                </span>
                <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60">
                  <span className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <User className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Staff</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Default Role
                  </span>
                </div>
                <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Please contact super admin for adding of admin role account.</span>
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => requestClose()}
                  className="flex-1 min-h-[44px] py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 min-h-[44px] py-3 bg-[#00875a] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      <span>Creating Account…</span>
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center space-y-5">
            <button
              type="button"
              onClick={() => handleSuccessClose()}
              className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
              <Check className="w-7 h-7 text-emerald-600" strokeWidth={3} aria-hidden="true" />
            </div>

            <div>
              <h3 id="add-staff-modal-title" className="text-lg font-bold text-slate-900">
                Account Created
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {createdStaff?.name ? (
                  <>
                    <span className="font-bold text-slate-900">{createdStaff.name}</span> can now sign into the portal.
                  </>
                ) : (
                  'The new staff account is ready to sign in.'
                )}
              </p>
            </div>

            {createdStaff?.email && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{createdStaff.email}</span>
                </div>
                {createdStaff?.role && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</span>
                    <span className="text-xs font-bold text-emerald-700">{createdStaff.role}</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleSuccessClose()}
              className="w-full min-h-[44px] py-3 bg-[#00875a] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
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
