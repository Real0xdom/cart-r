-- Migration: Addon Services (Load/Unload Helpers)
-- Description: Add tables for addon services like load/unload helpers
-- Date: 2026-02-12

-- 1. Create addon_services table
CREATE TABLE IF NOT EXISTS public.addon_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  is_active boolean DEFAULT true,
  applicable_vehicle_types vehicle_type[] DEFAULT ARRAY[]::vehicle_type[],
  icon_emoji varchar DEFAULT '🔧',
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create booking_addons junction table
CREATE TABLE IF NOT EXISTS public.booking_addons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.addon_services(id),
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total_price numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT booking_addons_unique UNIQUE(booking_id, addon_id)
);

-- 3. Add addon_charges column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS addon_charges numeric DEFAULT 0;

-- 4. Insert default addon services
INSERT INTO public.addon_services (
  code,
  name,
  description,
  price,
  applicable_vehicle_types,
  icon_emoji,
  display_order
)
VALUES 
  (
    'LOAD_HELPER',
    'Load Helper',
    'Helper for loading goods at pickup location',
    100,
    ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '📦',
    1
  ),
  (
    'UNLOAD_HELPER',
    'Unload Helper',
    'Helper for unloading goods at destination',
    100,
    ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '📤',
    2
  ),
  (
    'BOTH_HELPERS',
    'Load & Unload Helper',
    'Helper for both loading and unloading goods',
    180,
    ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '🔄',
    3
  ),
  (
    'EXTRA_HELPER',
    'Extra Helper',
    'Additional helper for heavy or bulk items',
    150,
    ARRAY['chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '👷',
    4
  ),
  (
    'PACKING_MATERIAL',
    'Packing Material',
    'Bubble wrap, boxes, and packing supplies',
    200,
    ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '📦',
    5
  ),
  (
    'ASSEMBLY_SERVICE',
    'Assembly/Disassembly',
    'Furniture assembly or disassembly service',
    300,
    ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[],
    '🔧',
    6
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  applicable_vehicle_types = EXCLUDED.applicable_vehicle_types,
  icon_emoji = EXCLUDED.icon_emoji,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- 5. Function to get applicable addons for vehicle type
CREATE OR REPLACE FUNCTION get_applicable_addons(
  p_vehicle_type vehicle_type
) RETURNS TABLE(
  id uuid,
  code varchar,
  name varchar,
  description text,
  price numeric,
  icon_emoji varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    addon_services.id,
    addon_services.code,
    addon_services.name,
    addon_services.description,
    addon_services.price,
    addon_services.icon_emoji
  FROM addon_services
  WHERE is_active = true
  AND (
    applicable_vehicle_types = ARRAY[]::vehicle_type[] 
    OR p_vehicle_type = ANY(applicable_vehicle_types)
  )
  ORDER BY display_order ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to calculate total addon charges for a booking
CREATE OR REPLACE FUNCTION calculate_addon_charges(
  p_booking_id uuid
) RETURNS numeric AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(total_price), 0)
  INTO v_total
  FROM booking_addons
  WHERE booking_id = p_booking_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to add addon to booking
CREATE OR REPLACE FUNCTION add_addon_to_booking(
  p_booking_id uuid,
  p_addon_code varchar,
  p_quantity integer DEFAULT 1
) RETURNS boolean AS $$
DECLARE
  v_addon_id uuid;
  v_addon_price numeric;
BEGIN
  -- Get addon details
  SELECT id, price
  INTO v_addon_id, v_addon_price
  FROM addon_services
  WHERE code = p_addon_code
  AND is_active = true;

  IF v_addon_id IS NULL THEN
    RAISE EXCEPTION 'Addon service not found or inactive: %', p_addon_code;
  END IF;

  -- Insert or update booking addon
  INSERT INTO booking_addons (
    booking_id,
    addon_id,
    quantity,
    unit_price
  )
  VALUES (
    p_booking_id,
    v_addon_id,
    p_quantity,
    v_addon_price
  )
  ON CONFLICT (booking_id, addon_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price;

  -- Update booking addon_charges
  UPDATE bookings
  SET addon_charges = calculate_addon_charges(p_booking_id)
  WHERE id = p_booking_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger to update booking addon_charges when addons change
CREATE OR REPLACE FUNCTION update_booking_addon_charges()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bookings
  SET addon_charges = calculate_addon_charges(
    COALESCE(NEW.booking_id, OLD.booking_id)
  )
  WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_booking_addon_charges ON booking_addons;
CREATE TRIGGER trigger_update_booking_addon_charges
  AFTER INSERT OR UPDATE OR DELETE
  ON booking_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_addon_charges();

-- 9. Update total fare calculation to include addons
CREATE OR REPLACE FUNCTION update_booking_total_fare()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_fare = COALESCE(NEW.base_fare, 0) 
                 + COALESCE(NEW.distance_fare, 0)
                 + COALESCE(NEW.time_fare, 0)
                 + COALESCE(NEW.waiting_charges, 0)
                 + COALESCE(NEW.addon_charges, 0)
                 + COALESCE(NEW.tip_amount, 0)
                 - COALESCE(NEW.discount_amount, 0);
  
  -- Calculate driver payout (85% of total fare)
  NEW.driver_payout = ROUND(NEW.total_fare * 0.85);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with addon_charges
DROP TRIGGER IF EXISTS trigger_update_booking_total_fare ON bookings;
CREATE TRIGGER trigger_update_booking_total_fare
  BEFORE INSERT OR UPDATE OF base_fare, distance_fare, time_fare, waiting_charges, addon_charges, tip_amount, discount_amount
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_total_fare();

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_addons_booking_id 
ON public.booking_addons(booking_id);

CREATE INDEX IF NOT EXISTS idx_addon_services_active 
ON public.addon_services(is_active) WHERE is_active = true;

-- 11. Enable RLS
ALTER TABLE public.addon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies
-- 12. RLS Policies
DROP POLICY IF EXISTS "Anyone can view active addon services" ON public.addon_services;
CREATE POLICY "Anyone can view active addon services"
ON public.addon_services
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Users can view their booking addons" ON public.booking_addons;
CREATE POLICY "Users can view their booking addons"
ON public.booking_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = booking_addons.booking_id
    AND (bookings.customer_id = auth.uid() OR bookings.driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    ))
  )
);

DROP POLICY IF EXISTS "Customers can add addons to their bookings" ON public.booking_addons;
CREATE POLICY "Customers can add addons to their bookings"
ON public.booking_addons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = booking_addons.booking_id
    AND bookings.customer_id = auth.uid()
    AND bookings.status = 'pending'
  )
);

-- 13. Comments
COMMENT ON TABLE addon_services IS 'Available addon services like load/unload helpers';
COMMENT ON TABLE booking_addons IS 'Junction table linking bookings to selected addon services';
COMMENT ON FUNCTION get_applicable_addons IS 'Returns addon services applicable for a vehicle type';
COMMENT ON FUNCTION calculate_addon_charges IS 'Calculates total addon charges for a booking';
COMMENT ON FUNCTION add_addon_to_booking IS 'Adds an addon service to a booking';
