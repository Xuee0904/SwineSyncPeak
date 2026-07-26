-- 1. Create the Batch Activity Logs Table
CREATE TABLE batch_activity_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES piglet_batches(batch_id) ON DELETE CASCADE,
  activity_type TEXT CHECK (activity_type IN ('FEED', 'MEDICATION', 'SUPPLEMENT', 'PROCEDURE')),
  guideline_id UUID REFERENCES growth_program_guidelines(guideline_id) ON DELETE SET NULL,
  amount_given NUMERIC DEFAULT 0,
  performed_by TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- 2. Enable Row Level Security
ALTER TABLE batch_activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create Security Policies
CREATE POLICY "Staff can view batch activity logs" 
ON batch_activity_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert batch activity logs" 
ON batch_activity_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins have full control of batch activity logs" 
ON batch_activity_logs FOR ALL TO service_role USING (true);
