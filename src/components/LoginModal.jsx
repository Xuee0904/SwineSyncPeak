import { useCallback, useRef, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import useModalAnimation from '../hooks/useModalAnimation';
import { mapSupabaseUser } from '../utils/rbac';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email, password) {
  const errs = {};
  if (!email.trim()) errs.email = 'Email is required.';
  else if (email !== email.trim()) errs.email = 'Email cannot start or end with a space.';
  else if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address.';
  if (!password) errs.password = 'Password is required.';
  return errs;
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
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-slate-700 mb-1.5"
      >
        {label}
      </label>
      {children}
      <AnimatedFieldError id={errorId} message={touched ? error : ''} />
    </div>
  );
}

export default function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
  onForgotPassword,
  onForcePasswordChange,
  initialEmail = '',
}) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const emailInputRef = useRef(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setEmail(isOpen ? (initialEmail || '') : '');
    setPassword('');
    setShowPassword(false);
    setIsLoading(false);
    setServerError('');
    setTouched({ email: false, password: false });
  }

  const handleResetAndClose = useCallback(() => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setIsLoading(false);
    setServerError('');
    setTouched({ email: false, password: false });
    onClose();
  }, [onClose]);

  const { shouldRender, requestClose, panelRef, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, handleResetAndClose, { initialFocusRef: emailInputRef });

  if (!shouldRender) return null;

  const fieldErrors = validate(email, password);
  const isFormValid = Object.keys(fieldErrors).length === 0;

  const touch = (field) => setTouched((t) => ({ ...t, [field]: true }));
  const touchAll = () => setTouched({ email: true, password: true });

  const handleClose = (afterClose) => {
    requestClose(afterClose);
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

      if (user?.user_metadata?.is_archived === true) {
        await supabase.auth.signOut().catch(() => {});
        setServerError('This account has been archived. Contact an administrator.');
        return;
      }

      if (user?.user_metadata?.must_change_password) {
        if (onForcePasswordChange) {
          handleClose(() => onForcePasswordChange(user, password));
          return;
        }
      }

      onLoginSuccess(mapSupabaseUser(user));
      handleClose();
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
      console.error('[LoginModal] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const currentEmail = email.trim();
    handleClose(() => {
      if (onForgotPassword) onForgotPassword(currentEmail);
    });
  };

  const inputBase = [
    'w-full min-h-[44px] py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-500',
    'text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors',
  ].join(' ');
  const inputOk = 'border-slate-500 focus:border-emerald-700 focus:ring-emerald-700/25';
  const inputErr = 'border-rose-600 focus:border-rose-700 focus:ring-rose-600/25 bg-rose-50/40';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      id="login-modal-overlay"
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
        id="login-modal-content"
      >
        <div className="flex items-center justify-end px-3 pt-3 sm:px-4 sm:pt-4 shrink-0">
          <button
            type="button"
            onClick={() => handleClose()}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            aria-label="Close sign in dialog"
            id="close-login-btn"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 overflow-y-auto px-5 sm:px-8 pt-1 pb-6"
        >
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

            <h2
              id="login-modal-title"
              className="text-2xl font-extrabold font-display text-slate-900 tracking-tight"
            >
              Sign In
            </h2>
          </div>

          <AnimatedServerError message={serverError} />

          <div className="mt-5 space-y-4">
            <Field
              label="Email address"
              htmlFor="login-email"
              errorId="login-email-error"
              error={fieldErrors.email}
              touched={touched.email}
            >
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-600 pointer-events-none"
                >
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  ref={emailInputRef}
                  type="email"
                  inputMode="email"
                  id="login-email"
                  autoComplete="email"
                  placeholder="manager@farm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => touch('email')}
                  aria-invalid={Boolean(touched.email && fieldErrors.email)}
                  aria-describedby={touched.email && fieldErrors.email ? 'login-email-error' : undefined}
                  className={`${inputBase} pl-10 pr-4 ${touched.email && fieldErrors.email ? inputErr : inputOk}`}
                />
              </div>
            </Field>

            <Field
              label="Password"
              htmlFor="login-password"
              errorId="login-password-error"
              error={fieldErrors.password}
              touched={touched.password}
            >
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-10 flex items-center justify-center text-slate-600 pointer-events-none"
                >
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => touch('password')}
                  aria-invalid={Boolean(touched.password && fieldErrors.password)}
                  aria-describedby={touched.password && fieldErrors.password ? 'login-password-error' : undefined}
                  className={`${inputBase} pl-10 pr-12 ${touched.password && fieldErrors.password ? inputErr : inputOk}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 w-11 min-h-[44px] flex items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>

            <div className="flex justify-end -mt-2 -mb-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="min-h-[44px] px-2 -mr-2 inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline-offset-4 hover:underline transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-900/15 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700"
              id="login-submit-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="px-5 sm:px-8 py-3 bg-slate-50 border-t border-slate-200 text-xs text-center text-slate-600 shrink-0">
          Restricted to authorized SwineSync personnel only.
        </div>
      </div>
    </div>
  );
}
