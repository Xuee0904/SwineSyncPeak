import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import {
  Search, RefreshCw, WifiOff, Syringe, Weight, Calendar,
  ChevronLeft, ChevronRight, Baby, ShieldCheck, CheckCircle2,
  Award, Users, User
} from 'lucide-react';

const ITEMS_PER_PAGE = 6;

const GROUP_TABS = [
  { id: 'all', label: 'All Groups' },
  { id: 'weaner', label: 'Weaners' },
  { id: 'grower', label: 'Growers' },
  { id: 'finisher', label: 'Finishers' },
  { id: 'boar', label: 'Boars' },
  { id: 'sow', label: 'Sows' }
];

const FEED_PROGRAMS = {
  Weaner: 'Pre-Starter Pellets (0.5 kg/day)',
  Grower: 'Grower Mash (2.2 kg/day)',
  Finisher: 'Finisher Pellets (3.0 kg/day)',
  Boar: 'Breeder Developer (2.5 kg/day)',
  Sow: 'Gestation Crumbles (2.0 kg/day)'
};

const FALLBACK_BREEDS = {
  Weaner: 'Large White',
  Grower: 'Landrace',
  Finisher: 'Duroc',
  Boar: 'Pietrain',
  Sow: 'Landrace'
};

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoadingSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-6 w-20 bg-slate-100 rounded-lg" />
            <div className="h-6 w-24 bg-slate-100 rounded-full" />
          </div>
          <div className="h-7 w-3/5 bg-slate-100 rounded-lg" />
          <div className="h-5 w-2/5 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-50 rounded-2xl" />
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
        Retry Connection
      </button>
    </div>
  );
}

// ─── Health Passport Modal (With Layout Shift Prevention) ─────────────────────
function HealthPassportModal({ item, onClose }) {
  const isPig = item.type === 'pig';
  const vaccs = item.vaccinations || [];
  
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // 1. Calculate physical scrollbar width (e.g., 17px on Windows, 0px on macOS overlay)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // 2. Cache original style parameters
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    
    // 3. Apply scroll-lock
    document.body.style.overflow = 'hidden';
    
    // 4. Inject right-side padding equivalent to scrollbar width to prevent visual jump
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    
    // 5. Restore styling variables on unmount
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };
  
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${
        isClosing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{`
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slide-down {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to { transform: translateY(20px) scale(0.96); opacity: 0; }
        }
        .animate-fade-out {
          animation: fade-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-down {
          animation: slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className={`w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left max-h-[85vh] flex flex-col ${
        isClosing ? 'animate-slide-down' : 'animate-slide-up'
      }`}>

        <div className="p-6 border-b border-slate-100 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                Health Passport
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                {item.group}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-2 flex items-center gap-2">
              <Syringe className="w-6 h-6 text-emerald-500" />
              {item.tag}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.breed} • {isPig ? 'Individual Swine Record' : 'Piglet Batch Record'}
            </p>
          </div>
          
          <button
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50/50">
          <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-xs">
            <div>
              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Status</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">
                {isPig ? 'Weight' : 'Avg Weight'}
              </span>
              <span className="font-bold text-slate-800 block mt-1">
                {isPig ? `${item.weight} kg` : `${item.average_weight} kg`}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Age</span>
              <span className="font-bold text-slate-800 block mt-1">
                Week {item.ageWeeks}
              </span>
            </div>
          </div>

          {!isPig && (
            <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Born Alive</span>
                <span className="font-bold text-slate-800 block mt-1">{item.total_born_alive ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Stillborn</span>
                <span className="font-bold text-slate-800 block mt-1">{item.stillborn_count ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Mummified</span>
                <span className="font-bold text-slate-800 block mt-1">{item.mummy_count ?? '—'}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 tracking-wider pl-1">
              Vaccination History ({vaccs.length})
            </h3>

            {vaccs.length > 0 ? (
              <div className="relative border-l-2 border-slate-200 ml-3.5 pl-5 space-y-6 py-2">
                {vaccs.map((v, idx) => {
                  const isBoosterOverdue = v.booster_due_date && new Date(v.booster_due_date) < new Date();
                  return (
                    <div key={v.vaccination_id || idx} className="relative">
                      <span className="absolute -left-[27px] top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white border-2 border-emerald-500 ring-4 ring-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>

                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-800 text-sm capitalize">{v.vaccine_name}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {formatDate(v.administered_date)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                          {v.dosage && (
                            <p>
                              <span className="font-semibold text-slate-400">Dosage:</span> {v.dosage}
                            </p>
                          )}
                          {v.lot_number && (
                            <p>
                              <span className="font-semibold text-slate-400">Lot:</span> {v.lot_number}
                            </p>
                          )}
                          {v.administered_by && (
                            <p className="col-span-2">
                              <span className="font-semibold text-slate-400">Administered By:</span> {v.administered_by}
                            </p>
                          )}
                        </div>

                        {v.booster_due_date && (
                          <div className={`mt-2 p-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
                            isBoosterOverdue ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-slate-50 text-slate-600'
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              Booster Due: {formatDate(v.booster_due_date)} {isBoosterOverdue && '(Overdue)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-2">
                <ShieldCheck className="w-10 h-10 text-slate-300" />
                <p className="text-xs text-slate-400 italic">No vaccination records found for this profile.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white flex justify-end shrink-0">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Close Passport
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Swine Card ───────────────────────────────────────────────────────────────
function SwineCard({ item, index, onInspectPassport }) {
  const isPig = item.type === 'pig';
  const vaccCount = item.vaccinations?.length || 0;

  let availability = 'Available';
  let availabilityStyle = 'bg-emerald-50 text-emerald-800 border-emerald-100';

  if (!isPig) {
    if ((item.current_count || 0) < 10) {
      availability = 'Low Stock';
      availabilityStyle = 'bg-amber-50 text-amber-800 border-amber-100';
    }
  } else {
    if (item.parity_count === 1) {
      availability = 'Reserved';
      availabilityStyle = 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  let accentBorder = 'border-l-4 border-l-slate-300';
  if (!isPig) {
    accentBorder = 'border-l-4 border-l-sky-400';
  } else if (item.group === 'Sow') {
    accentBorder = 'border-l-4 border-l-pink-500';
  } else if (item.group === 'Boar') {
    accentBorder = 'border-l-4 border-l-emerald-600';
  }

  let taxonomyLabel = 'Market Swine';
  if (item.group === 'Sow') taxonomyLabel = 'Breeding Female (Sow)';
  else if (item.group === 'Boar') taxonomyLabel = 'Breeding Male (Boar)';
  else if (!isPig) taxonomyLabel = 'Cohesive Litter Batch';

  const animationDelay = `${(index % ITEMS_PER_PAGE) * 75}ms`;

  return (
    <div
      className={`bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-emerald-100 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group animate-slide-up ${accentBorder}`}
      style={{ animationDelay, animationFillMode: 'both' }}
      id={`swine-card-${item.id}`}
    >
      <div>
        <div className="flex justify-between items-center mb-4">
          {isPig ? (
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-150">
              <User className="w-3 h-3 text-slate-400" />
              Single Swine
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg border border-sky-100">
              <Users className="w-3 h-3 text-sky-500" />
              Litter Batch
            </span>
          )}

          <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 rounded-full text-[10px] font-bold uppercase tracking-wide">
            {item.group}
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold font-display text-slate-900 group-hover:text-emerald-700 transition-colors">
            {item.breed}
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 block">
            {taxonomyLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-3 text-slate-500 font-medium text-xs flex-wrap">
          <span className="flex items-center gap-1.5">
            <Weight className="w-3.5 h-3.5 text-slate-400" />
            {isPig ? `${item.weight} kg` : `${item.average_weight} kg (avg)`}
          </span>
          <span className="text-slate-200">|</span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Week {item.ageWeeks}
          </span>
          {!isPig && (
            <>
              <span className="text-slate-200">|</span>
              <span className="flex items-center gap-1.5 font-bold text-sky-700">
                <Baby className="w-3.5 h-3.5 text-sky-400" />
                {item.current_count ?? 0} head
              </span>
            </>
          )}
        </div>

        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 mt-5">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
              Program Feed
            </span>
            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${availabilityStyle}`}>
              {availability}
            </span>
          </div>
          <span className="text-slate-700 font-bold text-xs mt-1 block">
            {FEED_PROGRAMS[item.group] || 'Standard Feed'}
          </span>
        </div>
      </div>

      <button
        onClick={() => onInspectPassport(item)}
        className="w-full mt-6 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/70 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-sm"
        id={`inspect-passport-${item.tag}`}
      >
        <Syringe className="w-3.5 h-3.5 text-emerald-600" />
        Inspect Health Passport ({vaccCount})
      </button>
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────
export default function Catalog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [passportItem, setPassportItem] = useState(null);

  const loadCatalogData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pigsRes, batchesRes, vaccRes, healthRes] = await Promise.all([
        supabase.from('pigs').select('*'),
        supabase.from('piglet_batches').select('*'),
        supabase.from('vaccination_records').select('*'),
        supabase.from('health_logs').select('*')
      ]);

      if (pigsRes.error) throw pigsRes.error;
      if (batchesRes.error) throw batchesRes.error;
      if (vaccRes.error) throw vaccRes.error;
      if (healthRes.error) throw healthRes.error;

      const allVaccinations = vaccRes.data ?? [];
      const allHealthLogs = healthRes.data ?? [];

      const healthyPigs = (pigsRes.data ?? []).filter(p => {
        if (p.is_archived) return false;
        if (p.status !== 'healthy') return false;

        const pigLogs = allHealthLogs.filter(h => h.pig_id === p.pig_id);
        if (pigLogs.length > 0) {
          const latestLog = pigLogs.sort((a, b) => new Date(b.log_date) - new Date(a.log_date))[0];
          if (latestLog && ['sick', 'quarantine', 'under treatment'].includes(latestLog.status?.toLowerCase())) {
            return false;
          }
        }
        return true;
      });

      const healthyBatches = (batchesRes.data ?? []).filter(b => {
        if (b.is_archived) return false;

        const batchLogs = allHealthLogs.filter(h => h.batch_id === b.batch_id);
        if (batchLogs.length > 0) {
          const latestLog = batchLogs.sort((a, b) => new Date(b.log_date) - new Date(a.log_date))[0];
          if (latestLog && ['sick', 'quarantine', 'under treatment', 'sick batch'].includes(latestLog.status?.toLowerCase())) {
            return false;
          }
        }
        return true;
      });

      const mappedPigs = healthyPigs.map(p => {
        const pVaccs = allVaccinations.filter(v => v.pig_id === p.pig_id);
        const pLogs = allHealthLogs.filter(h => h.pig_id === p.pig_id);

        const ageWeeks = Math.max(1, Math.floor((new Date() - new Date(p.date_of_birth)) / (1000 * 60 * 60 * 24 * 7)));

        let group = 'Grower';
        if (p.gender?.toLowerCase() === 'male' || p.gender?.toLowerCase() === 'm') group = 'Boar';
        else if ((p.gender?.toLowerCase() === 'female' || p.gender?.toLowerCase() === 'f') && p.parity_count > 0) group = 'Sow';
        else if (p.weight < 25) group = 'Weaner';
        else if (p.weight >= 80) group = 'Finisher';

        return {
          id: p.pig_id,
          tag: p.pig_tag,
          type: 'pig',
          group,
          breed: p.breed || FALLBACK_BREEDS[group],
          gender: p.gender,
          weight: p.weight,
          average_weight: null,
          ageWeeks,
          date_of_birth: p.date_of_birth,
          parity_count: p.parity_count,
          pen_id: p.pen_id,
          vaccinations: pVaccs,
          healthLogs: pLogs
        };
      });

      const mappedBatches = healthyBatches.map(b => {
        const bVaccs = allVaccinations.filter(v => v.batch_id === b.batch_id);
        const bLogs = allHealthLogs.filter(h => h.batch_id === b.batch_id);

        let group = 'Weaner';
        if (b.status === 'transferred') group = 'Grower';
        else if (b.average_weight >= 80) group = 'Finisher';

        let ageWeeks = 2;
        if (b.status === 'weaned') ageWeeks = 6;
        else if (b.status === 'transferred') ageWeeks = 12;

        return {
          id: b.batch_id,
          tag: b.batch_tag || `BATCH-${b.batch_id.slice(0, 5).toUpperCase()}`,
          type: 'batch',
          group,
          breed: FALLBACK_BREEDS[group],
          gender: null,
          weight: null,
          average_weight: b.average_weight,
          ageWeeks,
          date_of_birth: null,
          parity_count: null,
          pen_id: b.pen_id,
          current_count: b.current_count,
          total_born_alive: b.total_born_alive,
          stillborn_count: b.stillborn_count,
          mummy_count: b.mummy_count,
          vaccinations: bVaccs,
          healthLogs: bLogs
        };
      });

      setItems([...mappedPigs, ...mappedBatches]);
    } catch (e) {
      console.error('Error fetching inventory catalog:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);

  const filteredItems = items.filter(item => {
    if (activeGroup !== 'all' && item.group.toLowerCase() !== activeGroup) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.tag?.toLowerCase().includes(q) ||
        item.breed?.toLowerCase().includes(q) ||
        item.group?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const priority = { Sow: 1, Boar: 2, Finisher: 3, Grower: 4, Weaner: 5 };
    const aPriority = priority[a.group] || 99;
    const bPriority = priority[b.group] || 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.ageWeeks - a.ageWeeks;
  });

  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedItems = sortedItems.slice(startIndex, endIndex);

  const handleGroupChange = (groupId) => {
    setActiveGroup(groupId);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-8 pb-20 text-left" id="catalog-section">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight flex items-center gap-2">
            Active Inventory Listing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? (
              <span>Updating active profiles…</span>
            ) : (
              <span>
                Showing <strong>{totalItems > 0 ? `${startIndex + 1}–${endIndex}` : '0'}</strong> of{' '}
                <strong>{totalItems}</strong> {totalItems === 1 ? 'profile' : 'profiles'}.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-grow lg:flex-grow-0 lg:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              id="catalog-search"
              placeholder="Search by breed or tag..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm transition-all placeholder-slate-400"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <button
            onClick={loadCatalogData}
            disabled={loading}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-slate-700 hover:border-slate-300 disabled:opacity-50 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </section>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none shrink-0" role="tablist">
        {GROUP_TABS.map(tab => {
          const isActive = activeGroup === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleGroupChange(tab.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadCatalogData} />
      ) : paginatedItems.length > 0 ? (
        <div className="space-y-10">
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedItems.map((item, index) => (
              <SwineCard
                key={item.id}
                item={item}
                index={index}
                onInspectPassport={setPassportItem}
              />
            ))}
          </section>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
              <button
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isCurrent = pageNum === safeCurrentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-[34px] h-[34px] flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm shadow-sm flex flex-col items-center justify-center space-y-3">
          <Award className="w-12 h-12 text-slate-300 animate-pulse" />
          <p className="font-semibold text-slate-600">No Healthy Profiles Found</p>
          <p className="text-xs text-slate-400 max-w-xs">
            There are currently no healthy swine profiles or batches matching your selected filters.
          </p>
        </div>
      )}

      {passportItem && createPortal(
        <HealthPassportModal
          item={passportItem}
          onClose={() => setPassportItem(null)}
        />,
        document.body
      )}
    </div>
  );
}