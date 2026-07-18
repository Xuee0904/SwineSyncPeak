import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, PiggyBank, Layers, Calendar, MapPin, Activity, 
  Scale, Tag, Award, Edit2, Archive, HeartPulse, 
  Loader2, AlertCircle, ChevronRight, CheckCircle2,
  PlusCircle, Home, Weight, Baby, Hash, Shuffle, Ruler, ArrowLeft
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import StatusBadge from '../../components/StatusBadge';
import toast from '../../utils/toast';
import { EditPigForm } from './EditPigModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STATUS_OPTIONS = ['Healthy', 'Sick', 'Quarantine', 'Pregnant'];
const BATCH_STATUS_OPTIONS = ['Suckling', 'Weaned', 'Nursery', 'Fattening', 'Quarantine'];

export default function ViewPigModal({ isOpen, onClose, onSave, onArchive, pigData }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  // mode: 'view' | 'edit' | 'success'
  const [mode, setMode] = useState('view');

  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [successInfo, setSuccessInfo] = useState(null);

  // Edit dependencies
  const [pens, setPens] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const isBatch = pigData?.category === 'Piglet Batch' || 
    Boolean(pigData?.batch_tag) || 
    (pigData && typeof pigData.pig_tag === 'string' && pigData.pig_tag.startsWith('BATCH'));

  // Reset mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('view');
      setSuccessInfo(null);
    }
  }, [isOpen]);

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode);
  }, []);

  // 1. Fetch detail when opened
  useEffect(() => {
    if (!isOpen || !pigData) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/pigs/${pigData.id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed to load details (status ${res.status})`);
        if (cancelled) return;
        setDetail(body.data || pigData);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not fetch full details.');
          setDetail(pigData);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => { cancelled = true; };
  }, [isOpen, pigData]);

  // 2. Fetch pens & breeds when switching to edit mode
  useEffect(() => {
    if (mode !== 'edit') return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingData(true);
      try {
        const [pensRes, breedsRes] = await Promise.all([
          fetch(`${API_BASE}/api/pens/available`).then(r => r.json()),
          fetch(`${API_BASE}/api/breeds`).then(r => r.json()),
        ]);
        if (!cancelled) {
          setPens(pensRes.data ?? []);
          setBreeds(breedsRes.data ?? []);
        }
      } catch { /* fail silently */ }
      finally { if (!cancelled) setIsLoadingData(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [mode]);

  if (!shouldRender || !pigData) return null;

  // Derive display metrics
  const data = detail || pigData;
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

  const switchToEdit = () => {
    if (isArchived) return;
    changeMode('edit');
  };

  // Width class based on mode (view is max-w-xl so that edit at max-w-2xl/3xl smoothly widens out!)
  const maxWidthClass = mode === 'view' ? 'max-w-xl' : mode === 'edit' ? (isBatch ? 'max-w-3xl' : 'max-w-2xl') : 'max-w-md';

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

        {/* ──── SUCCESS VIEW ──── */}
        {mode === 'success' ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 size={32} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                {successInfo?.type || 'Record'} Updated
              </span>
              <h4 className="text-xl font-black text-slate-900">
                {successInfo?.type || 'Record'} #{successInfo?.tag} Saved!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {successInfo?.message || 'The record has been updated and synced to your database.'}
              </p>
            </div>
            <div className="pt-2 w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => requestClose()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Done & Close
              </button>
            </div>
          </div>

        /* ──── EDIT VIEW ──── */
        ) : mode === 'edit' ? (
          <>
            {/* Edit Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100/60">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => changeMode('view')}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                  title="Back to details"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit {isBatch ? 'Piglet Batch' : 'Swine Record'}</h3>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">#{tag}</p>
                </div>
              </div>
              <button onClick={() => requestClose()} className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {isArchived && (
              <div className="mx-8 mt-4 p-3.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 font-medium">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>This record is archived and cannot be modified unless restored from archive.</span>
              </div>
            )}

            {isLoadingData ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs font-semibold">Loading form data…</p>
              </div>
            ) : (
              <EditPigForm
                pigData={data}
                pens={pens}
                breeds={breeds}
                onSave={onSave}
                onCancel={() => setMode('view')}
                onSuccess={(updatedInfo) => {
                  setSuccessInfo(updatedInfo);
                  changeMode('success');
                }}
                isArchived={isArchived}
                isLoadingData={isLoadingData}
                maxHeightClass="max-h-[88vh]"
              />
            )}
          </>

        /* ──── VIEW MODE ──── */
        ) : (
          <>
            {/* View Header */}
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
                  isBatch 
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
                  <p className="text-xs font-bold text-slate-500">Loading detailed swine record...</p>
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
                          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                            Number(survivability) >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
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
                </>
              )}
            </div>

            {/* View Footer */}
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200/80 flex items-center justify-between gap-3">
              <button type="button" onClick={requestClose} className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer">Close</button>
              <div className="flex items-center gap-2.5">
                {onArchive && (
                  <button type="button" onClick={() => { requestClose(() => onArchive(data)); }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 transition-all cursor-pointer">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={!isArchived ? switchToEdit : undefined}
                  disabled={isArchived}
                  title={isArchived ? "Archived records cannot be modified unless unarchived" : "Edit Record"}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isArchived
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Record {!isArchived && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
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
