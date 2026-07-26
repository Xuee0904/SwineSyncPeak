-- 1. Create the Program Header Table
CREATE TABLE growth_programs (
  program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create the Guidelines (Instruction steps)
CREATE TABLE growth_program_guidelines (
  guideline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES growth_programs(program_id) ON DELETE CASCADE,
  days_after_birth INTEGER NOT NULL,
  activity_type TEXT CHECK (activity_type IN ('FEED', 'MEDICATION', 'SUPPLEMENT', 'PROCEDURE')),
  task_name TEXT NOT NULL,
  item_id UUID REFERENCES inventory_items(item_id), 
  daily_consumption_per_head NUMERIC DEFAULT 0,
  dosage_instructions TEXT
);

-- 3. Enable Row Level Security for new tables
ALTER TABLE growth_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_program_guidelines ENABLE ROW LEVEL SECURITY;

-- 4. Update the existing piglet_batches table
-- Adding only the columns needed for the growth module
ALTER TABLE piglet_batches ADD COLUMN assigned_program_id UUID REFERENCES growth_programs(program_id);
ALTER TABLE piglet_batches ADD COLUMN is_auto_feed_enabled BOOLEAN DEFAULT true;

-- 5. Create Security Policies
CREATE POLICY "Staff can view growth programs" 
ON growth_programs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins have full control of growth programs" 
ON growth_programs FOR ALL TO service_role USING (true);

CREATE POLICY "Staff can view program guidelines" 
ON growth_program_guidelines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage guidelines" 
ON growth_program_guidelines FOR ALL TO service_role USING (true);

-- Assuming a policy named "Staff can update batches" doesn't exist yet, 
-- or you can rename this to be specific.
CREATE POLICY "Staff can update batch growth settings" 
ON piglet_batches FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 6. Insert Sample Data
-- First, create the program
INSERT INTO growth_programs (name, description) 
VALUES ('Commercial Fast-Track', 'High protein diet for 4-month market readiness');

-- Second, add the instructions for that program
INSERT INTO growth_program_guidelines (program_id, days_after_birth, activity_type, task_name, daily_consumption_per_head, item_id)
VALUES 
  ((SELECT program_id FROM growth_programs WHERE name = 'Commercial Fast-Track'), 0, 'FEED', 'Pre-Starter Feed', 0.25, (SELECT item_id FROM inventory_items WHERE item_name = 'Pre-Starter Feed')),
  ((SELECT program_id FROM growth_programs WHERE name = 'Commercial Fast-Track'), 21, 'FEED', 'Grower Feed', 0.80, (SELECT item_id FROM inventory_items WHERE item_name = 'Grower Feed (Premium)')),
  ((SELECT program_id FROM growth_programs WHERE name = 'Commercial Fast-Track'), 3, 'MEDICATION', 'Iron Injection', 0, NULL),
  ((SELECT program_id FROM growth_programs WHERE name = 'Commercial Fast-Track'), 14, 'SUPPLEMENT', 'Vitamin B Complex', 0, NULL);