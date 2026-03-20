-- Add queued booking status in its own migration so the enum value is committed
-- before later migrations reference it in indexes, functions, or policies.

ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'queued';
