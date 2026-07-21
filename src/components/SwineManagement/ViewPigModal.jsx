import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, PiggyBank, Layers, Calendar, MapPin, Activity,
  Scale, Tag, Award, Edit2, Archive, HeartPulse,
  Loader2, AlertCircle, ChevronRight, CheckCircle2,
  PlusCircle, Home, Weight, Baby, Hash, Shuffle, Ruler, ArrowLeft,
  Syringe, ShieldCheck, Stethoscope, Pill, FileText, Clock, User, AlertTriangle, RotateCcw
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import StatusBadge from '../../components/StatusBadge';
import toast from '../../utils/toast';
import { PigEditView } from './EditPigModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant'];
const BATCH_STATUS_OPTIONS = ['Suckling', 'Weaned', 'Nursery', 'Fattening', 'Quarantine'];

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

export default function ViewPigModal({ isOpen, onClose, onSave, onArchive, onUnarchive, pigData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  // mode: 'view' | 'edit' | 'success'
  const [mode, setMode] = useState('view');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'health' | 'vaccinations'

  const [detail, setDetail] = useState(null);
  const [healthLogs, setHealthLogs] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState(null);

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('view');
      setActiveTab('overview');
    }
  }, [isOpen]);

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

      const [res, healthRes, vaccRes] = await Promise.all([
        fetch(`${API_BASE}/api/pigs/${pigData.id}`),
        fetch(`${API_BASE}/api/health-logs?${paramName}=${pigData.id}`).catch(() => null),
        fetch(`${API_BASE}/api/vaccination-records?${paramName}=${pigData.id}`).catch(() => null),
      ]);

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to load details (status ${res.status})`);

      let fLogs = [];
      let fVaccs = [];
      if (healthRes && healthRes.ok) {
        const hBody = await healthRes.json().catch(() => ({ data: [] }));
        fLogs = hBody.data || [];
      }
      if (vaccRes && vaccRes.ok) {
        const vBody = await vaccRes.json().catch(() => ({ data: [] }));
        fVaccs = vBody.data || [];
      }

      setDetail(body.data || pigData);
      setHealthLogs(fLogs);
      setVaccinations(fVaccs);
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
  const stillbornCount = Number(data.stillborn_count || 0);
  const mummyCount = Number(data.mummy_count || 0);
  const currentCount = Number(data.current_count ?? totalBornAlive);
  const totalBorn = totalBornAlive + stillbornCount + mummyCount;
  const survivability = totalBorn > 0 ? ((totalBornAlive / totalBorn) * 100).toFixed(1) : null;

  const sourceOrigin = data.source_origin || data.sourceOrigin || 'born_in_farm';
  const supplierName = data.supplier_name || data.supplierName || null;
  const arrivalDate = data.arrival_date || data.arrivalDate ? String(data.arrival_date || data.arrivalDate).slice(0, 10) : null;

  const switchToEdit = () => {
    if (isArchived) return;
    changeMode('edit');
  };

  const maxWidthClass = mode === 'view' ? 'max-w-3xl' : mode === 'success' ? 'max-w-md' : (isBatch ? 'max-w-3xl' : 'max-w-2xl');

  return createPortal(
      <div
        className={`fixed inset-0 lg:left-60 z-40 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 transition-opacity duration-300 ${overlayClassName}`}
        onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      >
        <div
          style={{ willChange: 'transform, opacity, max-width' }}
          className={`flex max-h-[92vh] flex-col w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative transition-[max-width] duration-300 ease-in-out ${maxWidthClass} ${panelClassName}`}
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
                {/* View Header */}
                <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${isBatch
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-500/20'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                      }`}>
                      {isBatch ? <Layers className="w-7 h-7 text-white" /> : <PiggyBank className="w-7 h-7 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          {isBatch ? 'Piglet Batch' : (data.category || 'Swine Record')}
                        </span>
                        <StatusBadge status={status} />
                        {data.is_archived && (
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1.5">
                            <Archive className="w-3 h-3" />
                            <span>{data.archive_reasoning || 'Archived'}</span>
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black tracking-tight mt-1 text-white">#{tag}</h2>
                      {dob && (
                        <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Date of Birth: <span className="font-semibold text-white">{dob}</span> ({ageWeeks})
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={requestClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer" title="Close modal">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* View Content */}
                <div className="p-6 overflow-y-auto max-h-[88vh] space-y-6 bg-slate-50/50 animate-in fade-in duration-300">
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                      <p className="text-xs font-bold text-slate-500">Loading detailed swine record & health passport...</p>
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

                      {/* Modern Glassmorphism Segmented Tab Navigation */}
                      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-inner">
                        <button
                          type="button"
                          onClick={() => setActiveTab('overview')}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'overview'
                            ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                          <FileText className={`w-4 h-4 ${activeTab === 'overview' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Overview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('health')}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'health'
                            ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                          <Stethoscope className={`w-4 h-4 ${activeTab === 'health' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Health Logs</span>
                          {healthLogs.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'health' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/80 text-slate-700'
                              }`}>
                              {healthLogs.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('vaccinations')}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'vaccinations'
                            ? 'bg-white text-slate-900 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                          <Syringe className={`w-4 h-4 ${activeTab === 'vaccinations' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>Vaccinations</span>
                          {vaccinations.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'vaccinations' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/80 text-slate-700'
                              }`}>
                              {vaccinations.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* TAB 1: OVERVIEW */}
                      {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-emerald-600" /> Core Specifications
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Tag className="w-3.5 h-3.5 text-indigo-500" /> Breed</span>
                                <span className="text-base font-extrabold text-slate-800 truncate" title={breed}>{breed}</span>
                              </div>
                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Scale className="w-3.5 h-3.5 text-amber-500" /> {isBatch ? 'Avg Weight' : 'Weight'}</span>
                                <span className="text-base font-extrabold text-slate-800">{weight != null ? `${Number(weight).toFixed(1)} kg` : '—'}</span>
                              </div>
                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><MapPin className="w-3.5 h-3.5 text-rose-500" /> Pen Location</span>
                                <span className="text-base font-extrabold text-slate-800">{penCode ? penCode : 'Unassigned'}</span>
                              </div>
                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1"><Calendar className="w-3.5 h-3.5 text-emerald-500" /> Age</span>
                                <span className="text-base font-extrabold text-slate-800">{ageWeeks}</span>
                              </div>
                            </div>
                          </div>

                          {isBatch ? (
                            <div className="bg-gradient-to-br from-white to-amber-50/30 rounded-2xl p-5 border border-amber-200/60 shadow-sm space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                  <HeartPulse className="w-4 h-4 text-amber-600" /> Batch Vitals & Survivability Snapshot
                                </h3>
                                {survivability && (
                                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${Number(survivability) >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : Number(survivability) >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>{survivability}% Survivability</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Born Alive</span>
                                  <span className="text-lg font-black text-emerald-600 mt-0.5 block">{totalBornAlive}</span>
                                </div>
                                <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Head Count</span>
                                  <span className="text-lg font-black text-indigo-600 mt-0.5 block">{currentCount}</span>
                                </div>
                                <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stillborn</span>
                                  <span className="text-lg font-black text-slate-700 mt-0.5 block">{stillbornCount}</span>
                                </div>
                                <div className="bg-white rounded-xl p-3.5 border border-amber-100/80 shadow-2xs text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mummies</span>
                                  <span className="text-lg font-black text-rose-600 mt-0.5 block">{mummyCount}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                  <Award className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800">Parity & Production History</h4>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {data.category === 'Sow'
                                      ? `Total Parity Count: ${data.parity_count !== undefined && data.parity_count !== '' ? data.parity_count : 0} litters farrowed.`
                                      : 'Active Breeding Boar assigned to breeding logs.'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                                {data.category === 'Sow' ? `Parity #${data.parity_count ?? 0}` : 'Active Boar'}
                              </span>
                            </div>
                          )}

                          {/* Source Origin & Acquisition Card */}
                          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                <Award className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">Origin & Acquisition Tracking</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {sourceOrigin === 'born_in_farm'
                                    ? 'Born within farm facility (Internal Breeding Cycle)'
                                    : sourceOrigin === 'purchased'
                                      ? `Purchased external inventory${supplierName ? ` from ${supplierName}` : ''}`
                                      : `Transferred from external farm or facility${supplierName ? ` (${supplierName})` : ''}`}
                                  {arrivalDate ? ` • Arrived on ${arrivalDate}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 capitalize">
                              {sourceOrigin === 'born_in_farm' ? 'Born in Farm' : sourceOrigin}
                            </span>
                          </div>

                          {/* Quick Medical & Vaccine Snapshot */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            {/* Health Summary Card */}
                            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Latest Health Check
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {healthLogs.length} total
                                  </span>
                                </div>
                                {healthLogs.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-extrabold text-slate-900 truncate">
                                        {healthLogs[0].diagnosis || 'General Checkup'}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${['sick', 'quarantine'].includes(healthLogs[0].status?.toLowerCase())
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                        {healthLogs[0].status || 'healthy'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 line-clamp-2">
                                      {healthLogs[0].symptoms && healthLogs[0].symptoms !== 'None observed'
                                        ? `Symptoms: ${healthLogs[0].symptoms}`
                                        : healthLogs[0].treatment || 'Routine observation.'}
                                    </p>
                                    <p className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {formatLogDate(healthLogs[0].log_date)} • {healthLogs[0].recorded_by || 'Caretaker'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic py-3">No health logs recorded yet.</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('health')}
                                className="mt-3.5 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                View All Health Logs ({healthLogs.length}) <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Vaccine Summary Card */}
                            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Syringe className="w-3.5 h-3.5 text-indigo-600" /> Latest Vaccination
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {vaccinations.length} total
                                  </span>
                                </div>
                                {vaccinations.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-extrabold text-slate-900 truncate">
                                        {vaccinations[0].vaccine_name}
                                      </span>
                                      {vaccinations[0].dosage && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                          {vaccinations[0].dosage}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600">
                                      Administered on <span className="font-semibold">{formatLogDate(vaccinations[0].administered_date)}</span>
                                      {vaccinations[0].lot_number && ` (Lot: ${vaccinations[0].lot_number})`}
                                    </p>
                                    {vaccinations[0].booster_due_date && (
                                      <p className={`text-[10px] font-bold pt-1 flex items-center gap-1 ${new Date(vaccinations[0].booster_due_date) < new Date() ? 'text-rose-600' : 'text-emerald-600'
                                        }`}>
                                        <Calendar className="w-3 h-3" /> Booster: {formatLogDate(vaccinations[0].booster_due_date)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic py-3">No vaccinations recorded yet.</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('vaccinations')}
                                className="mt-3.5 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                View All Vaccinations ({vaccinations.length}) <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: HEALTH LOGS */}
                      {activeTab === 'health' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Stethoscope className="w-4 h-4 text-emerald-600" /> Medical & Health History
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Detailed log of clinical diagnoses, treatments, medications, and observed symptoms.
                              </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                              {healthLogs.length} {healthLogs.length === 1 ? 'Record' : 'Records'}
                            </span>
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
                                  This swine profile does not have any recorded medical checkups, illness diagnoses, or treatments yet.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 3: VACCINATIONS */}
                      {activeTab === 'vaccinations' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Syringe className="w-4 h-4 text-indigo-600" /> Vaccination & Immunization Passport
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Complete record of administered vaccines, dosages, lot numbers, and scheduled booster dates.
                              </p>
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-800 rounded-xl border border-indigo-100">
                              {vaccinations.length} {vaccinations.length === 1 ? 'Dose' : 'Doses'}
                            </span>
                          </div>

                          {isLoadingLogs ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                              <span className="text-xs font-bold text-slate-500">Loading immunization records...</span>
                            </div>
                          ) : vaccinations.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                              {vaccinations.map((vacc, idx) => {
                                const isBoosterOverdue = vacc.booster_due_date && new Date(vacc.booster_due_date) < new Date();
                                return (
                                  <div key={vacc.vaccination_id || idx} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full -z-0 opacity-80 pointer-events-none" />
                                    <div className="relative z-10 space-y-3.5">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
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
                              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                                <Syringe className="w-8 h-8" />
                              </div>
                              <div className="max-w-sm">
                                <h4 className="text-base font-extrabold text-slate-900">No Vaccinations Recorded</h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  This swine profile has no logged vaccinations or scheduled booster records in the immunization registry.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* View Footer */}
                <div className="px-6 py-4 bg-slate-100 border-t border-slate-200/80 flex items-center justify-between gap-3">
                  <button type="button" onClick={requestClose} className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer">Close</button>
                  <div className="flex items-center gap-2.5">
                    {isArchived ? (
                      onUnarchive && (
                        <button type="button" onClick={() => onUnarchive(data)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
                          <RotateCcw className="w-3.5 h-3.5" /> Unarchive Record
                        </button>
                      )
                    ) : (
                      <>
                        {onArchive && (
                          <button type="button" onClick={() => onArchive(data)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 transition-all cursor-pointer">
                            <Archive className="w-3.5 h-3.5" /> Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={switchToEdit}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit Record <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>{/* end contentRef */}
        </div>
      </div>,
      document.body
    );
  }
