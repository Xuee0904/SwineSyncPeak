import React, { useState } from 'react';
import { ShieldAlert, CheckSquare, Square, Info, ShieldAlert as AlertTriangle, FileText, ClipboardCheck, ArrowRight, Printer } from 'lucide-react';

export default function Protocols() {
  const [activeLevel, setActiveLevel] = useState('level1');
  const [checkedItems, setCheckedItems] = useState({});

  const levels = {
    level1: {
      title: 'Level 1: General Facility Access',
      subtitle: 'Standard baseline hygiene rules for all visitors, deliveries, and external staff.',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-100',
      iconColor: 'text-emerald-600',
      checklist: [
        { id: 'l1_1', text: 'Register in the SwineSync visitor visitor-log before entry.' },
        { id: 'l1_2', text: 'Pass through the sanitation foot-bath at the primary outer gate.' },
        { id: 'l1_3', text: 'Sanitize hands using the foam dispenser at the lobby entrance.' },
        { id: 'l1_4', text: 'Confirm no contact with external swine herds in the past 72 hours.' },
        { id: 'l1_5', text: 'Equip disposable boot covers and high-visibility vest.' }
      ]
    },
    level2: {
      title: 'Level 2: Controlled Barn Access',
      subtitle: 'Higher strictness zone covering gestation houses, feeding barns, and breeding units.',
      badge: 'bg-amber-50 text-amber-800 border-amber-100',
      iconColor: 'text-amber-600',
      checklist: [
        { id: 'l2_1', text: 'Perform a complete "Shower-in, Shower-out" sequence.' },
        { id: 'l2_2', text: 'Change into color-coded facility-issued overalls and rubber boots.' },
        { id: 'l2_3', text: 'Ensure all equipment/tools pass through the UV disinfection chamber.' },
        { id: 'l2_4', text: 'Log livestock movement commands or audits into the database.' },
        { id: 'l2_5', text: 'Perform visual checking for any visible lesions or abnormal respiration.' }
      ]
    },
    level3: {
      title: 'Level 3: Critical Sterile Zones',
      subtitle: 'Maximum biosafety protocols protecting farrowing chambers, nursery rooms, and quarantine units.',
      badge: 'bg-rose-50 text-rose-800 border-rose-100',
      iconColor: 'text-rose-600',
      checklist: [
        { id: 'l3_1', text: 'Obtain digital authorization approval signature from Lead Veterinarian.' },
        { id: 'l3_2', text: 'Double sanitation wash with surgical-grade hand scrub.' },
        { id: 'l3_3', text: 'Wear secondary sterile head cover, N95 face mask, and latex gloves.' },
        { id: 'l3_4', text: 'Separate work batches: move only from younger livestock sections to older sections.' },
        { id: 'l3_5', text: 'Ensure zero entry of any external organic materials or unchecked instruments.' }
      ]
    }
  };

  const handleToggle = (id) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const currentLevel = levels[activeLevel];
  const completedCount = currentLevel.checklist.filter(item => checkedItems[item.id]).length;
  const progressPercent = Math.round((completedCount / currentLevel.checklist.length) * 100);

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="protocols-section">
      {/* Header Title */}
      <section className="border-b border-slate-100 pb-5">
        <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Biosecurity & Safety Protocols</h1>
        <p className="text-sm text-slate-500 mt-1">
          Strict operational standards designed to preserve herd health and comply with national veterinary guidelines.
        </p>
      </section>

      {/* Emergency Notice banner */}
      <section className="bg-gradient-to-r from-rose-50 to-swine-50 border border-rose-100 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" id="emergency-banner">
        <div className="flex gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-rose-900 text-sm">African Swine Fever (ASF) Alert Level</h3>
            <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
              Standard alert level: <strong>Green/Low Risk</strong>. Follow standard Level 1 and Level 2 protocols daily. Report abnormal behavior immediately.
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          id="print-protocols-btn"
        >
          <Printer className="w-3.5 h-3.5" />
          Print SOP
        </button>
      </section>

      {/* Main Protocols Tabs & Interactive Checklist */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">Access Zones</h3>
          
          <button
            onClick={() => setActiveLevel('level1')}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
              activeLevel === 'level1'
                ? 'bg-white border-primary-600 shadow-md ring-2 ring-primary-500/10'
                : 'bg-white border-slate-100 hover:border-slate-300'
            }`}
            id="tab-level1"
          >
            <div>
              <span className="text-xs font-bold text-slate-400 block">ZONE A</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">Level 1: General</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ${activeLevel === 'level1' ? 'text-primary-600' : ''}`} />
          </button>

          <button
            onClick={() => setActiveLevel('level2')}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
              activeLevel === 'level2'
                ? 'bg-white border-primary-600 shadow-md ring-2 ring-primary-500/10'
                : 'bg-white border-slate-100 hover:border-slate-300'
            }`}
            id="tab-level2"
          >
            <div>
              <span className="text-xs font-bold text-slate-400 block">ZONE B</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">Level 2: Barn Area</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ${activeLevel === 'level2' ? 'text-primary-600' : ''}`} />
          </button>

          <button
            onClick={() => setActiveLevel('level3')}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
              activeLevel === 'level3'
                ? 'bg-white border-primary-600 shadow-md ring-2 ring-primary-500/10'
                : 'bg-white border-slate-100 hover:border-slate-300'
            }`}
            id="tab-level3"
          >
            <div>
              <span className="text-xs font-bold text-slate-400 block">ZONE C</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">Level 3: Sterile</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ${activeLevel === 'level3' ? 'text-primary-600' : ''}`} />
          </button>
        </div>

        {/* Interactive Checklist Board */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between" id="checklist-board">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${currentLevel.badge}`} id="level-badge">
                {currentLevel.title.split(':')[0]}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <ClipboardCheck className="w-4 h-4 text-primary-600" />
                <span>Zone Readiness: <strong>{progressPercent}%</strong></span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold font-display text-slate-800" id="level-title">{currentLevel.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed" id="level-desc">{currentLevel.subtitle}</p>
            </div>

            {/* Visual Progress Bar */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
                id="protocols-progress-bar"
              />
            </div>

            {/* Checklist items */}
            <div className="pt-4 space-y-3" id="checklist-items-container">
              {currentLevel.checklist.map((item) => {
                const isChecked = !!checkedItems[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-primary-50/30 border-primary-200 text-slate-700'
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200'
                    }`}
                    id={`checkbox-item-${item.id}`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-primary-600 fill-primary-100" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </span>
                    <span className="text-sm font-medium leading-relaxed">{item.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 flex gap-3 mt-6">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Every staff member must verify checklists prior to crossing zone thresholds. Failure to follow the Biosecurity Protocols will trigger an automatic event log warning.
            </p>
          </div>
        </div>
      </section>

      {/* Biosecurity Resources section */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm">
        <h3 className="text-lg font-bold font-display text-slate-800">Operational Biosecurity Resources</h3>
        <p className="text-xs text-slate-500 mt-1">Download standard training PDFs and official safety audit logs.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-slate-200 transition-colors">
            <div className="flex gap-3">
              <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 text-sm block">Farm Entry Disinfection Guide</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">PDF • 1.4 MB • Updated May 2026</span>
              </div>
            </div>
            <a href="#" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-semibold text-xs" id="download-guide-1">
              Download
            </a>
          </div>

          <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-slate-200 transition-colors">
            <div className="flex gap-3">
              <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 text-sm block">Livestock Health Inspection Log template</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">PDF • 820 KB • Updated June 2026</span>
              </div>
            </div>
            <a href="#" className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-semibold text-xs" id="download-guide-2">
              Download
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
