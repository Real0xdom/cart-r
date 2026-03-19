-- Migration: Create Invoices View for Finance Tracking
-- Date: 2026-02-13
-- Description: Creates a view that aggregates booking data into an invoice format. 
-- Includes safety checks to ensure required columns exist if previous migrations failed.

-- 1. Ensure columns exist in bookings table (Self-healing schema)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS waiting_charges NUMERIC DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS addon_charges NUMERIC DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS wallet_amount_used DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_session_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS online_payment_order_id TEXT;

-- 2. Drop existing invoices table
-- The existing 'invoices' table has proper structure but is EMPTY (no data).
-- It was designed to be manually populated, but no code populates it.
-- We're replacing it with a VIEW that dynamically pulls from 'bookings' table.
-- This gives you instant access to ALL historical completed trips without manual data entry.
DROP TABLE IF EXISTS public.invoices CASCADE;

-- 3. Create View
CREATE OR REPLACE VIEW public.invoices AS
SELECT
    b.id,
    b.id AS booking_id,
    b.booking_number AS invoice_number,
    b.completed_at AS invoice_date,
    b.created_at, -- Keep created_at for sorting if needed
    
    -- Customer Details
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email,
    
    -- Driver Details
    d_user.name AS driver_name,
    d_user.phone AS driver_phone,
    d.vehicle_number,
    d.vehicle_model,
    
    -- Trip Details
    b.origin_address AS pickup_address,
    b.destination_address AS dropoff_address,
    b.started_at AS pickup_time,
    b.completed_at AS dropoff_time,
    b.actual_distance AS distance_km,
    b.vehicle_type,
    
    -- Financials
    b.base_fare,
    b.distance_fare,
    b.time_fare,
    COALESCE(b.waiting_charges, 0) AS waiting_charges,
    COALESCE(b.addon_charges, 0) AS addon_charges,
    COALESCE(b.tip_amount, 0) AS tip_amount,
    COALESCE(b.discount_amount, 0) AS discount_amount,
    COALESCE(b.surge_multiplier, 1.0) AS surge_multiplier,
    
    -- Totals
    b.total_fare AS total_amount,
    COALESCE(b.driver_payout, 0) AS driver_payout,
    (b.total_fare - COALESCE(b.driver_payout, 0)) AS platform_fee,
    
    -- Tax (assuming inclusive or 0 for now)
    0 AS gst_amount, 
    
    -- Payment Status
    b.payment_method,
    b.payment_status,
    b.payment_id,
    b.online_payment_order_id,
    b.wallet_amount_used,
    b.payment_session_id
    
FROM
    public.bookings b
    LEFT JOIN public.users c ON b.customer_id = c.id
    LEFT JOIN public.drivers d ON b.driver_id = d.id
    LEFT JOIN public.users d_user ON d.user_id = d_user.id
WHERE
    b.status IN ('completed', 'cancelled');

-- Grant permissions
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.invoices TO service_role;

-- Comment
COMMENT ON VIEW public.invoices IS 'View aggregating booking details into invoices for finance dashboard and receipts.';
