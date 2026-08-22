CREATE TABLE IF NOT EXISTS public.expansion_interests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  requested_area text NOT NULL,
  latitude double precision,
  longitude double precision,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expansion_interests_pkey PRIMARY KEY (id),
  CONSTRAINT expansion_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

ALTER TABLE public.expansion_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create expansion interests" 
ON public.expansion_interests 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Admins can view all expansion interests" 
ON public.expansion_interests 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
