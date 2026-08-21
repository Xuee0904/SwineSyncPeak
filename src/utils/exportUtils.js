import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export data to a formatted Excel (.xlsx) file with auto-fitted column widths.
 *
 * @param {Array<Object>} data - The data array to export.
 * @param {Array<Object>} columns - [{ header: 'Header Name', accessor: 'key' | function(row) }]
 * @param {string} filename - The desired filename without extension.
 * @param {string} sheetName - The name of the Excel worksheet tab.
 */
export const exportToExcel = (data, columns, filename, sheetName = 'Records') => {
  if (!data || !data.length) return;

  // Build rows as arrays so SheetJS can map them
  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col => {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
      return val == null ? '' : val;
    })
  );

  // Create worksheet from array-of-arrays
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-fit column widths based on the max character length in each column
  const colWidths = columns.map((col, colIdx) => {
    const headerLen = col.header.length;
    const maxDataLen = rows.reduce((max, row) => {
      const cell = String(row[colIdx] ?? '');
      return Math.max(max, cell.length);
    }, 0);
    return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
  });
  ws['!cols'] = colWidths;

  // Style the header row bold (requires xlsx-style or workaround — skip for now, SheetJS CE doesn't support cell styles)

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Export data to PDF format and trigger download.
 *
 * @param {Array<Object>} data - The data array to export.
 * @param {Array<Object>} columns - The column definitions. [{ header: 'Header Name', accessor: 'key' | function(row) }]
 * @param {string} filename - The desired filename without extension.
 * @param {string} title - The title to display at the top of the PDF.
 */
export const exportToPDF = (data, columns, filename, title = 'Data Export') => {
  if (!data || !data.length) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Extract headers
  const headers = columns.map(col => col.header);

  // Extract rows
  const rows = data.map(row => {
    return columns.map(col => {
      let cellData;
      if (typeof col.accessor === 'function') {
        cellData = col.accessor(row);
      } else {
        cellData = row[col.accessor];
      }
      return cellData == null ? '' : String(cellData);
    });
  });

  // Generate Date timestamp
  const dateStr = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${dateStr}`, 14, 30);

  // Build the table
  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [16, 185, 129], // Emerald 500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    margin: { top: 36, left: 14, right: 14, bottom: 20 },
    didDrawPage: (hookData) => {
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${hookData.pageNumber}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
  });

  doc.save(`${filename}.pdf`);
};

// ─── Helper: draw a colored section header label ─────────────────────────────
const drawSectionHeader = (doc, text, y, color = [15, 118, 110]) => {
  const pageWidth = doc.internal.pageSize.width;
  doc.setFillColor(...color);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 17, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  return y + 10;
};

/**
 * Export a comprehensive single-swine profile PDF.
 *
 * @param {Object} swine         - Core swine/batch data object.
 * @param {Array}  healthLogs    - Health log records array (pass [] to skip).
 * @param {Array}  vaccinations  - Vaccination records array (pass [] to skip).
 * @param {Array}  breedingHistory - Breeding cycle records (pass [] to skip).
 * @param {Object} options       - { includeHealth, includeVaccinations, includeBreeding }
 */
export const exportSwineProfile = (swine, healthLogs = [], vaccinations = [], breedingHistory = [], options = {}) => {
  const {
    includeHealth = true,
    includeVaccinations = true,
    includeBreeding = true,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const dateStr = new Date().toLocaleString();

  const isBatch = swine.category === 'Piglet Batch';
  const tag = swine.pig_tag || swine.batch_tag || swine.id || 'Unknown';
  const dob = swine.date_of_birth ? new Date(swine.date_of_birth).toLocaleDateString() : '—';

  // ── Document Header ──────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`SwineSync — Swine Profile`, 14, 12);

  doc.setFontSize(11);
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text(`#${tag}`, 14, 20);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated on: ${dateStr}`, pageWidth - 14, 20, { align: 'right' });

  // ── Core Specifications ──────────────────────────────────────────────────────
  let y = 36;
  y = drawSectionHeader(doc, 'CORE SPECIFICATIONS', y);

  const specs = [
    ['Swine Tag', `#${tag}`, 'Category', swine.category || '—'],
    ['Breed', swine.breed || '—', 'Date of Birth', dob],
    ['Status', swine.status || '—', 'Pen', swine.pen_code || '—'],
    ['Current Weight', swine.current_weight != null ? `${Number(swine.current_weight).toFixed(1)} kg` : '—', 'Age', swine.age_weeks != null ? `${swine.age_weeks} weeks` : '—'],
  ];

  if (swine.category === 'Sow') {
    specs.push(['Parity', swine.parity_count != null ? (swine.parity_count === 0 ? '0 — not yet farrowed' : `#${swine.parity_count}`) : '—', 'Source Origin', (swine.source_origin || '').replace(/_/g, ' ')]);
  }
  if (isBatch) {
    specs.push(['Born Alive', swine.total_born_alive ?? '—', 'Current Count', swine.current_count ?? '—']);
  }

  autoTable(doc, {
    startY: y,
    body: specs,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
      1: { textColor: [30, 41, 59], cellWidth: 52 },
      2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 38 },
      3: { textColor: [30, 41, 59], cellWidth: 52 },
    },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // ── Breeding History (Sow only) ───────────────────────────────────────────────
  if (includeBreeding && swine.category === 'Sow' && breedingHistory.length > 0) {
    y = doc.lastAutoTable.finalY + 8;
    y = drawSectionHeader(doc, `REPRODUCTIVE & BREEDING HISTORY  (${breedingHistory.length} cycle${breedingHistory.length !== 1 ? 's' : ''})`, y, [157, 23, 77]);

    const breedingRows = breedingHistory.map((c, idx) => [
      `Cycle ${breedingHistory.length - idx}`,
      c.breeding_date ? new Date(c.breeding_date).toLocaleDateString() : '—',
      c.boar_tag || c.boar_id || '—',
      c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : '—',
      c.expected_farrowing_date ? new Date(c.expected_farrowing_date).toLocaleDateString() : '—',
      c.actual_farrowing_date ? new Date(c.actual_farrowing_date).toLocaleDateString() : '—',
      c.total_born_alive ?? '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Cycle', 'Breeding Date', 'Boar', 'Outcome', 'Expected Farrowing', 'Actual Farrowing', 'Born Alive']],
      body: breedingRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [157, 23, 77], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 241, 242] },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Health Logs ──────────────────────────────────────────────────────────────
  if (includeHealth) {
    y = doc.lastAutoTable.finalY + 8;
    y = drawSectionHeader(doc, `HEALTH & MEDICAL HISTORY  (${healthLogs.length} record${healthLogs.length !== 1 ? 's' : ''})`, y, [5, 150, 105]);

    if (healthLogs.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('No health logs recorded yet.', 14, y + 2);
      y += 8;
    } else {
      const healthRows = healthLogs.map(h => [
        h.checkup_date ? new Date(h.checkup_date).toLocaleDateString() : '—',
        h.diagnosis || '—',
        h.symptoms || '—',
        h.treatment || '—',
        h.medication || '—',
        h.vet_name || '—',
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Diagnosis', 'Symptoms', 'Treatment', 'Medication', 'Veterinarian']],
        body: healthRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        margin: { left: 14, right: 14 },
      });
    }
  }

  // ── Vaccination Records ───────────────────────────────────────────────────────
  if (includeVaccinations) {
    y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 8;
    y = drawSectionHeader(doc, `VACCINATION & IMMUNIZATION PASSPORT  (${vaccinations.length} dose${vaccinations.length !== 1 ? 's' : ''})`, y, [67, 56, 202]);

    if (vaccinations.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('No vaccinations recorded yet.', 14, y + 2);
    } else {
      const vaccRows = vaccinations.map(v => [
        v.vaccine_name || v.vaccine || '—',
        v.administered_date ? new Date(v.administered_date).toLocaleDateString() : '—',
        v.dosage || '—',
        v.lot_number || '—',
        v.next_due_date ? new Date(v.next_due_date).toLocaleDateString() : '—',
        v.administered_by || '—',
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Vaccine', 'Date Administered', 'Dosage', 'Lot No.', 'Next Due', 'Administered By']],
        body: vaccRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        margin: { left: 14, right: 14 },
      });
    }
  }

  // ── Page numbers ──────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 8, { align: 'center' });
  }

  doc.save(`swine_profile_${tag.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

