import React, { useState } from 'react';
import { MapPin, Phone, ExternalLink, Clock, Copy, Check, MessageCircle } from 'lucide-react';
import farmLogo from '../assets/Logo.jpg';
import { FARM_PRIMARY_PHONE, FARM_SECONDARY_PHONE, FARM_MESSENGER_URL } from './contactInfo';

export default function Contact() {
  const [copied, setCopied] = useState(false);

  const farmAddress = 'Purok 4, Barangay San Isidro, Lipa City, Batangas, Philippines';
  const primaryPhone = FARM_PRIMARY_PHONE;
  const secondaryPhone = FARM_SECONDARY_PHONE;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(farmAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="contact-section">
      {/* Header Title */}
      <section className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-extrabold font-display text-white tracking-tight">Contact Us</h1>
          </div>
        </div>
      </section>

      {/* Main Contact & Address Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="contact-details-grid">
        {/* Card 1: Farm Address */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Farm Location
                </span>
                <h2 className="text-xl font-bold font-display text-slate-900">
                  Ambo &amp; Ang&apos;s Oink Yard
                </h2>
              </div>
            </div>

            <div className="p-5 bg-slate-50/70 border border-slate-100 rounded-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Physical Address
              </p>
              <p className="text-base font-semibold text-slate-800 leading-relaxed">
                {farmAddress}
              </p>
              <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                Main gate entrance along the barangay access road. All visiting vehicles must proceed through the tire sanitation bath before parking.
              </p>
            </div>

            <div className="flex items-start gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-xs text-slate-600">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Visiting Hours</span>
                <span>Monday to Saturday: 8:00 AM &ndash; 5:00 PM (By scheduled appointment only due to 72-hour biosecurity rules)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={handleCopyAddress}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Address Copied!' : 'Copy Address'}
            </button>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(farmAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Card 2: Contact Numbers */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Direct Inquiries
                </span>
                <h2 className="text-xl font-bold font-display text-slate-900">
                  Call or Message Us
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {/* Primary Contact Number */}
              <a
                href={`tel:${primaryPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between p-5 bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                    Primary Mobile / Inquiries
                  </span>
                  <span className="text-lg font-black font-display text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {primaryPhone}
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">Calls &amp; SMS messages welcome</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all">
                  <Phone className="w-4 h-4" />
                </div>
              </a>

              {/* Secondary Contact Number */}
              <a
                href={`tel:${secondaryPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between p-5 bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-200 rounded-2xl transition-all group"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Secondary Line / Farm Operations
                  </span>
                  <span className="text-lg font-black font-display text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {secondaryPhone}
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">Farm office &amp; delivery coordination</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all">
                  <Phone className="w-4 h-4" />
                </div>
              </a>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              For batch reservations, weight verifications, or scheduling a visit, please contact our farm office during operating hours.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href={FARM_MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Message on Facebook</span>
            </a>
            <a
              href={`tel:${primaryPhone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Primary Number</span>
            </a>
            <a
              href={`sms:${primaryPhone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              <span>Send SMS</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
