-- Drop the old constraint
ALTER TABLE growth_program_guidelines DROP CONSTRAINT IF EXISTS growth_program_guidelines_activity_type_check;

-- Add the new constraint with VACCINATION
ALTER TABLE growth_program_guidelines ADD CONSTRAINT growth_program_guidelines_activity_type_check 
CHECK (activity_type IN ('FEED', 'MEDICATION', 'SUPPLEMENT', 'PROCEDURE', 'VACCINATION'));
