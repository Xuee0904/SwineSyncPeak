import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Loader2, Check, Sparkles, RefreshCw } from 'lucide-react';
import PigSnout from '../common/PigSnout';
import useModalAnimation from '../../hooks/useModalAnimation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function buildUniqueTag(prefix, dobStr, existingTagsSet) {
  if (!dobStr) return '';
  const yyyymmdd = dobStr.replace(/-/g, '');
  const baseTag = `${prefix}-${yyyymmdd}`;
  if (!existingTagsSet || !existingTagsSet.has(baseTag.toUpperCase())) {
    return baseTag;
  }
  let suffix = 2;
  while (existingTagsSet.has(`${baseTag}-${suffix}`.toUpperCase())) {
    suffix++;
  }
  return `${baseTag}-${suffix}`;
}

export default function PromoteToBreederModal({ isOpen, onClose, batch, onSuccess, loggedInUser }) {
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [pens, setPens] = useState([]);
  const [existingTags, setExistingTags] = useState(new Set());
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [promotedTag, setPromotedTag] = useState('');

  // Form State
  const [tagNumber, setTagNumber] = useState('');
  const [isTagManuallyEdited, setIsTagManuallyEdited] = useState(false);
  const [gender, setGender] = useState('Female'); // 'Female' (Gilt/Sow) | 'Male' (Boar)
  const [penId, setPenId] = useState('');
  const [weight, setWeight] = useState('');

  const { shouldRender, requestClose, overlayClassName, panelClassName } = useModalAnimation(isOpen, onClose);

  // Fetch available pens and existing tags when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setError(null);
      setGender('Female');
      setPenId('');
      setPromotedTag('');
      setIsTagManuallyEdited(false);

      const avgW = batch?.current_weight ?? batch?.average_weight ?? '';
      setWeight(avgW !== '' && avgW != null ? String(avgW) : '');

      setFetchingData(true);
      Promise.all([
        fetch(`${API_BASE}/api/pens/available`).then(res => res.json()).catch(() => ({ data: [] })),
        fetch(`${API_BASE}/api/pigs?limit=9999`).then(res => res.json()).catch(() => ({ data: [] })),
        fetch(`${API_BASE}/api/pigs/archived?limit=9999`).then(res => res.json()).catch(() => ({ data: [] })),
      ])
        .then(([pensJson, activeJson, archivedJson]) => {
          setPens(pensJson.data || []);

          const tagSet = new Set([
            ...(activeJson.data || []).map(p => (p.pig_tag || '').toUpperCase()),
            ...(archivedJson.data || []).map(p => (p.pig_tag || '').toUpperCase()),
          ]);
          setExistingTags(tagSet);

          const dob = batch?.date_of_birth || new Date().toISOString().split('T')[0];
          const autoTag = buildUniqueTag('SOW', dob, tagSet);
          setTagNumber(autoTag);
        })
        .catch(err => {
          console.error('Failed to load data for promote modal:', err);
        })
        .finally(() => {
          setFetchingData(false);
        });
    }
  }, [isOpen, batch]);

  // Handle gender toggle with intelligent auto-tag update
  const handleGenderToggle = (nextGender) => {
    setGender(nextGender);
    if (!isTagManuallyEdited) {
      const prefix = nextGender === 'Female' ? 'SOW' : 'BOAR';
      const dob = batch?.date_of_birth || new Date().toISOString().split('T')[0];
      setTagNumber(buildUniqueTag(prefix, dob, existingTags));
    }
  };

  // Filter available pens based on chosen gender
  const availablePens = pens.filter(p => {
    const isQPen = p.section === 'Q' || p.section === 'QUARANTINE';
    if (isQPen) return false;

    if (gender === 'Female') {
      if (p.section !== 'S' && p.section !== 'SOW') return false;
      if (p.hasSow || (p.sowCount ?? 0) >= 1 || (p.pigCount ?? 0) >= 1) return false;
    }
    if (gender === 'Male') {
      if (p.section !== 'B' && p.section !== 'BOAR') return false;
      if (p.hasBoar || (p.boarCount ?? 0) >= 1 || (p.pigCount ?? 0) >= 1) return false;
    }
    return typeof p.remaining === 'number' ? p.remaining > 0 : true;
  });

  // Reset pen selection if the currently selected pen is not valid for new gender
  useEffect(() => {
    if (penId && !availablePens.some(p => String(p.id) === String(penId))) {
      setPenId('');
    }
  }, [gender, availablePens, penId]);

  if (!shouldRender || !batch) return null;

  const currentCount = Number(batch.current_count ?? batch.total_born_alive ?? 0);
  const remainingAfter = Math.max(0, currentCount - 1);
  const batchTag = batch.pig_tag || batch.batch_tag || 'Batch';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanTag = tagNumber.trim();
    if (!cleanTag) {
      setError('Please provide a unique pig tag number.');
      return;
    }
    if (!penId) {
      setError(`Please select an available ${gender === 'Female' ? 'Sow' : 'Boar'} pen.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pigs/batch/${batch.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagNumber: cleanTag,
          gender,
          penId,
          weight: weight ? parseFloat(weight) : null,
          creator: loggedInUser || 'Admin',
        }),
      });

      let errorMessage = 'Failed to promote pig to breeding herd.';
      try {
        const data = await res.json();
        if (data && data.error) errorMessage = data.error;
      } catch {
        if (res.status === 404) {
          errorMessage = 'API route not loaded (404). Please restart the backend server to load new endpoints.';
        } else {
          errorMessage = `Server returned status ${res.status}: ${res.statusText || 'Request failed'}`;
        }
      }

      if (!res.ok) {
        throw new Error(errorMessage);
      }

      setPromotedTag(cleanTag);
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

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm ${overlayClassName}`}
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
          <form onSubmit={handleSubmit} className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <PigSnout className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    Promote to Breeder
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={loading}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Source Batch Context Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-[13.5px]">#{batchTag}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg text-[11px]">
                    <PigSnout className="w-3 h-3 text-emerald-600" />
                    {currentCount} {currentCount === 1 ? 'head' : 'heads'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <span>Pen <strong className="text-slate-700">{batch.pen_code || batch.pens?.pen_code || 'Unassigned'}</strong></span>
                  <span>·</span>
                  <span>DOB <strong className="text-slate-700">{batch.date_of_birth || 'Recorded'}</strong></span>
                  <span>·</span>
                  <span>Breed <strong className="text-slate-700">{batch.breed || 'Standard'}</strong></span>
                </div>
              </div>

              {/* Gender Selection Segmented Control */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Breeding Role *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleGenderToggle('Female')}
                    disabled={loading}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${gender === 'Female'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Female (Gilt / Sow)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenderToggle('Male')}
                    disabled={loading}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${gender === 'Male'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Male (Boar)
                  </button>
                </div>
              </div>

              {/* Tag Number (Auto-generated from birthdate, editable) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    New Pig Tag Number *
                  </label>
                  {!isTagManuallyEdited ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-suggested
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const prefix = gender === 'Female' ? 'SOW' : 'BOAR';
                        const dob = batch?.date_of_birth || new Date().toISOString().split('T')[0];
                        setTagNumber(buildUniqueTag(prefix, dob, existingTags));
                        setIsTagManuallyEdited(false);
                      }}
                      className="text-[10px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Reset to birthdate tag
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={gender === 'Female' ? 'e.g. SOW-20261107' : 'e.g. BOAR-20261107'}
                  value={tagNumber}
                  onChange={(e) => {
                    setTagNumber(e.target.value);
                    setIsTagManuallyEdited(e.target.value.trim().length > 0);
                  }}
                  disabled={loading}
                  required
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60"
                />
              </div>

              {/* Pen Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Target {gender === 'Female' ? 'Sow' : 'Boar'} Pen *
                  </label>
                  {fetchingData && <span className="text-[10px] text-slate-400">Loading pens...</span>}
                </div>
                <select
                  value={penId}
                  onChange={(e) => setPenId(e.target.value)}
                  disabled={loading || fetchingData}
                  required
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-all cursor-pointer disabled:opacity-60"
                >
                  <option value="">-- Choose available pen --</option>
                  {availablePens.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.remaining} slots free)
                    </option>
                  ))}
                </select>
                {availablePens.length === 0 && !fetchingData && (
                  <p className="text-[10.5px] text-amber-700 font-medium">
                    No available {gender === 'Female' ? 'sow' : 'boar'} pens found. Please free up or add a suitable pen.
                  </p>
                )}
              </div>

              {/* Current Weight (Explicitly Optional / Can be skipped) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Current Weight (kg) <span className="font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Leave blank or e.g. 120"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  disabled={loading}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 disabled:opacity-60"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={loading}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !tagNumber.trim() || !penId}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Promoting...</span>
                    </>
                  ) : (
                    <>
                      <PigSnout className="w-3.5 h-3.5" />
                      <span>Confirm Promotion</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-300">
            <button
              onClick={handleSuccessClose}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            <div>
              <h4 className="text-lg font-black text-slate-900">
                Pig Promoted Successfully!
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-1.5 max-w-xs mx-auto leading-relaxed">
                <strong className="text-slate-800">#{promotedTag}</strong> has been registered into the active breeding herd as a {gender === 'Female' ? 'gilt/sow' : 'boar'}.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSuccessClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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


