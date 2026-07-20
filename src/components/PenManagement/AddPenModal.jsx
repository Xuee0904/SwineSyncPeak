import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Loader2 } from "lucide-react";
import useModalAnimation from "../../hooks/useModalAnimation";

export default function AddPenModal({ isOpen, onClose, onAdd, sections, submitting }) {
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  const [code, setCode] = useState("");
  const [section, setSection] = useState("B");
  const [capacity, setCapacity] = useState("1");

  useEffect(() => {
    if (isOpen) {
      setCode("");
      const firstSec = sections && Object.keys(sections)[0] ? Object.keys(sections)[0] : "B";
      setSection(firstSec);
      setCapacity(firstSec === "B" ? "1" : String(sections?.[firstSec]?.defaultCapacity || "10"));
    }
  }, [isOpen, sections]);

  if (!shouldRender) return null;

  const handleClose = () => {
    requestClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ code, section, capacity });
  };

  const isBoarLocked = section === "B";

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-60 z-[60] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md ${overlayClassName} ${isClosing ? "pointer-events-none" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) handleClose();
      }}
    >
      <div className={`w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 ${panelClassName}`}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add New Pen</h3>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Create a new housing unit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Pen Code *
            </label>
            <input
              type="text"
              required
              disabled={submitting}
              placeholder="e.g. PEN-S1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Section (Pen Type) *
            </label>
            <select
              value={section}
              disabled={submitting}
              onChange={(e) => {
                const val = e.target.value;
                setSection(val);
                if (val === "B") {
                  setCapacity("1");
                } else if (val === "S") {
                  setCapacity("1");
                } else {
                  setCapacity(String(sections[val]?.defaultCapacity || 10));
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              {Object.entries(sections).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label} ({key}) — {s.desc}
                </option>
              ))}
            </select>
            {sections[section]?.desc && (
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                ℹ️ {sections[section].desc}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Capacity *
            </label>
            <input
              type="number"
              required
              disabled={submitting || isBoarLocked}
              min="1"
              placeholder="e.g. 10"
              value={isBoarLocked ? "1" : capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            {isBoarLocked && (
              <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                <span>⚠️ Max capacity is locked to 1 since boars fight other pigs.</span>
              </p>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-50">
            <button
              type="button"
              disabled={submitting}
              onClick={handleClose}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Saving..." : "Save Pen"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
