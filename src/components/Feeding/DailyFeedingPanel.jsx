import React, { useState, useEffect } from 'react';
import {
  Wheat, Check, Pencil, X, Loader2, ChevronDown
} from 'lucide-react';
import { toast } from '../../utils/toast';
import { supabase } from '../../supabaseClient';
import Pagination from '../common/Pagination';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function DailyFeedingPanel({ variant = 'dashboard', onUpdated, title = "Today's Feeding" }) {
  const [data, setData] = useState(() => {
    try {
      const cached = sessionStorage.getItem('swinesync_daily_feeding_cache');
      return cached ? JSON.parse(cached) : { batches: [], breeder_summary: null };
    } catch {
      return { batches: [], breeder_summary: null };
    }
  });
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('swinesync_daily_feeding_cache');
      return !cached;
    } catch {
      return true;
    }
  });
  const [submittingBatchId, setSubmittingBatchId] = useState(null);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editKg, setEditKg] = useState('');
  const [bulkFeeding, setBulkFeeding] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(null);

  // Local overrides for linking feed items inline
  const [batchFeedItemOverrides, setBatchFeedItemOverrides] = useState({});

  // Breeder herd state
  const [selectedBreederFeedId, setSelectedBreederFeedId] = useState(() => {
    return localStorage.getItem('swinesync_breeder_feed_item_id') || '';
  });
  const [breederRatePerHead, setBreederRatePerHead] = useState(() => {
    const saved = localStorage.getItem('swinesync_breeder_rate_per_head');
    return saved ? parseFloat(saved) : 2.5;
  });
  const [editingBreeder, setEditingBreeder] = useState(false);
  const [breederKgInput, setBreederKgInput] = useState('');
  const [submittingBreeder, setSubmittingBreeder] = useState(false);

  const handleUpdateBreederRate = (newRate) => {
    const val = parseFloat(newRate);
    setBreederRatePerHead(newRate);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem('swinesync_breeder_rate_per_head', String(val));
    }
  };

  const fetchFeedingData = async () => {
    try {
      const [batchesRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/api/growth/active-feed-batches`),
        supabase
          .from('inventory_items')
          .select('item_id, item_name, unit_of_measure, current_stock_level, category')
          .eq('is_archived', false)
          .order('item_name', { ascending: true })
      ]);

      if (batchesRes.ok) {
        const batchJson = await batchesRes.json();
        const list = Array.isArray(batchJson) ? batchJson : (batchJson?.batches || []);
        const breeder = batchJson?.breeder_summary || null;
        const fresh = { batches: list, breeder_summary: breeder };
        setData(fresh);
        try {
          sessionStorage.setItem('swinesync_daily_feeding_cache', JSON.stringify(fresh));
        } catch {
          // ignore quota error
        }
      }

      if (invRes.data) {
        const feeds = invRes.data.filter(i => {
          const cat = (i.category || '').toLowerCase();
          const name = (i.item_name || '').toLowerCase();
          return cat === 'feed' || name.includes('feed') || name.includes('pellet') || name.includes('mash');
        });
        setFeedItems(feeds);

        if (!selectedBreederFeedId && feeds.length > 0) {
          const defaultFeed = feeds.find(f => (f.item_name || '').toLowerCase().includes('gestat') || (f.item_name || '').toLowerCase().includes('sow')) || feeds[0];
          setSelectedBreederFeedId(defaultFeed.item_id);
          localStorage.setItem('swinesync_breeder_feed_item_id', defaultFeed.item_id);
        }
      }
    } catch (err) {
      console.warn('[DailyFeedingPanel] Error loading feed data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedingData();
  }, []);

  const handleSelectBreederFeed = (id) => {
    setSelectedBreederFeedId(id);
    localStorage.setItem('swinesync_breeder_feed_item_id', id);
  };

  // Smart suggestion: matches task name (e.g. "Grower Feed") to available inventory
  const getSuggestedFeed = (taskName) => {
    if (!taskName || feedItems.length === 0) return null;
    const lower = taskName.toLowerCase();
    const keywords = ['pre-starter', 'starter', 'grower', 'finisher', 'lactat', 'gestat', 'boar'];
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const match = feedItems.find(f => (f.item_name || '').toLowerCase().includes(kw));
        if (match) return match;
      }
    }
    const matchAny = feedItems.find(f => {
      const fName = (f.item_name || '').toLowerCase();
      return lower.split(' ').some(word => word.length > 3 && fName.includes(word));
    });
    return matchAny || null;
  };

  // Inline feed linking
  const handleLinkBatchFeed = async (batch, newItemId) => {
    if (!newItemId) return;

    setBatchFeedItemOverrides(prev => ({
      ...prev,
      [batch.batch_id]: newItemId,
    }));

    const selectedInv = feedItems.find(f => f.item_id === newItemId);
    toast.success(`Linked ${selectedInv?.item_name || 'feed'} to batch ${batch.batch_tag}.`);

    const guidelineId = batch.current_feed?.guideline_id;
    if (guidelineId) {
      try {
        await fetch(`${API_BASE}/api/growth/guidelines/link-inventory`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guideline_id: guidelineId,
            item_id: newItemId,
            activity_type: 'FEED',
          }),
        });

        setData(prev => ({
          ...prev,
          batches: prev.batches.map(b => {
            if (b.batch_id === batch.batch_id) {
              return {
                ...b,
                current_feed: {
                  ...b.current_feed,
                  item_id: newItemId,
                  inventory_items: selectedInv || null,
                }
              };
            }
            return b;
          })
        }));
      } catch (err) {
        console.warn('Failed to persist guideline inventory link:', err);
      }
    }
  };

  const batches = data.batches || [];
  const breeder = data.breeder_summary;
  const unfedBatches = batches.filter(b => b.current_feed && !b.current_feed.fed_today);
  const fedBatchesCount = batches.filter(b => b.current_feed?.fed_today).length;
  const totalBatchesCount = batches.length;
  const unfedTotalKg = unfedBatches
    .reduce((sum, b) => sum + (Number(b.current_feed?.total_daily_feed_kg) || 0), 0)
    .toFixed(1);

  const breederHeadCount = breeder?.total_breeders || 0;
  const numericBreederRate = parseFloat(breederRatePerHead) || 2.5;
  const calculatedBreederKg = Number((breederHeadCount * numericBreederRate).toFixed(1));

  const hasAnimals = batches.length > 0 || (breeder && breeder.total_breeders > 0);
  const allBatchesFed = batches.length === 0 || unfedBatches.length === 0;
  const breederFed = !breeder || breeder.total_breeders === 0 || !!breeder.breeder_fed_today;
  const allFed = hasAnimals && allBatchesFed && breederFed;

  const batchesFedTodayKg = batches.reduce(
    (sum, b) => sum + (Number(b.current_feed?.fed_today ? b.current_feed.fed_today_kg : 0) || 0),
    0
  );
  const breederFedTodayKg = breeder?.breeder_fed_today ? Number(breeder.breeder_fed_today_kg) || 0 : 0;
  const totalFedTodayKg = (batchesFedTodayKg + breederFedTodayKg).toFixed(1);

  // Auto-collapse when all animals are fed, unless user manually toggled
  const isPanelCollapsed = userCollapsed !== null ? userCollapsed : allFed;

  // Auto-sort: Unfed batches first, then already fed batches
  const sortedBatches = [...batches].sort((a, b) => {
    const aFed = !!a.current_feed?.fed_today;
    const bFed = !!b.current_feed?.fed_today;
    if (aFed !== bFed) {
      return aFed ? 1 : -1;
    }
    return (a.batch_tag || '').localeCompare(b.batch_tag || '');
  });

  // Pagination for sorted batches (3 batches per page)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(sortedBatches.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBatches = sortedBatches.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // 1-Click Feed Batch
  const handleFeedBatch = async (batch, customKg = null, explicitItemId = null) => {
    const feed = batch.current_feed;
    if (!feed) return;
    const kg = customKg !== null ? parseFloat(customKg) : Number(feed.total_daily_feed_kg);
    if (!kg || kg <= 0) {
      toast.error('Please enter a valid feed amount in kg.');
      return;
    }

    const suggested = getSuggestedFeed(feed.task_name);
    const effectiveItemId = explicitItemId || batchFeedItemOverrides[batch.batch_id] || feed.item_id || suggested?.item_id;
    if (!effectiveItemId) {
      toast.error(`Please select a feed supply for batch ${batch.batch_tag} first.`);
      return;
    }

    setSubmittingBatchId(batch.batch_id);
    try {
      const res = await fetch(`${API_BASE}/api/growth/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          activity_type: 'FEED',
          guideline_id: feed.guideline_id,
          amount_given: kg,
          item_id: effectiveItemId,
          performed_by: 'Staff',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to log feeding.');

      toast.success(`Fed ${kg} kg to batch ${batch.batch_tag}. Stock deducted.`);
      setData(prev => {
        const next = {
          ...prev,
          batches: prev.batches.map(b => {
            if (b.batch_id === batch.batch_id) {
              return {
                ...b,
                current_feed: {
                  ...b.current_feed,
                  fed_today: true,
                  fed_today_kg: kg,
                  item_id: effectiveItemId,
                }
              };
            }
            return b;
          })
        };
        try { sessionStorage.setItem('swinesync_daily_feeding_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      setEditingBatchId(null);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error logging batch feed.');
    } finally {
      setSubmittingBatchId(null);
    }
  };

  // 1-Click Feed Breeder Herd
  const handleFeedBreeders = async (customKg = null) => {
    if (!selectedBreederFeedId) {
      toast.error('Please select a feed supply for the breeder herd.');
      return;
    }
    const kg = customKg !== null ? parseFloat(customKg) : calculatedBreederKg;
    if (!kg || kg <= 0) {
      toast.error('Please enter a valid feed amount in kg.');
      return;
    }

    setSubmittingBreeder(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/log-breeder-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedBreederFeedId,
          amount_kg: kg,
          head_count: breeder?.total_breeders || 0,
          performed_by: 'Staff',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to log breeder feed.');

      toast.success(`Fed ${kg} kg to Breeder Herd (${breeder?.total_breeders || 0} heads). Stock deducted.`);
      setData(prev => {
        const next = {
          ...prev,
          breeder_summary: {
            ...prev.breeder_summary,
            breeder_fed_today: true,
            breeder_fed_today_kg: kg,
          }
        };
        try { sessionStorage.setItem('swinesync_daily_feeding_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      setEditingBreeder(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error logging breeder feed.');
    } finally {
      setSubmittingBreeder(false);
    }
  };

  // 1-Click Feed All Remaining Batches
  const handleFeedAllRemaining = async () => {
    if (unfedBatches.length === 0) return;
    setBulkFeeding(true);
    try {
      let fedCount = 0;
      let skippedCount = 0;

      for (const b of unfedBatches) {
        const feed = b.current_feed;
        const suggested = getSuggestedFeed(feed?.task_name);
        const effectiveItemId = batchFeedItemOverrides[b.batch_id] || feed?.item_id || suggested?.item_id;
        if (effectiveItemId) {
          await handleFeedBatch(b, null, effectiveItemId);
          fedCount++;
        } else {
          skippedCount++;
        }
      }

      if (skippedCount > 0) {
        toast.warning(`${skippedCount} batch(es) skipped because no feed supply was selected yet.`);
      } else {
        toast.success(`All remaining batches fed (${unfedTotalKg} kg deducted).`);
      }

      await fetchFeedingData();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error executing bulk feed.');
    } finally {
      setBulkFeeding(false);
    }
  };

  const isBanner = variant === 'banner';

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs ${isBanner ? 'mb-5' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Smart Done state: Auto-collapsed into an ultra-slim, clean confirmation strip
  if (allFed && isPanelCollapsed) {
    return (
      <div className={`transition-all duration-300 ease-out ${isBanner ? 'mb-5' : ''}`}>
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2 truncate text-xs">
              <span className="font-semibold text-emerald-950 font-display">
                All Animals Fed Today
              </span>
              <span className="text-emerald-700 font-medium text-[11px] hidden sm:inline">
                • {totalBatchesCount} {totalBatchesCount === 1 ? 'batch' : 'batches'}
                {breeder?.total_breeders > 0 ? ` + ${breeder.total_breeders} breeders` : ''}
                {Number(totalFedTodayKg) > 0 ? ` (${totalFedTodayKg} kg deducted)` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUserCollapsed(false)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-white/90 hover:bg-white rounded-lg border border-emerald-200/90 shadow-2xs transition-all cursor-pointer shrink-0"
            title="Expand to view details or adjust amounts"
          >
            <span>View / Adjust</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 shadow-xs ${isBanner ? 'border-slate-200 mb-5' : 'border-slate-200/80 hover:shadow-sm'
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
            <Wheat className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-display font-bold text-slate-900 leading-tight">{title}</h3>
            <span
              className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border ${allFed
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
            >
              {allFed ? '✓ All Fed Today' : `${fedBatchesCount} of ${totalBatchesCount} Batches Fed`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unfedBatches.length > 1 && !isPanelCollapsed && (
            <button
              type="button"
              disabled={bulkFeeding}
              onClick={handleFeedAllRemaining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Feed all remaining unfed batches in 1 click"
            >
              {bulkFeeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Feeding...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Feed All ({unfedTotalKg} kg)</span>
                </>
              )}
            </button>
          )}

          {/* Minimize / Expand Toggle with 180deg animated rotation */}
          <button
            type="button"
            onClick={() => setUserCollapsed(!isPanelCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title={isPanelCollapsed ? 'Expand feeding queue' : 'Minimize panel'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isPanelCollapsed ? 'rotate-0' : 'rotate-180'
                }`}
            />
          </button>
        </div>
      </div>

      {/* Animated Collapsible Body Container (Smooth CSS Grid 0fr <-> 1fr Transition) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isPanelCollapsed
          ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
          : 'grid-rows-[1fr] opacity-100'
          }`}
      >
        <div className="overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Section: Piglet Batches */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                <span>Piglet Batches</span>
              </div>

              {batches.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2 px-1">
                  No active piglet batches enrolled in growth programs.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {paginatedBatches.map(b => {
                      const feed = b.current_feed;
                      const isSubmitting = submittingBatchId === b.batch_id;
                      const isEditing = editingBatchId === b.batch_id;

                      const overrideItemId = batchFeedItemOverrides[b.batch_id];
                      const suggestedFeed = !feed?.item_id && !overrideItemId ? getSuggestedFeed(feed?.task_name) : null;
                      const effectiveItemId = overrideItemId || feed?.item_id || suggestedFeed?.item_id;
                      const effectiveFeedItem = feedItems.find(f => f.item_id === effectiveItemId) || feed?.inventory_items;
                      const hasFeedItem = !!effectiveItemId;

                      return (
                        <div
                          key={b.batch_id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${feed?.fed_today
                            ? 'bg-emerald-50/30 border-emerald-200/60 text-emerald-950'
                            : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-2xs'
                            }`}
                        >
                          {/* Left: Batch Tag, Pen, Pig Count */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-xs text-slate-900 tracking-tight shrink-0">
                              {b.batch_tag}
                            </span>
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                              {b.pen_code ? `Pen ${b.pen_code}` : 'No Pen'}
                            </span>
                            <span className="text-xs text-slate-500 font-normal shrink-0">
                              {b.current_count} {b.current_count === 1 ? 'pig' : 'pigs'}
                            </span>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center justify-end shrink-0 sm:w-48">
                            {!hasFeedItem ? (
                              <div className="relative inline-flex items-center h-8 w-full sm:w-48 shrink-0">
                                <select
                                  value=""
                                  onChange={(e) => handleLinkBatchFeed(b, e.target.value)}
                                  className="w-full h-8 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl pl-3 pr-7 cursor-pointer transition-all shadow-2xs appearance-none truncate"
                                  title="Select an inventory supply to feed this batch"
                                >
                                  <option value="" disabled>Choose Feed Supply ▾</option>
                                  {feedItems.map(f => (
                                    <option key={f.item_id} value={f.item_id}>
                                      {f.item_name} ({f.current_stock_level} {f.unit_of_measure})
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-amber-700 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                              </div>
                            ) : feed?.fed_today ? (
                              <div className="inline-flex items-center justify-center gap-1.5 h-8 w-full sm:w-48 rounded-xl bg-emerald-50 border border-emerald-200/90 text-emerald-800 px-3 text-xs font-semibold shadow-2xs shrink-0">
                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5] shrink-0" />
                                <span className="truncate">Fed Today ({feed.fed_today_kg} kg)</span>
                              </div>
                            ) : isEditing ? (
                              <div className="inline-flex items-center justify-end h-8 gap-1 bg-amber-50 px-1.5 rounded-xl border border-amber-300 shadow-2xs shrink-0">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={editKg}
                                    onChange={e => setEditKg(e.target.value)}
                                    className="w-14 h-6 px-1.5 bg-white border border-slate-300 rounded font-semibold text-xs text-slate-800 text-center focus:ring-1 focus:ring-amber-500"
                                    placeholder="kg"
                                    autoFocus
                                  />
                                  <span className="text-[11px] font-semibold text-slate-600">kg</span>
                                </div>
                                {b.current_count > 0 && (
                                  <span className="text-[10px] font-medium text-amber-900 bg-amber-100/70 border border-amber-200 px-1 py-0.5 rounded whitespace-nowrap hidden sm:inline">
                                    {parseFloat(editKg) > 0 ? `${(parseFloat(editKg) / b.current_count).toFixed(1)}/pig` : '—'}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => handleFeedBatch(b, editKg, effectiveItemId)}
                                  className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs rounded transition-all cursor-pointer shadow-2xs"
                                >
                                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Feed'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBatchId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer hover:bg-amber-100 transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center h-8 w-full sm:w-48 rounded-xl bg-amber-600 text-white shadow-2xs overflow-hidden shrink-0">
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => handleFeedBatch(b, null, effectiveItemId)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-full px-2 text-xs font-semibold hover:bg-amber-700 active:bg-amber-800 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isSubmitting ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Feeding...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wheat className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">Feed {feed?.total_daily_feed_kg} kg</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBatchId(b.batch_id);
                                    setEditKg(String(feed.total_daily_feed_kg));
                                  }}
                                  className="w-8 h-full inline-flex items-center justify-center border-l border-amber-500/80 hover:bg-amber-700 active:bg-amber-800 transition-colors cursor-pointer text-amber-100 hover:text-white shrink-0"
                                  title="Adjust kg before feeding"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Batches Pagination */}
                  {totalPages > 1 && (
                    <div className="pt-2 flex justify-between items-center text-xs text-slate-500 flex-wrap gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Page {safePage} of {totalPages} ({sortedBatches.length} batches total)
                      </span>
                      <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={sortedBatches.length}
                        itemsPerPage={itemsPerPage}
                        itemName="batches"
                        showSummary={false}
                        buttonSize="sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Section: Breeder Herd (Sows & Boars) */}
            {breeder && breeder.total_breeders > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                  <span>Breeder Herd</span>
                </div>

                <div
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all ${breeder.breeder_fed_today
                    ? 'bg-emerald-50/30 border-emerald-200/60 text-emerald-950'
                    : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-2xs'
                    }`}
                >
                  {/* Left: Breeder Identity, count, and rate */}
                  <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                    <span className="font-bold text-xs text-slate-900 tracking-tight shrink-0">
                      Sows & Boars
                    </span>
                    <span className="text-xs text-slate-400 font-normal shrink-0">
                      ({breeder.total_breeders} total)
                    </span>
                    <span className="text-slate-300 hidden sm:inline">•</span>
                    <div className="inline-flex items-center gap-1 bg-amber-50/80 border border-amber-200/80 px-2 py-0.5 rounded-md text-xs shrink-0" title="Daily feed per head">
                      <span className="text-slate-500 font-medium text-[11px]">Rate:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="15"
                        value={breederRatePerHead}
                        onChange={e => handleUpdateBreederRate(e.target.value)}
                        className="w-10 px-1 py-0.5 text-xs font-semibold text-amber-950 bg-white border border-amber-300 rounded text-center focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="text-slate-500 text-[10px]">kg/hd</span>
                    </div>
                    {feedItems.length > 0 && (
                      <select
                        value={selectedBreederFeedId}
                        onChange={e => handleSelectBreederFeed(e.target.value)}
                        className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 max-w-[140px] truncate cursor-pointer hidden md:inline"
                        title="Breeder feed supply from inventory"
                      >
                        {feedItems.map(f => (
                          <option key={f.item_id} value={f.item_id}>
                            {f.item_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-end shrink-0 sm:w-48">
                    {breeder.breeder_fed_today ? (
                      <div className="inline-flex items-center justify-center gap-1.5 h-8 w-full sm:w-48 rounded-xl bg-emerald-50 border border-emerald-200/90 text-emerald-800 px-3 text-xs font-semibold shadow-2xs shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5] shrink-0" />
                        <span className="truncate">Fed Today ({breeder.breeder_fed_today_kg} kg)</span>
                      </div>
                    ) : editingBreeder ? (
                      <div className="inline-flex items-center justify-end h-8 gap-1 bg-amber-50 px-1.5 rounded-xl border border-amber-300 shadow-2xs shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={breederKgInput}
                            onChange={e => setBreederKgInput(e.target.value)}
                            className="w-14 h-6 px-1.5 bg-white border border-slate-300 rounded font-semibold text-xs text-slate-800 text-center focus:ring-1 focus:ring-amber-500"
                            placeholder="kg"
                            autoFocus
                          />
                          <span className="text-[11px] font-semibold text-slate-600">kg</span>
                        </div>
                        {breeder.total_breeders > 0 && (
                          <span className="text-[10px] font-medium text-amber-900 bg-amber-100/70 border border-amber-200 px-1 py-0.5 rounded whitespace-nowrap hidden sm:inline">
                            {parseFloat(breederKgInput) > 0 ? `${(parseFloat(breederKgInput) / breeder.total_breeders).toFixed(1)}/hd` : '—'}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={submittingBreeder}
                          onClick={() => handleFeedBreeders(breederKgInput)}
                          className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs rounded transition-all cursor-pointer shadow-2xs"
                        >
                          {submittingBreeder ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Feed'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBreeder(false)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer hover:bg-amber-100 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center h-8 w-full sm:w-48 rounded-xl bg-amber-600 text-white shadow-2xs overflow-hidden shrink-0">
                        <button
                          type="button"
                          disabled={submittingBreeder || !selectedBreederFeedId}
                          onClick={() => handleFeedBreeders()}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-full px-2 text-xs font-semibold hover:bg-amber-700 active:bg-amber-800 transition-colors cursor-pointer disabled:opacity-50"
                          title={`Feed ${calculatedBreederKg} kg in 1 click`}
                        >
                          {submittingBreeder ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Feeding...</span>
                            </>
                          ) : (
                            <>
                              <Wheat className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Feed {calculatedBreederKg} kg</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBreeder(true);
                            setBreederKgInput(String(calculatedBreederKg));
                          }}
                          className="w-8 h-full inline-flex items-center justify-center border-l border-amber-500/80 hover:bg-amber-700 active:bg-amber-800 transition-colors cursor-pointer text-amber-100 hover:text-white shrink-0"
                          title="Adjust kg before feeding"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
