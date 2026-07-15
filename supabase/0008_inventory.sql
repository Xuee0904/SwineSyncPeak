-- 1. Master Record (Defines the Unit)
CREATE TABLE inventory_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL UNIQUE,
  unit_of_measure TEXT NOT NULL, -- e.g., 'kg', 'bags', 'ml'
  current_stock_level NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
  ideal_stock_level   NUMERIC NOT NULL DEFAULT 100,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. The Journal (Records the Quantity changes)
CREATE TABLE inventory_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(item_id) ON DELETE CASCADE,
  
  -- Logic: Is this stock coming in or going out?
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('RESTOCK', 'USAGE', 'WASTAGE', 'CORRECTION')),
  
  -- The number here always relates to the 'unit_of_measure' in the master table
  quantity NUMERIC NOT NULL CONSTRAINT chk_qty_positive CHECK (quantity > 0),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO inventory_items (item_name, unit_of_measure, current_stock_level, low_stock_threshold, ideal_stock_level)
VALUES 
  ('Grower Feed (Premium)', 'bags', 45, 20, 100),
  ('Pre-Starter Feed', 'bags', 12, 10, 30),
  ('Amoxicillin (Veterinary)', 'vials', 8, 10, 25), -- Triggering Alert (8 < 10)
  ('Iron Injection (100mg)', 'ml', 450, 150, 1000),
  ('Virkon S Disinfectant', 'liters', 15, 10, 40);

-- 3. POPULATE TRANSACTIONS (The Audit Trail)
-- We will simulate a week of activity to make "Daily Usage" calculations work.

-- USAGE: Grower Feed used daily over the last 4 days
INSERT INTO inventory_transactions (item_id, transaction_type, quantity, notes, created_at)
VALUES 
  ((SELECT item_id FROM inventory_items WHERE item_name = 'Grower Feed (Premium)'), 'USAGE', 5, 'Daily feeding - Morning/Afternoon shift', now() - interval '4 days'),
  ((SELECT item_id FROM inventory_items WHERE item_name = 'Grower Feed (Premium)'), 'USAGE', 6, 'Daily feeding - Morning/Afternoon shift', now() - interval '3 days'),
  ((SELECT item_id FROM inventory_items WHERE item_name = 'Grower Feed (Premium)'), 'USAGE', 5, 'Daily feeding - Morning/Afternoon shift', now() - interval '2 days'),
  ((SELECT item_id FROM inventory_items WHERE item_name = 'Grower Feed (Premium)'), 'USAGE', 7, 'Heavy feeding for Pen B finishers', now() - interval '1 day');

  -- READ: Allow all logged-in staff to see stock levels
CREATE POLICY "Staff can view inventory" 
ON inventory_items FOR SELECT 
TO authenticated 
USING (true);

-- UPDATE: Allow staff to update current_stock_level
CREATE POLICY "Staff can update stock levels" 
ON inventory_items FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- INSERT/DELETE: Only Admins (or your Backend) can add/remove items from the system
CREATE POLICY "Admins have full control of items" 
ON inventory_items FOR ALL 
TO service_role 
USING (true);

-- READ: Allow staff to see the transaction history
CREATE POLICY "Staff can view transaction history" 
ON inventory_transactions FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow staff to record usage or restocks
CREATE POLICY "Staff can record usage and restocks" 
ON inventory_transactions FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- PROTECT HISTORY: Prevent anyone (even staff) from editing or deleting a transaction once logged
-- This ensures the audit trail remains honest.
CREATE POLICY "Prevent history tampering" 
ON inventory_transactions FOR UPDATE 
TO authenticated 
USING (false); -- Returns false, effectively blocking updates

CREATE POLICY "Prevent history deletion" 
ON inventory_transactions FOR DELETE 
TO authenticated 
USING (false); -- Returns false, effectively blocking deletes