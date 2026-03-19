-- Track which app submitted the ticket (customer app vs driver app).
-- A user can be both; the app they used when submitting is what matters for support.
ALTER TABLE public.support_tickets
ADD COLUMN IF NOT EXISTS source_app character varying
CHECK (source_app IS NULL OR source_app IN ('customer_app', 'driver_app'));

COMMENT ON COLUMN public.support_tickets.source_app IS 'App from which the ticket was submitted: customer_app or driver_app';
