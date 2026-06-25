import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import Dashboard from './components/Dashboard';
import Protocols from './components/Protocols';
import News from './components/News';
import Catalog from './components/Catalog';
import FAQs from './components/FAQs';
import Contact from './components/Contact';
import { ShieldCheck, Heart, CheckCircle2, X, ArrowUp } from 'lucide-react';
import './App.css';

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const observerRef = useRef(null);

  // Scroll-spy: track which section is in view
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

  const handleLoginSuccess = (name) => {
    setLoggedInUser(name);
    showToast(`Welcome back, ${name}! Staff session established successfully.`, 'success');
    // Scroll to top (dashboard view)
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

      {/* Navigation Header */}
      <Navbar
        activeSection={activeSection}
        scrollToSection={scrollToSection}
        onOpenLogin={() => setIsLoginOpen(true)}
        loggedInUser={loggedInUser}
        onLogout={handleLogout}
        isLandingMode={!loggedInUser}
      />

      {/* Toast Alert notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-slate-900 border border-slate-850 text-white rounded-2xl shadow-xl animate-slide-in max-w-sm"
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
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10" id="staff-portal-layout">
          <Catalog loggedInUser={loggedInUser} />
        </main>
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

          {/* FAQs */}
          <section id="faqs" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 reveal-on-scroll">
            <FAQs scrollToSection={scrollToSection} />
          </section>

          {/* CONTACT — full-width dark background band */}
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
      />

      {/* Public Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800" id="swinesync-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
            {/* Brand column */}
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-600 text-white font-extrabold text-sm shadow-md">
                  S
                </div>
                <span className="font-black font-display text-lg tracking-tight">Swine<span className="text-primary-400">Sync</span></span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-light max-w-sm">
                Next-generation swine operations monitoring, digital trace registration, and compliance log ecosystem. Prepared for Supabase and RFID scanner integrations.
              </p>
            </div>

            {/* Quick Links Column */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">Platform</h4>
              <ul className="space-y-2 text-xs">
                {['Home', 'Safety & Protocols', 'News', 'FAQs', 'Contact Us'].map((label, i) => {
                  const ids = ['home', 'protocols', 'news', 'faqs', 'contact'];
                  return (
                    <li key={ids[i]}>
                      <button
                        onClick={() => scrollToSection(ids[i])}
                        className="hover:text-white transition-colors cursor-pointer text-left"
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Infrastructure info */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest">Security Status</h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>All Systems Operational</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-primary-500" />
                  <span>SSL SECURED • AES-256</span>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright line */}
          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>&copy; {new Date().getFullYear()} SwineSync Livestock Ecosystem. All rights reserved.</p>
            <div className="flex items-center gap-1">
              <span>Designed for precision agriculture with</span>
              <Heart className="w-3 h-3 text-swine-450 text-rose-500 fill-rose-500" />
              <span>and React.js.</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
