import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Eye, RefreshCw, Database, Loader2, WifiOff,
  Heart, Syringe, Tag, Weight, Calendar, Users, AlertTriangle, Baby,
} from 'lucide-react';

// ─── Constants & Configuration ────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const STATUS_STYLES = {
  healthy:     'bg-emerald-50 text-emerald-800 border-emerald-100',
  sick:        'bg-amber-50  text-amber-800  border-amber-100',
  quarantine:  'bg-rose-50   text-rose-800   border-rose-100',
  default:     'bg-slate-50  text-slate-700  border-slate-100',
};

const BATCH_STATUS_STYLES = {
  suckling:    'bg-sky-50    text-sky-800    border-sky-100',
  weaned:      'bg-violet-50 text-violet-800 border-violet-100',
  transferred: 'bg-slate-50  text-slate-700  border-slate-100',
  default:     'bg-slate-50  text-slate-700  border-slate-100',
};

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function fetchPigs({ search = '', status = 'all', gender = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search)            params.set('search', search);
  if (status !== 'all')  params.set('status', status);
  if (gender !== 'all')  params.set('gender', gender);
  
  const res = await fetch(`${API_BASE_URL}/api/pigs?${params}`);
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || `Server error ${res.status}`); 
  }
  return res.json(); // { data: Pig[], count: N }
}

async function fetchPigDetails(pigId) {
  const [healthRes, vaccRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/health-logs?pig_id=${pigId}`),
    fetch(`${API_BASE_URL}/api/vaccination-records?pig_id=${pigId}`),
  ]);
  const health = healthRes.ok ? await healthRes.json() : { data: [] };
  const vacc   = vaccRes.ok  ? await vaccRes.json()   : { data: [] };
  return { healthLogs: health.data ?? [], vaccinations: vacc.data ?? [] };
}

async function fetchPigletBatches({ search = '', status = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search)           params.set('search', search);
  if (status !== 'all') params.set('status', status);
  
  const res = await fetch(`${API_BASE_URL}/api/piglet-batches?${params}`);
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || `Server error ${res.status}`); 
  }
  return res.json(); // { data: PigletBatch[], count: N }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(date) {
  if (!date) return '';
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 120) return '1 minute ago';
  return `${Math.floor(diff / 60)} minutes ago`;
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusStyle(status, map = STATUS_STYLES) {
  return map[status?.toLowerCase()] ?? map.default;
}

function calcAge(dob) {
  if (!dob) return '—';
  const months = Math.floor((new Date() - new Date(dob)) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1)  return '< 1 mo';
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoadingSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse">
          <div className="flex justify-between mb-4">
            <div className="h-6 w-24 bg-slate-100 rounded-lg" />
            <div className="h-6 w-16 bg-slate-100 rounded-full" />
          </div>
          <div className="h-5 w-3/5 bg-slate-100 rounded mb-2" />
          <div className="h-4 w-2/5 bg-slate-100 rounded mb-6" />
          <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-slate-50">
            <div className="h-8 bg-slate-100 rounded" />
            <div className="h-8 bg-slate-100 rounded" />
          </div>
          <div className="flex justify-between mt-5">
            <div className="h-4 w-28 bg-slate-100 rounded" />
            <div className="h-8 w-24 bg-slate-100 rounded-xl" />
          </div>
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
        <h3 className="font-bold text-slate-800 text-base">Failed to load records</h3>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">{message}</p>
        <p className="text-xs text-slate-400 mt-2">
          Make sure the API is running: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">cd server && node index.js</code>
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Connection
      </button>
    </div>
  );
}

// ─── Pig Card ─────────────────────────────────────────────────────────────────
function PigCard({ pig, onViewDetails }) {
  return (
    <div
      key={pig.pig_id}
      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
      id={`pig-card-${pig.pig_tag}`}
    >
      {pig.status === 'quarantine' && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
      )}
      {pig.status === 'sick' && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400" />
      )}

      <div>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {pig.pig_tag}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusStyle(pig.status)}`}>
            {pig.status ?? 'Unknown'}
          </span>
        </div>

        {/* Gender + parity */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 capitalize">{pig.gender ?? '—'}</span>
            {pig.parity_count > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>{pig.parity_count} {pig.parity_count === 1 ? 'litter' : 'litters'}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mt-4 py-3 border-t border-b border-slate-50 text-xs">
          <div>
            <span className="text-slate-400 block font-semibold flex items-center gap-1"><Weight className="w-3 h-3" /> Weight</span>
            <span className="font-bold text-slate-800">{pig.weight != null ? `${pig.weight} kg` : '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold flex items-center gap-1"><Calendar className="w-3 h-3" /> Age</span>
            <span className="font-bold text-slate-800">{calcAge(pig.date_of_birth)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 italic">
          DOB: {formatDate(pig.date_of_birth)}
        </span>
        <button
          onClick={() => onViewDetails(pig)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-primary-50 hover:text-primary-700 border border-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
          id={`view-pig-btn-${pig.pig_tag}`}
        >
          <Eye className="w-3.5 h-3.5" />
          View Details
        </button>
      </div>
    </div>
  );
}

// ─── Piglet Batch Card ────────────────────────────────────────────────────────
function BatchCard({ batch, onViewDetails }) {
  const survivability = batch.total_born_alive > 0
    ? Math.round((batch.current_count / batch.total_born_alive) * 100)
    : null;

  return (
    <div
      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
      id={`batch-card-${batch.batch_id}`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-300 to-violet-300" />

      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1">
            <Baby className="w-3 h-3" />
            {batch.batch_tag ?? batch.batch_id.slice(0, 8)}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusStyle(batch.status, BATCH_STATUS_STYLES)}`}>
            {batch.status ?? 'Unknown'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 py-3 border-t border-b border-slate-50 text-xs">
          <div>
            <span className="text-slate-400 block font-semibold">Born Alive</span>
            <span className="font-bold text-slate-800">{batch.total_born_alive}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Current Count</span>
            <span className="font-bold text-slate-800">{batch.current_count}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Stillborn</span>
            <span className="font-bold text-slate-800">{batch.stillborn_count}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-semibold">Avg Weight</span>
            <span className="font-bold text-slate-800">{batch.average_weight != null ? `${batch.average_weight} kg` : '—'}</span>
          </div>
        </div>

        {survivability != null && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Survivability</span>
              <span className="font-bold text-slate-700">{survivability}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${survivability >= 80 ? 'bg-emerald-400' : survivability >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                style={{ width: `${survivability}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 italic">
          Mummies: {batch.mummy_count}
        </span>
        <button
          onClick={() => onViewDetails(batch)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          View Details
        </button>
      </div>
    </div>
  );
}

// ─── Pig Detail Modal ─────────────────────────────────────────────────────────
function PigDetailModal({ pig, onClose }) {
  const [details, setDetails]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [detailErr, setDetailErr] = useState(null);

  useEffect(() => {
    fetchPigDetails(pig.pig_id)
      .then(setDetails)
      .catch((e) => setDetailErr(e.message))
      .finally(() => setLoading(false));
  }, [pig.pig_id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left max-h-[90vh] flex flex-col">
        <div className="h-2 bg-gradient-to-r from-primary-600 to-emerald-400 w-full shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8 space-y-5 overflow-y-auto">
          {/* Identity */}
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                {pig.pig_tag}
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-2 capitalize">
                {pig.gender ?? 'Pig'} — {pig.status ?? ''}
              </h2>
            </div>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${statusStyle(pig.status)}`}>
              {pig.status ?? '—'}
            </span>
          </div>

          {/* Core stats */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
            {[
              ['Date of Birth',  formatDate(pig.date_of_birth)],
              ['Age',            calcAge(pig.date_of_birth)],
              ['Weight',         pig.weight != null ? `${pig.weight} kg` : '—'],
              ['Gender',         pig.gender ?? '—'],
              ['Parity Count',   pig.parity_count ?? 0],
              ['Pen ID',         pig.pen_id ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-slate-400 font-semibold block uppercase tracking-wide">{label}</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{value}</span>
              </div>
            ))}
          </div>

          {/* Health logs */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Health Logs
            </h4>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse">Loading records…</div>
            ) : detailErr ? (
              <div className="text-xs text-rose-500">{detailErr}</div>
            ) : details?.healthLogs?.length ? (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {details.healthLogs.map((log) => (
                  <div key={log.health_id} className="p-3 bg-white border border-slate-100 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">{log.diagnosis ?? 'No diagnosis'}</span>
                      <span className="text-slate-400">{formatDate(log.log_date)}</span>
                    </div>
                    {log.symptoms && <p className="text-slate-500">Symptoms: {log.symptoms}</p>}
                    {log.treatment && <p className="text-slate-500">Treatment: {log.treatment}</p>}
                    {log.medication_name && (
                      <p className="text-slate-500">
                        Medication: {log.medication_name} {log.dosage ? `— ${log.dosage}` : ''}
                      </p>
                    )}
                    <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusStyle(log.status)}`}>
                      {log.status ?? 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No health logs on record.</p>
            )}
          </div>

          {/* Vaccination records */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Syringe className="w-3.5 h-3.5 text-sky-400" /> Vaccinations
            </h4>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse">Loading records…</div>
            ) : details?.vaccinations?.length ? (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {details.vaccinations.map((v) => (
                  <div key={v.vaccination_id} className="p-3 bg-white border border-slate-100 rounded-xl text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">{v.vaccine_name}</span>
                      <span className="text-slate-400">{formatDate(v.administered_date)}</span>
                    </div>
                    {v.dosage && <p className="text-slate-500">Dosage: {v.dosage}</p>}
                    {v.booster_due_date && (
                      <p className="text-slate-500">Booster due: {formatDate(v.booster_due_date)}</p>
                    )}
                    {v.administered_by && <p className="text-slate-500">By: {v.administered_by}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No vaccination records on file.</p>
            )}
          </div>

          {/* Supabase reference */}
          <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100 text-[11px] text-primary-900 flex gap-3">
            <Database className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
            <div>
              <strong>Live Supabase Record</strong>
              <p className="mt-1 font-mono break-all">
                {`supabase.from('pigs').select('*').eq('pig_id', '${pig.pig_id}')`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Dismiss Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Detail Modal ───────────────────────────────────────────────────────
function BatchDetailModal({ batch, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/health-logs?batch_id=${batch.batch_id}`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE_URL}/api/vaccination-records?batch_id=${batch.batch_id}`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([health, vacc]) => {
      setDetails({ healthLogs: health.data ?? [], vaccinations: vacc.data ?? [] });
    }).finally(() => setLoading(false));
  }, [batch.batch_id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left max-h-[90vh] flex flex-col">
        <div className="h-2 bg-gradient-to-r from-sky-400 to-violet-400 w-full shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8 space-y-5 overflow-y-auto">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                {batch.batch_tag ?? batch.batch_id.slice(0, 8)}
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 mt-2">Piglet Batch</h2>
            </div>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${statusStyle(batch.status, BATCH_STATUS_STYLES)}`}>
              {batch.status ?? '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
            {[
              ['Born Alive',    batch.total_born_alive],
              ['Current Count', batch.current_count],
              ['Stillborn',     batch.stillborn_count],
              ['Mummies',       batch.mummy_count],
              ['Avg Weight',    batch.average_weight != null ? `${batch.average_weight} kg` : '—'],
              ['Pen ID',        batch.pen_id ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-slate-400 font-semibold block uppercase tracking-wide">{label}</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">{value}</span>
              </div>
            ))}
          </div>

          {/* Health logs */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> Health Logs
            </h4>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse">Loading…</div>
            ) : details?.healthLogs?.length ? (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {details.healthLogs.map((log) => (
                  <div key={log.health_id} className="p-3 bg-white border border-slate-100 rounded-xl text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">{log.diagnosis ?? '—'}</span>
                      <span className="text-slate-400">{formatDate(log.log_date)}</span>
                    </div>
                    {log.treatment && <p className="text-slate-500">Treatment: {log.treatment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No health logs on record.</p>
            )}
          </div>

          {/* Vaccinations */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Syringe className="w-3.5 h-3.5 text-sky-400" /> Vaccinations
            </h4>
            {loading ? (
              <div className="text-xs text-slate-400 animate-pulse">Loading…</div>
            ) : details?.vaccinations?.length ? (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {details.vaccinations.map((v) => (
                  <div key={v.vaccination_id} className="p-3 bg-white border border-slate-100 rounded-xl text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">{v.vaccine_name}</span>
                      <span className="text-slate-400">{formatDate(v.administered_date)}</span>
                    </div>
                    {v.booster_due_date && <p className="text-slate-500 mt-0.5">Booster: {formatDate(v.booster_due_date)}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No vaccination records on file.</p>
            )}
          </div>

          <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-[11px] text-sky-900 flex gap-3">
            <Database className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div>
              <strong>Live Supabase Record</strong>
              <p className="mt-1 font-mono break-all">
                {`supabase.from('piglet_batches').select('*').eq('batch_id', '${batch.batch_id}')`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────
export default function Catalog() {
  const [activeTab, setActiveTab]   = useState('pigs'); // 'pigs' | 'batches'

  // Pigs state
  const [pigs, setPigs]             = useState([]);
  const [pigsLoading, setPigsLoading] = useState(true);
  const [pigsError, setPigsError]   = useState(null);
  const [lastFetchedPigs, setLastFetchedPigs] = useState(null);

  // Batch state
  const [batches, setBatches]       = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState(null);
  const [lastFetchedBatches, setLastFetchedBatches] = useState(null);

  // Shared filter state
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [sortBy, setSortBy]         = useState('tag');

  // Modal state
  const [selectedPig, setSelectedPig]     = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadPigs = useCallback(async () => {
    setPigsLoading(true); setPigsError(null);
    try {
      const result = await fetchPigs();
      setPigs(result.data ?? []);
      setLastFetchedPigs(new Date());
    } catch (e) { setPigsError(e.message); }
    finally { setPigsLoading(false); }
  }, []);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true); setBatchesError(null);
    try {
      const result = await fetchPigletBatches();
      setBatches(result.data ?? []);
      setLastFetchedBatches(new Date());
    } catch (e) { setBatchesError(e.message); }
    finally { setBatchesLoading(false); }
  }, []);

  useEffect(() => { loadPigs(); }, [loadPigs]);
  useEffect(() => { if (activeTab === 'batches' && batches.length === 0 && !batchesLoading) loadBatches(); }, [activeTab]);

  // ── Client filtering ───────────────────────────────────────────────────────
  const filteredPigs = pigs.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.pig_tag?.toLowerCase().includes(q) || p.gender?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchGender = genderFilter === 'all' || p.gender?.toLowerCase().startsWith(genderFilter);
    return matchSearch && matchStatus && matchGender;
  });

  const sortedPigs = [...filteredPigs].sort((a, b) => {
    if (sortBy === 'tag')         return (a.pig_tag ?? '').localeCompare(b.pig_tag ?? '');
    if (sortBy === 'weight-desc') return (b.weight ?? 0) - (a.weight ?? 0);
    if (sortBy === 'weight-asc')  return (a.weight ?? 0) - (b.weight ?? 0);
    if (sortBy === 'age-asc')     return new Date(b.date_of_birth) - new Date(a.date_of_birth);
    if (sortBy === 'age-desc')    return new Date(a.date_of_birth) - new Date(b.date_of_birth);
    if (sortBy === 'parity')      return (b.parity_count ?? 0) - (a.parity_count ?? 0);
    return 0;
  });

  const filteredBatches = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.batch_tag?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setGenderFilter('all'); };
  const hasFilters = search || statusFilter !== 'all' || genderFilter !== 'all';
  const isPigs = activeTab === 'pigs';

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="catalog-section">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">Swine Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live herd records
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(isPigs ? lastFetchedPigs : lastFetchedBatches) && !(isPigs ? pigsLoading : batchesLoading) && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Updated {formatRelativeTime(isPigs ? lastFetchedPigs : lastFetchedBatches)}</span>
              <button
                onClick={isPigs ? loadPigs : loadBatches}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Tab switcher ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'pigs',    label: 'Individual Pigs',   icon: Tag },
          { id: 'batches', label: 'Piglet Batches',    icon: Baby },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); clearFilters(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4" id="catalog-controls">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              id="catalog-search"
              placeholder={isPigs ? 'Search by tag or gender…' : 'Search by batch tag…'}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {isPigs ? (
                <>
                  <option value="healthy">Healthy</option>
                  <option value="sick">Sick</option>
                  <option value="quarantine">Quarantine</option>
                </>
              ) : (
                <>
                  <option value="suckling">Suckling</option>
                  <option value="weaned">Weaned</option>
                  <option value="transferred">Transferred</option>
                </>
              )}
            </select>
          </div>

          {/* Sort / Gender */}
          <div>
            {isPigs ? (
              <select
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="tag">Sort: Tag</option>
                <option value="weight-desc">Weight: High → Low</option>
                <option value="weight-asc">Weight: Low → High</option>
                <option value="age-asc">Age: Youngest first</option>
                <option value="age-desc">Age: Oldest first</option>
                <option value="parity">Parity: High → Low</option>
              </select>
            ) : (
              <select
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="tag">Sort: Tag</option>
                <option value="count-desc">Count: High → Low</option>
              </select>
            )}
          </div>
        </div>

        {/* Quick status pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50 text-xs">
          <span className="text-slate-400 font-semibold uppercase">Quick Status:</span>
          {(isPigs
            ? ['all', 'healthy', 'sick', 'quarantine']
            : ['all', 'suckling', 'weaned', 'transferred']
          ).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg border font-semibold transition-colors cursor-pointer capitalize ${
                statusFilter === s
                  ? s === 'all'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : `${statusStyle(s, isPigs ? STATUS_STYLES : BATCH_STATUS_STYLES)} shadow-sm`
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}

          {isPigs && (
            <>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-slate-400 font-semibold uppercase">Gender:</span>
              {[['all', 'All'], ['m', 'Male'], ['f', 'Female'], ['c', 'Castrated']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setGenderFilter(val)}
                  className={`px-3 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    genderFilter === val
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      </section>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {isPigs ? (
        pigsLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-400 pl-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to Supabase…</span>
            </div>
            <LoadingSkeleton />
          </div>
        ) : pigsError ? (
          <ErrorBanner message={pigsError} onRetry={loadPigs} />
        ) : (
          <>
            <div className="text-xs text-slate-500 font-medium pl-1">
              Showing <strong>{sortedPigs.length}</strong> of {pigs.length} pigs
              {hasFilters && (
                <button onClick={clearFilters} className="ml-3 text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
                  Clear filters
                </button>
              )}
            </div>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedPigs.map((pig) => (
                <PigCard key={pig.pig_id} pig={pig} onViewDetails={setSelectedPig} />
              ))}
              {sortedPigs.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm">
                  No pigs match the current filters.
                </div>
              )}
            </section>
          </>
        )
      ) : (
        batchesLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-400 pl-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading piglet batches…</span>
            </div>
            <LoadingSkeleton count={3} />
          </div>
        ) : batchesError ? (
          <ErrorBanner message={batchesError} onRetry={loadBatches} />
        ) : (
          <>
            <div className="text-xs text-slate-500 font-medium pl-1">
              Showing <strong>{filteredBatches.length}</strong> of {batches.length} batches
              {hasFilters && (
                <button onClick={clearFilters} className="ml-3 text-primary-600 hover:text-primary-700 font-semibold cursor-pointer">
                  Clear filters
                </button>
              )}
            </div>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBatches.map((batch) => (
                <BatchCard key={batch.batch_id} batch={batch} onViewDetails={setSelectedBatch} />
              ))}
              {filteredBatches.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-400 text-sm">
                  No piglet batches match the current filters.
                </div>
              )}
            </section>
          </>
        )
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {selectedPig   && <PigDetailModal   pig={selectedPig}     onClose={() => setSelectedPig(null)}   />}
      {selectedBatch && <BatchDetailModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} />}
    </div>
  );
}