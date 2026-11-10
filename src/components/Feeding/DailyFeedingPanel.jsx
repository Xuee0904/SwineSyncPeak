import React, { useState, useEffect, useMemo } from 'react';
import {
  Leaf, Check, Pencil, X, Loader2, ChevronUp, ChevronDown, Undo2
} from 'lucide-react';
import { toast } from '../../utils/toast';
import { supabase } from '../../supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function DailyFeedingPanel({ variant = 'dashboard', onUpdated, title = "Today's Feeding" }) {
  const [data, setData] = useState({ batches: [], breeder_summary: null });
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [submittingBatchId, setSubmittingBatchId] = useState(null);
  const [submittingBreeder, setSubmittingBreeder] = useState(false);
  const [bulkFeeding, setBulkFeeding] = useState(false);
  const [undoingId, setUndoingId] = useState(null);
  const [undoingBreeder, setUndoingBreeder] = useState(false);

  // Inline adjustment state (only for the current single day)
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [tempAmount, setTempAmount] = useState('');
  const [customAmounts, setCustomAmounts] = useState({});

  const [editingBreeder, setEditingBreeder] = useState(false);
  const [tempBreederAmount, setTempBreederAmount] = useState('');
  const [customBreederKg, setCustomBreederKg] = useState(null);

  // Link guideline to inventory inline state
  const [linkingGuidelineId, setLinkingGuidelineId] = useState(null);
  const [batchFeedItemOverrides, setBatchFeedItemOverrides] = useState({});

  // Breeder herd state (changeable, default saved in localStorage or 2.0 kg/hd)
  const [selectedBreederFeedId, setSelectedBreederFeedId] = useState(() => {
    return localStorage.getItem('swinesync_breeder_feed_item_id') || '';
  });
  const [breederRatePerHead, setBreederRatePerHead] = useState(() => {
    const saved = localStorage.getItem('swinesync_breeder_rate_per_head');
    return saved ? parseFloat(saved) : 2.0;
  });

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
          return (
            cat.includes('feed') ||
            name.includes('feed') ||
            name.includes('pellet') ||
            name.includes('mash') ||
            name.includes('starter') ||
            name.includes('grower') ||
            name.includes('finisher') ||
            name.includes('booster') ||
            name.includes('lactat') ||
            name.includes('gestat') ||
            name.includes('corn') ||
            name.includes('bran') ||
            cat === 'general'
          );
        });
        setFeedItems(feeds);

        // Auto-select breeder feed if not selected
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

  const handleSelectBreederFeed = (newFeedId) => {
    setSelectedBreederFeedId(newFeedId);
    localStorage.setItem('swinesync_breeder_feed_item_id', newFeedId);
    const chosen = feedItems.find(f => f.item_id === newFeedId);
    if (chosen) {
      toast.success(`Breeder feed changed to "${chosen.item_name}".`);
    }
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

  // Resolve inventory item name from growth program template
  const getBatchFeedItem = (batch) => {
    const feed = batch.current_feed;
    if (!feed) return null;
    if (feed.inventory_items?.item_name) {
      return feed.inventory_items;
    }
    const overrideId = batchFeedItemOverrides[batch.batch_id];
    if (overrideId) {
      const f = feedItems.find(item => item.item_id === overrideId);
      if (f) return f;
    }
    if (feed.item_id) {
      const f = feedItems.find(item => item.item_id === feed.item_id);
      if (f) return f;
    }
    return getSuggestedFeed(feed.task_name);
  };

  const getBatchFeedName = (batch) => {
    const item = getBatchFeedItem(batch);
    if (item?.item_name) return item.item_name;
    return batch.current_feed?.task_name || 'Prescribed Feed';
  };

  // Link an unlinked template guideline to an inventory feed item
  const handleLinkGuidelineToInventory = async (guidelineId, itemId, batchTag) => {
    if (!itemId || !guidelineId) return;
    try {
      const selectedItem = feedItems.find(f => f.item_id === itemId);
      const res = await fetch(`${API_BASE}/api/growth/guidelines/link-inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guideline_id: guidelineId,
          item_id: itemId,
          item_name: selectedItem?.item_name || null,
          activity_type: 'FEED',
        }),
      });

      if (!res.ok) throw new Error('Failed to update template guideline link.');

      toast.success(`Connected "${selectedItem?.item_name}" to growth program template for batch ${batchTag}.`);
      setLinkingGuidelineId(null);
      await fetchFeedingData();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error linking feed to template.');
    }
  };

  const formatFedTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  const batches = data.batches || [];
  const breeder = data.breeder_summary;
  const breederHeadCount = breeder?.total_breeders || 0;
  const numericBreederRate = parseFloat(breederRatePerHead) || 2.0;
  const calculatedBreederKg = Number((breederHeadCount * numericBreederRate).toFixed(1));

  const unfedBatches = batches.filter(b => b.current_feed && !b.current_feed.fed_today);
  const fedBatchesCount = batches.filter(b => b.current_feed?.fed_today).length;
  const totalBatchesCount = batches.length;

  const hasBreeder = breeder && breederHeadCount > 0;
  const breederFed = hasBreeder ? !!breeder.breeder_fed_today : true;

  // Counts for the progress bar: batches + breeder herd
  const totalGroupsCount = totalBatchesCount + (hasBreeder ? 1 : 0);
  const fedGroupsCount = fedBatchesCount + (hasBreeder && breeder.breeder_fed_today ? 1 : 0);
  const progressPercent = totalGroupsCount > 0 ? Math.round((fedGroupsCount / totalGroupsCount) * 100) : 0;

  // Piglet batch total kg: sum of all amounts (fed today or prescribed/adjusted)
  const pigletTotalKg = useMemo(() => {
    return batches.reduce((sum, b) => {
      const feed = b.current_feed;
      if (!feed) return sum;
      if (feed.fed_today) {
        const fedAmount = typeof feed.fed_today_kg === 'number' && feed.fed_today_kg > 0
          ? feed.fed_today_kg
          : (Number(feed.total_daily_feed_kg) || 0);
        return sum + fedAmount;
      }
      const adjusted = customAmounts[b.batch_id];
      const amount = adjusted !== undefined ? Number(adjusted) : (Number(feed.total_daily_feed_kg) || 0);
      return sum + amount;
    }, 0);
  }, [batches, customAmounts]);

  // Breeder total kg and dynamic rate
  const breederDisplayKg = breeder?.breeder_fed_today
    ? Number(breeder.breeder_fed_today_kg) || 0
    : (customBreederKg !== null ? customBreederKg : calculatedBreederKg);
  const breederTotalKg = breederDisplayKg;

  const breederIsAdjusted = breeder?.breeder_fed_today
    ? Math.abs(breeder.breeder_fed_today_kg - calculatedBreederKg) > 0.05
    : (customBreederKg !== null && Math.abs(customBreederKg - calculatedBreederKg) > 0.05);

  const breederDisplayRate = breederIsAdjusted && breederHeadCount > 0
    ? breederDisplayKg / breederHeadCount
    : numericBreederRate;

  // Remaining kg summary for CTA button
  const remainingBatchesKg = unfedBatches.reduce((sum, b) => {
    const adjusted = customAmounts[b.batch_id];
    const amount = adjusted !== undefined ? Number(adjusted) : (Number(b.current_feed?.total_daily_feed_kg) || 0);
    return sum + amount;
  }, 0);
  const remainingBreederKg = !breederFed ? breederDisplayKg : 0;
  const totalRemainingKg = remainingBatchesKg + remainingBreederKg;

  // Breeder feed name
  const breederFeedItem = feedItems.find(f => f.item_id === selectedBreederFeedId) || feedItems[0] || null;
  const breederFeedName = breederFeedItem?.item_name || 'Standard Breeder Feed';

  // Dynamic header remaining summary text matching reference screenshot
  let remainingSummaryText = '';
  if (unfedBatches.length === 0 && breederFed) {
    remainingSummaryText = 'All animals fed today';
  } else if (unfedBatches.length === 1 && breederFed) {
    const single = unfedBatches[0];
    const singleKg = customAmounts[single.batch_id] !== undefined ? customAmounts[single.batch_id] : single.current_feed?.total_daily_feed_kg;
    const singleFeed = getBatchFeedName(single);
    remainingSummaryText = `Remaining: 1 batch • ${singleKg} kg ${singleFeed}`;
  } else if (unfedBatches.length > 0 && breederFed) {
    remainingSummaryText = `Remaining: ${unfedBatches.length} batches • ${remainingBatchesKg.toFixed(1)} kg`;
  } else if (unfedBatches.length === 0 && !breederFed) {
    remainingSummaryText = `Remaining: Breeder Herd • ${breederDisplayKg} kg ${breederFeedName}`;
  } else {
    remainingSummaryText = `Remaining: ${unfedBatches.length} ${unfedBatches.length === 1 ? 'batch' : 'batches'} + Breeder • ${totalRemainingKg.toFixed(1)} kg`;
  }

  // --- Actions ---

  const handleStartEditBatch = (batchId, currentKg) => {
    setEditingBatchId(batchId);
    setTempAmount(String(currentKg));
  };

  const handleSaveCustomAmount = (batchId) => {
    const val = parseFloat(tempAmount);
    if (!isNaN(val) && val > 0) {
      setCustomAmounts(prev => ({ ...prev, [batchId]: val }));
    }
    setEditingBatchId(null);
  };

  const handleStartEditBreeder = () => {
    setEditingBreeder(true);
    setTempBreederAmount(String(breederDisplayKg));
  };

  const handleSaveBreederCustomAmount = () => {
    const val = parseFloat(tempBreederAmount);
    if (!isNaN(val) && val > 0) {
      setCustomBreederKg(val);
    }
    setEditingBreeder(false);
  };

  const handleFeedBatch = async (batch, customKg = null, explicitItemId = null, silent = false) => {
    const feed = batch.current_feed;
    if (!feed) return;
    const kg = customKg !== null ? parseFloat(customKg) : (customAmounts[batch.batch_id] !== undefined ? customAmounts[batch.batch_id] : Number(feed.total_daily_feed_kg));
    if (!kg || kg <= 0) {
      toast.error('Please enter a valid feed amount in kg.');
      return;
    }

    const effectiveItem = getBatchFeedItem(batch);
    const effectiveItemId = explicitItemId || effectiveItem?.item_id || batchFeedItemOverrides[batch.batch_id] || feed.item_id;
    if (!effectiveItemId) {
      toast.error(`Please link a feed supply to batch ${batch.batch_tag} first.`);
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

      if (!silent) {
        toast.success(`Fed ${kg} kg to batch ${batch.batch_tag}. Stock deducted.`);
      }

      await fetchFeedingData();
      setEditingBatchId(null);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error logging batch feed.');
      throw err;
    } finally {
      setSubmittingBatchId(null);
    }
  };

  const handleFeedBreeders = async (customKg = null, silent = false) => {
    if (!selectedBreederFeedId) {
      toast.error('Please select a feed supply for the breeder herd.');
      return;
    }
    const kg = customKg !== null ? parseFloat(customKg) : (customBreederKg !== null ? customBreederKg : calculatedBreederKg);
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
          head_count: breederHeadCount,
          performed_by: 'Staff',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to log breeder feed.');

      if (!silent) {
        toast.success(`Fed ${kg} kg to Breeder Herd (${breederHeadCount} heads). Stock deducted.`);
      }

      await fetchFeedingData();
      setEditingBreeder(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error logging breeder feed.');
      throw err;
    } finally {
      setSubmittingBreeder(false);
    }
  };

  const handleFeedRemaining = async () => {
    if (unfedBatches.length === 0 && breederFed) return;
    setBulkFeeding(true);
    try {
      let fedCount = 0;
      for (const b of unfedBatches) {
        const feed = b.current_feed;
        const effectiveItem = getBatchFeedItem(b);
        const effectiveItemId = effectiveItem?.item_id || batchFeedItemOverrides[b.batch_id] || feed?.item_id;
        const customKg = customAmounts[b.batch_id] !== undefined ? customAmounts[b.batch_id] : null;

        if (effectiveItemId) {
          await handleFeedBatch(b, customKg, effectiveItemId, true);
          fedCount++;
        }
      }

      if (!breederFed && selectedBreederFeedId) {
        const bKg = customBreederKg !== null ? customBreederKg : calculatedBreederKg;
        await handleFeedBreeders(bKg, true);
      }

      toast.success(`Remaining fed (${totalRemainingKg.toFixed(1)} kg deducted).`);
      await fetchFeedingData();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error executing bulk feed.');
    } finally {
      setBulkFeeding(false);
    }
  };

  const handleUndoFeedBatch = async (batchId) => {
    setUndoingId(batchId);
    try {
      const res = await fetch(`${API_BASE}/api/growth/undo-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to undo feeding');

      toast.success('Feeding undone. Inventory stock restored.');
      setCustomAmounts(prev => {
        const next = { ...prev };
        delete next[batchId];
        return next;
      });
      await fetchFeedingData();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error undoing batch feed.');
    } finally {
      setUndoingId(null);
    }
  };

  const handleUndoFeedBreeder = async () => {
    setUndoingBreeder(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/undo-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_breeder: true })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to undo breeder feeding');

      toast.success('Breeder feeding undone. Inventory stock restored.');
      setCustomBreederKg(null);
      await fetchFeedingData();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error undoing breeder feed.');
    } finally {
      setUndoingBreeder(false);
    }
  };

  const isBanner = variant === 'banner';

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs animate-pulse p-5 overflow-hidden ${isBanner ? 'mb-5' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 shrink-0" />
            <div className="h-5 w-32 bg-slate-200 rounded" />
            <div className="w-24 h-2 bg-slate-100 rounded-full" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-36 bg-slate-200 rounded-xl" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-8 bg-slate-100 rounded-lg" />
          <div className="h-12 bg-slate-50 rounded-lg" />
          <div className="h-12 bg-slate-50 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-300 ${isBanner ? 'mb-5' : ''}`}>
      {/* Top Header */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Icon, Title, Chevron, Progress Bar, Fed Count, Remaining Summary */}
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* Leaf Icon Box matching SwineSync emerald palette */}
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <Leaf className="w-4 h-4 stroke-[2.2]" />
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-[17px] font-bold text-slate-900 tracking-tight shrink-0 font-display">
            {title}
          </h3>

          {/* Collapsible toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition-colors shrink-0"
            title={isCollapsed ? 'Expand feeding table' : 'Collapse table'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          {/* Progress Bar Track */}
          <div className="w-20 sm:w-24 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0 ml-1">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Fed Count */}
          <span className="text-xs sm:text-sm font-bold text-slate-800 shrink-0">
            {fedGroupsCount} of {totalGroupsCount} fed
          </span>

          {/* Remaining Summary */}
          <span className="text-xs text-slate-500 font-normal shrink-0 hidden md:inline">
            {remainingSummaryText}
          </span>
        </div>

        {/* Right CTA Button: Feed Remaining (using SwineSync emerald-600 palette) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {totalRemainingKg > 0 ? (
            <button
              type="button"
              disabled={bulkFeeding}
              onClick={handleFeedRemaining}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Feed all remaining groups in 1 click"
            >
              {bulkFeeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Feeding...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>
                    Feed Remaining ({totalRemainingKg.toFixed(totalRemainingKg % 1 === 0 ? 0 : 2)} kg)
                  </span>
                </>
              )}
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-semibold">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>All Fed Today</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">
            {/* Scrollable Container for table responsiveness on mobile */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[760px]">
                {/* Column Headers */}
                <thead>
                  <tr className="border-t border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="text-left py-2.5 px-3 font-semibold w-[22%]">BATCH</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-[10%]">PEN</th>
                    <th className="text-center py-2.5 px-3 font-semibold w-[8%]">PIGS</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-[24%]">FEED</th>
                    <th className="text-right py-2.5 px-3 font-semibold w-[12%]">RATE</th>
                    <th className="text-right py-2.5 px-3 font-semibold w-[12%]">AMOUNT</th>
                    <th className="text-right py-2.5 px-3 font-semibold w-[12%]"></th>
                  </tr>
                </thead>

                {/* Piglet Batches Body */}
                <tbody>
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-slate-400 italic">
                        No active piglet batches enrolled in growth programs.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => {
                      const feed = b.current_feed;
                      const isFed = !!feed?.fed_today;
                      const isEditing = editingBatchId === b.batch_id;
                      const isSubmitting = submittingBatchId === b.batch_id;
                      const isUndoing = undoingId === b.batch_id;

                      const dailyRate = Number(feed?.daily_consumption_per_head) || 0;
                      const prescribedKg = Number(feed?.total_daily_feed_kg) || 0;
                      const fedKg = typeof feed?.fed_today_kg === 'number' && feed?.fed_today_kg > 0
                        ? feed.fed_today_kg
                        : (customAmounts[b.batch_id] !== undefined ? customAmounts[b.batch_id] : prescribedKg);
                      const customKg = customAmounts[b.batch_id];
                      const displayKg = isFed ? fedKg : (customKg !== undefined ? customKg : prescribedKg);

                      const isAdjusted = isFed
                        ? (feed?.is_adjusted || Math.abs(fedKg - prescribedKg) > 0.05)
                        : (customKg !== undefined && Math.abs(customKg - prescribedKg) > 0.05);

                      // Single-day rate calculation: if adjusted, dynamically shows kg/head for today only!
                      const displayRate = isAdjusted && b.current_count > 0
                        ? displayKg / b.current_count
                        : dailyRate;

                      const feedItem = getBatchFeedItem(b);
                      const feedName = getBatchFeedName(b);
                      const fedTime = formatFedTime(feed?.fed_time);
                      const effectiveItemId = feedItem?.item_id || batchFeedItemOverrides[b.batch_id] || feed?.item_id;

                      return (
                        <tr
                          key={b.batch_id}
                          className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          {/* BATCH */}
                          <td className="py-3.5 px-3 text-left">
                            <div className="flex items-center gap-2">
                              {isFed ? (
                                <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                              ) : (
                                <span className="w-4 shrink-0" />
                              )}
                              <span className="font-bold text-xs text-slate-900 tracking-tight">
                                {b.batch_tag}
                              </span>
                            </div>
                          </td>

                          {/* PEN */}
                          <td className="py-3.5 px-3 text-left">
                            {b.pen_code ? (
                              <span className="inline-block bg-slate-100 text-slate-600 font-medium text-xs px-2.5 py-0.5 rounded-md">
                                {b.pen_code}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* PIGS */}
                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs text-slate-700 font-medium">
                              {b.current_count}
                            </span>
                          </td>

                          {/* FEED (from Growth Program Template) */}
                          <td className="py-3.5 px-3 text-left">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                              <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {linkingGuidelineId === feed?.guideline_id ? (
                                <div className="inline-flex items-center gap-1">
                                  <select
                                    onChange={(e) => handleLinkGuidelineToInventory(feed.guideline_id, e.target.value, b.batch_tag)}
                                    defaultValue=""
                                    className="text-xs bg-white border border-emerald-400 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-emerald-500"
                                  >
                                    <option value="" disabled>Connect Inventory Feed...</option>
                                    {feedItems.map(item => (
                                      <option key={item.item_id} value={item.item_id}>{item.item_name}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setLinkingGuidelineId(null)}
                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="truncate" title={`Growth template guideline: ${feed?.task_name || ''}`}>
                                    {feedName}
                                  </span>
                                  {!feed?.item_id && (
                                    <button
                                      type="button"
                                      onClick={() => setLinkingGuidelineId(feed?.guideline_id)}
                                      className="text-[10px] text-amber-600 hover:text-amber-800 font-semibold underline cursor-pointer ml-1"
                                      title="This template guideline is not linked to an inventory item. Click to connect."
                                    >
                                      (Link Feed)
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          {/* RATE (kg/head, dynamically updated when adjusted for the day) */}
                          <td className="py-3.5 px-3 text-right">
                            <span className="text-xs text-slate-500 font-normal">
                              {displayRate.toFixed(2)} kg/hd
                            </span>
                          </td>

                          {/* AMOUNT */}
                          <td className="py-3.5 px-3 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  value={tempAmount}
                                  onChange={(e) => setTempAmount(e.target.value)}
                                  className="w-16 h-6 px-1.5 text-xs font-bold text-slate-900 bg-white border border-emerald-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomAmount(b.batch_id)}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
                                  title="Save for today"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBatchId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isAdjusted && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">
                                    Adjusted
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                                  {displayKg} kg
                                </span>
                                {!isFed && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditBatch(b.batch_id, displayKg)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                                    title="Adjust kg for today before feeding"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* ACTION / STATUS */}
                          <td className="py-3.5 px-3 text-right">
                            {isFed ? (
                              <div className="inline-flex items-center justify-end gap-3">
                                <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                                  {fedTime ? `Fed ${fedTime}` : 'Fed Today'}
                                </span>
                                <button
                                  type="button"
                                  disabled={isUndoing}
                                  onClick={() => handleUndoFeedBatch(b.batch_id)}
                                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 cursor-pointer transition-colors disabled:opacity-50"
                                  title="Undo feeding and restore stock"
                                >
                                  {isUndoing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Undo2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Undo</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleFeedBatch(b, displayKg, effectiveItemId)}
                                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs px-4 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Feeding...</span>
                                  </>
                                ) : (
                                  <>
                                    <Leaf className="w-3.5 h-3.5 shrink-0" />
                                    <span>Feed {displayKg} kg</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Piglet Total Line */}
            {batches.length > 0 && (
              <div className="text-right py-2 px-3 text-xs font-bold text-slate-700">
                Piglet total: {pigletTotalKg.toFixed(pigletTotalKg % 1 === 0 ? 0 : 2)} kg
              </div>
            )}

            {/* Breeder Herd Section */}
            {hasBreeder && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-t border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="text-left pt-3 pb-2 px-3 font-semibold w-[22%]">BREEDER HERD</th>
                      <th className="text-left pt-3 pb-2 px-3 font-semibold w-[10%]"></th>
                      <th className="text-center pt-3 pb-2 px-3 font-semibold w-[8%]">HEADS</th>
                      <th className="text-left pt-3 pb-2 px-3 font-semibold w-[24%]">FEED</th>
                      <th className="text-right pt-3 pb-2 px-3 font-semibold w-[12%]">RATE</th>
                      <th className="text-right pt-3 pb-2 px-3 font-semibold w-[12%]">AMOUNT</th>
                      <th className="text-right pt-3 pb-2 px-3 font-semibold w-[12%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {/* BREEDER HERD */}
                      <td className="py-3.5 px-3 text-left">
                        <div className="flex items-center gap-2">
                          {breederFed ? (
                            <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="font-bold text-xs text-slate-900 tracking-tight">
                            Sows & Boars
                          </span>
                        </div>
                      </td>

                      {/* PEN (Blank) */}
                      <td className="py-3.5 px-3 text-left"></td>

                      {/* HEADS */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="text-xs text-slate-700 font-medium">
                          {breederHeadCount}
                        </span>
                      </td>

                      {/* FEED (Changeable for Breeder Herd since it has no growth template) */}
                      <td className="py-3.5 px-3 text-left">
                        {!breederFed ? (
                          <div className="relative inline-flex items-center">
                            <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0 mr-1.5" />
                            <select
                              value={selectedBreederFeedId}
                              onChange={(e) => handleSelectBreederFeed(e.target.value)}
                              className="text-xs font-semibold text-slate-800 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200/90 rounded-lg pl-2 pr-6 py-1 cursor-pointer transition-colors shadow-2xs appearance-none truncate max-w-[210px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              title="Breeder herd does not follow a template. Select inventory feed supply anytime."
                            >
                              {feedItems.map(f => (
                                <option key={f.item_id} value={f.item_id}>
                                  {f.item_name} ({f.current_stock_level} {f.unit_of_measure})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-700 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{breederFeedName}</span>
                          </div>
                        )}
                      </td>

                      {/* RATE (kg/head, dynamically updated when adjusted for the day) */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="text-xs text-slate-500 font-normal">
                          {breederDisplayRate % 1 === 0 ? breederDisplayRate : breederDisplayRate.toFixed(2)} kg/hd
                        </span>
                      </td>

                      {/* AMOUNT */}
                      <td className="py-3.5 px-3 text-right">
                        {editingBreeder ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={tempBreederAmount}
                              onChange={(e) => setTempBreederAmount(e.target.value)}
                              className="w-16 h-6 px-1.5 text-xs font-bold text-slate-900 bg-white border border-emerald-500 rounded text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleSaveBreederCustomAmount}
                              className="p-1 text-emerald-600 hover:text-emerald-800 cursor-pointer"
                              title="Save for today"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBreeder(false)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {breederIsAdjusted && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">
                                Adjusted
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                              {breederDisplayKg} kg
                            </span>
                            {!breederFed && (
                              <button
                                type="button"
                                onClick={handleStartEditBreeder}
                                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                                title="Adjust kg for today before feeding"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ACTION / STATUS */}
                      <td className="py-3.5 px-3 text-right">
                        {breederFed ? (
                          <div className="inline-flex items-center justify-end gap-3">
                            <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                              {formatFedTime(breeder.breeder_fed_time) ? `Fed ${formatFedTime(breeder.breeder_fed_time)}` : 'Fed Today'}
                            </span>
                            <button
                              type="button"
                              disabled={undoingBreeder}
                              onClick={handleUndoFeedBreeder}
                              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 cursor-pointer transition-colors disabled:opacity-50"
                              title="Undo breeder feeding"
                            >
                              {undoingBreeder ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Undo2 className="w-3.5 h-3.5" />
                              )}
                              <span>Undo</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={submittingBreeder}
                            onClick={() => handleFeedBreeders(breederDisplayKg)}
                            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs px-4 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {submittingBreeder ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Feeding...</span>
                              </>
                            ) : (
                              <>
                                <Leaf className="w-3.5 h-3.5 shrink-0" />
                                <span>Feed {breederDisplayKg} kg</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Breeder Total Line */}
                <div className="text-right py-2 px-3 text-xs font-bold text-slate-700">
                  Breeder total: {breederTotalKg.toFixed(breederTotalKg % 1 === 0 ? 0 : 2)} kg
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
