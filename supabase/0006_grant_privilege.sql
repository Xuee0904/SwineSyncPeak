-- ─── 1. GRANT READ PRIVILEGES TO ALL (ANON + AUTHENTICATED) ──────────────
-- This resolves the permission denied (42501) error for public catalog visitors.
GRANT SELECT ON public.pigs TO anon, authenticated;
GRANT SELECT ON public.piglet_batches TO anon, authenticated;
GRANT SELECT ON public.health_logs TO anon, authenticated;
GRANT SELECT ON public.vaccination_records TO anon, authenticated;
GRANT SELECT ON public.pens TO anon, authenticated;

-- ─── 2. GRANT FULL MANAGEMENT PRIVILEGES TO AUTHENTICATED STAFF ──────────
-- This ensures logged-in caretakers can add, edit, or delete herd records.
GRANT ALL ON public.pigs TO authenticated;
GRANT ALL ON public.piglet_batches TO authenticated;
GRANT ALL ON public.health_logs TO authenticated;
GRANT ALL ON public.vaccination_records TO authenticated;
GRANT ALL ON public.pens TO authenticated;

-- ─── 3. ENSURE PUBLIC SCHEMA USAGE IS ACTIVE ─────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;