import React, { useState, useEffect } from 'react';
import { Menu, X, LogIn, LogOut, User, Shield, ChevronDown } from 'lucide-react';

export default function Navbar({ activeSection, scrollToSection, onOpenLogin, loggedInUser, onLogout, isLandingMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Public landing nav items including the Catalog section
  const publicNavItems = [
    { id: 'home', label: 'Home' },
    { id: 'protocols', label: 'Safety Protocols' },
    { id: 'news', label: 'News & Announcements' },
    { id: 'catalog', label: 'Swine Catalog' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact Us' }
  ];

  const handleNavClick = (id) => {
    if (isLandingMode && scrollToSection) {
      scrollToSection(id);
    }
    setIsOpen(false);
  };

  const isActive = (id) => activeSection === id;

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-md shadow-slate-900/5'
          : 'bg-white/80 backdrop-blur-sm border-b border-slate-100/60 shadow-sm'
      }`}
      id="main-navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">

          {/* Logo Brand Area */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-3 cursor-pointer group"
              id="brand-logo-btn"
            >
              <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-700 shadow-md shadow-primary-700/20 text-white group-hover:scale-105 transition-transform">
                <Shield className="w-6 h-6 text-white" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-swine-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-swine-500 border-2 border-white"></span>
                </span>
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-xl font-extrabold font-display tracking-tight text-slate-900 group-hover:text-primary-700 transition-colors">
                  Swine<span className="text-primary-600">Sync</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">
                  Livestock Ecosystem
                </span>
              </div>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          {isLandingMode && (
            <div className="hidden lg:flex items-center space-x-1">
              {publicNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  id={`nav-${item.id}-desktop`}
                  className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive(item.id)
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                  {/* Active indicator dot */}
                  {isActive(item.id) && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Desktop Action Area: Login / User Controls */}
          <div className="hidden lg:flex items-center gap-4">
            {loggedInUser ? (
              <div className="flex items-center gap-3 bg-slate-50 pl-3 pr-2 py-1.5 rounded-2xl border border-slate-100" id="desktop-user-profile">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-semibold text-xs">
                    {loggedInUser.charAt(0)}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs text-slate-400 leading-none">Staff Portal</span>
                    <span className="text-xs font-bold text-slate-700">{loggedInUser}</span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Exit Staff Portal"
                  id="nav-logout-btn-desktop"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg shadow-slate-950/10"
                id="nav-login-btn-desktop"
              >
                <LogIn className="w-4 h-4" />
                Staff Login
              </button>
            )}
          </div>

          {/* Mobile Menu Hamburguer Toggle */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 focus:outline-none transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
              id="mobile-menu-toggle"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation Panel */}
      {isOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white" id="mobile-navigation-drawer">
          <div className="px-4 pt-2 pb-6 space-y-1.5 shadow-inner">
            {isLandingMode && publicNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                id={`nav-${item.id}-mobile`}
                className={`w-full text-left px-4 py-3 rounded-xl text-base font-semibold transition-all cursor-pointer ${
                  isActive(item.id)
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-4 border-t border-slate-100 mt-4">
              {loggedInUser ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100" id="mobile-user-profile">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">
                      {loggedInUser.charAt(0)}
                    </span>
                    <div className="flex flex-col text-left">
                      <span className="text-xs text-slate-400">Staff Portal</span>
                      <span className="text-sm font-extrabold text-slate-800">{loggedInUser}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsOpen(false);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    id="nav-logout-btn-mobile"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Exit Portal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onOpenLogin();
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  id="nav-login-btn-mobile"
                >
                  <LogIn className="w-4 h-4" />
                  Staff Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}