-- Public swine availability

CREATE OR REPLACE FUNCTION public.get_swine_availability()
RETURNS TABLE (category text, head_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH   latest_batch_log AS (
    SELECT DISTINCT ON (batch_id) batch_id, lower(status) AS status
    FROM health_logs
    WHERE batch_id IS NOT NULL
    ORDER BY batch_id, log_date DESC
  ),
  batch_counts AS (
    SELECT
      --   Weaner   : 28 to 89 days old
      --   Fattener : 90 days and older
      CASE
        WHEN (CURRENT_DATE - b.date_of_birth) >= 28 AND (CURRENT_DATE - b.date_of_birth) < 90 THEN 'Weaner'
        WHEN (CURRENT_DATE - b.date_of_birth) >= 90 THEN 'Fattener'
      END AS category,
      sum(COALESCE(b.current_count, 0)) AS n
    FROM piglet_batches b
    LEFT JOIN latest_batch_log l ON l.batch_id = b.batch_id
    WHERE NOT COALESCE(b.is_archived, false)
      AND COALESCE(l.status, '') NOT IN ('sick', 'quarantine', 'under treatment', 'sick batch')
    GROUP BY 1
  )
  SELECT
    c.category,
    COALESCE((SELECT n FROM batch_counts WHERE category = c.category), 0)::bigint AS head_count
  FROM (VALUES ('Weaner'), ('Fattener')) AS c(category);
$$;

REVOKE ALL ON FUNCTION public.get_swine_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_swine_availability() TO anon, authenticated;

GRANT SELECT ON public.pigs                TO anon, authenticated;
GRANT SELECT ON public.piglet_batches      TO anon, authenticated;
GRANT SELECT ON public.health_logs         TO anon, authenticated;
GRANT SELECT ON public.vaccination_records TO anon, authenticated;

