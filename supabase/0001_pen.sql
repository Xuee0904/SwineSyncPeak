CREATE TABLE pens (
  pen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_code TEXT NOT NULL UNIQUE,
  pen_type TEXT,
  max_capacity INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE pens ENABLE ROW LEVEL SECURITY;

INSERT INTO pens (pen_id, pen_code, pen_type, max_capacity)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'PEN-A1', 'Gestation', 10),
  ('e2222222-2222-2222-2222-222222222222', 'PEN-A2', 'Gestation', 10),
  ('e3333333-3333-3333-3333-333333333333', 'PEN-B3', 'Farrowing', 5),
  ('e4444444-4444-4444-4444-444444444444', 'PEN-Q1', 'Quarantine', 8),
  ('e5555555-5555-5555-5555-555555555555', 'PEN-N1', 'Nursery', 25),
  ('e6666666-6666-6666-6666-666666666666', 'PEN-W2', 'Weaning', 20),
  ('e7777777-7777-7777-7777-777777777777', 'PEN-T1', 'Finishing', 15);

CREATE POLICY "Allow public read access to pens" 
ON pens FOR SELECT TO public USING (true);

create policy "Allow public read access"
on public.pens for select
to anon
using (true);