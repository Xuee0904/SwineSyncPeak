CREATE TABLE pigs (
  pig_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pig_tag TEXT NOT NULL UNIQUE,
  date_of_birth DATE,
  breed TEXT,
  gender TEXT NOT NULL, -- 'F' (female), 'M' (male) or full terms
  weight NUMERIC CONSTRAINT chk_pig_weight_positive CHECK (weight >= 0),
  pen_id UUID REFERENCES pens(pen_id) ON DELETE SET NULL,
  parity_count INTEGER DEFAULT 0,
  status TEXT, -- e.g. 'healthy', 'sick', 'quarantine'
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archive_reasoning TEXT,

  CONSTRAINT chk_parity_count_female CHECK (
    (gender ILIKE 'F%' AND parity_count >= 0) OR
    ((gender NOT ILIKE 'F%') AND (parity_count = 0 OR parity_count IS NULL))
  )
);

INSERT INTO pigs (pig_id, pig_tag, date_of_birth, breed, gender, weight, pen_id, parity_count, status, is_archived)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'SOW-001', '2024-03-15', 'Landrace', 'F', 185.20, 'e1111111-1111-1111-1111-111111111111', 3, 'healthy', false),
  ('a2222222-2222-2222-2222-222222222222', 'SOW-002', '2023-11-20', 'Large White', 'F', 198.50, 'e2222222-2222-2222-2222-222222222222', 4, 'healthy', false),
  ('a3333333-3333-3333-3333-333333333333', 'SOW-003', '2024-06-01', 'Duroc', 'F', 174.00, 'e3333333-3333-3333-3333-333333333333', 1, 'healthy', false),
  ('a4444444-4444-4444-4444-444444444444', 'SOW-004', '2024-01-10', 'Berkshire', 'F', 162.30, 'e4444444-4444-4444-4444-444444444444', 2, 'sick', false),
  ('b1111111-1111-1111-1111-111111111111', 'BOAR-001', '2023-09-05', 'Duroc', 'M', 220.40, 'e7777777-7777-7777-7777-777777777777', 0, 'healthy', false),
  ('b2222222-2222-2222-2222-222222222222', 'BOAR-002', '2024-02-14', 'Hampshire', 'M', 245.10, 'e4444444-4444-4444-4444-444444444444', 0, 'quarantine', false);

ALTER TABLE pigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to pigs" 
ON pigs FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write pigs"
ON pigs FOR ALL TO authenticated USING (true) WITH CHECK (true);