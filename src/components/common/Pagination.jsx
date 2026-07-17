import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Global Pagination Component
 *
 * Implements windowed pagination with ellipsis ('...') for clean, scalable page navigation.
 * Can be used as a standalone button bar or as a complete table footer with item range summary.
 *
 * @param {number} currentPage - Current active page (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @param {function} onPageChange - Callback receiving the new page number
 * @param {boolean} [disabled=false] - Disable buttons during loading/transitions
 * @param {boolean} [showPrevNextText=true] - Whether to show "Prev"/"Next" text next to chevrons
 * @param {number} [totalItems] - Total count of items across all pages (enables summary text)
 * @param {number} [itemsPerPage] - Number of items shown per page
 * @param {string} [itemName='items'] - Label for items in the summary (e.g., 'Swine', 'caretakers')
 * @param {boolean} [showSummary=true] - Whether to render the left "Showing X to Y of Z" text when totalItems is provided
 * @param {string} [className=''] - Custom wrapper class
 * @param {string} [buttonSize='sm'] - Button dimensions: 'sm' (32x32px) or 'md' (34x34px)
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  disabled = false,
  showPrevNextText = true,
  totalItems,
  itemsPerPage = 10,
  itemName = 'items',
  showSummary = true,
  className = '',
  buttonSize = 'sm',
}) {
  const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const safeTotalPages = Math.max(1, totalPages || 1);

  // Generate windowed page numbers with ellipsis
  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    const addPage = (p) => {
      if (!pages.includes(p)) pages.push(p);
    };

    addPage(1);
    if (current > 3) pages.push('...');

    for (
      let p = Math.max(2, current - 1);
      p <= Math.min(total - 1, current + 1);
      p++
    ) {
      addPage(p);
    }

    if (current < total - 2) pages.push('...');
    addPage(total);

    return pages;
  };

  const pages = getPageNumbers(safePage, safeTotalPages);

  // Calculate summary indices
  const startIndex = totalItems > 0 ? (safePage - 1) * itemsPerPage + 1 : 0;
  const endIndex = totalItems > 0 ? Math.min(safePage * itemsPerPage, totalItems) : 0;

  const buttonClasses =
    buttonSize === 'md' ? 'w-[34px] h-[34px] text-xs' : 'w-[32px] h-[32px] text-xs';

  const buttonsContent = (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        disabled={safePage <= 1 || disabled}
        onClick={() => onPageChange && onPageChange(Math.max(1, safePage - 1))}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95 border border-transparent hover:border-slate-200"
      >
        <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
        {showPrevNextText && <span>Prev</span>}
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, index) =>
          p === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="w-7 text-center text-slate-400 select-none font-bold text-xs"
            >
              &hellip;
            </span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange && onPageChange(p)}
              className={`${buttonClasses} flex items-center justify-center rounded-xl font-bold transition-all cursor-pointer active:scale-95 ${
                p === safePage
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={safePage >= safeTotalPages || disabled}
        onClick={() => onPageChange && onPageChange(Math.min(safeTotalPages, safePage + 1))}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition-all cursor-pointer active:scale-95 border border-transparent hover:border-slate-200"
      >
        {showPrevNextText && <span>Next</span>}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  );

  // If totalItems is passed and showSummary is true, render complete footer layout
  if (totalItems !== undefined && showSummary) {
    return (
      <div
        className={`p-4 border-t border-slate-100 bg-slate-50/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium ${className}`}
      >
        <span>
          Showing <strong>{startIndex} to {endIndex}</strong> of{' '}
          <strong>{totalItems.toLocaleString()}</strong> {itemName}
        </span>
        {buttonsContent}
      </div>
    );
  }

  return <div className={className}>{buttonsContent}</div>;
}
