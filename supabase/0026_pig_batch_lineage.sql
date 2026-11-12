-- Lineage for pigs promoted from piglet batches
ALTER TABLE public.pigs
  ADD COLUMN IF NOT EXISTS source_batch_id UUID REFERENCES public.piglet_batches(batch_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_batch_tag TEXT,
  ADD COLUMN IF NOT EXISTS dam_id UUID REFERENCES public.pigs(pig_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.pigs.source_batch_id  IS 'Piglet batch this pig was promoted from';
COMMENT ON COLUMN public.pigs.source_batch_tag IS 'Snapshot of batch tag (survives batch deletion)';
COMMENT ON COLUMN public.pigs.dam_id           IS 'Mother sow (copied from piglet_batches.sow_id)';
COMMENT ON COLUMN public.pigs.promoted_at      IS 'When the pig was promoted into the breeding herd';

