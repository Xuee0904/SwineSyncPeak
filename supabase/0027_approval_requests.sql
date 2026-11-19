-- 0027_approval_requests.sql
-- Queue table for staff-submitted adds/updates requiring administrator approval.

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL CHECK (module IN ('swine', 'pens', 'health')),
  action text NOT NULL CHECK (
    action IN (
      'create_pig',
      'create_batch',
      'update_pig',
      'update_batch',
      'transfer_swine',
      'create_health_log',
      'create_vaccination',
      'create_mortality'
    )
  ),
  action_label text NOT NULL,
  summary text NOT NULL,
  target_id text NULL,
  payload jsonb NOT NULL,
  before_snapshot jsonb NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by_id text NOT NULL,
  submitted_by_name text NOT NULL,
  submitted_by_email text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_id text NULL,
  reviewed_by_name text NULL,
  reviewed_by_email text NULL,
  reviewed_at timestamptz NULL,
  review_note text NULL,
  execution_result jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_submitted_at
  ON public.approval_requests (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_submitter_submitted_at
  ON public.approval_requests (submitted_by_id, submitted_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access to approval_requests" ON public.approval_requests;
CREATE POLICY "Allow authenticated read access to approval_requests"
  ON public.approval_requests
  FOR SELECT
  TO authenticated
  USING (true);

GRANT ALL ON TABLE public.approval_requests TO service_role;
GRANT SELECT ON TABLE public.approval_requests TO authenticated;
