import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, Lock, Eye, EyeOff, User, Mail, UserPlus, Shield, Bookmark, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import useModalAnimation from '../../hooks/useModalAnimation';
import useFormDraft from '../../hooks/useFormDraft';
import DraftBanner from '../DraftBanner';

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
  const {
    form: newStaff,
    setForm: setNewStaff,
    resetForm: resetNewStaff,
    hasDraft,
    draftInfo,
    saveDraft,
    restoreDraft,
    clearDraft,
    checkDraft,
    isOffline,
  } = useFormDraft('swinesync_draft_add_staff', { name: '', email: '', password: '', role: 'Staff' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } = 
    useModalAnimation(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => {
        checkDraft();
        resetNewStaff({ name: '', email: '', password: '', role: 'Staff' });
        setTouched({ name: false, email: false, password: false });
        setFormError(null);
        setShowPassword(false);
        setShowSuccess(false);
      });
    }
  }, [isOpen, checkDraft, resetNewStaff]);

  const handleRestoreDraft = () => {
    restoreDraft();
  };

  const handleDiscardDraft = () => {
    clearDraft();
    resetNewStaff({ name: '', email: '', password: '', role: 'Staff' });
  };

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
        creator: creatorString
      };

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(`${apiBaseUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register account.');
      }

      clearDraft();
      setCreatedStaff(newStaff);
      resetNewStaff({ name: '', email: '', password: '', role: 'Staff' });
      setTouched({ name: false, email: false, password: false });
      setShowSuccess(true);
    } catch (err) {
      if (isOffline || err.message?.toLowerCase().includes('fetch') || err.message?.toLowerCase().includes('network')) {
        saveDraft(newStaff);
      }
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

  const inputBase = "w-full bg-white border rounded-xl py-2.5 outline-none transition-all text-xs font-medium";
  const inputOk = "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 placeholder-slate-400";
  const inputErr = "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 text-rose-955 placeholder-rose-455 bg-rose-50/20";

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-40 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
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
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/60">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Add Staff Account</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Create new portal credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => requestClose()}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-4" noValidate>
              <DraftBanner
                hasDraft={hasDraft}
                draftInfo={draftInfo}
                onRestore={handleRestoreDraft}
                onDiscard={handleDiscardDraft}
                isOffline={isOffline}
              />
              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

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

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temporary Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {touched.password && fieldErrors.password ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium mt-1 animate-fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.password}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">Provide to the staff member so they can sign in initially.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: 'Staff',
                      icon: <User className="w-4 h-4" />,
                      title: 'Staff',
                      desc: 'View & update telemetry and logs',
                    },
                    {
                      value: 'Admin',
                      icon: <Shield className="w-4 h-4" />,
                      title: 'Admin',
                      desc: 'Full system & account management',
                    },
                  ].map((opt) => {
                    const selected = newStaff.role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewStaff({ ...newStaff, role: opt.value })}
                        className={[
                          'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer',
                          selected
                            ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
                        ].join(' ')}
                      >
                        {/* Radio circle */}
                        <span className={[
                          'mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-all',
                          selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white',
                        ].join(' ')}>
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                        </span>
                        {/* Icon + text */}
                        <div>
                          <span className={`flex items-center gap-1.5 text-xs font-bold ${selected ? 'text-emerald-800' : 'text-slate-700'}`}>
                            <span className={selected ? 'text-emerald-600' : 'text-slate-400'}>{opt.icon}</span>
                            {opt.title}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => requestClose()}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveDraft(newStaff);
                    requestClose();
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  title="Save current inputs as a draft and close"
                >
                  <Bookmark size={15} className="text-emerald-600" />
                  Save Draft
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating Account…</>
                  ) : (
                    'Create Account'
                  )}
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
              <h3 className="text-lg font-bold text-slate-900">Account Created</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {createdStaff?.name ? (
                  <>
                    <span className="font-bold text-slate-800">{createdStaff.name}</span> can now sign into the portal using their assigned credentials.
                  </>
                ) : (
                  'The new staff account is ready to sign in.'
                )}
              </p>
            </div>

            {createdStaff?.email && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{createdStaff.email}</span>
                </div>
                {createdStaff?.role && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
                    <span className="text-xs font-bold text-emerald-600">{createdStaff.role}</span>
                  </div>
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