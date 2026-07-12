CREATE TABLE health_logs (
  health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pig_id UUID REFERENCES pigs(pig_id) ON DELETE CASCADE,
  batch_id UUID REFERENCES piglet_batches(batch_id) ON DELETE CASCADE,
  log_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recorded_by TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  treatment TEXT,
  medication_name TEXT,
  dosage TEXT,
  status TEXT,
  notes TEXT,
  CONSTRAINT chk_has_associated_target CHECK (pig_id IS NOT NULL OR batch_id IS NOT NULL)
);

INSERT INTO health_logs (pig_id, batch_id, log_date, recorded_by, symptoms, diagnosis, treatment, medication_name, dosage, status, notes)
VALUES
  ('a4444444-4444-4444-4444-444444444444', NULL, '2026-09-27 08:30:00+00', 'Dr. Rachel Vance', 'High fever, sluggish motion', 'Acute Pyrexia', 'Isolate & administer antipyretic', 'Flunixin', '5 ml', 'sick', 'Monitor temperature every 12 hours.'),
  ('b2222222-2222-2222-2222-222222222222', NULL, '2024-05-10 08:30:00+00', 'Dr. Rachel Vance', 'Coughing, lethargy, mild fever', 'Swine Respiratory Disease', 'Injectable antibiotics & separation', 'Tylosin', '10 ml', 'sick', 'Monitor breathing rate twice daily.'),
  (NULL, 'c3333333-3333-3333-3333-333333333333', '2024-05-14 10:15:00+00', 'Dr. Rachel Vance', 'None observed', 'Routine Quarantine Hold', 
  'Isolate for 14 days post-intake', NULL, NULL, 'quarantine', 'Standard screening protocols applied.'),
  ('a1111111-1111-1111-1111-111111111111', NULL, '2024-04-02 09:00:00+00', 'John Doe (Tech)', 'Superficial skin scrape on right side', 'Minor Abrasion', 'Cleaned and applied topical protection', 'Blue Spray Antiseptic', 'Standard spray coverage', 'healthy', 'Scrape occurred during pen transit, healed well.');

ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read health_logs" ON health_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow public read access to health_logs" 
ON health_logs FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write health_logs"
ON health_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
