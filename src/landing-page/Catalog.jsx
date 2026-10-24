import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw, WifiOff, PiggyBank, Phone, Weight, MessageSquare } from 'lucide-react';
import { FARM_PRIMARY_PHONE } from './contactInfo';

// Only these categories are sold. Sows and boars are intentionally excluded.
// Weights are only measured when a buyer inquires, so the range shown is an estimate.
const CATEGORIES = [
  { id: 'Weaner', title: 'Weaners', weightRange: '8–80 kg' },
  { id: 'Fattener', title: 'Fatteners', weightRange: '80 kg and up' }
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
      {CATEGORIES.map(c => (
        <div key={c.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
          <div className="h-6 w-24 bg-slate-100 rounded-lg" />
          <div className="h-10 w-2/5 bg-slate-100 rounded-lg" />
          <div className="h-12 bg-slate-50 rounded-2xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
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

function AvailabilityCard({ category, count, index }) {
  const isSoldOut = count === 0;

  return (
    <div
      className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between animate-slide-up"
      style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'both' }}
      id={`availability-${category.id.toLowerCase()}`}
    >
      <div className="space-y-4">

        <h3 className="text-xl font-bold font-display text-slate-900">{category.title}</h3>

        <div className="flex items-end gap-2">
          <span className="text-5xl font-extrabold font-display text-slate-900 leading-none">{count}</span>
          <span className="text-sm font-semibold text-slate-500 pb-1">{count === 1 ? 'pig' : 'pigs'} available</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Weight className="w-3.5 h-3.5 text-slate-400" />
          <span>Est. weight: <span className="font-bold text-slate-700">{category.weightRange}</span></span>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <a
          href={`tel:${FARM_PRIMARY_PHONE.replace(/\s+/g, '')}`}
          className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/70 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
          id={`call-${category.id.toLowerCase()}`}
        >
          <Phone className="w-3.5 h-3.5" />
          {isSoldOut ? 'Call to Ask About Next Batch' : `Call to Inquire · ${FARM_PRIMARY_PHONE}`}
        </a>
        <a
          href={`sms:${FARM_PRIMARY_PHONE.replace(/\s+/g, '')}?body=${encodeURIComponent(`Hi, I'd like to ask about your ${category.title.toLowerCase()}.`)}`}
          className="w-full py-2 text-slate-500 hover:text-emerald-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          id={`sms-${category.id.toLowerCase()}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Or send a text message
        </a>
      </div>
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────
export default function Catalog() {
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

  const total = counts.Weaner + counts.Fattener;

  return (
    <div className="space-y-8 pb-20 text-left" id="catalog-section">
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
            Available Pigs
          </h1>
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
              />
            ))}
          </section>
          <p className="text-xs text-slate-400 text-center">
            Prices and exact weights are confirmed when you call.
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