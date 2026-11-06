-- ==============================================================================
-- 0024_link_inventory_to_growth_and_health.sql
-- SwineSync: Connect Inventory Management to Growth Tasks & Health Records
-- ==============================================================================

-- 1. Ensure growth_program_guidelines has item_id foreign key
ALTER TABLE public.growth_program_guidelines
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_growth_program_guidelines_item ON public.growth_program_guidelines(item_id);

-- 2. Add item_id to growth_tasks table
ALTER TABLE public.growth_tasks
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_growth_tasks_item ON public.growth_tasks(item_id);

-- 3. Add item_id and quantity_deducted to health_logs
ALTER TABLE public.health_logs
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_deducted NUMERIC;

CREATE INDEX IF NOT EXISTS idx_health_logs_item ON public.health_logs(item_id);

-- 4. Add item_id and quantity_deducted to vaccination_records
ALTER TABLE public.vaccination_records
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(item_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_deducted NUMERIC;

CREATE INDEX IF NOT EXISTS idx_vaccination_records_item ON public.vaccination_records(item_id);

-- 5. Update generate_growth_tasks trigger function to copy item_id from guidelines to tasks
CREATE OR REPLACE FUNCTION generate_growth_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_program_id is set or changed to a new program
  IF NEW.assigned_program_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.assigned_program_id IS DISTINCT FROM NEW.assigned_program_id) THEN
     
     -- Delete old tasks for this batch if re-assigning
     DELETE FROM growth_tasks WHERE batch_id = NEW.batch_id AND status = 'pending';
     
     -- Insert new tasks based on guidelines, now including item_id
     INSERT INTO growth_tasks (batch_id, program_id, guideline_id, activity_type, task_name, item_id, due_date, status)
     SELECT 
       NEW.batch_id,
       g.program_id,
       g.guideline_id,
       g.activity_type,
       g.task_name,
       g.item_id,
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

-- 6. Correct categories for legacy inventory items
UPDATE public.inventory_items
SET category = 'Medication'
WHERE item_name ILIKE '%Amoxicillin%' OR item_name ILIKE '%Iron Injection%' OR item_name ILIKE '%Tylosin%';

UPDATE public.inventory_items
SET category = 'Vaccines'
WHERE item_name ILIKE '%Vaccine%' OR item_name ILIKE '%PCV%';

UPDATE public.inventory_items
SET category = 'Disinfectants'
WHERE item_name ILIKE '%Virkon%' OR item_name ILIKE '%Disinfectant%';


