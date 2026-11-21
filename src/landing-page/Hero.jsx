import React, { useState, useEffect, useRef } from 'react';
import AnnouncementBanner from './AnnouncementBanner';
import { ArrowUpRight, ChevronRight, ChevronLeft, Syringe, ShieldCheck } from 'lucide-react';
import farmLogo from '../assets/Logo.jpg';
import heroSwineOne from '../assets/IMG_9220.webp';
import heroSwineTwo from '../assets/IMG_9194.webp';
import heroSwineThree from '../assets/IMG_9216.webp';
import heroSwineFour from '../assets/IMG_9227.webp';

const HERO_PHOTOS = [
  {
    src: heroSwineOne,
    alt: 'Healthy farm-raised swine at Ambo & Ang\'s Oink Yard',
  },
  {
    src: heroSwineTwo,
    alt: 'Healthy grower and fattener swine in the farm pen',
  },
  {
    src: heroSwineThree,
    alt: 'Two healthy white pigs standing in the farm pen',
  },
  {
    src: heroSwineFour,
    alt: 'Close-up of healthy swine at the farm',
  },
];

export default function Hero({ scrollToSection }) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false
  );
  const touchStartRef = useRef({ x: 0, y: 0 });
  const activePhoto = HERO_PHOTOS[activePhotoIndex];

  useEffect(() => {
    const handleVisibilityChange = () => setIsTabHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (isPaused || isTabHidden) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = setInterval(() => {
      setActivePhotoIndex((prev) => (prev + 1) % HERO_PHOTOS.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, isTabHidden]);

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + HERO_PHOTOS.length) % HERO_PHOTOS.length);
  };

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % HERO_PHOTOS.length);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    // Only treat clearly horizontal swipes as navigation so vertical page scroll is unaffected
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    if (deltaX < 0) handleNextPhoto();
    else handlePrevPhoto();
  };

  // Mouse-only pause: touch taps also fire mouseenter and would leave the carousel stuck paused
  const handlePointerEnter = (e) => {
    if (e.pointerType === 'mouse') setIsPaused(true);
  };
  const handlePointerLeave = (e) => {
    if (e.pointerType === 'mouse') setIsPaused(false);
  };
  return (
    <div className="animate-fade-in text-left" id="hero-section">
      {/* Top Farm Announcement Ribbon */}
      <AnnouncementBanner />

      {/* Main Public Hero Card */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white rounded-3xl p-5 sm:p-10 lg:p-14 shadow-2xl border border-slate-800">
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Farm Identity, Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6">
            {/* Farm Origin Identity Card */}
            <div className="inline-flex items-center gap-3.5 sm:gap-4 p-2 sm:p-2.5 pr-4 sm:pr-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl">
              <img
                src={farmLogo}
                alt="Ambo & Ang's Oink Yard Logo"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-[#fdfbf7] p-0.5 shadow-md border border-white/30 shrink-0"
              />
              <div className="flex flex-col text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm sm:text-base font-black text-white tracking-tight">
                    Ambo & Ang&apos;s Oink Yard
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-400 tracking-wide mt-0.5">
                  Biosecure Farm Operations
                </span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display tracking-tight leading-tight text-white">
              Healthy, High-Yield Swine from Our Family Piggery to Yours
            </h1>

            {/* Authentic Body Copy */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              From farrow to finish, we raise fatteners and piglet batches with veterinary-supervised health care, complete vaccination records, and strict biosecurity protocols.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => scrollToSection?.('catalog')}
                className="min-h-[44px] px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 cursor-pointer hover:translate-y-[-1px]"
              >
                Browse Available Pigs <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection?.('protocols')}
                className="min-h-[44px] px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                Visitor Safety Protocols <ChevronRight className="w-4 h-4 text-emerald-300" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right Column: Featured Swine Gallery */}
          <div className="lg:col-span-6">
            {/* Featured Farm Swine Gallery */}
            <div
              className="space-y-3"
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            >
              <div
                className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl aspect-[4/3] bg-slate-900 touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={activePhoto.src}
                  alt={activePhoto.alt}
                  decoding="async"
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent pointer-events-none" />

                {/* Prev / Next Controls */}
                <button
                  type="button"
                  onClick={handlePrevPhoto}
                  aria-label="Previous farm photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/60 hover:bg-slate-950/85 border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPhoto}
                  aria-label="Next farm photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/60 hover:bg-slate-950/85 border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-end gap-2">
                  <span className="text-[11px] font-medium text-emerald-300 bg-slate-950/70 backdrop-blur-sm border border-white/10 px-2.5 py-0.5 rounded-full shrink-0">
                    {activePhotoIndex + 1} / {HERO_PHOTOS.length}
                  </span>
                </div>
              </div>

              {/* Thumbnail Strip */}
              <div className="grid grid-cols-4 gap-2.5" role="group" aria-label="Farm swine photos">
                {HERO_PHOTOS.map((photo, idx) => {
                  const isSelected = idx === activePhotoIndex;
                  return (
                    <button
                      key={photo.alt}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`View photo ${idx + 1}: ${photo.alt}`}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative overflow-hidden rounded-xl aspect-[4/3] border transition-all cursor-pointer ${isSelected
                          ? 'border-emerald-400 ring-2 ring-emerald-400/40 opacity-100'
                          : 'border-white/15 opacity-65 hover:opacity-100'
                        }`}
                    >
                      <img
                        src={photo.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Trust & Transparency Cards */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-8 pt-6 border-t border-white/10">
          {/* Card 1: 100% Documented Vaccines */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Syringe className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-wide">100% Documented Vaccines</h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Every animal carries a complete immunization passport and scheduled booster history.
              </p>
            </div>
          </div>

          {/* Card 2: Strict Biosecurity Standards */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-wide">Strict Biosecurity &amp; Disinfection</h2>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Routine pen sanitization, mandatory 72-hour visitor rules, and vehicle tire spray stations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
