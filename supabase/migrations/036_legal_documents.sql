-- Legal Documents table for managing T&C, privacy policy, etc.
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type varchar NOT NULL,                          -- 'terms_conditions', 'privacy_policy', 'refund_policy', etc.
  title varchar NOT NULL,
  content text NOT NULL,                           -- markdown or HTML content
  version varchar NOT NULL DEFAULT 'v1.0',
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups by type
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON public.legal_documents(type);

-- Enable RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on legal_documents" ON public.legal_documents;
CREATE POLICY "Service role full access on legal_documents"
  ON public.legal_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read published documents
DROP POLICY IF EXISTS "Authenticated users can read published legal docs" ON public.legal_documents;
CREATE POLICY "Authenticated users can read published legal docs"
  ON public.legal_documents
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Insert default documents
INSERT INTO public.legal_documents (type, title, content, version, is_published, published_at) VALUES
  ('terms_conditions', 'Terms and Conditions', '# Terms and Conditions\n\nPlease update this document with your terms and conditions.', 'v1.0', true, now()),
  ('privacy_policy', 'Privacy Policy', '# Privacy Policy\n\nPlease update this document with your privacy policy.', 'v1.0', true, now()),
  ('refund_policy', 'Refund & Cancellation Policy', '# Refund & Cancellation Policy\n\nPlease update this document with your refund policy.', 'v1.0', true, now())
ON CONFLICT DO NOTHING;
