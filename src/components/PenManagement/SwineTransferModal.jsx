import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRightLeft, Loader2, Search, CheckSquare, Square, AlertTriangle, Info } from "lucide-react";
import toast from "../../utils/toast";
import useModalAnimation from "../../hooks/useModalAnimation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export default function SwineTransferModal({ isOpen, onClose, pens = [], onSuccess, user }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } = useModalAnimation(isOpen, onClose);

  const [sourcePenId, setSourcePenId] = useState("");
  const [destPenId, setDestPenId] = useState("");
  
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [animals, setAnimals] = useState([]);
  const [selectedPigIds, setSelectedPigIds] = useState(new Set());
  const [selectedBatchIds, setSelectedBatchIds] = useState(new Set());
  
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSourcePenId("");
      setDestPenId("");
      setAnimals([]);
      setSelectedPigIds(new Set());
      setSelectedBatchIds(new Set());
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchAnimals = async () => {
      if (!sourcePenId) {
        setAnimals([]);
        setSelectedPigIds(new Set());
        setSelectedBatchIds(new Set());
        return;
      }
      
      setLoadingAnimals(true);
      try {
        const res = await fetch(`${API_BASE}/api/pens/${sourcePenId}/swine`);
        if (!res.ok) throw new Error("Failed to fetch animals");
        const json = await res.json();
        
        const pigs = (json.data?.pigs || []).map(p => ({ ...p, _type: 'pig' }));
        const batches = (json.data?.batches || []).map(b => ({ ...b, _type: 'batch' }));
        
        setAnimals([...pigs, ...batches]);
      } catch (err) {
        toast.error(err.message || "Failed to load animals for selected pen.");
      } finally {
        setLoadingAnimals(false);
      }
    };
    
    fetchAnimals();
  }, [sourcePenId]);

  if (!shouldRender) return null;

  const activePens = pens.filter(p => !p.is_archived);
  const destPens = activePens.filter(p => String(p.id) !== String(sourcePenId));

  const totalIncomingHeadCount = Array.from(selectedPigIds).length + Array.from(selectedBatchIds).reduce((acc, bId) => {
    const batch = animals.find(a => a.batch_id === bId);
    return acc + (batch?.current_count || 0);
  }, 0);

  const validDestPens = React.useMemo(() => {
    return destPens.filter(pen => {
      if (selectedPigIds.size === 0 && selectedBatchIds.size === 0) return true;
      
      const occ = pen.occupied || 0;
      const destMaxCap = pen.maxCapacity ?? 20;
      const remaining = Math.max(0, destMaxCap - occ);
      if (totalIncomingHeadCount > remaining) return false;
      
      const penSection = pen.section || '';
      const isQPen = penSection === 'Q';

      let incomingSowsCount = 0;
      let incomingBoarsCount = 0;
      
      for (const id of Array.from(selectedPigIds)) {
        const pig = animals.find(a => a.pig_id === id);
        if (!pig) continue;
        const isSow = pig.gender === 'Female' || pig.status?.toLowerCase() === 'sow';
        const isBoar = pig.gender === 'Male' || pig.status?.toLowerCase() === 'boar';
        const isSickOrQ = pig.status?.toLowerCase() === 'sick' || pig.status?.toLowerCase() === 'quarantine';

        if (isSow) incomingSowsCount++;
        if (isBoar) incomingBoarsCount++;

        if (isSow && penSection === 'B') return false;
        if (isBoar && penSection !== 'B') return false;
        if (!isSickOrQ && isQPen) return false;
        if (isSickOrQ && !isQPen) return false;
        if (isSow && !isQPen && penSection !== 'S') return false;
      }

      if (penSection === 'S' && ((pen.sowCount || 0) + incomingSowsCount > 1 || (pen.pigCount || 0) + selectedPigIds.size > 1)) return false;
      if (penSection === 'B' && ((pen.boarCount || 0) + incomingBoarsCount > 1 || (pen.pigCount || 0) + selectedPigIds.size > 1)) return false;
      if (penSection === 'B' && selectedBatchIds.size > 0) return false;

      for (const id of Array.from(selectedBatchIds)) {
        const batch = animals.find(a => a.batch_id === id);
        if (!batch) continue;
        const statusStr = (batch.status || '').toLowerCase();
        let ageInDays = null;
        if (batch.date_of_birth) {
           ageInDays = Math.floor((Date.now() - new Date(batch.date_of_birth).getTime()) / (1000 * 60 * 60 * 24));
        }
        const isBatchWeaned = statusStr === 'weaned' || (statusStr !== 'suckling' && ageInDays !== null && ageInDays > 28);
        const isBatchNursing = statusStr === 'suckling' || (statusStr !== 'weaned' && ageInDays !== null && ageInDays <= 28);
        
        if (isBatchNursing && penSection !== 'S') return false;
        if (isBatchWeaned && penSection !== 'W') return false;
      }

      return true;
    });
  }, [destPens, selectedPigIds, selectedBatchIds, animals, totalIncomingHeadCount]);

  useEffect(() => {
    if (destPenId && !validDestPens.find(p => String(p.id) === String(destPenId))) {
      setDestPenId("");
    }
  }, [validDestPens, destPenId]);

  const filteredAnimals = animals.filter(a => {
    const tag = String(a.pig_tag || a.batch_tag || "").toLowerCase();
    return tag.includes(searchQuery.toLowerCase());
  });

  const togglePig = (id) => {
    const next = new Set(selectedPigIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPigIds(next);
  };

  const toggleBatch = (id) => {
    const next = new Set(selectedBatchIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBatchIds(next);
  };

  const toggleAll = () => {
    if (selectedPigIds.size + selectedBatchIds.size === filteredAnimals.length && filteredAnimals.length > 0) {
      setSelectedPigIds(new Set());
      setSelectedBatchIds(new Set());
    } else {
      const pIds = new Set(filteredAnimals.filter(a => a._type === 'pig').map(a => a.pig_id));
      const bIds = new Set(filteredAnimals.filter(a => a._type === 'batch').map(a => a.batch_id));
      setSelectedPigIds(pIds);
      setSelectedBatchIds(bIds);
    }
  };

  const selectedDestPen = destPens.find(p => String(p.id) === String(destPenId));
  
  const validationError = React.useMemo(() => {
    if (!selectedDestPen) return null;
    if (selectedPigIds.size === 0 && selectedBatchIds.size === 0) return null;
    
    // Check capacity
    const occ = selectedDestPen.occupied || 0;
    const destMaxCap = selectedDestPen.maxCapacity ?? 20;
    const remaining = Math.max(0, destMaxCap - occ);
    if (totalIncomingHeadCount > remaining) {
      return { type: "CAPACITY", msg: `You are attempting to transfer ${totalIncomingHeadCount} heads to a pen with only ${remaining} slots remaining.` };
    }
    
    const penSection = selectedDestPen.section || '';
    const isQPen = penSection === 'Q';

    let incomingSowsCount = 0;
    let incomingBoarsCount = 0;
    
    for (const id of Array.from(selectedPigIds)) {
      const pig = animals.find(a => a.pig_id === id);
      if (!pig) continue;
      const isSow = pig.gender === 'Female' || pig.status?.toLowerCase() === 'sow';
      const isBoar = pig.gender === 'Male' || pig.status?.toLowerCase() === 'boar';
      const isSickOrQ = pig.status?.toLowerCase() === 'sick' || pig.status?.toLowerCase() === 'quarantine';

      if (isSow) incomingSowsCount++;
      if (isBoar) incomingBoarsCount++;

      if (isSow && penSection === 'B') return { type: "RULE", msg: `Cannot transfer female sow #${pig.pig_tag} to a Boar pen.` };
      if (isBoar && penSection !== 'B') return { type: "RULE", msg: `Male boar #${pig.pig_tag} must be housed in a Boar pen.` };
      if (!isSickOrQ && isQPen) return { type: "RULE", msg: `Healthy pig #${pig.pig_tag} cannot go to Quarantine.` };
      if (isSickOrQ && !isQPen) return { type: "RULE", msg: `Sick/Quarantined pig #${pig.pig_tag} must go to Quarantine.` };
      if (isSow && !isQPen && penSection !== 'S') return { type: "RULE", msg: `Sow #${pig.pig_tag} must be housed in a Sow/Farrowing pen.` };
    }

    if (penSection === 'S' && ((selectedDestPen.sowCount || 0) + incomingSowsCount > 1 || (selectedDestPen.pigCount || 0) + selectedPigIds.size > 1)) {
      return { type: "RULE", msg: `Sow pens can only house 1 sow per pen.` };
    }
    if (penSection === 'B' && ((selectedDestPen.boarCount || 0) + incomingBoarsCount > 1 || (selectedDestPen.pigCount || 0) + selectedPigIds.size > 1)) {
      return { type: "RULE", msg: `Boar pens can only house 1 boar per pen.` };
    }
    if (penSection === 'B' && selectedBatchIds.size > 0) {
      return { type: "RULE", msg: `Piglet batches cannot be transferred to a Boar pen.` };
    }

    for (const id of Array.from(selectedBatchIds)) {
      const batch = animals.find(a => a.batch_id === id);
      if (!batch) continue;
      const statusStr = (batch.status || '').toLowerCase();
      let ageInDays = null;
      if (batch.date_of_birth) {
         ageInDays = Math.floor((Date.now() - new Date(batch.date_of_birth).getTime()) / (1000 * 60 * 60 * 24));
      }
      const isBatchWeaned = statusStr === 'weaned' || (statusStr !== 'suckling' && ageInDays !== null && ageInDays > 28);
      const isBatchNursing = statusStr === 'suckling' || (statusStr !== 'weaned' && ageInDays !== null && ageInDays <= 28);
      
      if (isBatchNursing && penSection !== 'S') return { type: "RULE", msg: `Nursing piglet batch #${batch.batch_tag} must go to a Sow/Farrowing pen.` };
      if (isBatchWeaned && penSection !== 'W') return { type: "RULE", msg: `Weaned piglet batch #${batch.batch_tag} must go to a Weaned/Fattening pen.` };
    }

    return null;
  }, [selectedDestPen, selectedPigIds, selectedBatchIds, animals, totalIncomingHeadCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourcePenId) return toast.error("Please select a source pen.");
    if (!destPenId) return toast.error("Please select a destination pen.");
    if (selectedPigIds.size === 0 && selectedBatchIds.size === 0) {
      return toast.error("Please select at least one animal or batch to transfer.");
    }
    if (validationError) {
      return toast.error(validationError.msg);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/pens/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePenId,
          destinationPenId: destPenId,
          pigIds: Array.from(selectedPigIds),
          batchIds: Array.from(selectedBatchIds),
          creator: user
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer failed");

      toast.success(data.message || "Transfer successful!");
      onSuccess?.();
      requestClose();
    } catch (err) {
      toast.error(err.message || "An error occurred during transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div 
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) requestClose();
      }}
    >
      <div 
        className={`w-full max-w-3xl flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] ${panelClassName}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Bulk Swine Transfer</h2>
              <p className="text-xs font-medium text-slate-500">Move pigs and batches between pens</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Step 1: Pen Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Source Pen <span className="text-rose-500">*</span></label>
                <select
                  value={sourcePenId}
                  onChange={e => {
                    setSourcePenId(e.target.value);
                    setDestPenId("");
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="">-- Select Source Pen --</option>
                  {activePens.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} ({p.section}) - {p.occupancy}/{p.capacity} Occupied
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Destination Pen <span className="text-rose-500">*</span></label>
                <select
                  value={destPenId}
                  onChange={e => setDestPenId(e.target.value)}
                  disabled={!sourcePenId}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">-- Select Destination Pen --</option>
                  {validDestPens.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} ({p.section}) - {p.remaining} slots remaining
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: Animal Selection */}
            <div className="flex flex-col space-y-3 min-h-[300px]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Swine to Transfer</label>
                {sourcePenId && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                {!sourcePenId ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-400">Please select a Source Pen first.</p>
                  </div>
                ) : loadingAnimals ? (
                  <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : animals.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50/50">
                    <p className="text-sm font-medium text-slate-400">This pen is currently empty.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-100/80 px-4 py-2 flex items-center gap-3 border-b border-slate-200 shrink-0">
                      <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                        {(selectedPigIds.size + selectedBatchIds.size) === filteredAnimals.length && filteredAnimals.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tag Number</span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-auto pr-8">Status</span>
                    </div>
                    <div className="overflow-y-auto max-h-[300px] flex-1 divide-y divide-slate-100">
                      {filteredAnimals.map(a => {
                        const isBatch = a._type === 'batch';
                        const id = isBatch ? a.batch_id : a.pig_id;
                        const tag = isBatch ? a.batch_tag : a.pig_tag;
                        const isSelected = isBatch ? selectedBatchIds.has(id) : selectedPigIds.has(id);
                        const toggle = isBatch ? () => toggleBatch(id) : () => togglePig(id);
                        
                        return (
                          <div 
                            key={id} 
                            onClick={toggle}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                          >
                            <button type="button" className="text-slate-400">
                              {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                            </button>
                            <div>
                              <p className="text-sm font-black text-slate-800">{tag}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {isBatch ? `PIGLET BATCH (${a.current_count} Heads)` : (a.gender === 'Female' ? 'SOW' : 'BOAR')}
                              </p>
                            </div>
                            <div className="ml-auto">
                              <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600 uppercase">
                                {a.status || 'Active'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {filteredAnimals.length === 0 && (
                        <div className="p-8 text-center">
                          <p className="text-sm font-medium text-slate-400">No animals match your search.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Validation Banner */}
            {destPenId && (selectedPigIds.size > 0 || selectedBatchIds.size > 0) && validationError && (
              <div className={`p-4 rounded-xl border ${validationError.type === 'CAPACITY' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'} flex items-start gap-3`}>
                <div className={`mt-0.5 ${validationError.type === 'CAPACITY' ? 'text-amber-500' : 'text-rose-500'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${validationError.type === 'CAPACITY' ? 'text-amber-800' : 'text-rose-800'}`}>
                    {validationError.type === 'CAPACITY' ? 'Capacity Exceeded' : 'Transfer Rule Violation'}
                  </h4>
                  <p className={`text-xs mt-1 ${validationError.type === 'CAPACITY' ? 'text-amber-600' : 'text-rose-600'}`}>
                    {validationError.msg}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || validationError !== null || (selectedPigIds.size === 0 && selectedBatchIds.size === 0)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Transferring...</>
              ) : (
                <><ArrowRightLeft className="w-4 h-4" /> Confirm Transfer</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
