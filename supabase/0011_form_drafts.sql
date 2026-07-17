-- 1. Create the form_drafts table for storing cross-device cloud drafts
CREATE TABLE IF NOT EXISTS public.form_drafts (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_key TEXT NOT NULL,
  data JSONB NOT NULL,
  extra_meta JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT form_drafts_user_key_unique UNIQUE (user_id, draft_key)
);

-- 2. Enable Row Level Security
ALTER TABLE public.form_drafts ENABLE ROW LEVEL SECURITY;

-- 3. Create Security Policies
-- Authenticated users can manage (SELECT, INSERT, UPDATE, DELETE) their own drafts
CREATE POLICY "Users can view their own drafts" 
ON public.form_drafts FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" 
ON public.form_drafts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" 
ON public.form_drafts FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" 
ON public.form_drafts FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access on form_drafts" 
ON public.form_drafts FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);
