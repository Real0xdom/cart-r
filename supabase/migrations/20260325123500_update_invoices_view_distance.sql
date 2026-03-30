-- Migration: Fix Invoices View Distance
-- Description: Updated in response to distance showing as 0.0 km on invoices.
-- Uses estimated_distance if actual_distance is null or 0.

-- 1. Drop existing invoices view so we can replace it safely
DROP VIEW IF EXISTS public.invoices CASCADE;

-- 2. Create View
CREATE OR REPLACE VIEW public.invoices AS
SELECT
    b.id,
    b.id AS booking_id,
    b.booking_number AS invoice_number,
    b.completed_at AS invoice_date,
    b.created_at,
    
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
    
    -- Financials
    -- CHANGE: Using COALESCE on actual_distance and estimated_distance
    COALESCE(NULLIF(b.actual_distance, 0), NULLIF(b.estimated_distance, 0), 0) AS distance_km,
    
    b.vehicle_type,
    
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
    
    -- Tax
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
COMMENT ON VIEW public.invoices IS 'View aggregating booking details into invoices for finance dashboard and receipts - Fixed distance issue.';
