create table breeding_logs (
  breeding_id uuid primary key default gen_random_uuid(),
  breeding_method text not null, -- e.g., 'Artificial Insemination', 'Natural'
  
  -- Foreign keys referencing the pigs table
  sow_id uuid not null references pigs(pig_id) on delete cascade,
  boar_id uuid references pigs(pig_id) on delete set null, -- Nullable for AI or untracked boars
  
  breeding_date date not null,
  breeding_status text, -- e.g., 'Pending', 'Pregnant', 'Failed', 'Farrowed'
  expected_farrowing_date date,
  actual_farrowing_date date,

  -- Optional safety check to ensure a pig is not bred with itself
  constraint chk_different_parent check (sow_id <> boar_id)
);

-- Enable Row Level Security (RLS) for Supabase
alter table breeding_logs enable row level security;

-- Create policy allowing all operations for authenticated and anon users
create policy "Allow all access on breeding_logs"
on public.breeding_logs for all
to anon, authenticated, service_role
using (true)
with check (true);

-- Grant privileges
grant select, insert, update, delete on public.breeding_logs to anon, authenticated, service_role;

-- Add check date tracking columns to breeding_logs
ALTER TABLE public.breeding_logs 
  ADD COLUMN heat_check_date date,
  ADD COLUMN preg_check_date date,
  ADD COLUMN is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN archive_reason TEXT,
  ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
