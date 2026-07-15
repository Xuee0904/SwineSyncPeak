-- 1. Create the new breeds table
CREATE TABLE breeds (
  breed_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable RLS and set policies for breeds
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to breeds" 
ON breeds FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write breeds"
ON breeds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Seed the breeds table with your existing unique breeds
INSERT INTO breeds (name) 
VALUES 
  ('Berkshire'), 
  ('Duroc'), 
  ('Hampshire'),
  ('Landrace'), 
  ('Large White'), 
  ('Pietrain'),
  ('Yorkshire');


-- 4. Update the PIGS table to use a Foreign Key
-- First, add the new column
ALTER TABLE pigs ADD COLUMN breed_id UUID REFERENCES breeds(breed_id) ON DELETE SET NULL;

-- Migrate existing data from 'breed' (text) to 'breed_id' (UUID)
UPDATE pigs p
SET breed_id = b.breed_id
FROM breeds b
WHERE p.breed = b.name;

-- Now remove the old text-based breed column
ALTER TABLE pigs DROP COLUMN breed;

-- 5. Update the PIGLET_BATCHES table
-- Note: Your original DDL didn't have a breed column, but we will add one now as requested.
ALTER TABLE piglet_batches ADD COLUMN breed_id UUID REFERENCES breeds(breed_id) ON DELETE SET NULL;

-- If you want to automatically assign the breed of the Sow to the batch:
UPDATE piglet_batches pb
SET breed_id = p.breed_id
FROM pigs p
WHERE pb.sow_id = p.pig_id;

create policy "Allow public read access"
on public.breeds for select
to anon
using (true);