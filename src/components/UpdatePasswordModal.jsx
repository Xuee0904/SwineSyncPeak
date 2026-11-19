import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import useModalAnimation from '../hooks/useModalAnimation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function calcStrength(password) {
  const checks = {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const levels = [
    { label: 'Too Weak', color: '#b91c1c', pct: 15 },
    { label: 'Weak', color: '#c2410c', pct: 30 },
    { label: 'Fair', color: '#a16207', pct: 55 },
    { label: 'Good', color: '#1d4ed8', pct: 75 },
    { label: 'Strong', color: '#047857', pct: 100 },
  ];
  return { checks, score, ...(levels[score] ?? levels[0]) };
}

function Req({ met, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex items-center justify-center w-4 h-4 rounded-full border-2 transition-colors duration-200 shrink-0"
        style={{
          borderColor: met ? '#047857' : '#64748b',
          backgroundColor: met ? '#047857' : 'transparent',
        }}
      >
        {met && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none" aria-hidden="true">
            <path
              d="M1 4l3 3 5-6"
              stroke="white"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span
        className="text-xs font-medium transition-colors duration-200"
        style={{ color: met ? '#047857' : '#475569' }}
      >
        {label}
      </span>
    </div>
  );
}

function AnimatedFieldError({ id, message }) {
  const show = Boolean(message);
  const [displayMessage, setDisplayMessage] = useState(message || '');

  if (show && message !== displayMessage) {
    setDisplayMessage(message);
  }

  return (
    <div
      aria-hidden={!show}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
        show ? 'grid-rows-[1fr] opacity-100 mt-1.5' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
      }`}
    >
      <div className="overflow-hidden min-h-0">
        {displayMessage && (
          <p
            id={show ? id : undefined}
            role={show ? 'alert' : undefined}
            className="flex items-center gap-1.5 text-xs text-rose-700 font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{displayMessage}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function AnimatedServerError({ message }) {
  const show = Boolean(message);
  const [displayMessage, setDisplayMessage] = useState(message || '');

  if (show && message !== displayMessage) {
    setDisplayMessage(message);
  }

  return (
    <div
      aria-hidden={!show}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
        show ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
      }`}
    >
      <div className="overflow-hidden min-h-0">
        {displayMessage && (
          <div
            role={show ? 'alert' : undefined}
            className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" aria-hidden="true" />
            <span>{displayMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, errorId, error, touched, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
      <AnimatedFieldError id={errorId} message={touched ? error : ''} />
    </div>
  );
}

const inputBase = [
  'w-full min-h-[44px] py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-500',
  'text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors',
].join(' ');
const inputOk = 'border-slate-500 focus:border-emerald-700 focus:ring-emerald-700/25';
const inputErr = 'border-rose-600 focus:border-rose-700 focus:ring-rose-600/25 bg-rose-50/40';

export default function UpdatePasswordModal({
  isOpen,
  onClose,
  onBackToLogin,
  onResetSuccess,
  onCancelForcedReset,
  initialView = 'send-email',
  initialEmail = '',
  isForcedReset = false,
  oldPassword,
}) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialView, setPrevInitialView] = useState(initialView);

  const [email, setEmail] = useState(initialEmail || '');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwTouched, setPwTouched] = useState({ newPassword: false, confirmPassword: false });
  const [successMsg, setSuccessMsg] = useState('');

  const [view, setView] = useState(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  const firstInputRef = useRef(null);
  const redirectTimerRef = useRef(null);

  if (initialView !== prevInitialView) {
    setPrevInitialView(initialView);
    setView(initialView);
    setSessionExpired(false);
  }

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setView(initialView);
      setEmail(initialView === 'send-email' ? (initialEmail || '') : '');
      setEmailTouched(false);
      setEmailSent(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowNew(false);
      setShowConfirm(false);
      setPwTouched({ newPassword: false, confirmPassword: false });
      setSuccessMsg('');
      setServerError('');
      setSessionExpired(false);
      setIsLoading(false);
    } else {
      setEmail('');
      setEmailTouched(false);
      setEmailSent(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowNew(false);
      setShowConfirm(false);
      setPwTouched({ newPassword: false, confirmPassword: false });
      setSuccessMsg('');
      setServerError('');
      setSessionExpired(false);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const canDismissModal = view !== 'update-password';

  const { shouldRender, requestClose, panelRef, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose, {
      canClose: canDismissModal,
      initialFocusRef: firstInputRef,
    });

  if (!shouldRender) return null;

  const emailError = !email.trim()
    ? 'Email is required.'
    : email !== email.trim()
      ? 'Email cannot start or end with a space.'
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
      else setEmailSent(true);
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const strength = calcStrength(newPassword);
  const pwErrors = {};

  if (!newPassword) {
    pwErrors.newPassword = 'New password is required.';
  } else if (newPassword.length < 8) {
    pwErrors.newPassword = 'Password must be at least 8 characters.';
  } else if (strength.score < 4) {
    pwErrors.newPassword = 'Your password must satisfy all security requirements listed below.';
  } else if (oldPassword && newPassword === oldPassword) {
    pwErrors.newPassword = 'You cannot reuse your most recent password.';
  }

  if (!confirmPassword) {
    pwErrors.confirmPassword = 'Please confirm your new password.';
  } else if (newPassword !== confirmPassword) {
    pwErrors.confirmPassword = 'Passwords do not match. Please verify your entries.';
  }

  const isPwValid = Object.keys(pwErrors).length === 0;
  const touchPw = (field) => setPwTouched((t) => ({ ...t, [field]: true }));
  const touchPwAll = () => setPwTouched({ newPassword: true, confirmPassword: true });

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    touchPwAll();
    setServerError('');
    setSessionExpired(false);
    if (!isPwValid) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });
      if (error) {
        const lower = String(error.message || '').toLowerCase();
        if (lower.includes('auth session missing') || lower.includes('session')) {
          setSessionExpired(true);
          setServerError('Your password reset link has expired or is invalid. Please request a new reset link.');
        } else {
          setServerError(error.message);
        }
      } else {
        setSuccessMsg(
          isForcedReset
            ? 'Your password has been updated. Opening the staff portal...'
            : 'Your password has been updated. Returning to sign in...'
        );
        if (onResetSuccess) {
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          redirectTimerRef.current = setTimeout(() => {
            requestClose(onResetSuccess);
          }, 1200);
        }
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!canDismissModal) return;
    requestClose();
  };

  const handleBackToLogin = () => {
    requestClose(onBackToLogin);
  };

  const handleCancelForcedReset = () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    requestClose(onCancelForcedReset || onClose);
  };

  const titles = {
    'send-email': {
      heading: 'Reset Password',
      sub: 'Enter your email to receive a password reset link.',
    },
    'update-password': {
      heading: 'Create a New Password',
      sub: isForcedReset
        ? 'Set a new password to activate your account.'
        : 'Choose a strong password to regain access.',
    },
  };
  const { heading, sub } = titles[view] ?? titles['send-email'];

  const btnCls = [
    'w-full min-h-[44px] py-3',
    'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white',
    'font-bold text-sm rounded-xl transition-colors',
    'flex items-center justify-center gap-2',
    'shadow-md shadow-emerald-900/15 cursor-pointer',
    'disabled:opacity-70 disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700',
  ].join(' ');

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-password-title"
      id="update-password-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={panelRef}
        className={[
          'relative w-full bg-white shadow-2xl border border-slate-200',
          'rounded-t-3xl sm:rounded-3xl',
          'h-auto max-h-[92dvh] sm:max-h-[90dvh]',
          'sm:max-w-md sm:my-auto',
          'flex flex-col overflow-hidden',
          panelClassName,
        ].join(' ')}
        id="update-password-modal-content"
      >
        <div className="flex items-center justify-end px-3 pt-3 sm:px-4 sm:pt-4 shrink-0">
          {canDismissModal ? (
            <button
              type="button"
              onClick={handleClose}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              aria-label="Close password reset dialog"
              id="close-update-password-btn"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="h-3" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-8 pt-1 pb-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-700 text-white font-extrabold text-base shadow-sm shrink-0"
              >
                S
              </span>
              <div className="flex flex-col leading-tight text-left">
                <span className="font-black font-display text-lg tracking-tight text-slate-900">
                  Swine<span className="text-emerald-700">Sync</span>
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  for Ambo &amp; Ang&apos;s Oink Yard
                </span>
              </div>
            </div>

            <div>
              <h2
                id="update-password-title"
                className="text-2xl font-extrabold font-display text-slate-900 tracking-tight"
              >
                {heading}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{sub}</p>
            </div>
          </div>

          <AnimatedServerError message={serverError} />

          <div className="mt-5 space-y-4">

          {/* PHASE 1: Send reset email */}
          {view === 'send-email' && !emailSent && (
            <form onSubmit={handleSendReset} noValidate className="space-y-4">
              <Field
                label="Email address"
                htmlFor="reset-email"
                errorId="reset-email-error"
                error={emailError}
                touched={emailTouched}
              >
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-600 pointer-events-none"
                  >
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    ref={firstInputRef}
                    type="email"
                    inputMode="email"
                    id="reset-email"
                    autoComplete="email"
                    placeholder="manager@farm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    aria-invalid={Boolean(emailTouched && emailError)}
                    aria-describedby={emailTouched && emailError ? 'reset-email-error' : undefined}
                    className={`${inputBase} pl-10 pr-4 ${emailTouched && emailError ? inputErr : inputOk}`}
                  />
                </div>
              </Field>

              <button type="submit" disabled={isLoading} className={btnCls} id="send-reset-email-btn">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    <span>Sending...</span>
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

          {/* Email sent confirmation */}
          {view === 'send-email' && emailSent && (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full animate-fade-in">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="animate-fade-in">
                <p className="text-sm font-bold text-slate-900">Check your inbox</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  A password reset link was sent to{' '}
                  <strong className="text-slate-800">{email}</strong>.<br />
                  Open the link in that email to set a new password.
                </p>
              </div>
              <div className="flex items-start gap-2 w-full p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium text-left animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
                <span>
                  Didn&apos;t receive it? Check your spam folder or{' '}
                  <button
                    type="button"
                    onClick={() => { setEmailSent(false); setServerError(''); }}
                    className="underline font-bold cursor-pointer text-amber-900 hover:text-slate-950 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                  >
                    try another email
                  </button>.
                </span>
              </div>
            </div>
          )}

          {/* PHASE 2: Set new password */}
          {view === 'update-password' && !successMsg && (
            <form onSubmit={handleUpdatePassword} noValidate>
              <div className="space-y-4">
                <Field
                  label="New password"
                  htmlFor="update-new-password"
                  errorId="update-new-password-error"
                  error={pwErrors.newPassword}
                  touched={pwTouched.newPassword}
                >
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-600 pointer-events-none"
                    >
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      ref={firstInputRef}
                      type={showNew ? 'text' : 'password'}
                      id="update-new-password"
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onBlur={() => touchPw('newPassword')}
                      aria-invalid={Boolean(pwTouched.newPassword && pwErrors.newPassword)}
                      aria-describedby={
                        pwTouched.newPassword && pwErrors.newPassword ? 'update-new-password-error' : undefined
                      }
                      className={`${inputBase} pl-10 pr-12 ${pwTouched.newPassword && pwErrors.newPassword ? inputErr : inputOk}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((prev) => !prev)}
                      className="absolute inset-y-0 right-0 w-11 min-h-[44px] flex items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                      aria-label={showNew ? 'Hide new password' : 'Show new password'}
                      aria-pressed={showNew}
                    >
                      {showNew ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </Field>

                <Field
                  label="Confirm new password"
                  htmlFor="update-confirm-password"
                  errorId="update-confirm-password-error"
                  error={pwErrors.confirmPassword}
                  touched={pwTouched.confirmPassword}
                >
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-600 pointer-events-none"
                    >
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      id="update-confirm-password"
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => touchPw('confirmPassword')}
                      aria-invalid={Boolean(pwTouched.confirmPassword && pwErrors.confirmPassword)}
                      aria-describedby={
                        pwTouched.confirmPassword && pwErrors.confirmPassword
                          ? 'update-confirm-password-error'
                          : undefined
                      }
                      className={`${inputBase} pl-10 pr-12 ${pwTouched.confirmPassword && pwErrors.confirmPassword ? inputErr : inputOk}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      className="absolute inset-y-0 right-0 w-11 min-h-[44px] flex items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                      aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                      aria-pressed={showConfirm}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </Field>
              </div>

              <div
                aria-hidden={newPassword.length === 0}
                className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
                  newPassword.length > 0
                    ? 'grid-rows-[1fr] opacity-100 mt-4'
                    : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden min-h-0">
                  <div
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3"
                    id="password-strength-panel"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          Password strength
                        </span>
                        <span
                          className="text-xs font-bold transition-colors duration-200"
                          style={{ color: strength.color }}
                        >
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out motion-reduce:transition-none"
                          style={{ width: `${strength.pct}%`, backgroundColor: strength.color }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <Req met={strength.checks.minLength} label="Min. 8 characters" />
                      <Req met={strength.checks.hasUppercase} label="One uppercase letter" />
                      <Req met={strength.checks.hasNumber} label="One number" />
                      <Req met={strength.checks.hasSpecialChar} label="One special character" />
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={`${btnCls} mt-4`} id="update-password-submit-btn">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    <span>Updating...</span>
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}

          {/* Success state */}
          {view === 'update-password' && successMsg && (
            <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full animate-fade-in">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" aria-hidden="true" />
              </div>
              <div className="animate-fade-in">
                <p className="text-sm font-bold text-slate-900">Password Updated</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{successMsg}</p>
              </div>
            </div>
          )}

          {/* Secondary action */}
          {canDismissModal ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="min-h-[44px] px-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                id="back-to-login-link"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to sign in</span>
              </button>
            </div>
          ) : !successMsg && (
            <div className="flex flex-col items-center gap-1 pt-1">
              {sessionExpired && !isForcedReset && (
                <button
                  type="button"
                  onClick={() => {
                    setView('send-email');
                    setServerError('');
                    setSessionExpired(false);
                    setEmailSent(false);
                    setEmailTouched(false);
                  }}
                  className="min-h-[44px] px-4 inline-flex items-center justify-center text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  id="request-new-reset-btn"
                >
                  Request a new reset link
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelForcedReset}
                disabled={isLoading}
                className="min-h-[44px] px-4 inline-flex items-center justify-center text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                id="cancel-forced-reset-btn"
              >
                {isForcedReset ? 'Cancel and Sign Out' : 'Cancel'}
              </button>
            </div>
          )}
          </div>
        </div>

        <div className="px-5 sm:px-8 py-3 bg-slate-50 border-t border-slate-200 text-xs text-center text-slate-600 shrink-0">
          Restricted to authorized SwineSync personnel only.
        </div>
      </div>
    </div>
  );
}
