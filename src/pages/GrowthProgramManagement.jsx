import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useModalAnimation from "../hooks/useModalAnimation";
import {
  Plus, ClipboardList, Wheat, Syringe, FlaskConical, Scissors,
  ArrowRight, Activity, AlertTriangle, X, Trash2,
  ChevronDown, Save, Archive, Pencil, Check, Unlock
} from "lucide-react";
import { toast } from "../utils/toast";

const FONT_DISPLAY = "font-['Space_Grotesk',_sans-serif]";

const ACTIVITY_TYPES = [
  { value: 'FEED',       label: 'Feed',       icon: Wheat,        bg: 'bg-[#fbf0dd]', text: 'text-[#b8791f]', border: 'border-[#f2ddba]', dot: 'bg-[#b8791f]' },
  { value: 'MEDICATION', label: 'Medication', icon: Syringe,      bg: 'bg-[#fbeae6]', text: 'text-[#a8412a]', border: 'border-[#f2c9bf]', dot: 'bg-[#a8412a]' },
  { value: 'SUPPLEMENT', label: 'Supplement', icon: FlaskConical, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  { value: 'PROCEDURE',  label: 'Procedure',  icon: Scissors,     bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-600' },
];

function getActivityStyle(type) {
  return ACTIVITY_TYPES.find(a => a.value === type) || ACTIVITY_TYPES[3];
}

/* ---------------------------------------------------------------------- */
/* Stat Card                                                               */
/* ---------------------------------------------------------------------- */
function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || 'bg-white'} p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || 'bg-slate-50'}`}>
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
          {badge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Timeline Preview (right panel in modal)                                */
/* ---------------------------------------------------------------------- */
function TimelinePreview({ guidelines }) {
  const visibleGuidelines = guidelines.filter(g => !g._isRemoving || true); // include removing for exit anim
  const sorted = [...guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);

  if (sorted.filter(g => !g._isRemoving).length === 0 && sorted.every(g => g._isRemoving)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-16 gap-3">
        <ClipboardList className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Add activities on the left<br />to see the timeline preview here.</p>
      </div>
    );
  }

  if (guidelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-16 gap-3">
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
                </div>
                {g.activity_type === 'FEED' && g.daily_consumption_per_head > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {g.daily_consumption_per_head} kg/head/day
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
function ActivityRow({ activity, index, onChange, onDelete, onRequestSort }) {
  const style = getActivityStyle(activity.activity_type);
  const isFeed = activity.activity_type === 'FEED';

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
                onChange={e => onChange({ ...activity, activity_type: e.target.value })}
                className="w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none cursor-pointer pr-6"
              >
                {ACTIVITY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Task Name */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Task / Product Name</label>
            <input
              type="text"
              placeholder={isFeed ? 'e.g. Pre-Starter Feed' : 'e.g. Iron Injection'}
              value={activity.task_name}
              onChange={e => onChange({ ...activity, task_name: e.target.value })}
              className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Row 2: Conditional fields */}
        <div className="flex gap-2 flex-wrap">
          {isFeed && (
            <div className="flex flex-col gap-0.5 w-[130px] shrink-0">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">kg / head / day</label>
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
              placeholder="Optional notes..."
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
  const [guidelines, setGuidelines] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editProgram;

  // Populate form when editing
  useEffect(() => {
    if (editProgram) {
      setName(editProgram.name || '');
      setDescription(editProgram.description || '');
      setGuidelines(
        (editProgram.guidelines || [])
          .sort((a, b) => a.days_after_birth - b.days_after_birth)
          .map(g => ({ ...g, _tempId: g.guideline_id || Math.random() }))
      );
    } else {
      setName('');
      setDescription('');
      setGuidelines([]);
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
    if (!name.trim()) {
      toast.error('Program name is required.');
      return;
    }
    setSaving(true);
    try {
      // Filter out internal flags before sending to API
      const payload = {
        name,
        description,
        guidelines: guidelines
          .filter(g => !g._isRemoving)
          .map(({ _tempId, _isRemoving, ...g }) => g),
      };
      const url = isEdit
        ? `/api/growth/programs/${editProgram.program_id}`
        : '/api/growth/programs';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save program');
      }

      toast.success(isEdit ? 'Program updated successfully!' : 'Program created successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    /* Overlay — covers content area only, positioned absolute inside page wrapper */
    <div className="absolute inset-0 z-50 flex flex-col bg-white animate-fade-in" style={{ minHeight: '100%' }}>
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h2 className={`${FONT_DISPLAY} text-[16px] font-bold text-slate-900 leading-tight`}>
              {isEdit ? 'Edit Growth Program' : 'Create Growth Program'}
            </h2>
            <p className="text-[12px] text-slate-400">
              {isEdit ? `Editing: ${editProgram.name}` : 'Configure a new piglet growth template'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body — two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Form */}
        <div className="flex flex-col w-full lg:w-1/2 border-r border-slate-100 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Program Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Program Name *</label>
              <input
                type="text"
                placeholder="e.g. Commercial Fast-Track"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 placeholder:text-slate-300 transition-colors"
              />
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

            {/* Activity Builder */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Timeline Activities</p>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">Define what happens at each milestone day.</p>
                </div>
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

          {/* Footer actions */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Program'}
            </button>
          </div>
        </div>

        {/* RIGHT: Live Timeline Preview */}
        <div className="hidden lg:flex flex-col w-1/2 bg-slate-50/40 overflow-y-auto">
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Preview</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Timeline updates as you add activities</p>
          </div>
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <TimelinePreview guidelines={guidelines} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Template Card                                                          */
/* ---------------------------------------------------------------------- */
/* Template Card                                                          */
/* ---------------------------------------------------------------------- */
function ProgramCard({ program, onEdit, onArchive, viewArchived, onRestore }) {
  const guidelines = program.guidelines || [];
  const sorted = [...guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);
  const totalFeed = sorted
    .filter(g => g.activity_type === 'FEED')
    .reduce((sum, g) => sum + (g.daily_consumption_per_head || 0), 0);

  return (
    <article className="bg-white border border-neutral-200 rounded-2xl px-6 pt-[22px] pb-4 shadow-sm hover:shadow-md transition-shadow tab-enter relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-800 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex gap-4 items-start min-w-0 w-full">
        <div className="flex-none w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-800 shadow-sm border border-emerald-100">
          <ClipboardList className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`${FONT_DISPLAY} text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-800 text-white shadow-sm`}>
              Template
            </span>
            <h3 className={`${FONT_DISPLAY} text-lg font-bold tracking-tight text-neutral-900 truncate`}>
              {program.name}
            </h3>
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-500 line-clamp-2">
            {program.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-neutral-50/80 rounded-xl mt-6 px-4 py-1 border border-neutral-100 overflow-x-auto">
        {sorted.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500 italic py-4">No guidelines configured.</p>
        ) : (
          <div className="relative mt-7 mb-4">
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-neutral-200" aria-hidden="true" />
            <div className="relative flex justify-between gap-2 hide-scrollbar snap-x min-w-max">
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
                    <div className="mt-3 text-center px-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider mb-1 ${style.bg} ${style.text}`}>
                        {g.activity_type}
                      </span>
                      <span className="block text-[11px] font-semibold text-neutral-700 leading-tight">{g.task_name}</span>
                      {g.daily_consumption_per_head > 0 && (
                        <span className="block text-[10px] text-neutral-500 mt-0.5">{g.daily_consumption_per_head} kg/head</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-neutral-100 flex-wrap">
        <span className="flex items-center gap-3 text-[12px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-neutral-400" />
            <strong className="text-neutral-700">{sorted.length} Tasks</strong>
          </span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" aria-hidden="true" />
          <span className="flex items-center gap-1.5">
            <Wheat className="w-3.5 h-3.5 text-neutral-400" />
            <strong className="text-neutral-700">{totalFeed > 0 ? totalFeed.toFixed(2) : '0'} kg</strong> total feed/day
          </span>
        </span>

        <div className="flex items-center gap-2">
          {!viewArchived ? (
            <>
              <button
                onClick={() => onEdit(program)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <span className="w-px h-4 bg-neutral-200" />
              <button
                onClick={() => onArchive(program)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </>
          ) : (
            <button
              onClick={() => onRestore(program)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
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
/* Archive Confirm Modal                                                  */
/* ---------------------------------------------------------------------- */
function ArchiveConfirmModal({ program, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(!!program, onCancel);

  useEffect(() => {
    if (program) {
      setShowSuccess(false);
      setLoading(false);
    }
  }, [program]);

  if (!shouldRender || !program) return null;

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/growth/programs/${program.program_id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Admin' }),
      });
      if (!res.ok) throw new Error('Failed to archive program');
      setShowSuccess(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onSuccess) onSuccess();
    requestClose();
  };

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
              <button 
                onClick={() => { if (!loading) requestClose(); }} 
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Archiving...' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 text-center animate-in zoom-in-95 duration-300 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Program Archived</h3>
            <p className="text-sm text-slate-500 mb-8 max-w-[260px]">
              "{program.name}" has been removed from active templates successfully.
            </p>
            <button
              onClick={handleSuccessClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md shadow-slate-900/10 transition-all"
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
  const [showSuccess, setShowSuccess] = useState(false);
  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(!!program, onCancel);

  useEffect(() => {
    if (program) {
      setShowSuccess(false);
      setLoading(false);
    }
  }, [program]);

  if (!shouldRender || !program) return null;

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/growth/programs/${program.program_id}/restore`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'Admin' }),
      });
      if (!res.ok) throw new Error('Failed to restore program');
      setShowSuccess(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onSuccess) onSuccess();
    requestClose();
  };

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
              <button 
                onClick={() => { if (!loading) requestClose(); }} 
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Restoring...' : 'Yes, Restore'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 text-center animate-in zoom-in-95 duration-300 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Program Restored</h3>
            <p className="text-sm text-slate-500 mb-8 max-w-[260px]">
              "{program.name}" has been restored successfully.
            </p>
            <button
              onClick={handleSuccessClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md shadow-slate-900/10 transition-all"
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
  const [viewArchived, setViewArchived] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => { fetchPrograms(); }, [viewArchived]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/growth/programs?archived=${viewArchived}`);
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

  const totalTasks = programs.reduce((acc, p) => acc + (p.guidelines?.length || 0), 0);
  const incompleteTemplates = programs.filter(p => !p.guidelines || p.guidelines.length === 0).length;

  return (
    <div ref={containerRef} className="relative p-5 lg:p-6 space-y-5 animate-fade-in font-sans text-neutral-900" style={{ minHeight: '100%' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<ClipboardList className="w-6 h-6 text-emerald-600" />} label="Total Templates" value={programs.length} badge="ACTIVE" badgeColor="bg-emerald-100 text-emerald-700" accentColor="bg-emerald-50" loading={loading} />
        <StatCard icon={<Activity className="w-6 h-6 text-indigo-500" />} label="Scheduled Tasks" value={totalTasks} badge="STEPS" badgeColor="bg-indigo-100 text-indigo-700" accentColor="bg-indigo-50" loading={loading} />
        <StatCard icon={<AlertTriangle className={`w-6 h-6 ${incompleteTemplates > 0 ? 'text-rose-600' : 'text-slate-400'}`} />} label="Incomplete Templates" value={incompleteTemplates} badge={incompleteTemplates > 0 ? "WARNING" : "GOOD"} badgeColor={incompleteTemplates > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"} accentColor={incompleteTemplates > 0 ? "bg-rose-50" : "bg-slate-50"} bg={incompleteTemplates > 0 ? "bg-rose-50/60" : "bg-white"} loading={loading} />
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-slate-800">Templates List</h3>
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
            <Plus className="w-3.5 h-3.5" /> Create Template
          </button>
        )}
      </div>

      {/* Program Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800" />
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
            />
          ))}
        </div>
      )}

      {/* Fullscreen Form Modal */}
      <ProgramFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        onSaved={fetchPrograms}
        editProgram={editProgram}
      />

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
    </div>
  );
}
