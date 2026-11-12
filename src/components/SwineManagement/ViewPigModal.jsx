import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, PiggyBank, Layers, Calendar, MapPin, Activity,
  Scale, Tag, Award, Edit2, Archive, HeartPulse,
  AlertCircle, ChevronRight, CheckCircle2,
  PlusCircle, Home, Weight, Baby, Hash, Shuffle, Ruler, ArrowLeft,
  Syringe, ShieldCheck, Stethoscope, Pill, FileText, Clock, User, AlertTriangle, RotateCcw,
  Heart, XCircle, Baby as BabyIcon, Target, ChevronDown, Loader2
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import StatusBadge from '../../components/StatusBadge';
import toast from '../../utils/toast';
import { PigEditView } from './EditPigModal';
import AddHealthLogModal from '../HealthManagement/AddHealthLogModal';
import VaccinationFormModal from '../HealthManagement/VaccinationFormModal';
import PigSnout from '../common/PigSnout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant', 'Cull'];
const BATCH_STATUS_OPTIONS = ['Suckling', 'Weaned', 'Nursery', 'Fattening', 'Sick', 'Quarantine'];

const formatLogDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatLogDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

export default function ViewPigModal({ isOpen, onClose, onSave, onArchive, onUnarchive, pigData, loggedInUser }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  // mode: 'view' | 'edit' | 'success'
  const [mode, setMode] = useState('view');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'health' | 'vaccinations'

  const [detail, setDetail] = useState(null);
  const [healthLogs, setHealthLogs] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [breedingHistory, setBreedingHistory] = useState([]);
  const [growthTasks, setGrowthTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState(null);
  const [showAddHealth, setShowAddHealth] = useState(false);
  const [showAddVaccine, setShowAddVaccine] = useState(false);

  // Animated content height
  const tabContentRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(null);

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('view');
      setActiveTab('overview');
    }
  }, [isOpen]);

  // Measure tab content height for smooth animation
  useLayoutEffect(() => {
    if (!tabContentRef.current) return;
    const el = tabContentRef.current;
    const measure = () => setPanelHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode);
  }, []);

  const fetchDetail = useCallback(async (silent = false) => {
    if (!pigData) return;
    if (!silent) {
      setIsLoading(true);
      setIsLoadingLogs(true);
    }
    setError(null);
    try {
      const isBatch = pigData.category === 'Piglet Batch' || Boolean(pigData.batch_tag) || (typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));
      const paramName = isBatch ? 'batch_id' : 'pig_id';
      const isSow = !isBatch && pigData.category === 'Sow';

      const requests = [
        fetch(`${API_BASE}/api/pigs/${pigData.id}`),
        fetch(`${API_BASE}/api/health-logs?${paramName}=${pigData.id}`).catch(() => null),
        fetch(`${API_BASE}/api/vaccination-records?${paramName}=${pigData.id}`).catch(() => null),
        isSow ? fetch(`${API_BASE}/api/breeding-logs/by-sow/${pigData.id}`).catch(() => null) : Promise.resolve(null),
        isBatch ? fetch(`${API_BASE}/api/growth-tasks?batch_id=${pigData.id}`).catch(() => null) : Promise.resolve(null),
      ];

      const [res, healthRes, vaccRes, breedRes, tasksRes] = await Promise.all(requests);

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to load details (status ${res.status})`);

      let fLogs = [];
      let fVaccs = [];
      let fBreeding = [];
      let fTasks = [];
      if (healthRes && healthRes.ok) {
        const hBody = await healthRes.json().catch(() => ({ data: [] }));
        fLogs = hBody.data || [];
      }
      if (vaccRes && vaccRes.ok) {
        const vBody = await vaccRes.json().catch(() => ({ data: [] }));
        fVaccs = vBody.data || [];
      }
      if (breedRes && breedRes.ok) {
        const bBody = await breedRes.json().catch(() => ({ data: [] }));
        fBreeding = bBody.data || [];
      }
      if (tasksRes && tasksRes.ok) {
        const tBody = await tasksRes.json().catch(() => ({ data: [] }));
        fTasks = tBody.data || [];
      }

      setDetail(body.data || pigData);
      setHealthLogs(fLogs);
      setVaccinations(fVaccs);
      setBreedingHistory(fBreeding);
      setGrowthTasks(fTasks);
    } catch (err) {
      setError(err.message || 'Could not fetch full details.');
      setDetail(pigData);
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsLoadingLogs(false);
      }
    }
  }, [pigData]);

  // 1. Fetch detail and health/vaccination records when opened
  useEffect(() => {
    if (!isOpen || !pigData) {
      setDetail(null);
      setHealthLogs([]);
      setVaccinations([]);
      setBreedingHistory([]);
      setError(null);
      return;
    }

    fetchDetail();
  }, [isOpen, pigData, fetchDetail]);

  if (!shouldRender || !pigData) return null;

  // Derive display metrics
  const data = detail || pigData;
  const isBatch = data.category === 'Piglet Batch' || Boolean(data.batch_tag) || (typeof data.pig_tag === 'string' && data.pig_tag.startsWith('BATCH'));
  const isArchived = Boolean(data.is_archived || data.status?.toLowerCase() === 'archived' || onArchive === null);
  const tag = data.pig_tag || data.batch_tag || data.id || '—';
  const breed = data.breed || '—';
  const weight = data.current_weight ?? data.average_weight ?? data.weight ?? null;
  const status = data.status || (isBatch ? 'suckling' : 'healthy');
  const penCode = data.pen_code || '';
  const dob = data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : null;

  let ageWeeks = data.age_weeks;
  if (dob) ageWeeks = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 7));
  if (ageWeeks === undefined || ageWeeks === null || ageWeeks === '—') ageWeeks = '—';
  else ageWeeks = `${ageWeeks} weeks`;

  const totalBornAlive = Number(data.total_born_alive || 0);
  const currentCount = Number(data.current_count ?? totalBornAlive);
  const soldCount = Number(data.sold_count || 0);
  const mortalityLoss = Math.max(0, totalBornAlive - currentCount - soldCount);
  const survivedHeads = Math.min(totalBornAlive, currentCount + soldCount);
  const survivability = totalBornAlive > 0 ? ((survivedHeads / totalBornAlive) * 100).toFixed(1) : null;

  const sourceOrigin = data.source_origin || data.sourceOrigin || 'born_in_farm';
  const supplierName = data.supplier_name || data.supplierName || null;
  const arrivalDate = data.arrival_date || data.arrivalDate ? String(data.arrival_date || data.arrivalDate).slice(0, 10) : null;

  const switchToEdit = () => {
    if (isArchived) return;
    changeMode('edit');
  };

  const maxWidthClass = mode === 'view' ? 'max-w-4xl' : mode === 'success' ? 'max-w-md' : 'max-w-2xl';

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-40 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 transition-opacity duration-300 ${overlayClassName}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        style={{ willChange: 'transform, opacity, max-width' }}
        className={`flex max-h-[92vh] flex-col w-full bg-white rounded-3xl shadow-2xl overflow-hidden relative transition-[max-width] duration-300 ease-in-out ${maxWidthClass} ${panelClassName}`}
      >
        <div className="flex flex-col w-full animate-in fade-in duration-300 overflow-y-auto">

          {/* ──── EDIT OR SUCCESS VIEW ──── */}
          {mode === 'edit' || mode === 'success' ? (
            <PigEditView
              pigData={data}
              onSave={onSave}
              onCancel={() => setMode('view')}
              onBack={() => setMode('view')}
              onClose={() => requestClose()}
              showBackBtn={true}
              onSuccess={(savedRecord) => {
                if (savedRecord) setDetail(savedRecord);
                fetchDetail(true);
                setMode('success');
              }}
            />

            /* ──── VIEW MODE ──── */
          ) : (
            <>
              {/* View Header — Clean Solid Color (Zero Gradients) */}
              <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between gap-4 rounded-t-3xl border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isBatch
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-600 text-white'
                    }`}>
                    {isBatch ? <Layers className="w-5 h-5 text-white" /> : <PigSnout className="w-6 h-6 text-white" />}
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none mr-1">#{tag}</h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                        {isBatch ? 'Piglet Batch' : (data.category || 'Swine Record')}
                      </span>
                      <StatusBadge status={status} />
                      {data.is_archived && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800 flex items-center gap-1.5">
                          <Archive className="w-3 h-3 text-amber-400" />
                          <span>{data.archive_reasoning || 'Archived'}</span>
                        </span>
                      )}
                    </div>
                    {dob && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Born <span className="font-bold text-slate-200">{dob}</span> <span className="mx-0.5 text-slate-600">•</span> <span className="text-slate-300">{ageWeeks}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* View Content — height-animated shell */}
              <div
                style={{
                  height: panelHeight != null ? `${panelHeight}px` : 'auto',
                  transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'height',
                  overflow: 'hidden',
                  maxHeight: '70vh',
                  overflowY: panelHeight != null && panelHeight > window.innerHeight * 0.68 ? 'auto' : 'hidden',
                }}
              >
                {/* Inner content — this is what ResizeObserver measures */}
                <div ref={tabContentRef} className="p-5 space-y-4 bg-slate-50/60">
                  {isLoading ? (
                    /* ── Skeleton Loader ───────────────────────────────── */
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* Tab bar skeleton */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="flex-1 h-8 skeleton rounded-lg" />
                        ))}
                      </div>

                      {/* Core specs card skeleton */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <div className="skeleton h-3.5 w-36 rounded" />
                          <div className="skeleton h-3 w-20 rounded" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="space-y-1.5">
                              <div className="skeleton h-3 w-16 rounded" />
                              <div className="skeleton h-5 w-28 rounded" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Care summary skeleton */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <div className="skeleton h-3.5 w-48 rounded" />
                          <div className="skeleton h-3 w-24 rounded" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 gap-y-4 md:gap-y-0">
                          <div className="md:pr-6 space-y-2.5">
                            <div className="skeleton h-3.5 w-28 rounded" />
                            <div className="skeleton h-4 w-3/4 rounded" />
                            <div className="skeleton h-3 w-1/2 rounded" />
                          </div>
                          <div className="pt-4 md:pt-0 md:pl-6 space-y-2.5">
                            <div className="skeleton h-3.5 w-28 rounded" />
                            <div className="skeleton h-4 w-3/4 rounded" />
                            <div className="skeleton h-3 w-1/2 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {error && (
                        <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2 text-xs text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      {data.is_archived && (
                        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                            <Archive className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-amber-900">Archived Swine Record</h4>
                            <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                              Reason: <span className="font-bold">{data.archive_reasoning || 'Not specified'}</span>
                              {data.archived_at && ` • Archived on ${new Date(data.archived_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Slim Segmented Tab Navigation */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70">
                        <button
                          type="button"
                          onClick={() => setActiveTab('overview')}
                          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'overview'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                            }`}
                        >
                          <FileText className={`w-3.5 h-3.5 ${activeTab === 'overview' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Overview</span>
                        </button>
                        {!isBatch && data.category === 'Sow' && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('breeding')}
                            className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'breeding'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                              }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${activeTab === 'breeding' ? 'text-rose-500' : 'text-slate-400'}`} />
                            <span>Breeding</span>
                            {breedingHistory.length > 0 && (
                              <span className={`px-1.5 py-px rounded-full text-[10px] font-black leading-none ${activeTab === 'breeding' ? 'bg-rose-100 text-rose-700' : 'bg-slate-300/80 text-slate-600'}`}>
                                {breedingHistory.length}
                              </span>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab('health')}
                          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'health'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                            }`}
                        >
                          <Stethoscope className={`w-3.5 h-3.5 ${activeTab === 'health' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Health</span>
                          {healthLogs.length > 0 && (
                            <span className={`px-1.5 py-px rounded-full text-[10px] font-black leading-none ${activeTab === 'health' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-300/80 text-slate-600'}`}>
                              {healthLogs.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('vaccinations')}
                          className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'vaccinations'
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                            }`}
                        >
                          <Syringe className={`w-3.5 h-3.5 ${activeTab === 'vaccinations' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Vaccines</span>
                          {vaccinations.length > 0 && (
                            <span className={`px-1.5 py-px rounded-full text-[10px] font-black leading-none ${activeTab === 'vaccinations' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-300/80 text-slate-600'}`}>
                              {vaccinations.length}
                            </span>
                          )}
                        </button>
                        {/* Growth Program Tab (Batches Only) */}
                        {isBatch && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('growth')}
                            className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'growth'
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                              }`}
                          >
                            <Target className={`w-3.5 h-3.5 ${activeTab === 'growth' ? 'text-amber-600' : 'text-slate-400'}`} />
                            <span>Growth</span>
                          </button>
                        )}
                      </div>

                      {/* TAB 1: OVERVIEW */}
                      {activeTab === 'overview' && (
                        <div className="space-y-4 tab-enter-stagger">
                          {/* SECTION 1: CORE SPECIFICATIONS (Semantic 3-Column Layout) */}
                          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-emerald-600" /> Core Specifications
                              </h3>
                              <span className="text-[11px] font-semibold text-slate-400">
                                {isBatch ? 'Batch Profile' : `${data.category || 'Swine'} Record`}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
                              {/* Row 1 / Col 1: Breed (Identity) */}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Breed
                                </span>
                                <span className="text-sm sm:text-base font-extrabold text-slate-800 truncate" title={breed}>{breed}</span>
                              </div>

                              {/* Row 1 / Col 2: Pen Location (Housing) */}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Pen Location
                                </span>
                                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                                  {penCode ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                                        {penCode}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Unassigned</span>
                                  )}
                                </span>
                              </div>

                              {/* Row 1 / Col 3: Age & Date of Birth (Life Stage) */}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Age
                                </span>
                                <span className="text-sm sm:text-base font-extrabold text-slate-800">
                                  {ageWeeks}
                                </span>
                                {dob && <span className="text-xs font-medium text-slate-400 mt-0.5">Born {dob}</span>}
                              </div>

                              {/* Row 2 / Col 1: Origin (Source Lineage) */}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                  <Home className="w-3.5 h-3.5 text-slate-400" /> Origin
                                </span>
                                <span className="text-sm sm:text-base font-extrabold text-slate-800 truncate" title={
                                  sourceOrigin === 'born_in_farm' ? 'Born in Farm'
                                    : sourceOrigin === 'purchased' ? `Purchased${supplierName ? ` · ${supplierName}` : ''}`
                                      : `Transferred${supplierName ? ` · ${supplierName}` : ''}`
                                }>
                                  {sourceOrigin === 'born_in_farm' ? 'Born in Farm'
                                    : sourceOrigin === 'purchased' ? `Purchased${supplierName ? ` · ${supplierName}` : ''}`
                                      : `Transferred${supplierName ? ` · ${supplierName}` : ''}`}
                                </span>
                                {arrivalDate && (
                                  <span className="text-xs text-slate-400 font-medium mt-0.5">Arrived {arrivalDate}</span>
                                )}
                              </div>

                              {/* Row 2 / Col 2: Weight (Physical Vitals) */}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                  <Scale className="w-3.5 h-3.5 text-slate-400" /> {isBatch ? 'Average Weight' : 'Weight'}
                                </span>
                                <span className={weight != null ? 'text-sm sm:text-base font-extrabold text-slate-800' : 'text-sm font-semibold text-slate-400'}>
                                  {weight != null ? `${Number(weight).toFixed(1)} kg` : 'Not weighed'}
                                </span>
                              </div>

                              {/* Row 2 / Col 3: Parity / Role / Mother Sow (Reproduction / Status) */}
                              {isBatch ? (
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                    <Award className="w-3.5 h-3.5 text-slate-400" /> Mother Sow
                                  </span>
                                  <span className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                                    {data.sow_tag ? `#${data.sow_tag}` : <span className="text-slate-400 font-medium">None / Unknown</span>}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                                    <Award className="w-3.5 h-3.5 text-slate-400" />
                                    {data.category === 'Sow' ? 'Parity' : 'Role'}
                                  </span>
                                  <span className="text-sm sm:text-base font-extrabold text-slate-800">
                                    {data.category === 'Sow'
                                      ? (Number(data.parity_count ?? 0) === 0
                                        ? '0 (Gilt — Not yet farrowed)'
                                        : `#${data.parity_count} (${data.parity_count === 1 ? '1 litter' : `${data.parity_count} litters`} farrowed)`)
                                      : 'Active Breeding Boar'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* BATCH VITALS & SURVIVABILITY (Batches Only) */}
                          {isBatch && (
                            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3.5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                  <HeartPulse className="w-3.5 h-3.5 text-amber-600" /> Batch Vitals & Survivability
                                </h3>
                                {survivability && (
                                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${Number(survivability) >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : Number(survivability) >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>{survivability}% Survivability</span>
                                )}
                              </div>
                              <div className={`grid gap-3 ${soldCount > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Initial Heads</span>
                                  <span className="text-base font-black text-slate-800 mt-0.5 block">{totalBornAlive}</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Heads</span>
                                  <span className="text-base font-black text-emerald-600 mt-0.5 block">{currentCount}</span>
                                </div>
                                {soldCount > 0 && (
                                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sold / Marketed</span>
                                    <span className="text-base font-black text-blue-600 mt-0.5 block">{soldCount}</span>
                                  </div>
                                )}
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mortality Loss</span>
                                  <span className={`text-base font-black mt-0.5 block ${mortalityLoss > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{mortalityLoss}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SECTION 2: HEALTH & IMMUNIZATION CARE SUMMARY (Clean Open Split Layout) */}
                          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Recent Care & Medical Summary
                              </h3>
                              <span className="text-[11px] font-semibold text-slate-400">Latest activity</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 gap-y-5 md:gap-y-0">
                              {/* Health Status Column */}
                              <div className="flex flex-col justify-between md:pr-6 min-h-[110px]">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                      <HeartPulse className="w-3.5 h-3.5 text-emerald-600" /> Health Inspection
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                      {healthLogs.length} total {healthLogs.length === 1 ? 'log' : 'logs'}
                                    </span>
                                  </div>

                                  {healthLogs.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-extrabold text-slate-900 truncate">
                                          {healthLogs[0].diagnosis || 'Routine Checkup'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${['sick', 'quarantine'].includes(healthLogs[0].status?.toLowerCase())
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                          {healthLogs[0].status || 'Healthy'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 line-clamp-1">
                                        {healthLogs[0].treatment || healthLogs[0].symptoms || 'Normal condition observed.'}
                                      </p>
                                      <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {formatLogDate(healthLogs[0].log_date)}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic py-1 leading-relaxed">
                                      No health logs recorded yet. {isBatch ? 'Batch' : 'Swine'} is marked as <strong className="font-semibold text-slate-600 capitalize">{status}</strong>.
                                    </p>
                                  )}
                                </div>

                                <div className="pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('health')}
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start transition-colors cursor-pointer group"
                                  >
                                    <span>View health history</span>
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Vaccination Status Column */}
                              <div className="flex flex-col justify-between pt-4 md:pt-0 md:pl-6 min-h-[110px]">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                      <Syringe className="w-3.5 h-3.5 text-emerald-600" /> Immunization
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                      {vaccinations.length} total {vaccinations.length === 1 ? 'dose' : 'doses'}
                                    </span>
                                  </div>

                                  {vaccinations.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-extrabold text-slate-900 truncate">
                                          {vaccinations[0].vaccine_name}
                                        </span>
                                        {vaccinations[0].dosage && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                            {vaccinations[0].dosage}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500">
                                        Administered on {formatLogDate(vaccinations[0].administered_date)}
                                      </p>
                                      {vaccinations[0].booster_due_date && (
                                        <p className={`text-[11px] font-bold pt-1 flex items-center gap-1 ${new Date(vaccinations[0].booster_due_date) < new Date() ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          <Calendar className="w-3 h-3" /> Booster: {formatLogDate(vaccinations[0].booster_due_date)}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic py-1 leading-relaxed">
                                      No vaccination doses recorded yet. Up to date on farm protocols.
                                    </p>
                                  )}
                                </div>

                                <div className="pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('vaccinations')}
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start transition-colors cursor-pointer group"
                                  >
                                    <span>View immunization passport</span>
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB: BREEDING HISTORY */}
                      {activeTab === 'breeding' && !isBatch && data.category === 'Sow' && (
                        <div className="space-y-4 tab-enter-stagger">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Heart className="w-4 h-4 text-rose-500" /> Reproductive & Breeding History
                              </h3>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-800 rounded-xl border border-rose-100">
                              {breedingHistory.length} {breedingHistory.length === 1 ? 'Cycle' : 'Cycles'}
                            </span>
                          </div>

                          {isLoadingLogs ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                              <span className="text-xs font-bold text-slate-500">Loading breeding records...</span>
                            </div>
                          ) : breedingHistory.length > 0 ? (
                            <div className="relative border-l-2 border-rose-200/60 ml-3 pl-6 space-y-5 py-2">
                              {breedingHistory.map((cycle, idx) => {
                                const status = cycle.breeding_status;
                                const isActive = status === 'pending' || status === 'pregnant';
                                const isFarrowed = status === 'farrowed';
                                const isFailed = status === 'failed';
                                const isArchivedCycle = cycle.is_archived;

                                const dotColor = isArchivedCycle
                                  ? 'bg-slate-400'
                                  : isFarrowed ? 'bg-emerald-500'
                                    : isFailed ? 'bg-rose-500'
                                      : isActive ? 'bg-blue-500'
                                        : 'bg-slate-400';

                                const statusLabel = isArchivedCycle ? 'Archived'
                                  : status === 'pregnant' ? 'Pregnant'
                                    : status === 'pending' ? 'Monitoring'
                                      : status === 'farrowed' ? 'Farrowed'
                                        : status === 'failed' ? 'Failed / Miscarriage'
                                          : status;

                                const statusColor = isArchivedCycle
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : isFarrowed ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : isFailed ? 'bg-rose-100 text-rose-800 border-rose-200'
                                      : isActive ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200';

                                const cycleNumber = breedingHistory.length - idx;

                                return (
                                  <div key={cycle.breeding_id} className="relative group">
                                    <span className={`absolute -left-[31px] top-4 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-slate-50 transition-transform group-hover:scale-125 ${dotColor}`} />
                                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-4">
                                      {/* Header */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isFarrowed ? 'bg-emerald-50 text-emerald-600'
                                            : isFailed ? 'bg-rose-50 text-rose-500'
                                              : isActive ? 'bg-blue-50 text-blue-500'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            <Heart className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <span className="text-sm font-black text-slate-900">Breeding Cycle #{cycleNumber}</span>
                                            <p className="text-[11px] text-slate-500 font-medium">
                                              {cycle.breeding_method === 'AI' ? 'Artificial Insemination' : 'Natural Mating'}
                                              {cycle.boar_tag ? ` · Boar #${cycle.boar_tag}` : ''}
                                            </p>
                                          </div>
                                        </div>
                                        <span className={`self-start sm:self-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusColor}`}>
                                          {statusLabel}
                                        </span>
                                      </div>

                                      {/* Key dates grid */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Mating Date</span>
                                          <span className="text-sm font-extrabold text-slate-800">{formatLogDate(cycle.breeding_date)}</span>
                                        </div>
                                        <div className={`rounded-xl p-3 border ${cycle.heat_check_date ? 'bg-amber-50/80 border-amber-100' : 'bg-slate-50/80 border-slate-100'}`}>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Heat Check</span>
                                          <span className={`text-sm font-extrabold ${cycle.heat_check_date ? 'text-amber-700' : 'text-slate-400'}`}>
                                            {formatLogDate(cycle.heat_check_date) || 'Pending'}
                                          </span>
                                        </div>
                                        <div className={`rounded-xl p-3 border ${cycle.preg_check_date ? 'bg-blue-50/80 border-blue-100' : 'bg-slate-50/80 border-slate-100'}`}>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Preg. Confirmed</span>
                                          <span className={`text-sm font-extrabold ${cycle.preg_check_date ? 'text-blue-700' : 'text-slate-400'}`}>
                                            {formatLogDate(cycle.preg_check_date) || 'Pending'}
                                          </span>
                                        </div>
                                        <div className={`rounded-xl p-3 border ${cycle.actual_farrowing_date ? 'bg-emerald-50/80 border-emerald-100' : 'bg-slate-50/80 border-slate-100'}`}>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                                            {cycle.actual_farrowing_date ? 'Farrowed On' : 'Expected Farrow'}
                                          </span>
                                          <span className={`text-sm font-extrabold ${cycle.actual_farrowing_date ? 'text-emerald-700' : 'text-slate-500'}`}>
                                            {formatLogDate(cycle.actual_farrowing_date || cycle.expected_farrowing_date) || '—'}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Archive reason if archived */}
                                      {isArchivedCycle && cycle.archive_reason && (
                                        <div className="flex items-center gap-2.5 bg-amber-50/70 rounded-xl p-3 border border-amber-100/80 text-xs">
                                          <Archive className="w-4 h-4 text-amber-600 shrink-0" />
                                          <div>
                                            <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wide">Archive Reason</span>
                                            <p className="text-slate-700 mt-0.5">{cycle.archive_reason}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Notes if present */}
                                      {cycle.notes && (
                                        <div className="flex items-start gap-2.5 bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-xs">
                                          <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                          <div>
                                            <span className="font-bold text-slate-600 block text-[11px] uppercase tracking-wide">Notes</span>
                                            <p className="text-slate-700 mt-0.5 italic">{cycle.notes}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-3.5">
                              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-400 shadow-inner">
                                <Heart className="w-8 h-8" />
                              </div>
                              <div className="max-w-sm">
                                <h4 className="text-base font-extrabold text-slate-900">No Breeding Cycles Recorded</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  This sow has no logged breeding cycles or reproductive history yet.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: HEALTH LOGS */}
                      {activeTab === 'health' && (
                        <div className="space-y-4 tab-enter-stagger">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Stethoscope className="w-4 h-4 text-emerald-600" /> Medical & Health History
                              </h3>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 hidden sm:inline-block">
                                {healthLogs.length} {healthLogs.length === 1 ? 'Record' : 'Records'}
                              </span>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => setShowAddHealth(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Add Log
                                </button>
                              )}
                            </div>
                          </div>

                          {isLoadingLogs ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                              <span className="text-xs font-bold text-slate-500">Loading health records...</span>
                            </div>
                          ) : healthLogs.length > 0 ? (
                            <div className="relative border-l-2 border-emerald-500/20 ml-3 pl-6 space-y-5 py-2">
                              {healthLogs.map((log, idx) => {
                                const statusLower = (log.status || 'healthy').toLowerCase();
                                const isSick = statusLower === 'sick' || statusLower === 'quarantine' || statusLower === 'under treatment';
                                return (
                                  <div key={log.health_id || idx} className="relative group">
                                    <span className={`absolute -left-[31px] top-4 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-slate-50 transition-transform group-hover:scale-125 ${isSick ? 'bg-rose-500' : 'bg-emerald-500'
                                      }`} />
                                    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                          <span className="text-sm font-black text-slate-900">
                                            {log.diagnosis || 'Routine Health Check'}
                                          </span>
                                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${isSick ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                            }`}>
                                            {log.status || 'Healthy'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                                          <span>{formatLogDateTime(log.log_date)}</span>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Symptoms Observed</span>
                                          <p className="font-semibold text-slate-700">
                                            {log.symptoms || 'None observed during inspection.'}
                                          </p>
                                        </div>
                                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Treatment Protocol</span>
                                          <p className="font-semibold text-slate-700">
                                            {log.treatment || 'No specific treatment required.'}
                                          </p>
                                        </div>
                                      </div>

                                      {(log.medication_name || log.dosage) && (
                                        <div className="flex items-center gap-3 bg-emerald-50/60 rounded-xl p-3 border border-emerald-100/80 text-xs">
                                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                                            <Pill className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Medication Administered</span>
                                            <p className="font-extrabold text-slate-800">
                                              {log.medication_name || 'Unspecified medication'} {log.dosage ? `— Dosage: ${log.dosage}` : ''}
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {log.notes && (
                                        <div className="text-xs text-slate-600 bg-amber-50/50 rounded-xl p-3 border border-amber-100/60 flex items-start gap-2">
                                          <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                          <div>
                                            <span className="font-bold text-amber-900 block text-[11px]">Caretaker Notes</span>
                                            <p className="text-slate-700 mt-0.5 italic">{log.notes}</p>
                                          </div>
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
                                        <span className="flex items-center gap-1 font-medium">
                                          <User className="w-3 h-3 text-slate-400" /> Recorded by: <strong className="text-slate-600 font-bold">{log.recorded_by || 'Staff Caretaker'}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-3.5">
                              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                                <HeartPulse className="w-8 h-8" />
                              </div>
                              <div className="max-w-sm">
                                <h4 className="text-base font-extrabold text-slate-900">No Health Logs Recorded</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  This {isBatch ? 'piglet batch' : 'swine profile'} does not have any recorded medical checkups, illness diagnoses, or treatments yet.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 3: VACCINATIONS */}
                      {activeTab === 'vaccinations' && (
                        <div className="space-y-4 tab-enter-stagger">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Syringe className="w-4 h-4 text-emerald-600" /> Vaccination & Immunization History
                              </h3>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 hidden sm:inline-block">
                                {vaccinations.length} {vaccinations.length === 1 ? 'Dose' : 'Doses'}
                              </span>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => setShowAddVaccine(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Add Vaccine
                                </button>
                              )}
                            </div>
                          </div>

                          {isLoadingLogs ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                              <span className="text-xs font-bold text-slate-500">Loading immunization records...</span>
                            </div>
                          ) : vaccinations.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                              {vaccinations.map((vacc, idx) => {
                                const isBoosterOverdue = vacc.booster_due_date && new Date(vacc.booster_due_date) < new Date();
                                return (
                                  <div key={vacc.vaccination_id || idx} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                    <div className="relative z-10 space-y-3.5">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                            <ShieldCheck className="w-5 h-5" />
                                          </div>
                                          <div>
                                            <h4 className="text-base font-black text-slate-900 capitalize">
                                              {vacc.vaccine_name}
                                            </h4>
                                            <p className="text-xs text-slate-500 font-medium">
                                              Administered on <span className="text-slate-800 font-bold">{formatLogDate(vacc.administered_date)}</span>
                                            </p>
                                          </div>
                                        </div>

                                        {vacc.lot_number && (
                                          <span className="self-start sm:self-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px] font-bold border border-slate-200">
                                            Lot: {vacc.lot_number}
                                          </span>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50/80 rounded-xl p-3.5 border border-slate-100">
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Dosage</span>
                                          <span className="font-extrabold text-slate-800 text-sm">{vacc.dosage || 'Standard Dose'}</span>
                                        </div>
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Administered By</span>
                                          <span className="font-extrabold text-slate-800 text-sm truncate block">{vacc.administered_by || 'Staff Caretaker'}</span>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Booster Schedule</span>
                                          <span className={`font-extrabold text-sm ${!vacc.booster_due_date ? 'text-slate-500' : isBoosterOverdue ? 'text-rose-600' : 'text-emerald-700'
                                            }`}>
                                            {vacc.booster_due_date ? formatLogDate(vacc.booster_due_date) : 'No booster required'}
                                          </span>
                                        </div>
                                      </div>

                                      {vacc.booster_due_date && (
                                        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${isBoosterOverdue
                                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          }`}>
                                          <div className="flex items-center gap-2">
                                            {isBoosterOverdue ? <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /> : <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />}
                                            <span>
                                              {isBoosterOverdue ? 'Booster Shot Overdue' : 'Scheduled Booster Shot'} — Due on {formatLogDate(vacc.booster_due_date)}
                                            </span>
                                          </div>
                                          {isBoosterOverdue && (
                                            <span className="px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 text-[10px] uppercase font-black tracking-wider">
                                              Action Needed
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-3.5">
                              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                                <Syringe className="w-8 h-8" />
                              </div>
                              <div className="max-w-sm">
                                <h4 className="text-base font-extrabold text-slate-900">No Vaccinations Recorded</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  This {isBatch ? 'piglet batch' : 'swine profile'} has no logged vaccinations or scheduled booster records in the immunization registry.
                                </p>
                              </div>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => setShowAddVaccine(true)}
                                  className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" /> Record First Vaccine
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Growth Program Content (Batches Only) */}
                      {activeTab === 'growth' && isBatch && (() => {
                        const totalTasks = growthTasks.length;
                        const completedTasks = growthTasks.filter(t => t.status === 'completed').length;
                        const overdueTasks = growthTasks.filter(t => t.status !== 'completed' && new Date(t.due_date) < new Date()).length;
                        const pendingTasks = totalTasks - completedTasks;
                        const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                        const programName = growthTasks[0]?.growth_programs?.name || data.program_name || 'Assigned Growth Program';

                        return (
                          <div className="space-y-4 animate-in fade-in duration-300">
                            {totalTasks === 0 ? (
                              <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-3.5">
                                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                                  <Layers className="w-8 h-8" />
                                </div>
                                <div className="max-w-sm">
                                  <h4 className="text-base font-extrabold text-slate-900">No Growth Program Assigned</h4>
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    This batch has not been assigned to a growth schedule or feeding & immunization protocol yet.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Program Progress Summary Card */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                        <Target className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h3 className="text-sm font-black text-slate-900">{programName}</h3>
                                        <p className="text-[11px] text-slate-400 font-medium">Batch Protocol & Milestone Timeline</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                        {completedTasks} / {totalTasks} Completed ({progressPct}%)
                                      </span>
                                    </div>
                                  </div>

                                  {/* Progress Bar & Sub-stats */}
                                  <div className="space-y-1.5">
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-0.5">
                                      <span className="text-emerald-700 font-bold">{completedTasks} Completed</span>
                                      {overdueTasks > 0 && <span className="text-rose-600 font-bold">{overdueTasks} Overdue</span>}
                                      <span className="text-slate-600 font-medium">{pendingTasks} Pending</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Milestone Tasks List */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Milestone Schedule</h4>
                                    <span className="text-[11px] font-semibold text-slate-400">{totalTasks} scheduled milestones</span>
                                  </div>

                                  <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-2">
                                    {growthTasks.map((task, idx) => {
                                      const isDone = task.status === 'completed';
                                      const isOverdue = !isDone && new Date(task.due_date) < new Date();
                                      const formattedDueDate = formatLogDate(task.due_date);

                                      const typeLower = (task.activity_type || '').toLowerCase();
                                      const typeBadge = typeLower === 'feed'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : typeLower === 'medication'
                                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                                          : typeLower === 'procedure'
                                            ? 'bg-slate-100 text-slate-800 border-slate-200'
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                                      return (
                                        <div
                                          key={task.task_id || idx}
                                          className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                                            isDone
                                              ? 'bg-emerald-50/30 border border-emerald-100/70'
                                              : isOverdue
                                                ? 'bg-rose-50/30 border border-rose-100/80'
                                                : 'bg-slate-50/80 border border-slate-100'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                              isDone
                                                ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                                                : isOverdue
                                                  ? 'bg-rose-100 border-rose-200 text-rose-600'
                                                  : 'bg-white border-slate-200 text-slate-400'
                                            }`}>
                                              {isDone ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                              ) : (
                                                <Clock className="w-4 h-4" />
                                              )}
                                            </div>

                                            <div className="min-w-0">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeBadge}`}>
                                                  {task.activity_type || 'Task'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                  Due {formattedDueDate}
                                                </span>
                                              </div>
                                              <h5 className={`text-xs font-black text-slate-800 truncate ${isDone ? 'line-through text-slate-400' : ''}`}>
                                                {task.task_name}
                                              </h5>
                                            </div>
                                          </div>

                                          <div className="shrink-0 flex items-center gap-2">
                                            {isDone ? (
                                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Done
                                              </span>
                                            ) : isOverdue ? (
                                              <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[10px] uppercase tracking-wider border border-rose-200 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Overdue
                                              </span>
                                            ) : (
                                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider border border-slate-200">
                                                Pending
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>{/* end tabContentRef inner */}
              </div>{/* end animated height shell */}

              {/* View Footer — Standardized */}
              <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={requestClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2.5">
                  {isArchived ? (
                    onUnarchive && (
                      <button
                        type="button"
                        onClick={() => onUnarchive(data)}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Unarchive Record</span>
                      </button>
                    )
                  ) : (
                    <>
                      {onArchive && (
                        <button
                          type="button"
                          onClick={() => onArchive(data)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={switchToEdit}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Record</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

        </div>{/* end contentRef */}
      </div>

      {/* --- Health & Vaccine Modals --- */}
      <AddHealthLogModal
        open={showAddHealth}
        onClose={() => setShowAddHealth(false)}
        prefillData={pigData ? { id: pigData.id, tag: tag, category: pigData.category || (isBatch ? 'Piglet Batch' : 'Pig'), targetType: isBatch ? 'batch' : 'pig' } : null}
        currentUser={loggedInUser}
        onSuccess={() => {
          fetchDetail(true);
          setShowAddHealth(false);
        }}
      />

      <VaccinationFormModal
        open={showAddVaccine}
        onClose={() => setShowAddVaccine(false)}
        prefillData={pigData ? { id: pigData.id, tag: tag, category: pigData.category || (isBatch ? 'Piglet Batch' : 'Pig'), targetType: isBatch ? 'batch' : 'pig' } : null}
        currentUser={loggedInUser}
        onSuccess={() => {
          fetchDetail(true);
          setShowAddVaccine(false);
        }}
      />
    </div>,
    document.body
  );
}
