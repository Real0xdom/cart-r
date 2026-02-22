-- Migration to add saved addresses and saved routes
CREATE TABLE public.saved_addresses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label character varying NOT NULL, -- 'Home', 'Work', 'Mom's house'
  address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  icon_type character varying DEFAULT 'place', -- 'home', 'work', 'place', 'heart'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT saved_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.saved_routes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name character varying NOT NULL,
  origin_address text NOT NULL,
  origin_latitude numeric NOT NULL,
  origin_longitude numeric NOT NULL,
  destination_address text NOT NULL,
  destination_latitude numeric NOT NULL,
  destination_longitude numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT saved_routes_pkey PRIMARY KEY (id),
  CONSTRAINT saved_routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own saved addresses" ON public.saved_addresses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own saved routes" ON public.saved_routes
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_addresses_updated_at BEFORE UPDATE ON public.saved_addresses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_saved_routes_updated_at BEFORE UPDATE ON public.saved_routes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
