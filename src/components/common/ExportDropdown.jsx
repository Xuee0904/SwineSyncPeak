import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

/**
 * ExportDropdown - A reusable export component.
 *
 * Props:
 *  - columns: Array of { header, accessor } column definitions (used for all formats).
 *  - filename: Base filename string (no extension).
 *  - pdfTitle: Title string to appear at the top of the PDF.
 *  - onFetchAll: Async function () => data[] that fetches ALL records (bypassing pagination).
 *               If not provided, falls back to the static `data` prop.
 *  - data: (Fallback) static array of already-loaded records.
 */
export default function ExportDropdown({ data, columns, filename, pdfTitle, onFetchAll }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const resolveData = async () => {
    if (onFetchAll) {
      return await onFetchAll();
    }
    return data || [];
  };

  const handleExportExcel = async () => {
    setIsLoading(true);
    setIsOpen(false);
    try {
      const allData = await resolveData();
      exportToExcel(allData, columns, filename);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setIsLoading(true);
    setIsOpen(false);
    try {
      const allData = await resolveData();
      exportToPDF(allData, columns, filename, pdfTitle);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
        disabled={isLoading}
      >
        {isLoading
          ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          : <Download className="w-4 h-4 text-emerald-600" />}
        <span>{isLoading ? 'Exporting…' : 'Export'}</span>
        {!isLoading && <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-slate-50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export All Records</p>
          </div>
          <div className="p-1">
            <button
              onClick={handleExportExcel}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Download as Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              Download as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
