import React, { useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        // Supabase returns generic messages — map them to friendlier ones
        if (authError.message.toLowerCase().includes('invalid')) {
          setError('Incorrect email or password. Please try again.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setError('Your account email has not been confirmed yet. Check your inbox.');
        } else {
          setError(authError.message);
        }
        return;
      }

      // Pull the display name from user metadata if set, otherwise fall back to email prefix
      const user         = data.user;
      const displayName  =
        user.user_metadata?.full_name ||
        user.user_metadata?.name      ||
        user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1);

      onLoginSuccess(displayName);
      onClose();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('[LoginModal] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      id="login-modal-overlay"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
        id="login-modal-content"
      >
        {/* Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-primary-600 to-swine-400 w-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close authentication modal"
          id="close-login-btn"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-primary-50 text-primary-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-display text-slate-900">Staff Portal</h2>
          <p className="mt-2 text-sm text-slate-500">
            Secure access to SwineSync biosafety protocols, records, and database configurations.
          </p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8 space-y-5" id="login-form">
          {error && (
            <div
              className="p-3.5 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2"
              id="login-error-msg"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase" htmlFor="login-email">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                id="login-email"
                required
                autoComplete="email"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase" htmlFor="login-password">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                required
                autoComplete="current-password"
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                id="toggle-password-btn"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                id="remember-me-checkbox"
                className="w-4 h-4 rounded text-primary-600 border-slate-200 focus:ring-primary-500/20"
              />
              Remember session
            </label>
            <a
              href="#"
              className="font-semibold text-primary-700 hover:text-primary-800 transition-colors"
              id="forgot-password-link"
              onClick={async (e) => {
                e.preventDefault();
                if (!email) { setError('Enter your email above first, then click Forgot password.'); return; }
                const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim());
                if (resetErr) { setError(resetErr.message); }
                else { setError(''); alert(`Password reset email sent to ${email}`); }
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3.5 px-4 mt-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold text-sm rounded-xl hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-700/10 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            id="login-submit-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In as Staff'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[11px] text-center text-slate-400">
          This system is restricted to authorized personnel. All connections are monitored and logged.
        </div>
      </div>
    </div>
  );
}