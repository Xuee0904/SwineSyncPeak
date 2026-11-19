import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import UpdatePasswordModal from './components/UpdatePasswordModal';
import TermsModal from './components/TermsModal';
import Dashboard from './pages/Dashboard';
import Hero from './landing-page/Hero';
import Protocols from './landing-page/Protocols';
import Catalog from './landing-page/Catalog';
import FAQs from './landing-page/FAQs';
import Contact from './landing-page/Contact';
import { ArrowUp } from 'lucide-react';
import SplashScreen from './components/SplashScreen';
import { supabase } from './supabaseClient';
import ToastContainer from './components/ToastContainer';
import { toast as globalToast } from './utils/toast';
import { mapSupabaseUser } from './utils/rbac';
import farmLogo from './assets/Logo.jpg';
import './App.css';

function getRecoveryUrlError() {
  if (typeof window === 'undefined') return '';
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  const errorCode = (hashParams.get('error_code') || searchParams.get('error_code') || '').toLowerCase();
  const error = (hashParams.get('error') || searchParams.get('error') || '').toLowerCase();
  const errorDesc = hashParams.get('error_description') || searchParams.get('error_description') || '';

  if (errorCode === 'otp_expired' || error === 'access_denied' || errorDesc) {
    return 'Your password reset link has expired or is invalid. Please request a new reset link.';
  }
  return '';
}

function hasRecoveryUrlToken() {
  if (typeof window === 'undefined') return false;
  if (getRecoveryUrlError()) return false;
  const href = window.location.href.toLowerCase();
  return href.includes('type=recovery') || href.includes('access_token');
}

const CACHED_USER_KEY = 'swinesync_cached_user';

function hasStoredSupabaseSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    // Storage unavailable
  }
  return false;
}

function readCachedUser() {
  if (hasRecoveryUrlToken() || !hasStoredSupabaseSession()) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHED_USER_KEY) || 'null');
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isUpdatePasswordOpen, setIsUpdatePasswordOpen] = useState(false);
  const [updatePasswordView, setUpdatePasswordView] = useState('send-email');

  // Cache to prevent reuse of temporary first-time log in password
  const [tempPasswordUsed, setTempPasswordUsed] = useState('');
  const [pendingResetEmail, setPendingResetEmail] = useState('');
  const [isForcedPasswordChange, setIsForcedPasswordChange] = useState(false);

  const isRecoveryLoadRef = useRef(hasRecoveryUrlToken());
  const recoveryUrlErrorRef = useRef(getRecoveryUrlError());
  const urlErrorHandledRef = useRef(false);

  const [initialCachedUser] = useState(readCachedUser);
  const [loggedInUser, setLoggedInUser] = useState(initialCachedUser);
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => !hasRecoveryUrlToken() && !getRecoveryUrlError() && !initialCachedUser && hasStoredSupabaseSession()
  );
  const [splashPhase, setSplashPhase] = useState(() =>
    !hasRecoveryUrlToken() && !getRecoveryUrlError() && hasStoredSupabaseSession() ? 'show' : 'done'
  );
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const [splashDuration, setSplashDuration] = useState(900);
  const [splashRunId, setSplashRunId] = useState(0);
  const splashLeaving = splashPhase === 'show' && splashMinElapsed && !isRestoringSession;

  const triggerSplash = (durationMs = 650) => {
    setSplashDuration(durationMs);
    setSplashMinElapsed(false);
    setSplashRunId((n) => n + 1);
    setSplashPhase('show');
  };

  useEffect(() => {
    if (splashPhase !== 'show') return;
    const timer = setTimeout(() => setSplashMinElapsed(true), splashDuration);
    return () => clearTimeout(timer);
  }, [splashPhase, splashDuration, splashRunId]);

  useEffect(() => {
    if (!splashLeaving) return;
    const timer = setTimeout(() => setSplashPhase('done'), 320);
    return () => clearTimeout(timer);
  }, [splashLeaving]);

  useEffect(() => {
    try {
      if (loggedInUser) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(loggedInUser));
      else localStorage.removeItem(CACHED_USER_KEY);
    } catch {
      // Storage unavailable
    }
  }, [loggedInUser]);

  const [activeSection, setActiveSection] = useState('home');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const observerRef = useRef(null);

  // ─── Supabase Auth & PASSWORD_RECOVERY handler ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Guards against a stray/late PASSWORD_RECOVERY event firing later in the
    // session (e.g. a trailing token-refresh tick on the recovery session as
    // it's being signed out) and abruptly yanking whatever modal is open at
    // the time. Once we've handled the *real* recovery link, we stop
    // reacting to this event entirely.
    let recoveryInProgress = false;
    let recoveryHandled = false;

    const clearPersistedTab = () => {
      try {
        sessionStorage.removeItem('swinesync_active_tab');
      } catch {
        // Ignore storage errors in restricted environments
      }
    };

    const openRecoveryModal = () => {
      if (recoveryHandled) return;
      recoveryHandled = true;
      setLoggedInUser(null);
      setIsLoginOpen(false);
      setIsForcedPasswordChange(false);
      setPendingResetEmail('');
      setUpdatePasswordView('update-password');
      setIsUpdatePasswordOpen(true);
    };

    const hasRecoveryToken = isRecoveryLoadRef.current || hasRecoveryUrlToken();

    if (recoveryUrlErrorRef.current) {
      if (!urlErrorHandledRef.current) {
        urlErrorHandledRef.current = true;
        window.history.replaceState(null, '', window.location.pathname);
        setLoggedInUser(null);
        setIsLoginOpen(false);
        setIsForcedPasswordChange(false);
        setUpdatePasswordView('send-email');
        setIsUpdatePasswordOpen(true);
        globalToast.show('error', recoveryUrlErrorRef.current);
      }
    } else if (hasRecoveryToken) {
      isRecoveryLoadRef.current = true;
      recoveryInProgress = true;
      openRecoveryModal();

      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (cancelled) return;
          if (session?.user?.email) {
            setPendingResetEmail(session.user.email);
          }
          if (window.location.hash || window.location.search) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        })
        .catch(() => { });
    } else {
      const isTransientAuthError = (err) => {
        if (!err) return false;
        const msg = String(err.message || '').toLowerCase();
        return (
          err.name === 'AuthRetryableFetchError' ||
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('timeout') ||
          err.status === 429 ||
          (typeof err.status === 'number' && err.status >= 500)
        );
      };

      const restoreSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (!session?.user) {
            setLoggedInUser(null);
            return;
          }

          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (cancelled) return;

          let activeUser = userData?.user || session.user;

          if (userError) {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (cancelled) return;

            if (!refreshError && (refreshed?.user || refreshed?.session?.user)) {
              activeUser = refreshed.user || refreshed.session.user;
            } else if (refreshError && !isTransientAuthError(refreshError)) {
              await supabase.auth.signOut().catch(() => { });
              clearPersistedTab();
              setLoggedInUser(null);
              return;
            }
          }

          if (activeUser.user_metadata?.is_archived === true) {
            await supabase.auth.signOut().catch(() => { });
            clearPersistedTab();
            setLoggedInUser(null);
            globalToast.show('error', 'This account has been archived. Contact an administrator.');
            return;
          }

          if (activeUser.user_metadata?.must_change_password) {
            await supabase.auth.signOut().catch(() => { });
            clearPersistedTab();
            setLoggedInUser(null);
            globalToast.show('info', 'Please sign in again to complete your required password update.');
            return;
          }

          setLoggedInUser(mapSupabaseUser(activeUser));
        } finally {
          if (!cancelled) {
            setIsRestoringSession(false);
          }
        }
      };

      restoreSession();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && (recoveryInProgress || isRecoveryLoadRef.current)) {
        openRecoveryModal();
        if (session?.user?.email) {
          setPendingResetEmail(session.user.email);
        }
        if (window.location.hash || window.location.search) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }
      if (event === 'SIGNED_OUT') {
        clearPersistedTab();
        setLoggedInUser(null);
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (recoveryInProgress || isRecoveryLoadRef.current) {
          return;
        }
        if (session?.user?.user_metadata?.is_archived === true) {
          supabase.auth.signOut().catch(() => { });
          clearPersistedTab();
          setLoggedInUser(null);
          globalToast.show('error', 'This account has been archived. Contact an administrator.');
          return;
        }
        if (session?.user?.user_metadata?.must_change_password) {
          return;
        }
        if (session?.user) {
          setLoggedInUser(mapSupabaseUser(session.user));
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isRestoringSession || loggedInUser) return;
    const sectionIds = ['home', 'protocols', 'catalog', 'faqs', 'contact'];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [loggedInUser, isRestoringSession]);

  // Scroll-reveal: animate sections below the fold as they enter the viewport
  useEffect(() => {
    if (isRestoringSession || loggedInUser) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const revealEls = Array.from(document.querySelectorAll('.reveal-on-scroll'));
    const hiddenEls = revealEls.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.95);
    hiddenEls.forEach((el) => el.classList.add('reveal-hidden'));

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('reveal-hidden');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.02 }
    );

    hiddenEls.forEach((el) => revealObserver.observe(el));

    return () => {
      revealObserver.disconnect();
      hiddenEls.forEach((el) => el.classList.remove('reveal-hidden'));
    };
  }, [loggedInUser, isRestoringSession]);

  // Back-to-top visibility
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLoginSuccess = (userObj) => {
    triggerSplash(650);
    setLoggedInUser(userObj);
    showToast(`Welcome back, ${userObj.name}.`, 'success');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleLogout = () => {
    triggerSplash(550);
    try {
      sessionStorage.removeItem('swinesync_active_tab');
    } catch {
      // Ignore storage errors
    }
    supabase.auth.signOut().catch(() => { });
    setLoggedInUser(null);
    showToast('You have signed out of the staff portal.', 'info');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showToast = (message, type = 'success') => {
    globalToast.show(type, message);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] flex flex-col font-sans text-slate-800 antialiased" id="swinesync-app-root">

      {/* Navigation Header (hidden when staff is logged in or restoring session) */}
      {!isRestoringSession && !loggedInUser && (
        <Navbar
          activeSection={activeSection}
          scrollToSection={scrollToSection}
          onOpenLogin={() => {
            setPendingResetEmail('');
            setIsLoginOpen(true);
          }}
          loggedInUser={loggedInUser}
          onLogout={handleLogout}
          isLandingMode={!loggedInUser}
        />
      )}

      {/* Global Toast Container */}
      <ToastContainer />

      {splashPhase !== 'done' && <SplashScreen leaving={splashLeaving} />}
      {/* Back to Top button */}
      {!isRestoringSession && !loggedInUser && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`back-to-top ${showBackToTop ? 'visible' : ''}`}
          aria-label="Scroll back to top"
          id="back-to-top-btn"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* ── STAFF PORTAL (only when logged in) ── */}
      {isRestoringSession ? (
        <main className="flex-grow" aria-hidden="true" />
      ) : loggedInUser ? (
        <Dashboard loggedInUser={loggedInUser} scrollToSection={scrollToSection} onLogout={handleLogout} />
      ) : (
        /* ── PUBLIC LANDING PAGE (scrollable) ── */
        <main className="flex-grow" id="public-landing">

          {/* HERO / HOME */}
          <section id="home" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pb-16">
            <Hero scrollToSection={scrollToSection} />
          </section>

          {/* PROTOCOLS */}
          <section id="protocols" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 reveal-on-scroll">
            <Protocols />
          </section>

          {/* CATALOG */}
          <section id="catalog" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-10 reveal-on-scroll">
            <Catalog />
          </section>

          {/* FAQs */}
          <section id="faqs" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 reveal-on-scroll">
            <FAQs scrollToSection={scrollToSection} />
          </section>

          {/* CONTACT */}
          <div id="contact" className="bg-slate-950 py-20 reveal-on-scroll">
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
              <Contact />
            </div>
          </div>

        </main>
      )}

      {/* Staff Login Overlay Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        initialEmail={pendingResetEmail}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(userObj) => {
          setPendingResetEmail('');
          handleLoginSuccess(userObj);
        }}
        onForgotPassword={(typedEmail) => {
          setPendingResetEmail(typedEmail || '');
          setIsForcedPasswordChange(false);
          setUpdatePasswordView('send-email');
          setIsLoginOpen(false);
          setIsUpdatePasswordOpen(true);
        }}
        onForcePasswordChange={(user, oldPass) => {
          setTempPasswordUsed(oldPass);
          setPendingResetEmail(user?.email || '');
          setIsForcedPasswordChange(true);
          setIsLoginOpen(false);
          setUpdatePasswordView('update-password');
          setIsUpdatePasswordOpen(true);
        }}
      />

      {/* Update Password Modal */}
      <UpdatePasswordModal
        isOpen={isUpdatePasswordOpen}
        initialView={updatePasswordView}
        initialEmail={pendingResetEmail}
        isForcedReset={isForcedPasswordChange}
        oldPassword={tempPasswordUsed}
        onClose={() => {
          setIsUpdatePasswordOpen(false);
          setIsForcedPasswordChange(false);
          setTempPasswordUsed('');
        }}
        onBackToLogin={() => {
          setIsUpdatePasswordOpen(false);
          setIsForcedPasswordChange(false);
          setIsLoginOpen(true);
        }}
        onCancelForcedReset={async () => {
          isRecoveryLoadRef.current = false;
          await supabase.auth.signOut().catch(() => { });
          setIsUpdatePasswordOpen(false);
          setIsForcedPasswordChange(false);
          setTempPasswordUsed('');
          setPendingResetEmail('');
          showToast(
            isForcedPasswordChange
              ? 'Sign in cancelled. Your temporary password was not changed.'
              : 'Password reset cancelled.',
            'info'
          );
        }}
        onResetSuccess={async () => {
          try {
            isRecoveryLoadRef.current = false;
            if (isForcedPasswordChange) {
              const { data: { user } } = await supabase.auth.getUser();
              setIsUpdatePasswordOpen(false);
              setIsForcedPasswordChange(false);
              setTempPasswordUsed('');
              setPendingResetEmail('');
              if (user) {
                const mappedUser = mapSupabaseUser(user);
                setLoggedInUser(mappedUser);
                showToast(`Password updated. Welcome, ${mappedUser.name}!`, 'success');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                setIsLoginOpen(true);
                showToast('Password updated. Please sign in with your new password.', 'success');
              }
              return;
            }

            await supabase.auth.signOut();
            setIsUpdatePasswordOpen(false);
            setIsForcedPasswordChange(false);
            setTempPasswordUsed('');
            setIsLoginOpen(true);
            showToast('Password updated. Please sign in with your new password.', 'success');
          } catch (e) {
            console.error('Error handling password update transition:', e);
          }
        }}
      />

      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      {/* Public Footer */}
      {!isRestoringSession && !loggedInUser && <footer className="bg-slate-900 text-slate-400 border-t border-slate-800" id="swinesync-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800">
            {/* Co-Branded Footer Identity Lockup */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-white shrink-0">
              {/* SwineSync Brand */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-600 text-white font-extrabold text-sm shadow-md">
                  S
                </div>
                <span className="font-black font-display text-lg tracking-tight">
                  Swine<span className="text-primary-400">Sync</span>
                </span>
              </div>

              {/* Vertical Divider */}
              <div className="hidden sm:block h-7 w-px bg-slate-700/80" />

              {/* Client Farm Identity */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">for</span>
                <img
                  src={farmLogo}
                  alt="Ambo & Ang's Oink Yard Logo"
                  className="w-7 h-7 rounded-lg object-contain bg-[#fdfbf7] p-0.5 border border-slate-700 shadow-sm"
                />
                <span className="text-xs font-bold text-slate-200 leading-tight">
                  Ambo &amp; Ang&apos;s Oink Yard
                </span>
              </div>
            </div>
            <nav aria-label="Footer platform links">
              <ul className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 lg:gap-x-10 gap-y-3 text-xs font-semibold">
                {[
                  { label: 'Home', id: 'home' },
                  { label: 'Safety Protocols', id: 'protocols' },
                  { label: 'Available Pigs', id: 'catalog' },
                  { label: 'FAQs', id: 'faqs' },
                  { label: 'Contact Us', id: 'contact' }
                ].map((link) => (
                  <li key={link.id}>
                    <button
                      onClick={() => scrollToSection(link.id)}
                      className="hover:text-white transition-colors cursor-pointer text-left py-1"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} SwineSync &middot; Built for Ambo &amp; Ang&apos;s Oink Yard.</p>
            <button
              type="button"
              onClick={() => setIsTermsOpen(true)}
              className="text-slate-400 hover:text-white underline-offset-4 hover:underline transition-colors cursor-pointer py-1"
              id="footer-terms-btn"
            >
              Terms &amp; Conditions
            </button>
          </div>
        </div>
      </footer>}

    </div>
  );
}