\set ON_ERROR_STOP on

\echo Running driver wallet database regression tests

\echo Test 1: Negative balance is allowed
BEGIN;
DO $test$
DECLARE
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_balance numeric;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES (
    v_driver_user_id,
    'Wallet SQL Driver 1',
    'wallet-sql-driver-1@cartr.test',
    '+919700000001',
    'driver',
    true,
    true,
    now()
  );

  INSERT INTO public.drivers (
    id,
    user_id,
    vehicle_type,
    vehicle_model,
    vehicle_number,
    license_number,
    license_expiry,
    verification_status,
    status,
    is_online,
    is_verified
  ) VALUES (
    v_driver_id,
    v_driver_user_id,
    'sedan',
    'Wallet SQL Sedan',
    'MH01SQL001',
    'SQLDL001',
    (current_date + 365),
    'approved',
    'approved',
    true,
    true
  );

  INSERT INTO public.driver_wallets (
    driver_id,
    available_balance,
    pending_balance,
    total_earned,
    total_withdrawn,
    total_commission_owed
  ) VALUES (
    v_driver_id,
    0,
    0,
    0,
    0,
    0
  );

  UPDATE public.driver_wallets
  SET available_balance = -500
  WHERE driver_id = v_driver_id;

  SELECT available_balance INTO v_balance
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  IF v_balance <> -500 THEN
    RAISE EXCEPTION 'Expected available_balance = -500, got %', v_balance;
  END IF;

  RAISE NOTICE 'PASS: negative balance persisted without constraint failure';
END
$test$;
ROLLBACK;

\echo Test 2: Cash commission deduction with sufficient balance
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_wallet record;
  v_result jsonb;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 2', 'wallet-sql-customer-2@cartr.test', '+919700000002', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 2', 'wallet-sql-driver-2@cartr.test', '+919700000003', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL002', 'SQLDL002',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 1000, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-002', v_customer_id, v_driver_id, 100, 500, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-002', now()
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES ('commission', jsonb_build_object('default_rate', 15, 'by_vehicle_type', jsonb_build_object()), 'Wallet SQL commission', false)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  SELECT public.credit_driver_earning(v_driver_id, v_booking_id, 500, true) INTO v_result;

  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  IF v_result->>'success' <> 'true' THEN
    RAISE EXCEPTION 'Expected credit_driver_earning success, got %', v_result;
  END IF;

  IF v_wallet.available_balance <> 925 THEN
    RAISE EXCEPTION 'Expected available_balance = 925, got %', v_wallet.available_balance;
  END IF;

  IF COALESCE(v_wallet.total_commission_owed, 0) <> 0 THEN
    RAISE EXCEPTION 'Expected total_commission_owed = 0, got %', v_wallet.total_commission_owed;
  END IF;

  RAISE NOTICE 'PASS: cash commission deducted correctly from positive balance';
END
$test$;
ROLLBACK;

\echo Test 3: Cash commission deduction with insufficient balance creates debt
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_wallet record;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 3', 'wallet-sql-customer-3@cartr.test', '+919700000004', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 3', 'wallet-sql-driver-3@cartr.test', '+919700000005', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL003', 'SQLDL003',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 50, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-003', v_customer_id, v_driver_id, 100, 800, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-003', now()
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES ('commission', jsonb_build_object('default_rate', 15, 'by_vehicle_type', jsonb_build_object()), 'Wallet SQL commission', false)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.credit_driver_earning(v_driver_id, v_booking_id, 800, true);

  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  IF v_wallet.available_balance <> -70 THEN
    RAISE EXCEPTION 'Expected available_balance = -70, got %', v_wallet.available_balance;
  END IF;

  IF v_wallet.total_commission_owed <> 70 THEN
    RAISE EXCEPTION 'Expected total_commission_owed = 70, got %', v_wallet.total_commission_owed;
  END IF;

  RAISE NOTICE 'PASS: cash commission can drive balance negative and tracks debt';
END
$test$;
ROLLBACK;

\echo Test 4: Commission calculation matches default_rate settings
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_platform_fee numeric;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 4', 'wallet-sql-customer-4@cartr.test', '+919700000006', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 4', 'wallet-sql-driver-4@cartr.test', '+919700000007', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL004', 'SQLDL004',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 1000, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-004', v_customer_id, v_driver_id, 100, 1000, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-004', now()
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES ('commission', jsonb_build_object('default_rate', 18, 'by_vehicle_type', jsonb_build_object()), 'Wallet SQL commission', false)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.credit_driver_earning(v_driver_id, v_booking_id, 1000, true);

  SELECT amount INTO v_platform_fee
  FROM public.driver_wallet_transactions
  WHERE booking_id = v_booking_id
    AND type = 'platform_fee';

  IF v_platform_fee <> 180 THEN
    RAISE EXCEPTION 'Expected platform_fee = 180, got %', v_platform_fee;
  END IF;

  RAISE NOTICE 'PASS: default_rate commission setting applied correctly';
END
$test$;
ROLLBACK;

\echo Test 5: Vehicle-specific commission override uses by_vehicle_type
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_platform_fee numeric;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 5', 'wallet-sql-customer-5@cartr.test', '+919700000008', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 5', 'wallet-sql-driver-5@cartr.test', '+919700000009', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'bike', 'Wallet SQL Bike', 'MH01SQL005', 'SQLDL005',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 1000, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-005', v_customer_id, v_driver_id, 100, 500, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'bike', 'wallet-sql-book-005', now()
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES (
    'commission',
    jsonb_build_object('default_rate', 15, 'by_vehicle_type', jsonb_build_object('bike', 10)),
    'Wallet SQL commission',
    false
  )
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.credit_driver_earning(v_driver_id, v_booking_id, 500, true);

  SELECT amount INTO v_platform_fee
  FROM public.driver_wallet_transactions
  WHERE booking_id = v_booking_id
    AND type = 'platform_fee';

  IF v_platform_fee <> 50 THEN
    RAISE EXCEPTION 'Expected vehicle-specific platform_fee = 50, got %', v_platform_fee;
  END IF;

  RAISE NOTICE 'PASS: by_vehicle_type commission override applied correctly';
END
$test$;
ROLLBACK;

\echo Test 6: Accept booking is allowed when balance is -99.99
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_result json;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 6', 'wallet-sql-customer-6@cartr.test', '+919700000010', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 6', 'wallet-sql-driver-6@cartr.test', '+919700000011', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL006', 'SQLDL006',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, -99.99, 0, 0, 0, 99.99
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, base_fare, total_fare, status, payment_status,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, expires_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-006', v_customer_id, 100, 250, 'pending', 'pending',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan',
    'wallet-sql-book-006', now() + interval '10 minutes'
  );

  SELECT public.accept_booking_atomic(v_booking_id, v_driver_id) INTO v_result;

  IF v_result->>'success' <> 'true' THEN
    RAISE EXCEPTION 'Expected accept_booking_atomic success at -99.99, got %', v_result;
  END IF;

  RAISE NOTICE 'PASS: accept_booking_atomic allows driver at -99.99';
END
$test$;
ROLLBACK;

\echo Test 7: Accept booking is allowed when balance is exactly -100.00
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_result json;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 7', 'wallet-sql-customer-7@cartr.test', '+919700000012', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 7', 'wallet-sql-driver-7@cartr.test', '+919700000013', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL007', 'SQLDL007',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, -100.00, 0, 0, 0, 100.00
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, base_fare, total_fare, status, payment_status,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, expires_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-007', v_customer_id, 100, 250, 'pending', 'pending',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan',
    'wallet-sql-book-007', now() + interval '10 minutes'
  );

  SELECT public.accept_booking_atomic(v_booking_id, v_driver_id) INTO v_result;

  IF v_result->>'success' <> 'true' THEN
    RAISE EXCEPTION 'Expected accept_booking_atomic success at -100.00, got %', v_result;
  END IF;

  RAISE NOTICE 'PASS: accept_booking_atomic allows driver at -100.00';
END
$test$;
ROLLBACK;

\echo Test 8: Accept booking is blocked when balance is below -100.00
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_result json;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 8', 'wallet-sql-customer-8@cartr.test', '+919700000014', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 8', 'wallet-sql-driver-8@cartr.test', '+919700000015', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL008', 'SQLDL008',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, -100.01, 0, 0, 0, 100.01
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, base_fare, total_fare, status, payment_status,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, expires_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-008', v_customer_id, 100, 250, 'pending', 'pending',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan',
    'wallet-sql-book-008', now() + interval '10 minutes'
  );

  SELECT public.accept_booking_atomic(v_booking_id, v_driver_id) INTO v_result;

  IF v_result->>'success' <> 'false' THEN
    RAISE EXCEPTION 'Expected accept_booking_atomic failure below threshold, got %', v_result;
  END IF;

  IF v_result->>'error' <> 'wallet_recharge_required' THEN
    RAISE EXCEPTION 'Expected wallet_recharge_required error, got %', v_result;
  END IF;

  IF abs(((v_result->>'required_recharge')::numeric) - 200.01) > 0.001 THEN
    RAISE EXCEPTION 'Expected required_recharge = 200.01, got %', v_result->>'required_recharge';
  END IF;

  RAISE NOTICE 'PASS: accept_booking_atomic blocks driver below -100.00';
END
$test$;
ROLLBACK;

\echo Test 9: Driver wallet top-up is atomic and idempotent
BEGIN;
DO $test$
DECLARE
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_first_credit boolean;
  v_second_credit boolean;
  v_wallet record;
  v_ledger_count integer;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES (
    v_driver_user_id,
    'Wallet SQL Driver 9',
    'wallet-sql-driver-9@cartr.test',
    '+919700000016',
    'driver',
    true,
    true,
    now()
  );

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL009', 'SQLDL009',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, -200, 0, 0, 0, 200
  );

  INSERT INTO public.wallet_transactions (
    user_id, amount, type, status, payment_order_id, description
  ) VALUES (
    v_driver_user_id, 300, 'credit', 'pending', 'DRIVERWALLET_SQL_009', 'Driver wallet top-up'
  );

  SELECT public.atomic_credit_driver_wallet_topup_idempotent(v_driver_user_id, 300, 'DRIVERWALLET_SQL_009')
  INTO v_first_credit;

  SELECT public.atomic_credit_driver_wallet_topup_idempotent(v_driver_user_id, 300, 'DRIVERWALLET_SQL_009')
  INTO v_second_credit;

  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  SELECT count(*) INTO v_ledger_count
  FROM public.driver_wallet_transactions
  WHERE driver_id = v_driver_id
    AND reference_id = 'DRIVERWALLET_SQL_009';

  IF v_first_credit IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected first top-up credit to succeed, got %', v_first_credit;
  END IF;

  IF v_second_credit IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected second top-up credit to be idempotent false, got %', v_second_credit;
  END IF;

  IF v_wallet.available_balance <> 100 THEN
    RAISE EXCEPTION 'Expected available_balance = 100 after top-up, got %', v_wallet.available_balance;
  END IF;

  IF v_wallet.total_commission_owed <> 0 THEN
    RAISE EXCEPTION 'Expected total_commission_owed = 0 after top-up, got %', v_wallet.total_commission_owed;
  END IF;

  IF v_ledger_count <> 1 THEN
    RAISE EXCEPTION 'Expected one driver wallet ledger entry, got %', v_ledger_count;
  END IF;

  RAISE NOTICE 'PASS: top-up credit is atomic, reduces debt, and is idempotent';
END
$test$;
ROLLBACK;

\echo Test 10: Unpaid commission debt is tracked from positive to negative balance crossover
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_wallet record;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 10', 'wallet-sql-customer-10@cartr.test', '+919700000017', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 10', 'wallet-sql-driver-10@cartr.test', '+919700000018', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL010', 'SQLDL010',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 100, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-010', v_customer_id, v_driver_id, 100, 800, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-010', now()
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES ('commission', jsonb_build_object('default_rate', 15, 'by_vehicle_type', jsonb_build_object()), 'Wallet SQL commission', false)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.credit_driver_earning(v_driver_id, v_booking_id, 800, true);

  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  IF v_wallet.available_balance <> -20 THEN
    RAISE EXCEPTION 'Expected available_balance = -20, got %', v_wallet.available_balance;
  END IF;

  IF v_wallet.total_commission_owed <> 20 THEN
    RAISE EXCEPTION 'Expected total_commission_owed = 20, got %', v_wallet.total_commission_owed;
  END IF;

  RAISE NOTICE 'PASS: only the unpaid commission remainder is tracked as debt';
END
$test$;
ROLLBACK;

\echo Test 11: get_driver_wallet_info returns wallet summary, transactions, and stats
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_info jsonb;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 11', 'wallet-sql-customer-11@cartr.test', '+919700000019', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 11', 'wallet-sql-driver-11@cartr.test', '+919700000020', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified, beneficiary_status
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL011', 'SQLDL011',
    (current_date + 365), 'approved', 'approved', true, true, 'pending'
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, -20, 50, 680, 0, 20
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key, completed_at
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-011', v_customer_id, v_driver_id, 100, 800, 'completed', 'pending', 'cash',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-011', now()
  );

  INSERT INTO public.driver_wallet_transactions (
    driver_id, booking_id, type, amount, balance_type, direction, status, description, metadata
  ) VALUES
    (
      v_driver_id, v_booking_id, 'earning', 680, 'available', 'credit', 'completed',
      'Cash ride earning (collected offline)',
      jsonb_build_object('gross_fare', 800, 'commission_rate', 15, 'platform_fee', 120)
    ),
    (
      v_driver_id, v_booking_id, 'platform_fee', 120, 'available', 'debit', 'completed',
      'Platform commission for cash ride',
      jsonb_build_object('gross_fare', 800, 'commission_rate', 15)
    );

  SELECT public.get_driver_wallet_info(v_driver_id) INTO v_info;

  IF v_info ? 'wallet' IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected wallet key in get_driver_wallet_info payload, got %', v_info;
  END IF;

  IF v_info ? 'recent_transactions' IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected recent_transactions key in payload, got %', v_info;
  END IF;

  IF v_info ? 'stats' IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected stats key in payload, got %', v_info;
  END IF;

  IF (v_info->'wallet'->>'requires_recharge')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected requires_recharge = false, got %', v_info->'wallet'->>'requires_recharge';
  END IF;

  IF (v_info->'wallet'->>'has_negative_balance')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected has_negative_balance = true, got %', v_info->'wallet'->>'has_negative_balance';
  END IF;

  IF jsonb_array_length(v_info->'recent_transactions') < 2 THEN
    RAISE EXCEPTION 'Expected at least 2 recent transactions, got %', v_info->'recent_transactions';
  END IF;

  RAISE NOTICE 'PASS: get_driver_wallet_info returns wallet, recent_transactions, and stats';
END
$test$;
ROLLBACK;

\echo Test 12: Releasing an online earning updates the original row instead of creating a duplicate release row
BEGIN;
DO $test$
DECLARE
  v_customer_id uuid := gen_random_uuid();
  v_driver_user_id uuid := gen_random_uuid();
  v_driver_id uuid := gen_random_uuid();
  v_booking_id uuid := gen_random_uuid();
  v_wallet record;
  v_result jsonb;
  v_earning record;
  v_release_count integer;
BEGIN
  INSERT INTO public.users (id, name, email, phone, role, is_active, terms_accepted, terms_accepted_at)
  VALUES
    (v_customer_id, 'Wallet SQL Customer 12', 'wallet-sql-customer-12@cartr.test', '+919700000021', 'customer', true, true, now()),
    (v_driver_user_id, 'Wallet SQL Driver 12', 'wallet-sql-driver-12@cartr.test', '+919700000022', 'driver', true, true, now());

  INSERT INTO public.drivers (
    id, user_id, vehicle_type, vehicle_model, vehicle_number, license_number, license_expiry,
    verification_status, status, is_online, is_verified
  ) VALUES (
    v_driver_id, v_driver_user_id, 'sedan', 'Wallet SQL Sedan', 'MH01SQL012', 'SQLDL012',
    (current_date + 365), 'approved', 'approved', true, true
  );

  INSERT INTO public.driver_wallets (
    driver_id, available_balance, pending_balance, total_earned, total_withdrawn, total_commission_owed
  ) VALUES (
    v_driver_id, 0, 0, 0, 0, 0
  );

  INSERT INTO public.bookings (
    id, booking_number, customer_id, driver_id, base_fare, total_fare, status, payment_status, payment_method,
    origin_address, origin_latitude, origin_longitude, destination_address, destination_latitude, destination_longitude,
    vehicle_type, idempotency_key
  ) VALUES (
    v_booking_id, 'WALLET-SQL-BOOK-012', v_customer_id, v_driver_id, 100, 600, 'in_progress', 'paid', 'online',
    'Andheri West', 19.1364, 72.8296, 'Bandra West', 19.0596, 72.8295, 'sedan', 'wallet-sql-book-012'
  );

  INSERT INTO public.platform_settings (key, value, description, is_public)
  VALUES ('commission', jsonb_build_object('default_rate', 15, 'by_vehicle_type', jsonb_build_object()), 'Wallet SQL commission', false)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM public.credit_driver_earning(v_driver_id, v_booking_id, 600, false);

  SELECT public.release_pending_earning(v_booking_id) INTO v_result;

  SELECT * INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id;

  SELECT * INTO v_earning
  FROM public.driver_wallet_transactions
  WHERE booking_id = v_booking_id
    AND driver_id = v_driver_id
    AND type = 'earning'
  LIMIT 1;

  SELECT COUNT(*) INTO v_release_count
  FROM public.driver_wallet_transactions
  WHERE booking_id = v_booking_id
    AND driver_id = v_driver_id
    AND type = 'release';

  IF v_result->>'success' <> 'true' THEN
    RAISE EXCEPTION 'Expected release_pending_earning success, got %', v_result;
  END IF;

  IF v_wallet.pending_balance <> 0 THEN
    RAISE EXCEPTION 'Expected pending_balance = 0 after release, got %', v_wallet.pending_balance;
  END IF;

  IF v_wallet.available_balance <> 510 THEN
    RAISE EXCEPTION 'Expected available_balance = 510 after release, got %', v_wallet.available_balance;
  END IF;

  IF v_earning.balance_type <> 'available' THEN
    RAISE EXCEPTION 'Expected earning row to be updated to available, got %', v_earning.balance_type;
  END IF;

  IF v_release_count <> 0 THEN
    RAISE EXCEPTION 'Expected no duplicate release rows, got %', v_release_count;
  END IF;

  RAISE NOTICE 'PASS: online earning release updates the original earning row without duplicates';
END
$test$;
ROLLBACK;

\echo Driver wallet database regression suite completed
