import express from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { verifyAuth, verifyAdmin } from '../middleware/auth.js';
import { isApprovalTableMissing } from '../helpers/approvalQueue.js';
import {
  executeCreatePig,
  executeCreateBatch,
  executeUpdatePig,
  executeUpdateBatch,
} from './pigs.js';
import { executeTransferSwine } from './pens.js';
import {
  executeCreateHealthLog,
  executeCreateVaccination,
  executeCreateMortality,
} from './health.js';

const router = express.Router();

function getInitials(name) {
  const parts = String(name || 'Admin').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0] || 'AD').substring(0, 2).toUpperCase();
}

// GET /api/approvals
router.get('/api/approvals', verifyAuth, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client (service role key) is not configured on this server.' });
    }

    const { status, module: moduleFilter, search } = req.query;

    let query = supabaseAdmin
      .from('approval_requests')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (!req.isAdmin) {
      query = query.eq('submitted_by_id', String(req.user.id));
    }

    if (status && status !== 'all') {
      query = query.eq('status', String(status).toLowerCase());
    }

    if (moduleFilter && moduleFilter !== 'all') {
      query = query.eq('module', String(moduleFilter).toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      if (isApprovalTableMissing(error)) {
        return res.status(200).json({
          data: [],
          tableMissing: true,
          message: 'Approval requests table is not initialized. Run supabase/0027_approval_requests.sql in Supabase.',
        });
      }
      throw error;
    }

    let rows = data || [];
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      rows = rows.filter((row) =>
        String(row.summary || '').toLowerCase().includes(q) ||
        String(row.action_label || '').toLowerCase().includes(q) ||
        String(row.submitted_by_name || '').toLowerCase().includes(q) ||
        String(row.submitted_by_email || '').toLowerCase().includes(q) ||
        String(row.review_note || '').toLowerCase().includes(q)
      );
    }

    return res.json({ data: rows, tableMissing: false });
  } catch (error) {
    console.error('Error loading approval requests:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/approvals/pending-count
router.get('/api/approvals/pending-count', verifyAuth, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client is not configured.' });
    }

    let query = supabaseAdmin
      .from('approval_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (!req.isAdmin) {
      query = query.eq('submitted_by_id', String(req.user.id));
    }

    const { count, error } = await query;

    if (error) {
      if (isApprovalTableMissing(error)) {
        return res.status(200).json({ count: 0, tableMissing: true });
      }
      throw error;
    }

    return res.json({ count: count ?? 0, tableMissing: false });
  } catch (error) {
    console.error('Error counting pending approvals:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/approvals/:id/approve
router.post('/api/approvals/:id/approve', verifyAdmin, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client is not configured.' });
    }

    const { id } = req.params;
    const cleanNote = req.body?.review_note ? String(req.body.review_note).trim() : null;

    const { data: requestRow, error: fetchErr } = await supabaseAdmin
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      if (isApprovalTableMissing(fetchErr)) {
        return res.status(503).json({ error: 'Approval requests table is not initialized yet.' });
      }
      throw fetchErr;
    }

    if (!requestRow) {
      return res.status(404).json({ error: 'Approval request not found.' });
    }

    if (requestRow.status !== 'pending') {
      return res.status(409).json({
        error: `This request has already been ${requestRow.status}.`,
      });
    }

    const creatorAttribution = `${requestRow.submitted_by_name} (approved by ${req.userName})`;
    const payload = requestRow.payload || {};
    let executionResult = null;

    try {
      switch (requestRow.action) {
        case 'create_pig':
          executionResult = await executeCreatePig({ ...payload, creator: creatorAttribution });
          break;
        case 'create_batch':
          executionResult = await executeCreateBatch({ ...payload, creator: creatorAttribution });
          break;
        case 'update_pig':
          executionResult = await executeUpdatePig(requestRow.target_id, { ...payload, creator: creatorAttribution });
          break;
        case 'update_batch':
          executionResult = await executeUpdateBatch(requestRow.target_id, { ...payload, creator: creatorAttribution });
          break;
        case 'transfer_swine':
          executionResult = await executeTransferSwine({ ...payload, creator: creatorAttribution });
          break;
        case 'create_health_log':
          executionResult = await executeCreateHealthLog({ ...payload, creator: creatorAttribution });
          break;
        case 'create_vaccination':
          executionResult = await executeCreateVaccination({ ...payload, creator: creatorAttribution });
          break;
        case 'create_mortality':
          executionResult = await executeCreateMortality({ ...payload, creator: creatorAttribution });
          break;
        default:
          return res.status(400).json({ error: `Unsupported approval action: ${requestRow.action}` });
      }
    } catch (execErr) {
      return res.status(execErr.statusCode || 400).json({
        error: execErr.message || 'Could not apply the requested change.',
      });
    }

    const { data: updatedRow, error: updateErr } = await supabaseAdmin
      .from('approval_requests')
      .update({
        status: 'approved',
        reviewed_by_id: String(req.user.id),
        reviewed_by_name: req.userName,
        reviewed_by_email: req.userEmail,
        reviewed_at: new Date().toISOString(),
        review_note: cleanNote,
        execution_result: executionResult,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_name: req.userName,
        user_email: req.userEmail,
        user_initials: getInitials(req.userName),
        user_bg_color: 'bg-emerald-100 text-emerald-700',
        event_title: 'Approval Granted',
        event_desc: `Approved ${requestRow.action_label} by ${requestRow.submitted_by_name}: ${requestRow.summary}`,
        status: 'SUCCESS',
      })
      .then(() => {})
      .catch(() => {});

    return res.json({ data: updatedRow, result: executionResult });
  } catch (error) {
    console.error('Error approving request:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/approvals/:id/reject
router.post('/api/approvals/:id/reject', verifyAdmin, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Administrative client is not configured.' });
    }

    const { id } = req.params;
    const cleanNote = req.body?.review_note ? String(req.body.review_note).trim() : '';

    if (!cleanNote) {
      return res.status(400).json({ error: 'A rejection reason is required.' });
    }

    const { data: requestRow, error: fetchErr } = await supabaseAdmin
      .from('approval_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      if (isApprovalTableMissing(fetchErr)) {
        return res.status(503).json({ error: 'Approval requests table is not initialized yet.' });
      }
      throw fetchErr;
    }

    if (!requestRow) {
      return res.status(404).json({ error: 'Approval request not found.' });
    }

    if (requestRow.status !== 'pending') {
      return res.status(409).json({
        error: `This request has already been ${requestRow.status}.`,
      });
    }

    const { data: updatedRow, error: updateErr } = await supabaseAdmin
      .from('approval_requests')
      .update({
        status: 'rejected',
        reviewed_by_id: String(req.user.id),
        reviewed_by_name: req.userName,
        reviewed_by_email: req.userEmail,
        reviewed_at: new Date().toISOString(),
        review_note: cleanNote,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_name: req.userName,
        user_email: req.userEmail,
        user_initials: getInitials(req.userName),
        user_bg_color: 'bg-rose-100 text-rose-700',
        event_title: 'Approval Rejected',
        event_desc: `Rejected ${requestRow.action_label} by ${requestRow.submitted_by_name}: ${requestRow.summary}. Reason: ${cleanNote}`,
        status: 'WARNING',
      })
      .then(() => {})
      .catch(() => {});

    return res.json({ data: updatedRow });
  } catch (error) {
    console.error('Error rejecting request:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
