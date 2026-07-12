CREATE TABLE vaccination_records (
  vaccination_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pig_id UUID REFERENCES pigs(pig_id) ON DELETE CASCADE,
  batch_id UUID REFERENCES piglet_batches(batch_id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  administered_date DATE NOT NULL,
  dosage TEXT,
  lot_number TEXT,
  booster_due_date DATE,
  administered_by TEXT,
  CONSTRAINT chk_vacc_has_target CHECK (pig_id IS NOT NULL OR batch_id IS NOT NULL)
);

INSERT INTO vaccination_records (
  pig_id, batch_id, vaccine_name, administered_date, dosage, lot_number, booster_due_date, administered_by
) VALUES
  ('a1111111-1111-1111-1111-111111111111', NULL, 'Erysipelas Vaccine', '2024-01-15', '2 ml', 'LOT-ERY-998A', '2024-07-15', 'Dr. Rachel Vance'),
  ('a2222222-2222-2222-2222-222222222222', NULL, 'Circovirus (PCV2)', '2024-02-20', '2 ml', 'LOT-PCV-404B', '2025-02-20', 'Dr. Rachel Vance'),
  ('a4444444-4444-4444-4444-444444444444', NULL, 'Mycoplasma Hyopneumoniae', '2024-03-01', '1 ml', 'LOT-MYCO-112', '2024-09-01', 'John Doe (Tech)'),
  (NULL, 'c1111111-1111-1111-1111-111111111111', 'Iron Injection & Mycoplasma', '2024-05-02', '1 ml', 'LOT-FE-MYCO-77', NULL, 'John Doe (Tech)'),
  (NULL, 'c2222222-2222-2222-2222-222222222222','Circovirus Vaccine (Weaning)', '2024-04-18', '2 ml', 'LOT-PCV-551Z', '2024-10-18', 'Dr. Rachel Vance');

ALTER TABLE vaccination_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to vaccination_records" 
ON vaccination_records FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write vaccination_records"
ON vaccination_records FOR ALL TO authenticated USING (true) WITH CHECK (true);