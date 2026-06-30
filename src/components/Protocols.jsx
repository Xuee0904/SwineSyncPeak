import React from 'react';
import { ShieldAlert, CheckCircle2, ShieldCheck, Users } from 'lucide-react';

export default function Protocols() {
  const visitorRequirements = [
    {
      title: '72-Hour Swine Isolation',
      desc: 'Have absolutely no contact with external swine herds, or livestock markets for at least 72 hours (3 days) prior to your visit.'
    },
    {
      title: 'Outer Gate Sanitation',
      desc: 'Pass through the sanitation foot-bath and vehicle tire-wash stations upon crossing the outer facility boundary.'
    },
    {
      title: 'Lobby Hand Disinfection',
      desc: 'Sanitize hands thoroughly using the alcohol dispensers at the lobby reception entrance.'
    }
  ];

  const farmSanitizationStandards = [
    {
      title: 'Caretaker Pre-Entry Disinfection',
      desc: 'All farm caretakers undergo complete shower-in, shower-out disinfection procedures before entering animal housing units.'
    },
    {
      title: 'Rigorous Facility & Pen Sanitization',
      desc: 'Pens undergo high-pressure washing and sanitization, while walkways, loading docks, and paths are immediately sanitized after any buyer visit.'
    },
    {
      title: 'Authorized Supply Sourcing',
      desc: 'All feed formulations, vitamins, and medical supplies are sourced exclusively from government-authorized, certified agricultural suppliers.'
    },
    {
      title: 'Certified Veterinary Audits',
      desc: 'Only certified swine veterinarians conduct health diagnostics and diagnostics reviews to maintain health record credibility.'
    }
  ];

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="protocols-section">
      {/* Header Title with Icon */}
      <section className="border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-50 text-primary-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Safety Protocols</h1>
          </div>
        </div>
      </section>

      {/* Notice banner */}
      <section className="bg-gradient-to-r from-rose-50 to-swine-50 border border-rose-100 rounded-2xl p-5 flex gap-4 items-start" id="emergency-banner">
        <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-extrabold text-rose-900 text-sm">African Swine Fever (ASF) and Other Disease Mitigation</h3>
          <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
            We enforce daily sanitization checks and strict vehicle disinfection protocols.
          </p>
        </div>
      </section>

      {/* Side-by-Side Dual Protocol Columns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="protocols-grid">
        
        {/* Column 1: Visitor Requirements */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-slate-900">Visitor Pre-Arrival Requirements</h3>
                <p className="text-xs text-slate-400 mt-0.5">Measures you must meet before entering our facility boundary.</p>
              </div>
            </div>

            <div className="space-y-4">
              {visitorRequirements.map((req, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <span className="mt-0.5 shrink-0 p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-slate-800 block mb-0.5">{req.title}</span>
                    <span className="text-slate-550 leading-relaxed block text-slate-500">{req.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/50 text-xs text-emerald-800 flex gap-3 mt-6">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="leading-relaxed font-medium">
              Following these simple rules helps keep our farm safe, clean, and free from diseases.
            </p>
          </div>
        </div>

        {/* Column 2: Swine Wellness & Farm Sanitization */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-slate-900">Swine Sanitization Standards</h3>
                <p className="text-xs text-slate-400 mt-0.5">Strict daily practices we follow to ensure optimal animal safety.</p>
              </div>
            </div>

            <div className="space-y-4">
              {farmSanitizationStandards.map((std, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <span className="mt-0.5 shrink-0 p-1 bg-indigo-50 text-indigo-600 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-slate-800 block mb-0.5">{std.title}</span>
                    <span className="text-slate-550 leading-relaxed block text-slate-500">{std.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 text-xs text-indigo-850 flex gap-3 mt-6">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
            <p className="leading-relaxed font-medium">
              Every pen is deeply cleaned and disinfected to keep our pigs healthy and free from germs.
            </p>
          </div>
        </div>

      </section>
    </div>
  );
}