import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import UpdatePasswordModal from './components/UpdatePasswordModal';
import Dashboard from './pages/Dashboard';
import Protocols from './landing-page/Protocols';
import News from './landing-page/News';
import Catalog from './landing-page/Catalog';
import FAQs from './landing-page/FAQs';
import Contact from './landing-page/Contact';
import { ShieldCheck, Heart, CheckCircle2, X, ArrowUp } from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

export default function App() {
  const [isLoginOpen, setIsLoginOpen]                   = useState(false);
  const [isUpdatePasswordOpen, setIsUpdatePasswordOpen] = useState(false);
  const [updatePasswordView, setUpdatePasswordView]     = useState('send-email');
  
  // Cache to prevent reuse of temporary first-time log in password
  const [tempPasswordUsed, setTempPasswordUsed]         = useState('');

  const [loggedInUser, setLoggedInUser]                 = useState(null);
  const [toast, setToast]                               = useState(null);
  const [activeSection, setActiveSection]               = useState('home');
  const [showBackToTop, setShowBackToTop]               = useState(false);
  const observerRef = useRef(null);

  // ─── Supabase PASSWORD_RECOVERY handler ─────────────────────────────────────
  useEffect(() => {
    // Guards against a stray/late PASSWORD_RECOVERY event firing later in the
    // session (e.g. a trailing token-refresh tick on the recovery session as
    // it's being signed out) and abruptly yanking whatever modal is open at
    // the time. Once we've handled the *real* recovery link, we stop
    // reacting to this event entirely.
    let recoveryInProgress = false;
    let recoveryHandled = false;

    const openRecoveryModal = () => {
      if (recoveryHandled) return;
      recoveryHandled = true;
      setIsLoginOpen(false);
      setUpdatePasswordView('update-password');
      setIsUpdatePasswordOpen(true);
    };

    const href = window.location.href.toLowerCase();
    const hasRecoveryToken = 
      href.includes('type=recovery') || 
      href.includes('recovery') || 
      href.includes('access_token');

    if (hasRecoveryToken) {
      recoveryInProgress = true;
      openRecoveryModal();
      window.history.replaceState(null, '', window.location.pathname);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && recoveryInProgress) {
        openRecoveryModal();
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sectionIds = ['home', 'protocols', 'news', 'catalog', 'faqs', 'contact'];

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
  }, [loggedInUser]);

  // Scroll-reveal: animate sections entering viewport
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal-on-scroll');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
    return () => revealObserver.disconnect();
  }, [loggedInUser]);

  // Back-to-top visibility
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLoginSuccess = (userObj) => {
    setLoggedInUser(userObj);
    showToast(`Welcome back, ${userObj.name}! Session established successfully.`, 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    showToast('Staff session terminated successfully.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased" id="swinesync-app-root">

      {/* Navigation Header — hidden when staff is logged in */}
      {!loggedInUser && (
        <Navbar
          activeSection={activeSection}
          scrollToSection={scrollToSection}
          onOpenLogin={() => setIsLoginOpen(true)}
          loggedInUser={loggedInUser}
          onLogout={handleLogout}
          isLandingMode={!loggedInUser}
        />
      )}

      {/* Toast Alert notification — z-[60] prevents clipping behind active backdrops */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 bg-slate-900 border border-slate-850 text-white rounded-2xl shadow-xl animate-slide-in max-w-sm"
          id="toast-notification"
        >
          <CheckCircle2 className={`w-5 h-5 shrink-0 ${toast.type === 'success' ? 'text-primary-500' : 'text-indigo-400'}`} />
          <p className="text-xs font-semibold leading-relaxed text-left">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Back to Top button */}
      {!loggedInUser && (
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
      {loggedInUser ? (
        <Dashboard loggedInUser={loggedInUser} scrollToSection={scrollToSection} onLogout={handleLogout} />
      ) : (
        /* ── PUBLIC LANDING PAGE (scrollable) ── */
        <main className="flex-grow" id="public-landing">

          {/* HERO / HOME */}
          <section id="home" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
            <Dashboard scrollToSection={scrollToSection} />
          </section>

          {/* DIVIDER */}
          <div className="w-full border-t border-slate-100" />

          {/* PROTOCOLS */}
          <section id="protocols" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal-on-scroll">
            <Protocols />
          </section>

          {/* DIVIDER */}
          <div className="w-full bg-slate-900/3 border-t border-slate-100" />

          {/* NEWS */}
          <section id="news" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal-on-scroll">
            <News />
          </section>

          {/* DIVIDER */}
          <div className="w-full border-t border-slate-100" />

          {/* CATALOG */}
          <section id="catalog" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal-on-scroll">
            <Catalog />
          </section>

          {/* FAQs */}
          <section id="faqs" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal-on-scroll">
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
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onForgotPassword={() => {
          setUpdatePasswordView('send-email');
          setIsLoginOpen(false);
          setIsUpdatePasswordOpen(true);
        }}
        onForcePasswordChange={(user, oldPass) => {
          setTempPasswordUsed(oldPass);
          setIsLoginOpen(false);
          setUpdatePasswordView('update-password');
          setIsUpdatePasswordOpen(true);
        }}
      />

      {/* Update Password Modal */}
      <UpdatePasswordModal
        isOpen={isUpdatePasswordOpen}
        initialView={updatePasswordView}
        oldPassword={tempPasswordUsed}
        onClose={() => {
          setIsUpdatePasswordOpen(false);
          setTempPasswordUsed('');
        }}
        onBackToLogin={() => {
          setIsUpdatePasswordOpen(false);
          setIsLoginOpen(true);
        }}
        onResetSuccess={async () => {
          try {
            await supabase.auth.signOut();
            setIsUpdatePasswordOpen(false);
            setTempPasswordUsed('');
            setIsLoginOpen(true);
            showToast('Password updated successfully. Please log in with your new credentials.', 'success');
          } catch (e) {
            console.error('Error handling password update transition:', e);
          }
        }}
      />

      {/* Public Footer */}
      {!loggedInUser && <footer className="bg-slate-900 text-slate-400 border-t border-slate-800" id="swinesync-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-2.5 text-white shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-600 text-white font-extrabold text-sm shadow-md">
                S
              </div>
              <span className="font-black font-display text-lg tracking-tight">Swine<span className="text-primary-400">Sync</span></span>
            </div>
            <nav aria-label="Footer platform links">
              <ul className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 lg:gap-x-10 gap-y-3 text-xs font-semibold">
                {[
                  { label: 'Home', id: 'home' },
                  { label: 'Safety Protocols', id: 'protocols' },
                  { label: 'News & Announcements', id: 'news' },
                  { label: 'Swine Catalog', id: 'catalog' },
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
            <p>&copy; {new Date().getFullYear()} SwineSync. All rights reserved.</p>
          </div>
        </div>
      </footer>}

    </div>
  );
}