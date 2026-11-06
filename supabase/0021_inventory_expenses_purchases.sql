-- ==============================================================================
-- 0021_inventory_expenses_purchases.sql
-- SwineSync: Financial Outflows & Inventory Purchasing
-- ==============================================================================

-- 1. Upgrade INVENTORY_ITEMS with category, unit_cost, archiving, and description
ALTER TABLE public.inventory_items 
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Feed',
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for category search
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

-- 2. Create EXPENSES table (Receipt / Invoice Header)
CREATE TABLE IF NOT EXISTS public.expenses (
  expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Feed & Supplies',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  date_incurred DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT,
  receipt_no TEXT,
  payment_method TEXT DEFAULT 'Cash', -- 'Cash', 'GCash', 'Bank Transfer', 'Credit'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for expense lookups
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date_incurred DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- 3. Create INVENTORY_PURCHASES table (Line items per expense receipt)
CREATE TABLE IF NOT EXISTS public.inventory_purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(expense_id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE RESTRICT,
  quantity_bought NUMERIC NOT NULL CHECK (quantity_bought > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC GENERATED ALWAYS AS (quantity_bought * unit_price) STORED,
  batch_number TEXT,
  expiration_date DATE,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_purchases_expense ON public.inventory_purchases(expense_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_item ON public.inventory_purchases(item_id);

-- 4. Upgrade INVENTORY_TRANSACTIONS to track responsible user & purchase link
ALTER TABLE public.inventory_transactions 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.inventory_purchases(purchase_id) ON DELETE SET NULL;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

-- Policies for expenses
CREATE POLICY "Allow public read access to expenses"
  ON public.expenses FOR SELECT TO public
  USING (true);

CREATE POLICY "Allow authenticated staff to manage expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for inventory_purchases
CREATE POLICY "Allow public read access to inventory_purchases"
  ON public.inventory_purchases FOR SELECT TO public
  USING (true);

CREATE POLICY "Allow authenticated staff to manage inventory_purchases"
  ON public.inventory_purchases FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure public read and staff management on inventory_items and inventory_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_items' AND policyname = 'Allow public read access to inventory_items'
  ) THEN
    CREATE POLICY "Allow public read access to inventory_items" ON public.inventory_items FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_items' AND policyname = 'Allow authenticated staff to manage inventory_items'
  ) THEN
    CREATE POLICY "Allow authenticated staff to manage inventory_items" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_transactions' AND policyname = 'Allow public read access to inventory_transactions'
  ) THEN
    CREATE POLICY "Allow public read access to inventory_transactions" ON public.inventory_transactions FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inventory_transactions' AND policyname = 'Allow authenticated staff to insert inventory_transactions'
  ) THEN
    CREATE POLICY "Allow authenticated staff to insert inventory_transactions" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 6. Grant Schema Privileges (Fixes 42501 Permission Denied)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Master inventory items
GRANT SELECT ON public.inventory_items TO anon, authenticated;
GRANT ALL ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

-- Inventory transactions / journal
GRANT SELECT ON public.inventory_transactions TO anon, authenticated;
GRANT ALL ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;

-- Expenses
GRANT SELECT ON public.expenses TO anon, authenticated;
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

-- Inventory purchases
GRANT SELECT ON public.inventory_purchases TO anon, authenticated;
GRANT ALL ON public.inventory_purchases TO authenticated;
GRANT ALL ON public.inventory_purchases TO service_role;

