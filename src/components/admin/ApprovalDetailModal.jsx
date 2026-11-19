import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Package,
  CalendarCheck,
  User,
  ArrowRight,
} from 'lucide-react';
import useModalAnimation from '../../hooks/useModalAnimation';
import { formatTimestamp } from '../../utils/formatTimestamp';
import toast from '../../utils/toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const MODULE_LABELS = {
  swine: 'Swine Management',
  pens: 'Pen Management',
  health: 'Health Management',
};

const STATUS_META = {
  pending: {
    label: 'Pending Review',
    Icon: Clock,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Approved',
    Icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    Icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

function formatFieldValue(val) {
  if (val === null || val === undefined || val === '') return 'Not specified';
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'None';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

function buildDetailRows(request) {
  const payload = request?.payload || {};
  switch (request?.action) {
    case 'create_pig':
      return [
        { label: 'Tag Number', value: payload.tagNumber },
        { label: 'Gender', value: payload.gender },
        { label: 'Breed', value: payload.breed },
        { label: 'Target Pen', value: payload.penCode || payload.penId },
        { label: 'Weight (kg)', value: payload.weight ? `${payload.weight} kg` : 'Not specified' },
        { label: 'Status', value: payload.status },
        { label: 'Date of Birth', value: payload.dateOfBirth },
        { label: 'Source Origin', value: payload.sourceOrigin || payload.source_origin },
        { label: 'Supplier', value: payload.supplierName || payload.supplier_name },
        { label: 'Arrival Date', value: payload.arrivalDate || payload.arrival_date },
      ];
    case 'create_batch':
      return [
        { label: 'Batch Tag', value: payload.batchTag || payload.batchId },
        { label: 'Target Pen', value: payload.penCode || payload.penId || payload.penLocation },
        { label: 'Breed', value: payload.breed },
        { label: 'Status', value: payload.status },
        { label: 'Date of Birth', value: payload.dateOfBirth },
        { label: 'Current Headcount', value: payload.currentCount ?? payload.totalHerdCount },
        { label: 'Born Alive', value: payload.totalBornAlive },
        { label: 'Stillborn', value: payload.stillbornCount },
        { label: 'Mummy Count', value: payload.mummyCount },
        { label: 'Average Weight (kg)', value: payload.averageWeight ? `${payload.averageWeight} kg` : 'Not specified' },
        { label: 'Source Origin', value: payload.sourceOrigin || payload.source_origin },
      ];
    case 'transfer_swine':
      return [
        { label: 'Source Pen', value: payload.sourcePenCode || payload.sourcePenId },
        { label: 'Destination Pen', value: payload.destinationPenCode || payload.destinationPenId },
        { label: 'Individual Pigs', value: payload.pigTags?.length ? payload.pigTags.join(', ') : 'None' },
        { label: 'Piglet Batches', value: payload.batchTags?.length ? payload.batchTags.join(', ') : 'None' },
        { label: 'Total Heads Moving', value: payload.totalHeads },
      ];
    case 'create_health_log':
      return [
        { label: 'Swine / Batch', value: payload.targetTag || payload.pig_id || payload.batch_id },
        { label: 'Clinical Status', value: payload.status },
        { label: 'Diagnosis', value: payload.diagnosis },
        { label: 'Symptoms', value: payload.symptoms },
        { label: 'Treatment', value: payload.treatment },
        { label: 'Medication', value: payload.medication_name },
        { label: 'Dosage', value: payload.dosage },
        { label: 'Examined By', value: payload.examined_by },
        { label: 'Mortality Count', value: payload.status === 'deceased' ? (payload.mortality_count || 1) : null },
        { label: 'Notes', value: payload.notes },
      ].filter((row) => row.value !== null && row.value !== undefined && row.value !== '');
    case 'create_vaccination':
      return [
        { label: 'Swine / Batch', value: payload.targetTag || payload.pig_id || payload.batch_id },
        { label: 'Vaccine Name', value: payload.vaccine_name },
        { label: 'Administered Date', value: payload.administered_date },
        { label: 'Dosage', value: payload.dosage },
        { label: 'Booster Due Date', value: payload.booster_due_date },
        { label: 'Administered By', value: payload.administered_by },
      ];
    case 'create_mortality':
      return [
        { label: 'Swine / Batch', value: payload.targetTag || payload.pig_id || payload.batch_id },
        { label: 'Cause of Mortality', value: payload.cause },
        { label: 'Action Taken', value: payload.action_taken },
      ];
    default:
      return Object.entries(payload).map(([key, value]) => ({
        label: key,
        value: typeof value === 'object' ? JSON.stringify(value) : value,
      }));
  }
}

export default function ApprovalDetailModal({
  request,
  isAdmin = false,
  initialMode = 'inspect',
  onClose,
  onSuccess,
}) {
  const isOpen = Boolean(request);
  const { shouldRender, isClosing, requestClose, overlayClassName, panelClassName } =
    useModalAnimation(isOpen, onClose);

  if (!shouldRender || !request) return null;

  return (
    <ApprovalDetailModalBody
      key={`${request.id}-${initialMode}`}
      request={request}
      isAdmin={isAdmin}
      initialMode={initialMode}
      onSuccess={onSuccess}
      isClosing={isClosing}
      requestClose={requestClose}
      overlayClassName={overlayClassName}
      panelClassName={panelClassName}
    />
  );
}

function ApprovalDetailModalBody({
  request,
  isAdmin,
  initialMode,
  onSuccess,
  isClosing,
  requestClose,
  overlayClassName,
  panelClassName,
}) {
  const [mode, setMode] = useState(initialMode === 'reject' ? 'reject' : 'inspect');
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const rejectTextareaRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        requestClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submitting, requestClose]);

  useEffect(() => {
    if (mode === 'reject' && rejectTextareaRef.current) {
      rejectTextareaRef.current.focus();
    }
  }, [mode]);

  const statusMeta = STATUS_META[request.status] || STATUS_META.pending;
  const StatusIcon = statusMeta.Icon;
  const payload = request.payload || {};
  const before = request.before_snapshot || null;
  const isUpdateAction = request.action === 'update_pig' || request.action === 'update_batch';
  const detailRows = isUpdateAction ? [] : buildDetailRows(request);
  const hasStockDeduction =
    (request.action === 'create_health_log' || request.action === 'create_vaccination') &&
    Number(payload.quantity_deducted) > 0;

  const handleApprove = async () => {
    setSubmitting(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE}/api/approvals/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_note: approvalNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Failed to approve request (${res.status}).`);
      }
      toast.success('Request approved', `${request.action_label} has been applied.`);
      onSuccess?.('approved', json.data);
      requestClose();
    } catch (err) {
      setApiError(err.message || 'Could not apply this request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setApiError('Please provide a reason so the staff member knows what to fix.');
      return;
    }
    setSubmitting(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE}/api/approvals/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_note: trimmedReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Failed to reject request (${res.status}).`);
      }
      toast.info('Request rejected', `Feedback sent to ${request.submitted_by_name}.`);
      onSuccess?.('rejected', json.data);
      requestClose();
    } catch (err) {
      setApiError(err.message || 'Could not reject this request.');
    } finally {
      setSubmitting(false);
    }
  };

  const prevWeight = before?.weight !== null && before?.weight !== undefined ? `${before.weight} kg` : 'Unset';
  const nextWeightRaw = payload.averageWeight ?? payload.weight;
  const nextWeight = nextWeightRaw !== null && nextWeightRaw !== undefined && nextWeightRaw !== ''
    ? `${nextWeightRaw} kg`
    : 'Unset';
  const prevStatus = before?.status || 'Unset';
  const nextStatus = payload.status || 'Unset';

  return createPortal(
    <div
      className={`fixed inset-0 lg:left-64 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-xs ${overlayClassName} ${isClosing ? 'pointer-events-none' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-detail-title"
    >
      <div
        className={`w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-200/80 text-slate-800">
                {MODULE_LABELS[request.module] || request.module}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusMeta.badgeClass}`}>
                <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{statusMeta.label}</span>
              </span>
            </div>
            <h2 id="approval-detail-title" className="text-base sm:text-lg font-bold text-slate-900 mt-1.5">
              {request.action_label}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => !submitting && requestClose()}
            disabled={submitting}
            aria-label="Close approval details"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-left">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Summary</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{request.summary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Submitted By</span>
              </p>
              <p className="text-sm font-bold text-slate-900 mt-1">{request.submitted_by_name}</p>
              <p className="text-xs text-slate-600 truncate">{request.submitted_by_email}</p>
              <p className="text-xs text-slate-600 mt-1">{formatTimestamp(request.submitted_at)}</p>
            </div>

            {request.reviewed_at ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-xs font-semibold text-slate-600">Reviewed By</p>
                <p className="text-sm font-bold text-slate-900 mt-1">{request.reviewed_by_name || 'Administrator'}</p>
                <p className="text-xs text-slate-600 truncate">{request.reviewed_by_email || ''}</p>
                <p className="text-xs text-slate-600 mt-1">{formatTimestamp(request.reviewed_at)}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-600">Review Status</p>
                <p className="text-sm font-semibold text-amber-800 mt-1">
                  Waiting for administrator decision
                </p>
              </div>
            )}
          </div>

          {request.review_note && (
            <div
              className={`rounded-xl border p-3.5 ${
                request.status === 'rejected'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide">
                {request.status === 'rejected' ? 'Rejection Reason' : 'Reviewer Note'}
              </p>
              <p className="text-sm mt-1">{request.review_note}</p>
            </div>
          )}

          {hasStockDeduction && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5 text-amber-900">
              <Package className="w-4 h-4 mt-0.5 shrink-0 text-amber-800" aria-hidden="true" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold">Inventory Deduction Notice</p>
                <p className="mt-0.5">
                  Approving this submission will deduct{' '}
                  <span className="font-bold">
                    {payload.quantity_deducted}
                    {payload.itemUnit ? ` ${payload.itemUnit}` : ''}
                  </span>{' '}
                  from <span className="font-bold">{payload.itemName || 'linked inventory item'}</span>.
                </p>
              </div>
            </div>
          )}

          {payload.growth_task_id && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-slate-800">
              <CalendarCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <p className="text-xs leading-relaxed">
                Approving this request will also mark the linked scheduled growth task as completed.
              </p>
            </div>
          )}

          {isUpdateAction && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Proposed Field Changes ({before?.tag || payload.tagNumber || 'Swine'})
                </h3>
                {before?.penCode && (
                  <span className="text-xs font-semibold text-slate-600">Pen {before.penCode}</span>
                )}
              </div>
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs bg-white items-center">
                  <span className="font-semibold text-slate-700">Weight</span>
                  <span className="text-slate-600">{prevWeight}</span>
                  <span className={`font-bold flex items-center gap-1 ${prevWeight !== nextWeight ? 'text-emerald-700' : 'text-slate-700'}`}>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{nextWeight}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs bg-white items-center">
                  <span className="font-semibold text-slate-700">Status</span>
                  <span className="text-slate-600 capitalize">{prevStatus}</span>
                  <span className={`font-bold flex items-center gap-1 capitalize ${prevStatus !== nextStatus ? 'text-emerald-700' : 'text-slate-700'}`}>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{nextStatus}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isUpdateAction && detailRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Submitted Details</h3>
              </div>
              <dl className="divide-y divide-slate-200">
                {detailRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 px-4 py-2.5 text-xs bg-white">
                    <dt className="font-semibold text-slate-600">{row.label}</dt>
                    <dd className="sm:col-span-2 font-medium text-slate-900 break-words">
                      {formatFieldValue(row.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {apiError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 flex items-start gap-2.5 text-rose-800"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs font-semibold">{apiError}</p>
            </div>
          )}

          {isAdmin && request.status === 'pending' && mode === 'reject' && (
            <form onSubmit={handleReject} id="approval-reject-form" className="space-y-3 pt-1">
              <div>
                <label htmlFor="approval-rejection-reason" className="block text-xs font-bold text-slate-800 mb-1.5">
                  Rejection Reason (Required)
                </label>
                <textarea
                  ref={rejectTextareaRef}
                  id="approval-rejection-reason"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain what needs to be corrected before resubmitting..."
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiError('');
                    setMode('inspect');
                  }}
                  disabled={submitting}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-1"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {isAdmin && request.status === 'pending' && mode !== 'reject' && (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 space-y-3">
            <div>
              <label htmlFor="approval-optional-note" className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Note for Staff
              </label>
              <input
                id="approval-optional-note"
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Add an optional confirmation note..."
                disabled={submitting}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-slate-900 placeholder-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setApiError('');
                  setMode('reject');
                }}
                disabled={submitting}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                <XCircle className="w-4 h-4" aria-hidden="true" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Approve and Apply</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
