-- ====================================================================
-- SwineSync: Sales Transactions & Financial Schema Migration
-- Run this script in the Supabase SQL Editor:
-- 1. Adds 'status' column to existing expenses table
-- 2. Creates sales_transactions table
-- 3. Creates sold_swine table
-- ====================================================================

-- 1. Enhance existing expenses table with payment status
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Completed';

-- 2. Create sales_transactions table
CREATE TABLE IF NOT EXISTS public.sales_transactions (
  sale_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  receipt_no text,
  buyer_name text NOT NULL,
  category text NOT NULL, -- 'Finisher hogs', 'Breeding sows', 'Piglets', 'Boars'
  total_price numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'Cash', -- 'Cash', 'Bank transfer', 'GCash', 'Check', 'Over the counter'
  status text DEFAULT 'Completed', -- 'Completed', 'Pending', 'Overdue', 'Cancelled'
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Create sold_swine table (line items linking to pigs or piglet_batches)
CREATE TABLE IF NOT EXISTS public.sold_swine (
  item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales_transactions(sale_id) ON DELETE CASCADE,
  pig_id uuid REFERENCES public.pigs(pig_id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.piglet_batches(batch_id) ON DELETE SET NULL,
  item_description text, -- e.g. 'Finisher hog (~100 kg)' or 'Weaned piglet'
  quantity_sold integer NOT NULL DEFAULT 1,
  sale_weight numeric,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable Row Level Security (RLS) policies or ensure service role has full access
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sold_swine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated and service role" ON public.sales_transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated and service role" ON public.sold_swine
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Grant explicit table & sequence permissions to Supabase roles
GRANT ALL ON TABLE public.sales_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sold_swine TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

