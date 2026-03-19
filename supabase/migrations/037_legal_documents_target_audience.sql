-- Add target_audience column to legal_documents
-- Specifies who the document is for: 'customer', 'driver', or 'both'
ALTER TABLE public.legal_documents 
ADD COLUMN IF NOT EXISTS target_audience varchar NOT NULL DEFAULT 'both';

-- Update any existing rows (in case column was added without default applying)
UPDATE public.legal_documents 
SET target_audience = 'both' 
WHERE target_audience IS NULL OR target_audience = '';

-- Allow anonymous (unauthenticated) users to read published documents
-- This is needed because terms are shown on the signup/onboarding screens
-- before the user is logged in
DROP POLICY IF EXISTS "Anon users can read published legal docs" ON public.legal_documents;
CREATE POLICY "Anon users can read published legal docs"
  ON public.legal_documents
  FOR SELECT
  TO anon
  USING (is_published = true);