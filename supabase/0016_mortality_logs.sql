CREATE TABLE mortality_logs (
  mortality_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pen_id UUID REFERENCES pens(pen_id) ON DELETE SET NULL,
  batch_id UUID REFERENCES piglet_batches(batch_id) ON DELETE CASCADE,
  pig_id UUID REFERENCES pigs(pig_id) ON DELETE CASCADE,
  cause TEXT NOT NULL,
  action_taken TEXT,
  recorded_by TEXT,
  log_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger function to deduct 1 from current_count of piglet_batches when a mortality occurs
CREATE OR REPLACE FUNCTION deduct_batch_current_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE piglet_batches
    SET current_count = current_count - 1
    WHERE batch_id = NEW.batch_id AND current_count > 0;
  END IF;
  
  IF NEW.pig_id IS NOT NULL THEN
    -- If an individual pig dies, mark its status as deceased
    UPDATE pigs
    SET status = 'deceased'
    WHERE pig_id = NEW.pig_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deduct_batch_current_count
AFTER INSERT ON mortality_logs
FOR EACH ROW
EXECUTE FUNCTION deduct_batch_current_count();

-- RLS and Policies
ALTER TABLE mortality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read mortality_logs" 
ON mortality_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow public read access to mortality_logs" 
ON mortality_logs FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write mortality_logs"
ON mortality_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
