-- Create early_access_signups table for storing email signups
CREATE TABLE public.early_access_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (public signup)
CREATE POLICY "Anyone can sign up for early access"
ON public.early_access_signups
FOR INSERT
WITH CHECK (true);

-- Create policy to allow reading all signups (for admin purposes)
CREATE POLICY "Allow reading all signups"
ON public.early_access_signups
FOR SELECT
USING (true);

-- Add index on email for faster lookups
CREATE INDEX idx_early_access_signups_email ON public.early_access_signups(email);

-- Add index on created_at for sorting
CREATE INDEX idx_early_access_signups_created_at ON public.early_access_signups(created_at DESC);