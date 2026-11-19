import { supabaseAdmin } from '../supabaseClient.js';

export function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function isApprovalTableMissing(err) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const message = String(err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('approval_requests')
  );
}

function getInitials(name) {
  const parts = String(name || 'Staff').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0] || 'ST').substring(0, 2).toUpperCase();
}

export async function queueApprovalRequest({
  req,
  module,
  action,
  actionLabel,
  summary,
  targetId = null,
  payload,
  beforeSnapshot = null,
}) {
  if (!supabaseAdmin) {
    throw createHttpError(500, 'Administrative client (service role key) is not configured on this server.');
  }

  const submittedById = req.user?.id;
  const submittedByName = req.userName || 'Staff';
  const submittedByEmail = req.userEmail || 'staff@swinesync.ag';

  if (!submittedById) {
    throw createHttpError(401, 'Authenticated user identity is required to submit for approval.');
  }

  const { data, error } = await supabaseAdmin
    .from('approval_requests')
    .insert({
      module,
      action,
      action_label: actionLabel,
      summary,
      target_id: targetId ? String(targetId) : null,
      payload,
      before_snapshot: beforeSnapshot,
      status: 'pending',
      submitted_by_id: String(submittedById),
      submitted_by_name: submittedByName,
      submitted_by_email: submittedByEmail,
    })
    .select()
    .single();

  if (error) {
    if (isApprovalTableMissing(error)) {
      throw createHttpError(
        503,
        'Approval queue table is not initialized yet. Run supabase/0027_approval_requests.sql in Supabase first.'
      );
    }
    throw createHttpError(500, error.message || 'Failed to queue approval request.');
  }

  await supabaseAdmin
    .from('activity_logs')
    .insert({
      user_name: submittedByName,
      user_email: submittedByEmail,
      user_initials: getInitials(submittedByName),
      user_bg_color: 'bg-amber-100 text-amber-700',
      event_title: 'Submitted for Approval',
      event_desc: `${actionLabel}: ${summary}`,
      status: 'INFO',
    })
    .then(() => {})
    .catch((logErr) => {
      console.warn('[ApprovalQueue] Failed to record activity log:', logErr?.message);
    });

  return data;
}
