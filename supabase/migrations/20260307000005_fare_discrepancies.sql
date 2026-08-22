-- Create table for auditing driver trip cheating or route deviations
-- Tracks when actual distance driven is significantly higher than the estimate

CREATE TABLE IF NOT EXISTS public.fare_discrepancies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    estimated_distance_km NUMERIC NOT NULL,
    actual_distance_km NUMERIC NOT NULL,
    deviation_percentage NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.fare_discrepancies ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated users (drivers completing trips)
CREATE POLICY "Drivers can insert fare discrepancies" ON public.fare_discrepancies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow admins full access
CREATE POLICY "Admins have full access to fare discrepancies" ON public.fare_discrepancies
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@cartr.in', 'support@cartr.in')); -- Replace with proper admin check if needed
