CREATE TABLE IF NOT EXISTS public.email_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  modules TEXT[] DEFAULT '{}',
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies (optional but recommended)
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view and manage whitelist
CREATE POLICY "Owners can manage whitelist" ON public.email_whitelist
  FOR ALL USING (true) WITH CHECK (true);
