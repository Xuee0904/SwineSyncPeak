import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Loader2, Lock, Unlock, Check, PiggyBank, Layers, Archive } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function ArchiveSwineModal({ isOpen, onClose, archiveData, onConfirmSuccess, loggedInUser }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(isOpen, onClose);

  const pig = archiveData?.pig;
  const isArchiving = archiveData?.isArchiving ?? true;
  const isBatch = pig?.category === 'Piglet Batch';

  const reasonOptions = isBatch
    ? [
      'Sold Out - Batch Fully Liquidated',
      'Transitioned to Breeding Herd (Gilts/Boars)',
      'Merged with Another Batch',
      'Mortality - Total Batch Loss',
      'Other (Specify below)',
    ]
    : [
      'Sold / Marketed',
      'Culled - Age & Productivity',
      'Culled - Health & Injury',
      'Mortality - Natural / Medical',
      'Transferred to Another Facility',
      'Other (Specify below)',
    ];

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setError(null);
      setSelectedReason(reasonOptions[0]);
      setCustomReason('');
      setReasonError('');
    }
  }, [isOpen]);

  if (!shouldRender || !pig) return null;

  const tag = pig.pig_tag || pig.batch_tag || pig.id || 'Record';

  const handleToggleArchive = async () => {
    try {
      setReasonError('');
      let finalReason = null;
      if (isArchiving) {
        const isOther = selectedReason.startsWith('Other');
        if (isOther && !customReason.trim()) {
          setReasonError('Please specify the custom archive reasoning.');
          return;
        }
        finalReason = isOther ? customReason.trim() : selectedReason;
      }

      setLoading(true);
      setError(null);

      const endpoint = isArchiving
        ? `${API_BASE}/api/pigs/${pig.id}/archive`
        : `${API_BASE}/api/pigs/${pig.id}/unarchive`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator: loggedInUser || 'Admin',
          archive_reasoning: finalReason,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isArchiving ? 'archive' : 'restore'} record.`);
      }

      setShowSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (onConfirmSuccess) onConfirmSuccess(archiveData);
    requestClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) requestClose();
      }}
      role="dialog"
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

      <div
        style={{ willChange: 'transform, opacity, max-width' }}
        className={[
          'w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left transition-[max-width] duration-300 ease-in-out',
          showSuccess ? 'max-w-sm' : 'max-w-md',
          panelClassName,
        ].join(' ')}
      >
        {!showSuccess ? (
          <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-8 pt-8 pb-5 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isArchiving ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isArchiving ? <Archive className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {isArchiving ? 'Archive Record' : 'Restore Record'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={loading}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 pt-6 space-y-6">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-left animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Swine Profile Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  {isBatch ? <Layers className="w-6 h-6 text-indigo-500" /> : <PiggyBank className="w-6 h-6 text-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">#{tag}</p>
                  <p className="text-xs font-medium text-slate-500 truncate">{pig.category || 'Swine Record'}</p>
                </div>
                <StatusBadge status={pig.status || (isArchiving ? 'Active' : 'Archived')} />
              </div>

              {/* Subtle Context Message */}
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isArchiving
                  ? 'Archiving this record will remove it from active circulation. It will be safely stored and can be restored at any time.'
                  : 'Restoring this record will immediately return it to active circulation in your herd.'}
              </p>

              {/* Archive Reason Dropdown (only when archiving) */}
              {isArchiving && (
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Select Archive Reason *
                  </label>
                  <select
                    value={selectedReason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      setReasonError('');
                    }}
                    disabled={loading}
                    className="w-full bg-slate-50/80 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none transition-all cursor-pointer disabled:opacity-60"
                  >
                    {reasonOptions.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {selectedReason.startsWith('Other') && (
                    <div className="pt-1 animate-fade-in">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Specify Custom Reason *
                      </label>
                      <input
                        type="text"
                        placeholder="Please enter exact details..."
                        value={customReason}
                        onChange={(e) => {
                          setCustomReason(e.target.value);
                          setReasonError('');
                        }}
                        disabled={loading}
                        required
                        className="w-full bg-white border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none transition-all disabled:opacity-60"
                      />
                    </div>
                  )}
                  {reasonError && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-fade-in">
                      <span>•</span> {reasonError}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={loading}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleArchive}
                  disabled={loading}
                  className={`flex-1 py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 ${isArchiving
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
                    </>
                  ) : isArchiving ? (
                    <>
                      Confirm Archive
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" /> Confirm Restore
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm ${isArchiving
                ? 'bg-rose-50 border-rose-100 text-rose-600'
                : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                }`}
            >
              {isArchiving ? (
                <Archive className="w-7 h-7" strokeWidth={2.5} />
              ) : (
                <Check className="w-7 h-7" strokeWidth={3} />
              )}
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Record {isArchiving ? 'Archived!' : 'Restored!'}
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
                {tag} has been successfully {isArchiving ? 'archived' : 'restored'}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className={`w-full py-3 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 ${isArchiving
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
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
