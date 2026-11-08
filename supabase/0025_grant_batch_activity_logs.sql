-- ==============================================================================
-- 0025_grant_batch_activity_logs.sql
-- Grant table privileges on batch_activity_logs to service_role, authenticated, and anon
-- ==============================================================================

GRANT ALL ON TABLE public.batch_activity_logs TO service_role;
GRANT ALL ON TABLE public.batch_activity_logs TO authenticated;
GRANT SELECT ON TABLE public.batch_activity_logs TO anon;

