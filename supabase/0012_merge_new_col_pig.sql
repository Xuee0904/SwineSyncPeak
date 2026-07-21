-- Migration: Add Source Origin, Supplier Name, and Arrival Date to pigs & piglet_batches tables
-- Run this in your Supabase SQL Editor

-- 1. Add fields to adult pigs table (Sows & Boars)
ALTER TABLE public.pigs 
  ADD COLUMN IF NOT EXISTS source_origin text DEFAULT 'born_in_farm',
  ADD COLUMN IF NOT EXISTS supplier_name text NULL,
  ADD COLUMN IF NOT EXISTS arrival_date date NULL;

-- 2. Add fields to piglet_batches table
ALTER TABLE public.piglet_batches 
  ADD COLUMN IF NOT EXISTS source_origin text DEFAULT 'born_in_farm',
  ADD COLUMN IF NOT EXISTS supplier_name text NULL,
  ADD COLUMN IF NOT EXISTS arrival_date date NULL;

-- 3. Add column descriptions/comments for documentation
COMMENT ON COLUMN public.pigs.source_origin IS 'Origin of the animal: born_in_farm, purchased, or transferred';
COMMENT ON COLUMN public.pigs.supplier_name IS 'Name of external supplier, farm, or breeder if purchased/transferred';
COMMENT ON COLUMN public.pigs.arrival_date IS 'Date the animal arrived at the facility if purchased/transferred';

COMMENT ON COLUMN public.piglet_batches.source_origin IS 'Origin of the batch: born_in_farm, purchased, or transferred';
COMMENT ON COLUMN public.piglet_batches.supplier_name IS 'Name of external supplier, farm, or breeder if purchased/transferred';
COMMENT ON COLUMN public.piglet_batches.arrival_date IS 'Date the batch arrived at the facility if purchased/transferred';
