-- Migration: Add created_at timestamp to pigs and piglet_batches for accurate "Most Recently Added" sorting
-- Run this in your Supabase SQL Editor

-- 1. Add created_at column with default now() to pigs table
ALTER TABLE public.pigs 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- 2. Add created_at column with default now() to piglet_batches table
ALTER TABLE public.piglet_batches 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- 3. Document the columns
COMMENT ON COLUMN public.pigs.created_at IS 'Timestamp when the swine record was registered/created in the system';
COMMENT ON COLUMN public.piglet_batches.created_at IS 'Timestamp when the piglet batch was registered/created in the system';
