-- Migration: Create growth_tasks table to track program milestones for batches
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS growth_tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES piglet_batches(batch_id) ON DELETE CASCADE,
  program_id UUID REFERENCES growth_programs(program_id) ON DELETE CASCADE,
  guideline_id UUID REFERENCES growth_program_guidelines(guideline_id) ON DELETE CASCADE,
  
  activity_type TEXT NOT NULL,
  task_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Optionally link to the actual health/vaccination log if created
  linked_health_id UUID REFERENCES health_logs(health_id) ON DELETE SET NULL,
  linked_vaccination_id UUID REFERENCES vaccination_records(vaccination_id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE growth_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to growth_tasks" 
ON growth_tasks FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to write growth_tasks"
ON growth_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ensure service_role has full access
GRANT ALL ON TABLE public.growth_tasks TO service_role;

-- Trigger to auto-generate tasks when a program is assigned
CREATE OR REPLACE FUNCTION generate_growth_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_program_id is set or changed to a new program
  IF NEW.assigned_program_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.assigned_program_id IS DISTINCT FROM NEW.assigned_program_id) THEN
     
     -- Delete old tasks for this batch if re-assigning
     DELETE FROM growth_tasks WHERE batch_id = NEW.batch_id AND status = 'pending';
     
     -- Insert new tasks based on guidelines
     INSERT INTO growth_tasks (batch_id, program_id, guideline_id, activity_type, task_name, due_date, status)
     SELECT 
       NEW.batch_id,
       g.program_id,
       g.guideline_id,
       g.activity_type,
       g.task_name,
       (NEW.date_of_birth + (g.days_after_birth || ' days')::interval)::date,
       'pending'
     FROM growth_program_guidelines g
     WHERE g.program_id = NEW.assigned_program_id;
     
  END IF;
  
  -- If date_of_birth changes, update pending task due dates
  IF TG_OP = 'UPDATE' AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth AND NEW.assigned_program_id IS NOT NULL THEN
    UPDATE growth_tasks gt
    SET due_date = (NEW.date_of_birth + (g.days_after_birth || ' days')::interval)::date
    FROM growth_program_guidelines g
    WHERE gt.guideline_id = g.guideline_id
      AND gt.batch_id = NEW.batch_id
      AND gt.status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_growth_tasks ON piglet_batches;

CREATE TRIGGER trigger_generate_growth_tasks
AFTER INSERT OR UPDATE ON piglet_batches
FOR EACH ROW
EXECUTE FUNCTION generate_growth_tasks();
