CREATE TABLE piglet_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_tag TEXT,
  sow_id UUID REFERENCES pigs(pig_id) ON DELETE SET NULL,
  pen_id UUID REFERENCES pens(pen_id) ON DELETE SET NULL,
  total_born_alive INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_born_alive_positive CHECK (total_born_alive >= 0),
  current_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_current_count_positive CHECK (current_count >= 0),
  stillborn_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_stillborn_positive CHECK (stillborn_count >= 0),
  mummy_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_mummy_positive CHECK (mummy_count >= 0),
  average_weight NUMERIC CONSTRAINT chk_avg_weight_positive CHECK (average_weight >= 0),
  status TEXT, -- e.g. 'suckling', 'weaned', 'transferred'
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archive_reasoning TEXT
);

INSERT INTO piglet_batches (batch_id, batch_tag, sow_id, pen_id, total_born_alive, current_count, stillborn_count, mummy_count, average_weight, status, is_archived)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'BATCH-2026-A', 'a3333333-3333-3333-3333-333333333333', 'e5555555-5555-5555-5555-555555555555', 12, 11, 1, 0, 1.45, 'suckling', false),
  ('c2222222-2222-2222-2222-222222222222', 'BATCH-2026-B', 'a1111111-1111-1111-1111-111111111111', 'e6666666-6666-6666-6666-666666666666', 14, 13, 0, 1, 6.85, 'weaned', false),
  ('c3333333-3333-3333-3333-333333333333', 'BATCH-2026-C', NULL, 'e7777777-7777-7777-7777-777777777777', 10, 10, 2, 0, 21.20, 'transferred', false);

ALTER TABLE piglet_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to piglet_batches" 
ON piglet_batches FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write piglet_batches"
ON piglet_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);