-- Grant service_role full access to vaccination_records
GRANT ALL ON TABLE public.vaccination_records TO service_role;

-- Grant service_role full access to health_logs
GRANT ALL ON TABLE public.health_logs TO service_role;

-- Grant service_role full access to mortality_logs
GRANT ALL ON TABLE public.mortality_logs TO service_role;
