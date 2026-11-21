import React, { useState } from 'react';
import { MapPin, Phone, ExternalLink, Clock, Copy, Check, MessageCircle } from 'lucide-react';
import { FARM_PRIMARY_PHONE, FARM_SECONDARY_PHONE, FARM_MESSENGER_URL } from './contactInfo';

export default function Contact({ onOpenTerms }) {
  const [copied, setCopied] = useState(false);

  const farmAddress = 'Purok 4, Barangay San Isidro, Lipa City, Batangas, Philippines';
  const primaryPhone = FARM_PRIMARY_PHONE;
  const secondaryPhone = FARM_SECONDARY_PHONE;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(farmAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-8 text-left animate-fade-in" id="contact-section">
      {/* Header Title */}
      <section className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Phone className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold font-display text-white tracking-tight">Contact Us</h2>
          </div>
        </div>
      </section>

      {/* Main Contact & Address Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="contact-details-grid">
        {/* Card 1: Farm Address */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                <MapPin className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Farm Location
                </span>
                <h3 className="text-xl font-bold font-display text-white">
                  Ambo &amp; Ang&apos;s Oink Yard
                </h3>
              </div>
            </div>

            <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Physical Address
              </p>
              <p className="text-base font-semibold text-slate-100 leading-relaxed">
                {farmAddress}
              </p>
              <p className="text-xs text-slate-300 pt-1 leading-relaxed">
                Main gate entrance along the barangay access road. All visiting vehicles must proceed through the tire sanitation bath.
              </p>
            </div>

            <div className="flex items-start gap-3 p-4 bg-emerald-950/50 border border-emerald-800/50 rounded-2xl text-xs text-slate-200">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-bold text-white block">Visiting Hours</span>
                <span>Monday to Saturday: 8:00 AM &ndash; 5:00 PM</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyAddress}
              aria-live="polite"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Address Copied!' : 'Copy Address'}
            </button>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(farmAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Card 2: Contact Numbers */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Phone className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Direct Inquiries
                </span>
                <h3 className="text-xl font-bold font-display text-white">
                  Call or Message Us
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {/* Primary Contact Number */}
              <a
                href={`tel:${primaryPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between p-5 bg-slate-800/60 hover:bg-emerald-950/40 border border-slate-700/60 hover:border-emerald-700/70 rounded-2xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                    Primary Mobile / Inquiries
                  </span>
                  <span className="text-lg font-black font-display text-white group-hover:text-emerald-300 transition-colors">
                    {primaryPhone}
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5">Calls &amp; SMS messages welcome</span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 group-hover:bg-emerald-700 group-hover:text-white group-hover:border-emerald-600 transition-all shrink-0">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                </div>
              </a>

              {/* Secondary Contact Number */}
              <a
                href={`tel:${secondaryPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between p-5 bg-slate-800/60 hover:bg-emerald-950/40 border border-slate-700/60 hover:border-emerald-700/70 rounded-2xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                    Secondary Line / Farm Operations
                  </span>
                  <span className="text-lg font-black font-display text-white group-hover:text-emerald-300 transition-colors">
                    {secondaryPhone}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 group-hover:bg-emerald-700 group-hover:text-white group-hover:border-emerald-600 transition-all shrink-0">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                </div>
              </a>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href={FARM_MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span>Message on Facebook</span>
            </a>
            <a
              href={`sms:${primaryPhone.replace(/\s+/g, '')}`}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <span>Send SMS</span>
            </a>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-300 text-center leading-relaxed">
        Calls, SMS, Facebook, and Google Maps connect through your own phone, desktop, or device apps. By contacting us, you agree to our{' '}
        <button
          type="button"
          onClick={onOpenTerms}
          className="font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer"
        >
          Terms &amp; Conditions
        </button>
        .
      </p>
    </div>
  );
}
