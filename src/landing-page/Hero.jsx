import React from 'react';
import AnnouncementBanner from './AnnouncementBanner';
import { ArrowUpRight, ChevronRight, Syringe, Award, ShieldCheck } from 'lucide-react';
import farmLogo from '../assets/Logo.jpg';

export default function Hero({ scrollToSection }) {
  return (
    <div className="animate-fade-in text-left pb-10" id="hero-section">
      {/* Top Farm Announcement Ribbon */}
      <AnnouncementBanner />

      {/* Main Public Hero Card */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-8 sm:p-12 lg:p-14 shadow-2xl border border-slate-700/40">
        {/* Subtle background ambient glow */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, #10b981 0%, transparent 50%), radial-gradient(circle at 10% 80%, #059669 0%, transparent 40%)',
          }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Farm Identity, Copy & CTAs */}
          <div className="lg:col-span-7 space-y-6">
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
              From farrow to finish, we raise fatteners, and piglet batches with veterinary-supervised health care, complete vaccination records, and strict biosecurity protocols.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => scrollToSection?.('catalog')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 cursor-pointer hover:translate-y-[-1px]"
              >
                Browse Available Swine <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollToSection?.('protocols')}
                className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                Visitor Safety Protocols <ChevronRight className="w-4 h-4 text-emerald-300" />
              </button>
            </div>
          </div>

          {/* Right Column: 3 Hybrid Trust & Transparency Cards */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* Card 1: 100% Documented Vaccines */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                <Syringe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-wide">100% Documented Vaccines</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                  Every animal carries a complete immunization passport and scheduled booster history.
                </p>
              </div>
            </div>

            {/* Card 2: Verified Pedigrees */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-wide">Verified Piglet &amp; Sow Pedigrees</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                  Carefully tracked breed genetics, parities, and born-alive rates for consistent raiser success.
                </p>
              </div>
            </div>

            {/* Card 3: Strict Biosecurity Standards */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-wide">Strict Biosecurity &amp; Disinfection</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                  Routine pen sanitization, mandatory 72-hour visitor rules, and vehicle tire spray stations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
