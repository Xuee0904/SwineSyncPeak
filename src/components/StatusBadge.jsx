import React from 'react';

export default function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const map = {
    healthy:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    sick:        'bg-rose-100 text-rose-700 border-rose-200',
    medical:     'bg-rose-100 text-rose-700 border-rose-200',
    quarantine:  'bg-amber-100 text-amber-700 border-amber-200',
    reserved:    'bg-slate-100 text-slate-600 border-slate-200',
    stable:      'bg-teal-100  text-teal-700  border-teal-200',
    active:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    suckling:    'bg-sky-100 text-sky-700 border-sky-200',
    weaned:      'bg-indigo-100 text-indigo-700 border-indigo-200',
    transferred: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const cls = map[s] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${cls}`}>
      {status || '—'}
    </span>
  );
}
