import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Minimalist Pig Nose Logo ─────────────────────────────────────────────────
function PigNoseLogo({ className = 'w-9 h-9 sm:w-10 sm:h-10' }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="14" fill="#16a34a" />
      <ellipse cx="24" cy="29" rx="13" ry="10" stroke="white" strokeWidth="2.2" fill="none" />
      <circle cx="19.5" cy="29.5" r="3.2" fill="white" />
      <circle cx="28.5" cy="29.5" r="3.2" fill="white" />
      <circle cx="19.5" cy="29.5" r="1.5" fill="#16a34a" />
      <circle cx="28.5" cy="29.5" r="1.5" fill="#16a34a" />
      <circle cx="18.5" cy="19.5" r="1.8" fill="white" />
      <circle cx="29.5" cy="19.5" r="1.8" fill="white" />
    </svg>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email, password) {
  const errs = {};
  if (!email.trim())              errs.email    = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errs.email    = 'Enter a valid email address.';
  if (!password)                  errs.password = 'Password is required.';
  else if (password.length < 8)  errs.password = 'Password must be at least 8 characters.';
  return errs;
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, htmlFor, error, touched, children }) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest"
      >
        {label}
      </label>
      {children}
      {touched && error && (
        <p className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-fade-in">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function LoginModal({ isOpen, onClose, onLoginSuccess, onForgotPassword, onForcePasswordChange }) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [serverError, setServerError]   = useState('');
  const [touched, setTouched]           = useState({ email: false, password: false });

  // Prevent scrollbar leakage and visual layout shifting on mount
  useEffect(() => {
    if (!isOpen) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const fieldErrors = validate(email, password);
  const isFormValid = Object.keys(fieldErrors).length === 0;

  const touch    = (f) => setTouched((t) => ({ ...t, [f]: true }));
  const touchAll = ()  => setTouched({ email: true, password: true });

  const handleClose = () => {
    setEmail(''); setPassword(''); setServerError('');
    setTouched({ email: false, password: false });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    touchAll();
    setServerError('');
    if (!isFormValid) return;

    setIsLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid')) {
          setServerError('Incorrect email or password. Please try again.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setServerError('Your email has not been confirmed yet. Check your inbox.');
        } else {
          setServerError(authError.message);
        }
        return;
      }

      const user = data.user;

      if (user?.user_metadata?.must_change_password) {
        if (onForcePasswordChange) {
          onForcePasswordChange(user, password);
          handleClose();
          return;
        }
      }

      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1);

      onLoginSuccess({
        name: displayName,
        role: user.user_metadata?.role || 'Staff'
      });
      handleClose();
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
      console.error('[LoginModal] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    handleClose();
    if (onForgotPassword) onForgotPassword();
  };

  const inputBase = [
    'w-full bg-white border rounded-xl text-slate-900 placeholder-slate-400',
    'text-sm focus:outline-none focus:ring-2 transition-all',
    'py-2 sm:py-2.5',               
  ].join(' ');
  const inputOk  = 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20';
  const inputErr = 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20 bg-rose-50/30';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:py-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      id="login-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{`
        .modal-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .modal-scroll-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div
        className={[
          'relative w-full bg-white shadow-2xl border border-slate-100',
          'rounded-t-3xl sm:rounded-3xl',
          'h-[85vh] sm:h-[490px]', 
          'max-h-[92dvh] sm:max-h-[90vh]',
          'sm:max-w-sm sm:my-auto',
          'flex flex-col overflow-hidden',
        ].join(' ')}
        id="login-modal-content"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer z-10"
          aria-label="Go back"
          id="close-login-btn"
        >
          <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          Back
        </button>

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto modal-scroll-container px-5 sm:px-8 pt-7 sm:pt-9 pb-4 sm:pb-5 space-y-3.5 sm:space-y-4">

          {/* Logo + Title */}
          <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
            <PigNoseLogo />
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                SwineSync
              </p>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                Welcome
              </h2>
            </div>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] sm:text-xs text-rose-700 font-medium animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              {serverError}
            </div>
          )}

          {/* Email */}
          <Field
            label="Email Address"
            htmlFor="login-email"
            error={fieldErrors.email}
            touched={touched.email}
          >
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="email"
                id="login-email"
                autoComplete="email"
                placeholder="manager@farm.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
                onBlur={() => touch('email')}
                className={`${inputBase} pl-8.5 sm:pl-9.5 pr-4 ${touched.email && fieldErrors.email ? inputErr : inputOk}`}
              />
            </div>
          </Field>

          {/* Password */}
          <Field
            label="Password"
            htmlFor="login-password"
            error={fieldErrors.password}
            touched={touched.password}
          >
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setServerError(''); }}
                onBlur={() => touch('password')}
                className={`${inputBase} pl-8.5 sm:pl-9.5 pr-10 ${touched.password && fieldErrors.password ? inputErr : inputOk}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>

          {/* Forgot password */}
          <div className="flex justify-end -mt-0.5">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={[
              'w-full py-2.5 sm:py-3',
              'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
              'font-bold text-sm rounded-xl transition-colors',
              'flex items-center justify-center gap-2',
              'shadow-lg shadow-emerald-600/25 cursor-pointer',
              'disabled:opacity-70 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-4 focus:ring-emerald-500/30',
            ].join(' ')}
            id="login-submit-btn"
          >
            {isLoading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing in…</>
            ) : (
              <>Log In <span className="text-base leading-none">→</span></>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 sm:px-8 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-center text-slate-400 tracking-wide shrink-0">
          Restricted to authorized SwineSync personnel only.
        </div>
      </div>
    </div>
  );
}