-- Create bookings together with selected add-ons so downstream realtime and
-- notification flows see a fully-formed ride request immediately.

DROP FUNCTION IF EXISTS public.create_booking_with_addons(
  uuid,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  public.vehicle_type,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
);

DROP FUNCTION IF EXISTS public.create_booking_with_addons(
  uuid,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  public.vehicle_type,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  public.payment_status,
  public.payment_method,
  timestamptz,
  jsonb
);

CREATE OR REPLACE FUNCTION public.create_booking_with_addons(
  p_customer_id uuid,
  p_origin_address text,
  p_origin_latitude double precision,
  p_origin_longitude double precision,
  p_destination_address text,
  p_destination_latitude double precision,
  p_destination_longitude double precision,
  p_vehicle_type public.vehicle_type,
  p_estimated_distance numeric,
  p_estimated_duration numeric,
  p_base_fare numeric,
  p_distance_fare numeric,
  p_time_fare numeric,
  p_surge_multiplier numeric,
  p_total_fare numeric,
  p_tip_amount numeric DEFAULT 0,
  p_fare_multiplier numeric DEFAULT 1,
  p_driver_payout numeric DEFAULT 0,
  p_pickup_otp text DEFAULT NULL,
  p_receiver_name text DEFAULT NULL,
  p_receiver_phone text DEFAULT NULL,
  p_goods_description text DEFAULT NULL,
  p_payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
  p_payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
  p_expires_at timestamptz DEFAULT NULL,
  p_addons jsonb DEFAULT '[]'::jsonb
) RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
  v_addon jsonb;
  v_addon_code varchar;
  v_quantity integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_customer_id THEN
    RAISE EXCEPTION 'Not authorized to create this booking';
  END IF;

  INSERT INTO public.bookings (
    customer_id,
    origin_address,
    origin_latitude,
    origin_longitude,
    destination_address,
    destination_latitude,
    destination_longitude,
    vehicle_type,
    estimated_distance,
    estimated_duration,
    base_fare,
    distance_fare,
    time_fare,
    surge_multiplier,
    total_fare,
    tip_amount,
    fare_multiplier,
    driver_payout,
    pickup_otp,
    receiver_name,
    receiver_phone,
    goods_description,
    status,
    payment_status,
    payment_method,
    expires_at
  )
  VALUES (
    p_customer_id,
    p_origin_address,
    p_origin_latitude,
    p_origin_longitude,
    p_destination_address,
    p_destination_latitude,
    p_destination_longitude,
    p_vehicle_type,
    p_estimated_distance,
    p_estimated_duration,
    p_base_fare,
    p_distance_fare,
    p_time_fare,
    p_surge_multiplier,
    p_total_fare,
    COALESCE(p_tip_amount, 0),
    COALESCE(p_fare_multiplier, 1),
    COALESCE(p_driver_payout, 0),
    p_pickup_otp,
    p_receiver_name,
    p_receiver_phone,
    p_goods_description,
    'pending'::public.booking_status,
    COALESCE(p_payment_status, 'pending'::public.payment_status),
    COALESCE(p_payment_method, 'cash'::public.payment_method),
    p_expires_at
  )
  RETURNING * INTO v_booking;

  IF jsonb_typeof(COALESCE(p_addons, '[]'::jsonb)) = 'array' THEN
    FOR v_addon IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(p_addons, '[]'::jsonb))
    LOOP
      v_addon_code := NULLIF(BTRIM(v_addon->>'code'), '');
      IF v_addon_code IS NULL THEN
        CONTINUE;
      END IF;

      BEGIN
        v_quantity := GREATEST(COALESCE(NULLIF(v_addon->>'quantity', '')::integer, 1), 1);
      EXCEPTION
        WHEN others THEN
          v_quantity := 1;
      END;

      PERFORM public.add_addon_to_booking(v_booking.id, v_addon_code, v_quantity);
    END LOOP;
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = v_booking.id;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_with_addons(
  uuid,
  text,
  double precision,
  double precision,
  text,
  double precision,
  double precision,
  public.vehicle_type,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text,
  text,
  public.payment_status,
  public.payment_method,
  timestamptz,
  jsonb
) TO authenticated;
