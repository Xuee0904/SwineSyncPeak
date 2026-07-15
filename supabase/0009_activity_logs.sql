-- 1. Create the activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(150) NOT NULL,
    user_initials VARCHAR(10),
    user_bg_color VARCHAR(50) DEFAULT 'bg-slate-100 text-slate-700',
    event_title VARCHAR(100) NOT NULL,
    event_desc TEXT,
    status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'BLOCKED', 'WARNING'))
);

-- 2. Clear out any previous mock logs
TRUNCATE TABLE activity_logs;

-- 3. Populate with highly realistic records matching your dashboard events
INSERT INTO activity_logs (timestamp, user_name, user_email, user_initials, user_bg_color, event_title, event_desc, status)
VALUES
  (timezone('utc', now() - INTERVAL '12 minutes'), 'John Doe', 'j.doe@swinesync.ag', 'JD', 'bg-emerald-100 text-emerald-700', 'Record Updated', 'Modified breeding cycle status for Pen B3.', 'SUCCESS'),
  (timezone('utc', now() - INTERVAL '45 minutes'), 'Admin System', 'system@internal', 'AS', 'bg-slate-100 text-slate-700', 'Bulk Export', 'Financial audit log for Q3 2024 was exported.', 'SUCCESS'),
  (timezone('utc', now() - INTERVAL '2 hours'), 'Unknown User', 'auth.fail@gateway', '??', 'bg-rose-100 text-rose-700', 'Failed Login', 'Invalid credentials provided for portal access.', 'BLOCKED'),
  (timezone('utc', now() - INTERVAL '4 hours'), 'Sarah Miller', 's.miller@swinesync.ag', 'SM', 'bg-sky-100 text-sky-700', 'Inventory Audit', 'Feed storage silo #2 volume checked and logged.', 'SUCCESS'),
  (timezone('utc', now() - INTERVAL '6 hours'), 'John Doe', 'j.doe@swinesync.ag', 'JD', 'bg-emerald-100 text-emerald-700', 'Permissions Changed', 'Granted "Audit Viewer" role to visitor account.', 'WARNING');

  -- Create a policy that allows logged-in (authenticated) staff members to view logs
CREATE POLICY "Allow authenticated staff to select logs" 
ON activity_logs 
FOR SELECT 
TO authenticated 
USING (true);

-- Explicitly grant full administrative and api privileges for the activity_logs table
GRANT ALL ON TABLE activity_logs TO service_role;
GRANT ALL ON TABLE activity_logs TO postgres;

-- (Optional) Also grant select privileges to authenticated staff members 
GRANT SELECT ON TABLE activity_logs TO authenticated;