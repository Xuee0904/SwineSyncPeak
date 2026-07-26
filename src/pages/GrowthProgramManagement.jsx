import React, { useState, useEffect } from "react";
import { Plus, ClipboardList, Wheat, Syringe, FlaskConical, Scissors, ArrowRight, Activity, AlertTriangle } from "lucide-react";
import { toast } from "../utils/toast";

const FONT_DISPLAY = "font-['Space_Grotesk',_sans-serif]";

/* ---------------------------------------------------------------------- */
/* Stat Card Component                                                    */
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
/* Helper to map activity type to icon and colors                          */
/* ---------------------------------------------------------------------- */
function getActivityStyling(type) {
  switch (type) {
    case 'FEED':
      return { icon: Wheat, bg: 'bg-[#fbf0dd]', text: 'text-[#b8791f]', border: 'border-[#f2ddba]' };
    case 'MEDICATION':
      return { icon: Syringe, bg: 'bg-[#fbeae6]', text: 'text-[#a8412a]', border: 'border-[#f2c9bf]' };
    case 'SUPPLEMENT':
      return { icon: FlaskConical, bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'PROCEDURE':
    default:
      return { icon: Scissors, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
  }
}

/* ---------------------------------------------------------------------- */
/* Template Timeline Milestone Component                                  */
/* ---------------------------------------------------------------------- */
function TemplateTimeline({ guidelines }) {
  if (!guidelines || guidelines.length === 0) {
    return <p className="text-[12.5px] text-neutral-500 italic py-4">No guidelines configured for this template.</p>;
  }

  return (
    <div className="relative mt-7 mb-4">
      {/* Background Track Line */}
      <div className="absolute top-5 left-8 right-8 h-0.5 bg-neutral-200" aria-hidden="true" />

      {/* Milestones Container */}
      <div className="relative flex justify-between gap-2 overflow-x-auto pb-4 hide-scrollbar snap-x">
        {guidelines.map((g, idx) => {
          const { icon: Icon, bg, text, border } = getActivityStyling(g.activity_type);
          return (
            <div key={g.guideline_id || idx} className="flex flex-col items-center flex-1 min-w-[80px] snap-center group">
              <span className={`block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-2 transition-colors group-hover:text-neutral-600`}>
                Day {g.days_after_birth}
              </span>

              <div className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center bg-white ${border} ${text} relative z-10 transition-transform group-hover:scale-110 shadow-sm`}>
                <Icon className="w-4 h-4" />
              </div>

              <div className="mt-3 text-center px-1">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider mb-1 ${bg} ${text}`}>
                  {g.activity_type}
                </span>
                <span className="block text-[11px] font-semibold text-neutral-700 leading-tight">
                  {g.task_name}
                </span>
                {g.daily_consumption_per_head > 0 && (
                  <span className="block text-[10px] text-neutral-500 mt-0.5">
                    {g.daily_consumption_per_head} kg/head
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gradient fade for scrolling if there are many items */}
      {guidelines.length > 5 && (
        <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-neutral-50 to-transparent pointer-events-none" />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Program Template Card                                                  */
/* ---------------------------------------------------------------------- */
function ProgramCard({ program }) {
  const guidelines = program.guidelines || [];

  // Sort guidelines by days_after_birth
  const sortedGuidelines = [...guidelines].sort((a, b) => a.days_after_birth - b.days_after_birth);

  // Calculate total feed required
  const totalFeed = sortedGuidelines
    .filter(g => g.activity_type === 'FEED')
    .reduce((sum, g) => sum + (g.daily_consumption_per_head || 0), 0);

  return (
    <article className="bg-white border border-neutral-200 rounded-2xl px-6 pt-[22px] pb-4 shadow-sm hover:shadow-md transition-shadow tab-enter relative overflow-hidden group">

      {/* Accent Top Border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-800 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-5 flex-wrap sm:flex-nowrap">
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
      </div>

      <div className="bg-neutral-50/80 rounded-xl mt-6 px-4 py-1 border border-neutral-100">
        <TemplateTimeline guidelines={sortedGuidelines} />
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-neutral-100 flex-wrap">
        <span className="flex items-center gap-3 text-[12px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-neutral-400" />
            <strong className="text-neutral-700">{sortedGuidelines.length} Tasks</strong>
          </span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" aria-hidden="true" />
          <span className="flex items-center gap-1.5">
            <Wheat className="w-3.5 h-3.5 text-neutral-400" />
            <strong className="text-neutral-700">{totalFeed > 0 ? totalFeed.toFixed(2) : '0'} kg</strong> total feed
          </span>
        </span>

        <button className="inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-800 hover:text-emerald-950 transition-colors group/btn">
          Edit Template
          <ArrowRight className="w-3.5 h-3.5 transform group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                   */
/* ---------------------------------------------------------------------- */
export default function GrowthProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/growth/programs');
      if (!res.ok) throw new Error('Failed to fetch growth programs');
      const data = await res.json();
      setPrograms(data);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalTasks = programs.reduce((acc, p) => acc + (p.guidelines?.length || 0), 0);
  const incompleteTemplates = programs.filter(p => !p.guidelines || p.guidelines.length === 0).length;

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in font-sans text-neutral-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&display=swap');
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<ClipboardList className="w-6 h-6 text-emerald-600" />}
          label="Total Templates"
          value={programs.length}
          badge="ACTIVE"
          badgeColor="bg-emerald-100 text-emerald-700"
          accentColor="bg-emerald-50"
          loading={loading}
        />
        <StatCard
          icon={<Activity className="w-6 h-6 text-indigo-500" />}
          label="Scheduled Tasks"
          value={totalTasks}
          badge="STEPS"
          badgeColor="bg-indigo-100 text-indigo-700"
          accentColor="bg-indigo-50"
          loading={loading}
        />
        <StatCard
          icon={<AlertTriangle className={`w-6 h-6 ${incompleteTemplates > 0 ? 'text-rose-600' : 'text-slate-400'}`} />}
          label="Incomplete Templates"
          value={incompleteTemplates}
          badge={incompleteTemplates > 0 ? "WARNING" : "GOOD"}
          badgeColor={incompleteTemplates > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}
          accentColor={incompleteTemplates > 0 ? "bg-rose-50" : "bg-slate-50"}
          bg={incompleteTemplates > 0 ? "bg-rose-50/60" : "bg-white"}
          loading={loading}
        />
      </div>

      <div className="flex items-center justify-between mb-4 mt-2">
        <h3 className="text-sm font-bold text-slate-800">
          Templates List
        </h3>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
          onClick={() => toast.info('Create Template modal coming soon!')}
        >
          <Plus className="w-3.5 h-3.5" />
          Create Template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
        </div>
      ) : programs.length === 0 ? (
        <div className="text-center py-20 bg-white border border-neutral-200 rounded-2xl shadow-sm">
          <p className="text-neutral-500 text-sm font-semibold">No growth programs found in the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {programs.map((program) => (
            <ProgramCard key={program.program_id} program={program} />
          ))}
        </div>
      )}
    </div>
  );
}
