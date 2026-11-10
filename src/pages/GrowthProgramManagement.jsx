import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useModalAnimation from "../hooks/useModalAnimation";
import {
  Plus, ClipboardList, Wheat, Syringe, FlaskConical, Scissors,
  ArrowRight, Activity, AlertTriangle, AlertCircle, X, Trash2,
  ChevronDown, Save, Archive, Pencil, Check, Unlock, Users, Loader2, ExternalLink, Target, Pill, Package, Baby
} from "lucide-react";
import { toast } from "../utils/toast";
import { supabase } from "../supabaseClient";
import AddSupplyModal from "../components/Inventory/AddSupplyModal";
import DailyFeedingPanel from "../components/Feeding/DailyFeedingPanel";

const FONT_DISPLAY = "font-['Space_Grotesk',_sans-serif]";
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getInventoryCategoryForActivityType(activityType) {
  const type = (activityType || '').toUpperCase();
  if (type === 'FEED') return 'Feed';
  if (type === 'MEDICATION') return 'Medication';
  if (type === 'SUPPLEMENT') return 'Supplements';
  return 'Feed';
}

export function isVaccineItem(item) {
  if (!item) return false;
  const cat = (item.category || '').toLowerCase();
  if (cat === 'vaccines' || cat === 'vaccine') return true;
  const name = (item.item_name || '').toLowerCase();
  const unit = (item.unit_of_measure || '').toLowerCase();
  if (name.includes('vaccine') || name.includes('pcv') || name.includes('prrs') ||
    name.includes('fmd') || name.includes('parvo') || name.includes('erysipelas') ||
    name.includes('mycoplasma') || name.includes('hog cholera') || name.includes('iron') ||
    unit.includes('dose')) {
    return true;
  }
  if (cat === 'medication' || cat === 'medicine') return false;
  return false;
}

export function isMedicationItem(item) {
  if (!item) return false;
  const cat = (item.category || '').toLowerCase();
  if (cat === 'medication' || cat === 'medicine') return true;
  if (cat === 'vaccines' || cat === 'vaccine') return false;
  if (isVaccineItem(item)) return false;
  if (cat === 'medical') return true;
  const name = (item.item_name || '').toLowerCase();
  const unit = (item.unit_of_measure || '').toLowerCase();
  return name.includes('amoxicillin') || name.includes('injection') || name.includes('antibiotic') ||
    name.includes('tylosin') || name.includes('penicillin') || name.includes('flunixin') ||
    name.includes('meloxicam') || name.includes('lincomycin') || name.includes('enrofloxacin') ||
    unit.includes('vial') || unit.includes('tablet') || unit.includes('capsule');
}

export function isFeedItem(item) {
  if (!item) return false;
  if (isVaccineItem(item) || isMedicationItem(item)) return false;
  const name = (item.item_name || '').toLowerCase();
  if (name.includes('disinfectant') || name.includes('virkon') || name.includes('cleaner') || name.includes('sanitizer')) return false;
  const cat = (item.category || '').toLowerCase();
  return cat === 'feed';
}

export function isSupplementItem(item) {
  if (!item) return false;
  if (isVaccineItem(item) || isMedicationItem(item)) return false;
  const cat = (item.category || '').toLowerCase();
  if (cat === 'supplements' || cat === 'supplement') return true;
  const name = (item.item_name || '').toLowerCase();
  return name.includes('electrolyte') || name.includes('vitamin') || name.includes('mineral') || name.includes('supplement') || name.includes('powder');
}

function getMatchingInventoryItems(activityType, items) {
  if (!items || items.length === 0) return [];
  const type = (activityType || '').toUpperCase();
  if (type === 'FEED') {
    return items.filter(isFeedItem);
  }
  if (type === 'MEDICATION') {
    return items.filter(isMedicationItem);
  }
  if (type === 'VACCINATION') {
    return items.filter(isVaccineItem);
  }
  if (type === 'SUPPLEMENT') {
    return items.filter(isSupplementItem);
  }
  return [];
}

const ACTIVITY_TYPES = [
  { value: 'FEED', label: 'Feed', icon: Wheat, bg: 'bg-[#fbf0dd]', text: 'text-[#b8791f]', border: 'border-[#f2ddba]', dot: 'bg-[#b8791f]' },
  { value: 'MEDICATION', label: 'Medication', icon: Pill, bg: 'bg-[#fbeae6]', text: 'text-[#a8412a]', border: 'border-[#f2c9bf]', dot: 'bg-[#a8412a]' },
  { value: 'VACCINATION', label: 'Vaccination', icon: Syringe, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-600' },
  { value: 'SUPPLEMENT', label: 'Supplement', icon: FlaskConical, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  { value: 'PROCEDURE', label: 'Procedure', icon: Scissors, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-600' },
];

const VACCINE_OPTIONS = [
  "Erysipelas Vaccine",
  "Circovirus (PCV2)",
  "Mycoplasma Hyopneumoniae",
  "Iron Injection & Mycoplasma",
  "Circovirus Vaccine (Weaning)",
  "PRRS Vaccine",
  "Foot & Mouth Disease (FMD)",
  "Parvovirus Vaccine",
  "Leptospirosis Vaccine",
  "TGE / Coronavirus Vaccine",
  "Streptococcus suis Vaccine",
  "Salmonella Vaccine",
  "Iron Dextran Injection",
  "Vitamin B Complex",
];

const MEDICATION_OPTIONS = [
  "Tylosin",
  "Meloxicam",
  "Enrofloxacin",
  "Penicillin",
  "Flunixin",
  "Amoxicillin",
  "Oxytetracycline",
  "Lincomycin",
];

function getActivityStyle(type) {
  return ACTIVITY_TYPES.find(a => a.value === type) || ACTIVITY_TYPES[3];
}


/* ---------------------------------------------------------------------- */
/* Timeline Preview (right panel in modal)                                */
/* ---------------------------------------------------------------------- */
function TimelinePreview({ guidelines, onAddToInventory }) {
  const visibleGuidelines = guidelines.filter(g => !g._isRemoving || true); // include removing for exit anim
  const sorted = [...guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);

  if (sorted.filter(g => !g._isRemoving).length === 0 && sorted.every(g => g._isRemoving)) {
    return (
      <div className="sticky top-32 flex flex-col items-center text-center text-slate-400 gap-3">
        <ClipboardList className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Add activities on the left<br />to see the timeline preview here.</p>
      </div>
    );
  }

  if (guidelines.length === 0) {
    return (
      <div className="sticky top-32 flex flex-col items-center text-center text-slate-400 gap-3">
        <ClipboardList className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Add activities on the left<br />to see the timeline preview here.</p>
      </div>
    );
  }

  return (
    <div className="py-2 px-3">
      {sorted.map((g, idx) => {
        const style = getActivityStyle(g.activity_type);
        const Icon = style.icon;
        const isLast = idx === sorted.length - 1;
        return (
          <div
            key={g._tempId || idx}
            className={`flex items-stretch gap-3 ${g._isRemoving ? 'preview-leave' : 'preview-enter'}`}
          >
            {/* Left column: connector + icon */}
            <div className="flex flex-col items-center shrink-0 w-10">
              {/* Top connector (hidden for first item) */}
              <div className={`w-0.5 flex-none ${idx === 0 ? 'h-3 bg-transparent' : 'h-3 bg-slate-200'}`} />
              {/* Icon circle */}
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 bg-white z-10 ${style.border} ${style.text}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {/* Bottom connector (hidden for last item) */}
              <div className={`w-0.5 flex-1 min-h-[8px] ${isLast ? 'bg-transparent' : 'bg-slate-200'}`} />
            </div>

            {/* Right column: day label + content card */}
            <div className="flex-1 min-w-0 pb-3">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 mt-0.5 leading-none" style={{ marginTop: '13px' }}>
                Day {g.days_after_birth}
              </span>
              <div className={`rounded-xl border px-3 py-2.5 ${style.bg} ${style.border} min-w-0`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800 truncate">
                    {g.task_name || <span className="italic text-slate-400">Unnamed task</span>}
                  </span>
                  {g.item_id ? (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-white/80 px-1.5 py-0.5 rounded-full border border-emerald-200">
                      <Package className="w-2.5 h-2.5" /> Inventory Linked
                    </span>
                  ) : (
                    g.activity_type !== 'PROCEDURE' && g.activity_type !== 'VACCINATION' && g.task_name && g.task_name.trim() && onAddToInventory && (
                      <button
                        type="button"
                        onClick={() => onAddToInventory(g)}
                        className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-800 bg-white hover:bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                        title="Register this custom item in Farm Inventory"
                      >
                        <Plus className="w-2.5 h-2.5 text-amber-600" /> Add to Inventory
                      </button>
                    )
                  )}
                </div>
                {g.activity_type === 'FEED' && g.daily_consumption_per_head > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ~{g.daily_consumption_per_head} kg/head/day est.
                  </p>
                )}
                {g.dosage_instructions && (
                  <p className="text-[11px] text-slate-500 mt-0.5 italic">{g.dosage_instructions}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Activity Row in the form builder                                       */
/* ---------------------------------------------------------------------- */
function ActivityRow({ activity, index, onChange, onDelete, onRequestSort, inventoryItems = [], onAddToInventory }) {
  const style = getActivityStyle(activity.activity_type);
  const isFeed = activity.activity_type === 'FEED';
  const isProcedure = activity.activity_type === 'PROCEDURE';
  const isVaccination = activity.activity_type === 'VACCINATION';

  const matchingItems = getMatchingInventoryItems(activity.activity_type, inventoryItems);
  const selectedInventoryItem = inventoryItems.find(i => i.item_id === activity.item_id);

  // If user explicitly chose custom or has a task_name that doesn't match an inventory item
  const [showCustomInput, setShowCustomInput] = useState(() => {
    if (isVaccination) {
      return !VACCINE_OPTIONS.includes(activity.task_name) && !!activity.task_name;
    }
    return isProcedure || activity.is_custom || (!!activity.task_name && !activity.item_id && !matchingItems.some(i => i.item_id === activity.item_id));
  });

  // Keep custom input state in sync if activity_type changes
  useEffect(() => {
    if (isProcedure) {
      setShowCustomInput(true);
    } else if (isVaccination) {
      setShowCustomInput(!VACCINE_OPTIONS.includes(activity.task_name) && !!activity.task_name);
    } else if (activity.item_id) {
      setShowCustomInput(false);
    }
  }, [activity.activity_type, activity.item_id, isProcedure, isVaccination]);

  const handleTypeChange = (newType) => {
    onChange({
      ...activity,
      activity_type: newType,
      item_id: null,
      task_name: '',
      is_custom: false
    });
    if (newType === 'PROCEDURE') {
      setShowCustomInput(true);
    } else if (newType === 'VACCINATION') {
      setShowCustomInput(false);
    }
  };

  const handleSelectInventory = (e) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setShowCustomInput(true);
      onChange({
        ...activity,
        item_id: null,
        is_custom: true,
        task_name: ''
      });
    } else {
      const item = matchingItems.find(i => i.item_id === val);
      if (item) {
        setShowCustomInput(false);
        onChange({
          ...activity,
          item_id: item.item_id,
          task_name: item.item_name,
          is_custom: false
        });
      } else {
        onChange({
          ...activity,
          item_id: null,
          task_name: '',
          is_custom: false
        });
      }
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${style.border} ${activity._isRemoving ? 'activity-leave' : 'activity-enter'}`}>
      {/* Row header: activity number + type badge + delete */}
      <div className={`flex items-center justify-between px-3 py-2 ${style.bg}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            #{index + 1}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
            {style.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-white/60 transition-colors"
          title="Remove activity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row fields */}
      <div className="p-3 bg-white space-y-2">
        {/* Row 1: Day + Type + Name */}
        <div className="flex gap-2 flex-wrap">
          {/* Day */}
          <div className="flex flex-col gap-0.5 w-[72px] shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Day</label>
            <input
              type="number"
              min="0"
              value={activity.days_after_birth}
              onChange={e => onChange({ ...activity, days_after_birth: parseInt(e.target.value) || 0 })}
              onBlur={onRequestSort}
              className="w-full text-sm font-bold text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-0.5 w-[130px] shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Type</label>
            <div className="relative">
              <select
                value={activity.activity_type}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none cursor-pointer pr-6"
              >
                {ACTIVITY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Task / Product Name */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {isProcedure ? 'Procedure Name' : isVaccination ? 'Vaccine Name (On-Demand)' : 'Inventory Item / Task'}
              </label>
              {isVaccination ? (
                <button
                  type="button"
                  onClick={() => {
                    const willShowCustom = !showCustomInput;
                    setShowCustomInput(willShowCustom);
                    if (willShowCustom) {
                      onChange({ ...activity, item_id: null, is_custom: true });
                    }
                  }}
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  {showCustomInput ? '← Pick Standard Vaccine' : '+ Custom Vaccine'}
                </button>
              ) : !isProcedure && matchingItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const willShowCustom = !showCustomInput;
                    setShowCustomInput(willShowCustom);
                    if (willShowCustom) {
                      onChange({ ...activity, item_id: null, is_custom: true });
                    }
                  }}
                  className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800"
                >
                  {showCustomInput ? '← Pick from Inventory' : '+ Enter Custom'}
                </button>
              )}
            </div>

            {isVaccination && !showCustomInput ? (
              <div className="relative">
                <select
                  value={VACCINE_OPTIONS.includes(activity.task_name) ? activity.task_name : (activity.task_name ? '__CUSTOM__' : '')}
                  onChange={e => {
                    if (e.target.value === '__CUSTOM__') {
                      setShowCustomInput(true);
                      onChange({ ...activity, task_name: '', item_id: null, is_custom: true });
                    } else {
                      onChange({ ...activity, task_name: e.target.value, item_id: null, is_custom: false });
                    }
                  }}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg pl-2 pr-8 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer"
                >
                  <option value="" disabled>-- Select Standard Vaccine --</option>
                  {VACCINE_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="__CUSTOM__">+ Custom / Other Vaccine Name</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            ) : isProcedure || isVaccination || showCustomInput ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={isFeed ? 'e.g. Starter Feed Mix' : isProcedure ? 'e.g. Ear Tagging & Castration' : isVaccination ? 'e.g. Circovirus (PCV2)' : 'e.g. Iron Injection'}
                    value={activity.task_name}
                    onChange={e => onChange({ ...activity, task_name: e.target.value, item_id: null, is_custom: true })}
                    className="flex-1 text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-slate-300"
                  />
                  {!isProcedure && !isVaccination && activity.task_name && activity.task_name.trim() && onAddToInventory && (
                    <button
                      type="button"
                      onClick={() => onAddToInventory(activity)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-2xs"
                      title="Register this custom item in Farm Inventory now"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      Add to Inventory
                    </button>
                  )}
                </div>
                {!isProcedure && !isVaccination && (
                  <p className="text-[10.5px] text-amber-700 font-medium flex items-center gap-1">
                    <Package className="w-3 h-3 text-amber-600 shrink-0" />
                    {activity.task_name && activity.task_name.trim()
                      ? 'Not yet in inventory — click "+ Add to Inventory" to register & link it, or save as an experimental item for later.'
                      : 'Type a custom/experimental supply name above.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={activity.item_id || ''}
                  onChange={handleSelectInventory}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg pl-2 pr-8 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none"
                >
                  <option value="" disabled>-- Select {style.label} from Inventory --</option>
                  {matchingItems.map(item => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.item_name} ({item.current_stock_level} {item.unit_of_measure})
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ Custom / Not yet in inventory</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* In-Stock Indicator */}
            {selectedInventoryItem && !showCustomInput && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${Number(selectedInventoryItem.current_stock_level) > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[11px] font-medium text-slate-500">
                  {Number(selectedInventoryItem.current_stock_level) > 0
                    ? `In Stock: ${selectedInventoryItem.current_stock_level} ${selectedInventoryItem.unit_of_measure}`
                    : `Out of Stock (0 ${selectedInventoryItem.unit_of_measure})`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Conditional fields */}
        <div className="flex gap-2 flex-wrap">
          {isFeed && (
            <div className="flex flex-col gap-0.5 w-[140px] shrink-0">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Est. kg / head / day</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={activity.daily_consumption_per_head || ''}
                onChange={e => onChange({ ...activity, daily_consumption_per_head: parseFloat(e.target.value) || 0 })}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              {isFeed ? 'Notes (optional)' : 'Dosage / Instructions (optional)'}
            </label>
            <input
              type="text"
              placeholder={isFeed ? 'e.g. Morning & afternoon feeding' : 'e.g. 2 ml per piglet IM'}
              value={activity.dosage_instructions || ''}
              onChange={e => onChange({ ...activity, dosage_instructions: e.target.value })}
              className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Fullscreen Modal Form                                                  */
/* ---------------------------------------------------------------------- */
function ProgramFormModal({ isOpen, onClose, onSaved, editProgram }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [guidelines, setGuidelines] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [addSupplyActivity, setAddSupplyActivity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const isEdit = !!editProgram;

  // Load inventory items when modal is open
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('inventory_items')
      .select('item_id, item_name, unit_of_measure, category, current_stock_level')
      .eq('is_archived', false)
      .order('item_name')
      .then(({ data, error }) => {
        if (!error && data) setInventoryItems(data);
      });
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editProgram) {
      setName(editProgram.name || '');
      setDescription(editProgram.description || '');
      setTargetWeight(editProgram.target_weight || '');
      setGuidelines(
        (editProgram.guidelines || [])
          .sort((a, b) => a.days_after_birth - b.days_after_birth)
          .map(g => ({ ...g, _tempId: g.guideline_id || Math.random() }))
      );
    } else {
      setName('');
      setDescription('');
      setTargetWeight('');
      setGuidelines([]);
      setErrors({});
    }
  }, [editProgram, isOpen]);

  const addActivity = () => {
    // Default new activity day to last day + 1 (or 0 if empty)
    const lastDay = guidelines.length > 0
      ? Math.max(...guidelines.map(g => g.days_after_birth || 0))
      : -1;
    setGuidelines(prev => [
      ...prev,
      {
        _tempId: Math.random(),
        days_after_birth: lastDay + 1,
        activity_type: 'FEED',
        task_name: '',
        item_id: null,
        is_custom: false,
        daily_consumption_per_head: 0,
        dosage_instructions: '',
      }
    ]);
  };

  const sortActivities = () => {
    setGuidelines(prev => [...prev].sort((a, b) => a.days_after_birth - b.days_after_birth));
  };

  const updateActivity = (tempId, updated) => {
    setGuidelines(prev => prev.map(g => g._tempId === tempId ? { ...updated, _tempId: tempId } : g));
  };

  const deleteActivity = (tempId) => {
    // Mark as removing to trigger exit animation, then remove after animation
    setGuidelines(prev => prev.map(g => g._tempId === tempId ? { ...g, _isRemoving: true } : g));
    setTimeout(() => {
      setGuidelines(prev => prev.filter(g => g._tempId !== tempId));
    }, 290);
  };

  const handleSave = async () => {
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: 'Program name is required.' });
      return;
    }
    setSaving(true);
    try {
      // Filter out internal flags before sending to API
      const payload = {
        name,
        description,
        target_weight: targetWeight || null,
        guidelines: guidelines
          .filter(g => !g._isRemoving)
          // eslint-disable-next-line no-unused-vars
          .map(({ _tempId, _isRemoving, is_custom, inventory_items, ...g }) => ({
            ...g,
            item_id: g.item_id || null,
          })),
      };
      const url = isEdit
        ? `${API_BASE}/api/growth/programs/${editProgram.program_id}`
        : `${API_BASE}/api/growth/programs`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save program');
      }

      toast.success(
        isEdit ? 'Program Updated' : 'Program Created',
        `"${name}" has been ${isEdit ? 'updated' : 'created'} successfully.`
      );
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col bg-white animate-fade-in overflow-hidden"
      style={{ height: 'calc(100dvh - 61px)', maxHeight: 'calc(100dvh - 61px)' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&display=swap');

        @keyframes activitySlideIn {
          from { opacity: 0; transform: translateY(-10px) scaleY(0.95); max-height: 0; }
          to   { opacity: 1; transform: translateY(0)     scaleY(1);    max-height: 400px; }
        }
        @keyframes activitySlideOut {
          from { opacity: 1; transform: translateY(0)    scaleY(1);    max-height: 400px; margin-bottom: 10px; }
          to   { opacity: 0; transform: translateY(-6px) scaleY(0.95); max-height: 0;     margin-bottom: 0; }
        }
        @keyframes previewSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes previewSlideOut {
          from { opacity: 1; transform: translateX(0)     scaleY(1);    max-height: 200px; }
          to   { opacity: 0; transform: translateX(12px)  scaleY(0.9);  max-height: 0; }
        }
        .activity-enter {
          animation: activitySlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
        }
        .activity-leave {
          animation: activitySlideOut 0.28s ease-in forwards;
          pointer-events: none;
          overflow: hidden;
        }
        .preview-enter {
          animation: previewSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .preview-leave {
          animation: previewSlideOut 0.28s ease-in forwards;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0 bg-white">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          title="Back"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`${FONT_DISPLAY} text-[15px] font-bold text-slate-900 leading-tight truncate`}>
            {isEdit ? `Edit: ${editProgram?.name || 'Program'}` : 'Create Growth Program'}
          </h2>
        </div>
      </div>

      {/* Body — two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Form */}
        <div className="flex flex-col w-full lg:w-1/2 border-r border-slate-100 overflow-y-auto">
          <div className="p-6 space-y-5">

            {errors.api && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{errors.api}</p>
              </div>
            )}

            {/* Program Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Program Name *</label>
              <input
                type="text"
                placeholder="e.g. Commercial Fast-Track"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: null }));
                }}
                className={`w-full text-sm font-semibold text-slate-800 border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 transition-colors placeholder:text-slate-300 ${errors.name
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-500/30'
                  }`}
              />
              {errors.name && (
                <div className="flex items-center gap-1.5 text-rose-500 pt-0.5 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <p className="text-[12px] font-semibold">{errors.name}</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description <span className="normal-case text-slate-400 font-medium">(optional)</span></label>
              <textarea
                placeholder="e.g. High protein diet for 4-month market readiness"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 placeholder:text-slate-300 resize-none transition-colors"
              />
            </div>

            {/* Target Weight */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Weight (kg) <span className="normal-case text-slate-400 font-medium">(optional)</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 105.00"
                value={targetWeight}
                onChange={e => setTargetWeight(e.target.value)}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 placeholder:text-slate-300 transition-colors"
              />
            </div>

            {/* Activity Builder */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Timeline Activities</p>
                <span className="text-[11px] text-slate-400 font-medium">{guidelines.length} {guidelines.length === 1 ? 'activity' : 'activities'}</span>
              </div>

              {guidelines.length === 0 ? (
                <div
                  onClick={addActivity}
                  className="border-2 border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer transition-colors"
                >
                  <Plus className="w-6 h-6" />
                  <p className="text-sm font-semibold">Click to add your first activity</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {guidelines.map((activity, idx) => (
                    <ActivityRow
                      key={activity._tempId}
                      index={idx}
                      activity={activity}
                      onChange={(updated) => updateActivity(activity._tempId, updated)}
                      onDelete={() => deleteActivity(activity._tempId)}
                      onRequestSort={sortActivities}
                      inventoryItems={inventoryItems}
                      onAddToInventory={(act) => setAddSupplyActivity(act)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addActivity}
                    className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Activity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Live Timeline Preview */}
        <div className="hidden lg:flex flex-col w-1/2 bg-slate-50/40 overflow-y-auto">
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Preview</p>
          </div>
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <TimelinePreview
              guidelines={guidelines}
              onAddToInventory={(act) => setAddSupplyActivity(act)}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-60 cursor-pointer">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Program'}
        </button>
      </div>

      {addSupplyActivity && (
        <AddSupplyModal
          item={null}
          prefill={{
            item_name: addSupplyActivity.task_name || '',
            category: getInventoryCategoryForActivityType(addSupplyActivity.activity_type),
            description: `Added from Growth Program (${name || 'Draft'}) - Day ${addSupplyActivity.days_after_birth}`,
          }}
          onClose={() => setAddSupplyActivity(null)}
          onSaved={async (_keepOpen, savedItem) => {
            if (!savedItem) return;
            setInventoryItems(prev => {
              const filtered = prev.filter(i => i.item_id !== savedItem.item_id);
              return [...filtered, savedItem].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));
            });
            setGuidelines(prev => prev.map(g => {
              const isTarget = g._tempId === addSupplyActivity._tempId ||
                (!g.item_id && g.activity_type === addSupplyActivity.activity_type && (g.task_name || '').trim().toLowerCase() === (addSupplyActivity.task_name || '').trim().toLowerCase());
              if (!isTarget) return g;
              return {
                ...g,
                item_id: savedItem.item_id,
                task_name: savedItem.item_name,
                is_custom: false,
              };
            }));
            if (addSupplyActivity.guideline_id) {
              fetch(`${API_BASE}/api/growth/guidelines/link-inventory`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  guideline_id: addSupplyActivity.guideline_id,
                  item_id: savedItem.item_id,
                  item_name: savedItem.item_name,
                  original_task_name: addSupplyActivity.task_name,
                  activity_type: addSupplyActivity.activity_type,
                }),
              }).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Operational Summary StatCard                                           */
/* ---------------------------------------------------------------------- */
function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || "bg-white"} p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || "bg-slate-50"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
          )}
          {badge && !loading && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor || "bg-slate-100 text-slate-600"}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Template Card                                                          */
/* ---------------------------------------------------------------------- */
function ProgramCard({ program, onEdit, onArchive, viewArchived, onRestore, onViewBatches, onAddToInventory, onProgramFed }) {
  const guidelines = program.guidelines || [];
  const sorted = [...guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);
  const batchCount = program.enrolled_batch_count ?? 0;
  const headCount = program.enrolled_head_count ?? 0;
  const hasEnrolled = headCount > 0 || batchCount > 0;
  const estDailyFeed = program.est_daily_feed_kg ?? 0;
  const marketReadyCount = program.market_ready_batches_count ?? 0;
  const unfedBatchesCount = program.unfed_batches_today_count ?? 0;
  const [submittingFeed, setSubmittingFeed] = useState(false);

  const handleQuickFeed = async (e) => {
    e.stopPropagation();
    setSubmittingFeed(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/programs/${program.program_id}/log-daily-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Staff' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to feed program batches');
      toast.success(data.message || `Fed all batches in ${program.name}`);
      if (onProgramFed) onProgramFed();
    } catch (err) {
      toast.error(err.message || 'Error feeding program batches');
    } finally {
      setSubmittingFeed(false);
    }
  };

  return (
    <article className="flex flex-col h-full bg-white border border-neutral-200 rounded-2xl px-6 pt-[22px] pb-4 shadow-sm hover:shadow-md transition-shadow tab-enter relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-800 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex gap-4 items-start min-w-0 w-full">
        <div className="flex-none w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-100">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className={`${FONT_DISPLAY} text-lg font-bold tracking-tight text-neutral-900 truncate`}>
              {program.name}
            </h3>
            {program.ready_fatteners_heads > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" />
                {program.ready_fatteners_heads} Ready Fattener{program.ready_fatteners_heads === 1 ? '' : 's'}
              </span>
            )}
            {program.ready_weaners_heads > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Check className="w-3 h-3 text-amber-700" />
                {program.ready_weaners_heads} Ready Weaner{program.ready_weaners_heads === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className={`mt-1.5 text-[13px] line-clamp-2 ${program.description ? 'text-neutral-500' : 'text-neutral-400 italic'}`}>
            {program.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 bg-neutral-50/80 rounded-xl mt-6 px-4 py-1 border border-neutral-100 overflow-x-auto custom-scrollbar">
        {sorted.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500 italic py-4">No guidelines configured.</p>
        ) : (
          <div className="mt-7 mb-4">
            <div className="relative flex justify-between gap-2 hide-scrollbar snap-x min-w-max">
              <div className="absolute top-10 left-10 right-10 h-0.5 bg-neutral-200" aria-hidden="true" />
              {sorted.map((g, idx) => {
                const style = getActivityStyle(g.activity_type);
                const Icon = style.icon;
                return (
                  <div key={g.guideline_id || idx} className="flex flex-col items-center min-w-[80px] snap-center group/node">
                    <span className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-2">
                      Day {g.days_after_birth}
                    </span>
                    <div className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center bg-white ${style.border} ${style.text} relative z-10 transition-transform group-hover/node:scale-110 shadow-sm`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="mt-3 text-center px-1 flex flex-col items-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider mb-1 ${style.bg} ${style.text}`}>
                        {g.activity_type}
                      </span>
                      <span className="block text-[11px] font-semibold text-neutral-700 leading-tight">{g.task_name}</span>
                      {g.daily_consumption_per_head > 0 && (
                        <span className="block text-[10px] text-neutral-500 mt-0.5">~{g.daily_consumption_per_head} kg/head</span>
                      )}
                      {g.item_id ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 mt-1">
                          <Package className="w-2.5 h-2.5" />
                          {g.inventory_items ? `${g.inventory_items.current_stock_level} ${g.inventory_items.unit_of_measure}` : 'Linked'}
                        </span>
                      ) : (
                        !viewArchived && g.activity_type !== 'PROCEDURE' && g.task_name && g.task_name.trim() && onAddToInventory && (
                          <button
                            type="button"
                            onClick={() => onAddToInventory(g, program)}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 mt-1.5 transition-colors cursor-pointer shadow-2xs"
                            title="Register this custom item in Farm Inventory"
                          >
                            <Plus className="w-2.5 h-2.5 text-amber-600" /> Add to Inventory
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-neutral-100 flex-wrap mt-auto">
        <span className="flex items-center gap-2.5 text-[12px] text-neutral-500 flex-wrap">
          {program.target_weight && (
            <>
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-neutral-400" />
                <strong className="text-neutral-700">{program.target_weight} kg</strong> target
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-300" aria-hidden="true" />
            </>
          )}
          <button
            onClick={() => onViewBatches(program)}
            className={`inline-flex items-center gap-1.5 transition-colors ${hasEnrolled
              ? 'text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer'
              : 'text-neutral-400 cursor-default'
              }`}
            title="Click to view enrolled batches"
          >
            <Users className="w-3.5 h-3.5" />
            <strong className={hasEnrolled ? 'text-indigo-700' : 'text-neutral-400'}>{headCount}</strong>
            Headcount
          </button>
          {estDailyFeed > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-neutral-300" aria-hidden="true" />
              {hasEnrolled && unfedBatchesCount > 0 ? (
                <button
                  type="button"
                  disabled={submittingFeed}
                  onClick={handleQuickFeed}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white font-bold text-[11.5px] shadow-2xs transition-all cursor-pointer"
                  title="1-click: feed all batches in this program today"
                >
                  {submittingFeed ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Feeding...
                    </>
                  ) : (
                    <>
                      <Wheat className="w-3 h-3" />
                      Feed Today (~{estDailyFeed} kg)
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onViewBatches(program)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-semibold text-[11.5px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 transition-colors cursor-pointer"
                  title={hasEnrolled ? "All active batches fed today — click to view" : "Estimated daily feed"}
                >
                  <Wheat className="w-3 h-3 text-emerald-600" />
                  <span>~{estDailyFeed} kg/day feed</span>
                  {hasEnrolled && <Check className="w-3 h-3 text-emerald-600" />}
                </button>
              )}
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          {!viewArchived ? (
            <>
              <button
                onClick={() => onEdit(program)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-800 hover:text-emerald-950 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <span className="w-px h-4 bg-neutral-200" />
              <button
                onClick={() => onArchive(program)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </>
          ) : (
            <button
              onClick={() => onRestore(program)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              Restore
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------- */
/* Enrolled Batches Modal                                                  */
/* ---------------------------------------------------------------------- */
function EnrolledBatchesModal({ program, onClose, onUpdated }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeBatchFeedId, setActiveBatchFeedId] = useState(null);
  const [feedAmountInput, setFeedAmountInput] = useState('');
  const [submittingFeed, setSubmittingFeed] = useState(false);
  const [bulkFeeding, setBulkFeeding] = useState(false);
  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(!!program, onClose);

  const fetchBatches = async () => {
    if (!program) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/programs/${program.program_id}/batches`);
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load enrolled batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (program) {
      setActiveBatchFeedId(null);
      fetchBatches();
    }
  }, [program]);

  if (!shouldRender || !program) return null;

  const statusColors = {
    Active: 'bg-emerald-100 text-emerald-700',
    Weaning: 'bg-amber-100 text-amber-700',
    Archived: 'bg-slate-100 text-slate-500',
  };

  const totalHeadcount = batches.reduce((sum, b) => sum + (Number(b.current_count) || 0), 0);
  const totalDailyFeed = batches.reduce((sum, b) => sum + (Number(b.current_feed?.total_daily_feed_kg) || 0), 0).toFixed(1);
  const unfedBatches = batches.filter(b => b.current_feed && !b.current_feed.fed_today && b.current_feed.item_id);
  const unfedFeedKg = unfedBatches.reduce((sum, b) => sum + (Number(b.current_feed.total_daily_feed_kg) || 0), 0).toFixed(1);

  const handleLogSingleFeed = async (batch, directKg = null) => {
    const raw = directKg !== null ? directKg : feedAmountInput;
    const kg = parseFloat(raw);
    if (!kg || kg <= 0) {
      toast.error('Please enter a valid feed amount in kg.');
      return;
    }
    setSubmittingFeed(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.batch_id,
          activity_type: 'FEED',
          guideline_id: batch.current_feed.guideline_id,
          amount_given: kg,
          item_id: batch.current_feed.item_id,
          performed_by: 'Staff',
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to log feeding.');
      }
      toast.success(`Deducted ${kg} kg of ${batch.current_feed.task_name} for batch ${batch.batch_tag}.`);
      setBatches(prev => prev.map(b => {
        if (b.batch_id === batch.batch_id) {
          return {
            ...b,
            current_feed: {
              ...b.current_feed,
              fed_today: true,
              fed_today_kg: kg,
              current_stock_level: result.new_stock_level !== undefined ? result.new_stock_level : b.current_feed.current_stock_level,
            }
          };
        }
        return b;
      }));
      setActiveBatchFeedId(null);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error logging feed.');
    } finally {
      setSubmittingFeed(false);
    }
  };

  const handleBulkFeedAll = async () => {
    if (unfedBatches.length === 0) return;
    setBulkFeeding(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/programs/${program.program_id}/log-daily-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Staff' }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to log bulk feeding.');
      }
      toast.success(result.message || `Successfully fed ${result.batches_fed} batches.`);
      await fetchBatches();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error executing bulk feeding.');
    } finally {
      setBulkFeeding(false);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <style>{`
        @keyframes modal-panel-in  { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes modal-panel-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(16px) scale(0.97); } }
        .animate-modal-in  { animation: modal-panel-in  220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-modal-out { animation: modal-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
      `}</style>
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden ${panelClassName || 'animate-modal-in'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Enrolled Batches</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">Program: {program.name}</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[460px] overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">No batches enrolled</p>
                <p className="text-[12px] text-slate-400 mt-0.5">No piglet batches are currently assigned to this program.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {batches.map(batch => (
                <li
                  key={batch.batch_id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-200 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-extrabold text-slate-900 tracking-tight">{batch.batch_tag || 'Unnamed Batch'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wide ${statusColors[batch.status] || 'bg-slate-100 text-slate-600'}`}>
                        {batch.status || 'Active'}
                      </span>
                    </div>
                    {batch.market_status === 'fattener_ready' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-700" />
                        Market Ready Fattener (Day {batch.age_in_days})
                      </span>
                    )}
                    {batch.market_status === 'weaner_ready' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Check className="w-3 h-3 text-amber-700" />
                        Market Ready Weaner (Day {batch.age_in_days})
                      </span>
                    )}
                  </div>

                  {/* Core specifications */}
                  <div className="flex items-center gap-3 text-[11.5px] text-slate-600 flex-wrap">
                    <span className="font-bold text-slate-800">{batch.current_count ?? 0} head</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                    <span>Pen: {batch.pen?.pen_code ? <strong className="text-slate-700">{batch.pen.pen_code}</strong> : 'Unassigned'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                    <span>Age: <strong className="text-slate-700">Day {batch.age_in_days ?? 0}</strong></span>
                  </div>

                  {/* Active Feed Requirement */}
                  {batch.current_feed && (
                    batch.current_feed.fed_today ? (
                      <div className="mt-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11.5px] text-emerald-900">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Wheat className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{batch.current_feed.task_name}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Fed Today ({batch.current_feed.fed_today_kg} kg)
                        </span>
                      </div>
                    ) : activeBatchFeedId === batch.batch_id ? (
                      <div className="mt-2.5 bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900">
                            <Wheat className="w-4 h-4 text-amber-600" />
                            <span>Feed Log — {batch.current_feed.task_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveBatchFeedId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] bg-white/80 p-2.5 rounded-lg border border-amber-200/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Amount to Deduct</label>
                            <div className="flex items-center gap-1.5 mt-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={feedAmountInput}
                                onChange={e => setFeedAmountInput(e.target.value)}
                                className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500/30"
                              />
                              <span className="font-semibold text-slate-600">kg</span>
                            </div>
                            {batch.current_feed.unit_of_measure?.toLowerCase().includes('sack') && (
                              <span className="text-slate-500 text-[10px] block mt-0.5">
                                ~{(Number(feedAmountInput || 0) / 50).toFixed(2)} sacks (50kg/sack)
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-600 flex flex-col justify-center">
                            <span>Current Stock: <strong className={Number(batch.current_feed.current_stock_level) < Number(feedAmountInput) ? 'text-rose-600' : 'text-emerald-700'}>
                              {batch.current_feed.current_stock_level ?? '—'} {batch.current_feed.unit_of_measure || 'kg'}
                            </strong></span>
                            <span className="text-slate-400 text-[10px] mt-0.5">Default budget: {batch.current_feed.total_daily_feed_kg} kg</span>
                          </div>
                        </div>

                        {Number(batch.current_feed.current_stock_level) < Number(feedAmountInput) && (
                          <p className="text-[10.5px] text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Warning: Stock level is lower than the entered feed quantity.
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={submittingFeed}
                            onClick={() => setActiveBatchFeedId(null)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={submittingFeed || !feedAmountInput || Number(feedAmountInput) <= 0}
                            onClick={() => handleLogSingleFeed(batch)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            {submittingFeed ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Deducting...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Confirm & Deduct Stock
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11.5px] text-amber-900 flex-wrap">
                        <div>
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Wheat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            {batch.current_feed.task_name}
                          </span>
                          <span className="text-[11px] text-amber-700/80 block mt-0.5">
                            Budget: ~{batch.current_feed.total_daily_feed_kg} kg/day ({batch.current_feed.daily_consumption_per_head} kg/head)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {batch.current_feed.item_id ? (
                            <>
                              <button
                                type="button"
                                disabled={submittingFeed}
                                onClick={() => handleLogSingleFeed(batch, batch.current_feed.total_daily_feed_kg)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                                title={`Feed ~${batch.current_feed.total_daily_feed_kg} kg in 1 click`}
                              >
                                <Wheat className="w-3.5 h-3.5" />
                                Feed ~{batch.current_feed.total_daily_feed_kg} kg
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBatchFeedId(batch.batch_id);
                                  setFeedAmountInput(String(batch.current_feed.total_daily_feed_kg || 0));
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer"
                                title="Adjust kg before feeding"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10.5px] text-amber-700 italic">No inventory item linked</span>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {/* Next Activity Milestone */}
                  {batch.next_activity && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Next Milestone:</span>
                      <span className="font-bold text-slate-700">Day {batch.next_activity.days_after_birth}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700 font-medium">{batch.next_activity.task_name}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!loading && batches.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 text-xs text-slate-600 font-medium flex-wrap">
            <div>
              <span className="block">
                <strong className="text-slate-900 font-bold">{totalHeadcount} heads</strong> across <strong className="text-slate-900 font-bold">{batches.length} {batches.length === 1 ? 'batch' : 'batches'}</strong>
              </span>
              {Number(totalDailyFeed) > 0 && (
                <span className="flex items-center gap-1 font-bold text-amber-800 text-[11px] mt-0.5">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  ~{totalDailyFeed} kg/day total budget
                </span>
              )}
            </div>

            {unfedBatches.length > 1 && (
              <button
                type="button"
                disabled={bulkFeeding}
                onClick={handleBulkFeedAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Deduct today's feed for all unfed batches in this program"
              >
                {bulkFeeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Logging Feed...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Log All Batches Today ({unfedFeedKg} kg)
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------------- */
/* Archive Confirm Modal                                                  */
/* ---------------------------------------------------------------------- */
function ArchiveConfirmModal({ program, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(!!program, onCancel);

  useEffect(() => {
    if (program) {
      setLoading(false);
      setError('');
      setShowSuccess(false);
    }
  }, [program]);

  const handleArchive = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/programs/${program.program_id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Admin' }),
      });
      if (!res.ok) throw new Error('Failed to archive program');

      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onSuccess) onSuccess();
    requestClose();
  };

  if (!shouldRender || !program) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) requestClose();
      }}
    >
      <style>{`
        @keyframes modal-panel-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modal-panel-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(16px) scale(0.97); }
        }
        .animate-modal-in  { animation: modal-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-modal-out { animation: modal-panel-out 220ms cubic-bezier(0.4, 0, 1, 1) both; }
      `}</style>
      <div className={`bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-auto ${panelClassName || 'animate-modal-in'}`}>
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-start gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">Archive Program?</h3>
                <p className="text-[12px] text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 mb-5 border border-slate-100">
              You are about to permanently remove <strong>"{program.name}"</strong>.
              Any piglet batches currently using this program may be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { if (!loading) requestClose(); }} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleArchive} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'Archiving...' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm bg-rose-50 border-rose-100 text-rose-600">
              <Archive className="w-7 h-7" strokeWidth={2.5} />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Program Archived!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                <span className="font-bold text-slate-700">"{program.name}"</span> has been removed from active templates.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className="w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------------- */
/* Restore Confirm Modal                                                  */
/* ---------------------------------------------------------------------- */
function RestoreConfirmModal({ program, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(!!program, onCancel);

  useEffect(() => {
    if (program) {
      setLoading(false);
      setError('');
      setShowSuccess(false);
    }
  }, [program]);

  const handleRestore = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/growth/programs/${program.program_id}/restore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Admin' }),
      });
      if (!res.ok) throw new Error('Failed to restore program');

      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onSuccess) onSuccess();
    requestClose();
  };

  if (!shouldRender || !program) return null;

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) requestClose();
      }}
    >
      <div className={`bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-auto ${panelClassName || 'animate-modal-in'}`}>
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2.5 rounded-xl text-[13px] font-medium flex items-start gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">Restore Program?</h3>
                <p className="text-[12px] text-slate-500">Return to active templates.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 mb-5 border border-slate-100">
              You are about to restore <strong>"{program.name}"</strong>.
              It will become available for assignment to piglet batches again.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { if (!loading) requestClose(); }} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleRestore} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'Restoring...' : 'Yes, Restore'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm bg-emerald-50 border-emerald-100 text-emerald-600">
              <Check className="w-7 h-7" strokeWidth={3} />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Program Restored!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                <span className="font-bold text-slate-700">"{program.name}"</span> is now active and available for assignment.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className="w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                   */
/* ---------------------------------------------------------------------- */
export default function GrowthProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProgram, setEditProgram] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [batchTarget, setBatchTarget] = useState(null);
  const [addSupplyTarget, setAddSupplyTarget] = useState(null);
  const [viewArchived, setViewArchived] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => { fetchPrograms(); }, [viewArchived]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/growth/programs?archived=${viewArchived}`);
      if (!res.ok) throw new Error('Failed to fetch growth programs');
      setPrograms(await res.json());
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (program) => {
    setEditProgram(program);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditProgram(null);
  };

  if (showForm) {
    return (
      <ProgramFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        onSaved={fetchPrograms}
        editProgram={editProgram}
      />
    );
  }

  const activePrograms = programs.filter(p => !p.is_archived);
  const totalHeadcount = activePrograms.reduce((acc, p) => acc + (p.enrolled_head_count || 0), 0);
  const totalDailyFeedKg = activePrograms.reduce((acc, p) => acc + (p.est_daily_feed_kg || 0), 0).toFixed(1);
  const totalReadyWeanersHeads = activePrograms.reduce((acc, p) => acc + (p.ready_weaners_heads || 0), 0);
  const totalReadyWeanersBatches = activePrograms.reduce((acc, p) => acc + (p.ready_weaners_batches || 0), 0);
  const totalReadyFattenersHeads = activePrograms.reduce((acc, p) => acc + (p.ready_fatteners_heads || 0), 0);
  const totalReadyFattenersBatches = activePrograms.reduce((acc, p) => acc + (p.ready_fatteners_batches || 0), 0);

  return (
    <div ref={containerRef} className="relative p-5 lg:p-6 space-y-5 animate-fade-in font-sans text-neutral-900" style={{ minHeight: '100%' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; margin-bottom: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
      `}</style>

      {/* High-level Operational Summary Cards */}
      {!viewArchived && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-6 h-6 text-indigo-600" />}
            label="Enrolled Headcount"
            value={`${totalHeadcount} heads`}
            badge={totalHeadcount > 0 ? "ENROLLED" : "NONE"}
            badgeColor="bg-indigo-100 text-indigo-700"
            accentColor="bg-indigo-50"
            loading={loading}
          />
          <StatCard
            icon={<Wheat className="w-6 h-6 text-amber-600" />}
            label="Est. Daily Feed Needed"
            value={`${totalDailyFeedKg} kg`}
            badge="PER DAY"
            badgeColor="bg-amber-100 text-amber-700"
            accentColor="bg-amber-50"
            loading={loading}
          />
          <StatCard
            icon={<Baby className="w-6 h-6 text-amber-600" />}
            label="Market Ready Weaners"
            value={`${totalReadyWeanersHeads} heads`}
            badge={totalReadyWeanersHeads > 0 ? `${totalReadyWeanersBatches} BATCH${totalReadyWeanersBatches === 1 ? '' : 'ES'}` : "NONE"}
            badgeColor={totalReadyWeanersHeads > 0 ? "bg-amber-100 text-amber-800 font-bold" : "bg-slate-100 text-slate-600"}
            accentColor="bg-amber-50"
            loading={loading}
          />
          <StatCard
            icon={<Target className="w-6 h-6 text-emerald-700" />}
            label="Market Ready Fatteners"
            value={`${totalReadyFattenersHeads} heads`}
            badge={totalReadyFattenersHeads > 0 ? `${totalReadyFattenersBatches} BATCH${totalReadyFattenersBatches === 1 ? '' : 'ES'}` : "NONE"}
            badgeColor={totalReadyFattenersHeads > 0 ? "bg-emerald-600 text-white font-bold" : "bg-slate-100 text-slate-600"}
            accentColor="bg-emerald-50"
            loading={loading}
          />
        </div>
      )}

      {/* Today's Daily Feeding Banner */}
      {!viewArchived && (
        <DailyFeedingPanel
          variant="banner"
          onUpdated={fetchPrograms}
        />
      )}

      {/* List header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-slate-800">Growth Programs List</h3>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewArchived(false)}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${!viewArchived ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Active
            </button>
            <button
              onClick={() => setViewArchived(true)}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${viewArchived ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Archived
            </button>
          </div>
        </div>
        {!viewArchived && (
          <button
            onClick={() => { setEditProgram(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create Growth Program
          </button>
        )}
      </div>

      {/* Program Cards */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <article key={i} className="flex flex-col h-[280px] bg-white border border-neutral-200 rounded-2xl px-6 pt-[22px] pb-4 shadow-sm animate-pulse">
              <div className="flex gap-4 items-start min-w-0 w-full mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 w-full space-y-3 pt-1">
                  <div className="h-5 w-48 bg-slate-200 rounded-md" />
                  <div className="h-4 w-32 bg-slate-200 rounded-md" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-3 w-full bg-slate-200 rounded-md" />
                <div className="h-3 w-3/4 bg-slate-200 rounded-md" />
                <div className="h-3 w-5/6 bg-slate-200 rounded-md" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                <div className="h-8 w-24 bg-slate-200 rounded-lg" />
                <div className="h-8 w-32 bg-slate-200 rounded-lg" />
              </div>
            </article>
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl shadow-sm">
          <p className="text-neutral-500 text-sm font-semibold">No growth programs found.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors">
            <Plus className="w-4 h-4" /> Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {programs.map(program => (
            <ProgramCard
              key={program.program_id}
              program={program}
              onEdit={handleEdit}
              onArchive={setArchiveTarget}
              viewArchived={viewArchived}
              onRestore={setRestoreTarget}
              onViewBatches={setBatchTarget}
              onAddToInventory={(guideline, prog) => setAddSupplyTarget({ guideline, program: prog })}
              onProgramFed={fetchPrograms}
            />
          ))}
        </div>
      )}

      {/* Archive Confirm */}
      <ArchiveConfirmModal
        program={archiveTarget}
        onSuccess={() => {
          setArchiveTarget(null);
          fetchPrograms();
        }}
        onCancel={() => setArchiveTarget(null)}
      />

      {/* Restore Confirm */}
      <RestoreConfirmModal
        program={restoreTarget}
        onSuccess={() => {
          setRestoreTarget(null);
          fetchPrograms();
        }}
        onCancel={() => setRestoreTarget(null)}
      />

      {/* Enrolled Batches */}
      <EnrolledBatchesModal
        program={batchTarget}
        onClose={() => setBatchTarget(null)}
        onUpdated={fetchPrograms}
      />

      {/* Add Custom Growth Activity Supply to Inventory Modal */}
      {addSupplyTarget && (
        <AddSupplyModal
          item={null}
          prefill={{
            item_name: addSupplyTarget.guideline.task_name || '',
            category: getInventoryCategoryForActivityType(addSupplyTarget.guideline.activity_type),
            description: `Added from Growth Program "${addSupplyTarget.program?.name || ''}" (Day ${addSupplyTarget.guideline.days_after_birth})`,
          }}
          onClose={() => setAddSupplyTarget(null)}
          onSaved={async (_keepOpen, savedItem) => {
            if (!savedItem) return;
            try {
              await fetch(`${API_BASE}/api/growth/guidelines/link-inventory`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  guideline_id: addSupplyTarget.guideline.guideline_id,
                  item_id: savedItem.item_id,
                  item_name: savedItem.item_name,
                  original_task_name: addSupplyTarget.guideline.task_name,
                  activity_type: addSupplyTarget.guideline.activity_type,
                }),
              });
              fetchPrograms();
            } catch (err) {
              console.error('Failed to link guideline to new inventory item:', err);
            }
          }}
        />
      )}
    </div>
  );
}
