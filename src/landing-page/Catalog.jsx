import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw, WifiOff, PiggyBank, Phone, Weight, Calendar, MessageCircle, MessageSquare, Copy, Check } from 'lucide-react';
import { FARM_PRIMARY_PHONE, FARM_MESSENGER_URL } from './contactInfo';
import weanerPhoto from '../assets/IMG_9223.webp';
import fattenerPhoto from '../assets/IMG_9214.webp';

// Only these categories are sold. Sows and boars are intentionally excluded.
// Weights are only measured when a buyer inquires, so the range shown is an estimate.
const CATEGORIES = [
  {
    id: 'Weaner',
    title: 'Weaners',
    ageRange: '1–3 mos old',
    weightRange: '12–50 kg',
    image: weanerPhoto,
    imagePosition: '50% 50%',
    imageAlt: 'Healthy young weaner pigs at Ambo & Ang\'s Oink Yard',
  },
  {
    id: 'Fattener',
    title: 'Fatteners',
    ageRange: '3+ mos old',
    weightRange: '50–80 kg and up',
    image: fattenerPhoto,
    imagePosition: '50% 55%',
    imageAlt: 'Healthy fattener pigs at Ambo & Ang\'s Oink Yard',
  }
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
      {CATEGORIES.map(c => (
        <div key={c.id} className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm animate-pulse space-y-4">
          <div className="aspect-[4/3] w-full bg-slate-100 rounded-lg" />
          <div className="px-2 pb-2 space-y-4">
            <div className="h-7 w-28 bg-slate-100 rounded-lg" />
            <div className="h-12 w-36 bg-slate-100 rounded-xl" />
            <div className="h-4 w-52 bg-slate-100 rounded-lg" />
            <div className="pt-2 space-y-2">
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 space-y-5 text-center">
      <div className="p-4 bg-rose-50 rounded-2xl text-rose-500 border border-rose-100">
        <WifiOff className="w-10 h-10" />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-slate-800 text-base">Connection Interrupted</h3>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

function AvailabilityCard({ category, count, index, activeAction, onToggleAction }) {
  const isSoldOut = count === 0;
  const isOpen = activeAction !== null;
  // Remembers the last panel type so its content stays put while the close animation plays
  const [panelType, setPanelType] = useState('call'); // 'call' | 'sms'
  const [copiedField, setCopiedField] = useState(null); // 'phone' | 'sms' (+ '-failed')

  const cleanPhone = FARM_PRIMARY_PHONE.replace(/\s+/g, '');
  const smsBody = isSoldOut
    ? `Hi, I'd like to ask about the next batch of ${category.title.toLowerCase()}.`
    : `Hi, I'd like to ask about your ${category.title.toLowerCase()}.`;
  const panelId = `contact-panel-${category.id.toLowerCase()}`;

  const handleContactClick = (e, type) => {
    const isTouchDevice =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (isTouchDevice) return; // Let mobile browsers open tel: / sms: directly

    e.preventDefault();
    setPanelType(type);
    onToggleAction(category.id, type);
  };

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
    } catch {
      setCopiedField(`${field}-failed`);
    }
    setTimeout(() => setCopiedField(null), 2000);
  };

  const triggerClass = (type) =>
    `min-h-[44px] py-2.5 px-3 border font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-sm whitespace-nowrap ${activeAction === type
      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
      : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
    }`;

  return (
    <div
      className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between animate-slide-up"
      style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'both' }}
      id={`availability-${category.id.toLowerCase()}`}
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-100 ring-1 ring-slate-900/5 aspect-[4/3] bg-slate-100">
          <img
            src={category.image}
            alt={category.imageAlt}
            loading="lazy"
            style={{ objectPosition: category.imagePosition }}
            className={`w-full h-full object-cover transition-[filter,opacity] duration-300 ${isSoldOut ? 'grayscale opacity-60' : ''
              }`}
          />
        </div>

        <div className="px-2 space-y-4">
          <h3 className="text-xl font-bold font-display text-slate-900">{category.title}</h3>

          <div className="flex items-end gap-2">
            <span
              className={`text-5xl font-extrabold font-display leading-none ${isSoldOut ? 'text-slate-400' : 'text-slate-900'
                }`}
            >
              {count}
            </span>
            <span className="text-sm font-semibold text-slate-500 pb-1">
              {isSoldOut
                ? 'None right now · Ask about next batch'
                : `${count === 1 ? 'pig' : 'pigs'} available`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-700">{category.ageRange}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Weight className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Est. weight: <span className="font-bold text-slate-700">{category.weightRange}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 px-2 pb-2 space-y-2.5">
        <a
          href={FARM_MESSENGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[44px] py-3 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/70 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
          id={`messenger-${category.id.toLowerCase()}`}
        >
          <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {isSoldOut ? 'Message Us About Next Batch' : 'Inquire on Messenger'}
          </span>
        </a>

        {/* The panel floats above the buttons, so opening it never moves them or resizes the card */}
        <div className="relative" data-contact-zone>
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={`tel:${cleanPhone}`}
              onClick={(e) => handleContactClick(e, 'call')}
              aria-expanded={activeAction === 'call'}
              aria-controls={panelId}
              className={triggerClass('call')}
              id={`call-${category.id.toLowerCase()}`}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Call Us</span>
            </a>
            <a
              href={`sms:${cleanPhone}?body=${encodeURIComponent(smsBody)}`}
              onClick={(e) => handleContactClick(e, 'sms')}
              aria-expanded={activeAction === 'sms'}
              aria-controls={panelId}
              className={triggerClass('sms')}
              id={`sms-${category.id.toLowerCase()}`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Send SMS</span>
            </a>
          </div>

          <div
            id={panelId}
            role="region"
            aria-label={panelType === 'call' ? 'Call the farm' : 'Text the farm'}
            aria-hidden={!isOpen}
            className={`absolute bottom-full left-0 right-0 mb-2.5 z-20 origin-bottom p-3.5 bg-white border border-slate-200 rounded-xl shadow-lg space-y-2.5 text-left transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${isOpen
                ? 'opacity-100 translate-y-0 scale-100 visible'
                : 'opacity-0 translate-y-2 scale-[0.97] invisible pointer-events-none'
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                  {panelType === 'call' ? 'Call Farm Mobile' : 'Text Farm Mobile'}
                </span>
                <span className="text-sm font-bold text-slate-900 select-all">
                  {FARM_PRIMARY_PHONE}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(FARM_PRIMARY_PHONE, 'phone')}
                aria-live="polite"
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {copiedField === 'phone' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : copiedField === 'phone-failed' ? (
                  <span>Select number to copy</span>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {panelType === 'sms' && (
              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 truncate">“{smsBody}”</p>
                <button
                  type="button"
                  onClick={() => handleCopy(smsBody, 'sms')}
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {copiedField === 'sms' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : copiedField === 'sms-failed' ? (
                    <span>Copy failed</span>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center justify-end pt-1 text-[11px]">
              <button
                type="button"
                onClick={() => onToggleAction(category.id, panelType)}
                className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────
export default function Catalog({ onOpenTerms }) {
  const [counts, setCounts] = useState({ Weaner: 0, Fattener: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadCatalogData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Headcounts are computed server-side (see supabase/0022_public_swine_availability.sql)
      // so no herd, health or vaccination records ever reach the browser.
      const { data, error: rpcError } = await supabase.rpc('get_swine_availability');
      if (rpcError) throw rpcError;

      const totals = { Weaner: 0, Fattener: 0 };
      (data ?? []).forEach(row => {
        if (row.category in totals) totals[row.category] = Number(row.head_count) || 0;
      });

      setCounts(totals);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error fetching availability:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);

  // Only one Call/SMS panel is open across both cards; { categoryId, type } or null
  const [openContact, setOpenContact] = useState(null);

  const handleToggleAction = useCallback((categoryId, type) => {
    setOpenContact((prev) =>
      prev && prev.categoryId === categoryId && prev.type === type ? null : { categoryId, type }
    );
  }, []);

  useEffect(() => {
    if (!openContact) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenContact(null);
    };
    const handlePointerDown = (e) => {
      if (!e.target.closest('[data-contact-zone]')) setOpenContact(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openContact]);

  const total = counts.Weaner + counts.Fattener;

  return (
    <div className="space-y-8 text-left" id="catalog-section">
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
            <PiggyBank className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
            Available Pigs
          </h2>
        </div>

        {lastUpdated && !error && (
          <p className="text-xs text-slate-400 font-medium">
            Updated {lastUpdated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </section>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadCatalogData} />
      ) : total > 0 ? (
        <div className="space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CATEGORIES.map((category, index) => (
              <AvailabilityCard
                key={category.id}
                category={category}
                count={counts[category.id]}
                index={index}
                activeAction={openContact?.categoryId === category.id ? openContact.type : null}
                onToggleAction={handleToggleAction}
              />
            ))}
          </section>
          <p className="text-xs text-slate-600 text-center leading-relaxed">
            Prices and exact weights are confirmed upon inquiry. Calls, SMS, and Messenger connect through your own device&apos;s apps. By contacting us, you agree to our{' '}
            <button
              type="button"
              onClick={onOpenTerms}
              className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
            >
              Terms &amp; Conditions
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm shadow-sm flex flex-col items-center justify-center space-y-3">
          <PiggyBank className="w-12 h-12 text-slate-300" />
          <p className="font-semibold text-slate-600">No pigs available right now</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Message us to ask about our next batch.
          </p>
        </div>
      )}
    </div>
  );
}