import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Loader2, AlertCircle, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function calcStrength(password) {
  const checks = {
    minLength:      password.length >= 8,
    hasNumber:      /\d/.test(password),
    hasUppercase:   /[A-Z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':\"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const levels = [
    { label: 'Too Weak', color: '#ef4444', pct: 15  },
    { label: 'Weak',     color: '#f97316', pct: 30  },
    { label: 'Fair',     color: '#eab308', pct: 55  },
    { label: 'Medium',   color: '#3b82f6', pct: 75  },
    { label: 'Strong',   color: '#16a34a', pct: 100 },
  ];
  return { checks, score, ...(levels[score] ?? levels[0]) };
}

function Req({ met, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 shrink-0"
        style={{ borderColor: met ? '#16a34a' : '#cbd5e1', backgroundColor: met ? '#16a34a' : 'transparent' }}
      >
        {met && (
          <svg viewBox="0 0 10 8" className="w-2 h-2" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[10px] sm:text-[11px] font-medium transition-colors duration-200" style={{ color: met ? '#15803d' : '#94a3b8' }}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, htmlFor, error, touched, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
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

const inputBase = [
  'w-full bg-white border rounded-xl text-slate-900 placeholder-slate-400',
  'text-sm focus:outline-none focus:ring-2 transition-all',
  'py-2 sm:py-2.5',
].join(' ');
const inputOk  = 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20';
const inputErr = 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20 bg-rose-50/30';

export default function UpdatePasswordModal({ isOpen, onClose, onBackToLogin, onResetSuccess, initialView = 'send-email', oldPassword }) {
  const [email,        setEmail]        = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [pwTouched,       setPwTouched]       = useState({ newPassword: false, confirmPassword: false });
  const [successMsg,      setSuccessMsg]      = useState('');

  const [view,        setView]        = useState(initialView);
  const [isLoading,   setIsLoading]   = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => { setView(initialView); }, [initialView]);

  useEffect(() => {
    if (!isOpen) {
      setEmail(''); setEmailTouched(false); setEmailSent(false);
      setNewPassword(''); setConfirmPassword('');
      setShowNew(false); setShowConfirm(false);
      setPwTouched({ newPassword: false, confirmPassword: false });
      setSuccessMsg(''); setServerError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const emailError = !email.trim()
    ? 'Email is required.'
    : !EMAIL_RE.test(email)
      ? 'Enter a valid email address.'
      : '';

  const handleSendReset = async (e) => {
    e.preventDefault();
    setEmailTouched(true);
    setServerError('');
    if (emailError) return;
    setIsLoading(true);
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: siteUrl,
      });
      if (error) setServerError(error.message);
      else        setEmailSent(true);
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const strength = calcStrength(newPassword);
  const pwErrors = {};

  // Strict validation rules
  if (!newPassword) {
    pwErrors.newPassword = 'New password is required.';
  } else if (newPassword.length < 8) {
    pwErrors.newPassword = 'Password must be at least 8 characters.';
  } else if (strength.score < 4) {
    // Mandates that all 4 criteria badges are checked
    pwErrors.newPassword = 'Your password must satisfy all security requirements listed below.';
  } else if (oldPassword && newPassword === oldPassword) {
    // Prevents reuse of the temporary first-time credential
    pwErrors.newPassword = 'For security purposes, you cannot reuse your temporary password.';
  }

  if (!confirmPassword) {
    pwErrors.confirmPassword = 'Please confirm your new password.';
  } else if (newPassword !== confirmPassword) {
    pwErrors.confirmPassword = 'Passwords do not match. Please verify your entries.';
  }

  const isPwValid  = Object.keys(pwErrors).length === 0;
  const touchPw    = (f) => setPwTouched((t) => ({ ...t, [f]: true }));
  const touchPwAll = ()  => setPwTouched({ newPassword: true, confirmPassword: true });

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    touchPwAll();
    setServerError('');
    if (!isPwValid) return;
    setIsLoading(true);
    try {
      // Updates the password and clears the must_change_password meta flag simultaneously
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword,
        data: { must_change_password: false } // Clears forced reset status
      });
      if (error) {
        setServerError(error.message);
      } else {
        setSuccessMsg('Your password has been successfully updated! Redirecting to the login screen...');
        if (onResetSuccess) {
          // Delay redirect slightly to let the user read the success text
          setTimeout(() => {
            onResetSuccess();
          }, 2000);
        }
      }
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose       = () => { if (initialView === 'update-password') return; onClose(); };
  const handleBackToLogin = () => { onClose(); if (onBackToLogin) onBackToLogin(); };

  const titles = {
    'send-email':      { heading: 'Forgot Password?',    sub: 'Enter your email to receive a reset link.' },
    'update-password': { heading: 'Secure Your Account', sub: 'Please set a secure password to activate your portal session.' },
  };
  const { heading, sub } = titles[view] ?? titles['send-email'];

  const btnCls = [
    'w-full py-2.5 sm:py-3',
    'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white',
    'font-bold text-sm rounded-xl transition-colors',
    'flex items-center justify-center gap-2',
    'shadow-lg shadow-emerald-600/25 cursor-pointer',
    'disabled:opacity-70 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-4 focus:ring-emerald-500/30',
  ].join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:py-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-password-title"
      id="update-password-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="relative w-full bg-white shadow-2xl border border-slate-100 rounded-t-3xl sm:rounded-3xl h-[85vh] sm:h-[530px] max-h-[92dvh] sm:max-h-[90vh] sm:max-w-sm sm:my-auto flex flex-col overflow-hidden"
        id="update-password-modal-content"
      >
        {/* Close/Back button hidden on forced password reset to ensure compliance */}
        {initialView !== 'update-password' && (
          <button
            onClick={handleClose}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer z-10"
            aria-label="Close modal"
            id="close-update-password-btn"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Back
          </button>
        )}

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-7 sm:pt-9 pb-4 sm:pb-5 space-y-3.5 sm:space-y-4">

          <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center">
            <div className="relative">
              <PigNoseLogo />
              <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 bg-emerald-600 rounded-full ring-2 ring-white">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                SwineSync
              </p>
              <h2 id="update-password-title" className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                {heading}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed">{sub}</p>
            </div>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] sm:text-xs text-rose-700 font-medium animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
              {serverError}
            </div>
          )}

          {/* ── PHASE 1: Send reset email ── */}
          {view === 'send-email' && !emailSent && (
            <>
              <Field label="Email Address" htmlFor="reset-email" error={emailError} touched={emailTouched}>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    id="reset-email"
                    autoComplete="email"
                    placeholder="manager@farm.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setServerError(''); }}
                    onBlur={() => setEmailTouched(true)}
                    className={`${inputBase} pl-8.5 sm:pl-9.5 pr-4 ${emailTouched && emailError ? inputErr : inputOk}`}
                  />
                </div>
              </Field>

              <button onClick={handleSendReset} disabled={isLoading} className={btnCls} id="send-reset-email-btn">
                {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : 'Send Reset Link'}
              </button>
            </>
          )}

          {/* Email sent confirmation */}
          {view === 'send-email' && emailSent && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex items-center justify-center w-11 h-12 bg-emerald-50 rounded-full animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="animate-fade-in">
                <p className="text-sm font-bold text-slate-800">Check your inbox!</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  A password reset link was sent to{' '}
                  <strong className="text-slate-700">{email}</strong>.<br />
                  Click the link in the email to set your new password.
                </p>
              </div>
              <div className="flex items-start gap-2 w-full p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] sm:text-xs text-amber-700 font-medium text-left animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Didn't get it? Check your spam folder or{' '}
                  <button
                    type="button"
                    onClick={() => { setEmailSent(false); setServerError(''); }}
                    className="underline font-bold cursor-pointer hover:text-amber-800"
                  >
                    try again
                  </button>.
                </span>
              </div>
            </div>
          )}

          {/* ── PHASE 2: Set new password ── */}
          {view === 'update-password' && !successMsg && (
            <>
              <Field label="New Password" htmlFor="update-new-password" error={pwErrors.newPassword} touched={pwTouched.newPassword}>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    id="update-new-password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setServerError(''); }}
                    onBlur={() => touchPw('newPassword')}
                    className={`${inputBase} pl-4 pr-10 ${pwTouched.newPassword && pwErrors.newPassword ? inputErr : inputOk}`}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-450 hover:text-slate-650 transition-colors cursor-pointer"
                    aria-label={showNew ? 'Hide password' : 'Show password'}>
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </Field>

              <Field label="Confirm New Password" htmlFor="update-confirm-password" error={pwErrors.confirmPassword} touched={pwTouched.confirmPassword}>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    id="update-confirm-password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setServerError(''); }}
                    onBlur={() => touchPw('confirmPassword')}
                    className={`${inputBase} pl-4 pr-10 ${pwTouched.confirmPassword && pwErrors.confirmPassword ? inputErr : inputOk}`}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-450 hover:text-slate-650 transition-colors cursor-pointer"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </Field>

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 space-y-3 animate-fade-in" id="password-strength-panel">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Security Strength</span>
                      <span className="text-[11px] sm:text-xs font-bold transition-colors duration-300" style={{ color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${strength.pct}%`, backgroundColor: strength.color }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Req met={strength.checks.minLength}      label="Min. 8 characters" />
                    <Req met={strength.checks.hasUppercase}   label="One uppercase"     />
                    <Req met={strength.checks.hasNumber}      label="Include number"    />
                    <Req met={strength.checks.hasSpecialChar} label="Special character" />
                  </div>
                </div>
              )}

              <button onClick={handleUpdatePassword} disabled={isLoading} className={btnCls} id="update-password-submit-btn">
                {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…</> : 'Update Password'}
              </button>
            </>
          )}

          {/* Success state */}
          {view === 'update-password' && successMsg && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex items-center justify-center w-11 h-12 bg-emerald-50 rounded-full animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="animate-fade-in">
                <p className="text-sm font-bold text-slate-800">Password Updated!</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{successMsg}</p>
              </div>
            </div>
          )}

          {/* Back to Log In (Hidden during forced reset) */}
          {initialView !== 'update-password' && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-[11px] sm:text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest transition-colors cursor-pointer"
                id="back-to-login-link"
              >
                Back to Log In
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 sm:px-8 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-center text-slate-400 tracking-wide shrink-0">
          Restricted to authorized SwineSync personnel only.
        </div>
      </div>
    </div>
  );
}