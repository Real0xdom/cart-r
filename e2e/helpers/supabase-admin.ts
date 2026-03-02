/**
 * Supabase Admin Helper
 * Direct database operations using service-role key for test data management.
 * Bypasses RLS for test setup/teardown.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import env from '../config/environments';
import { BOOKING_STATUS, PAYMENT_STATUS, VERIFICATION_STATUS, TEST_LOCATIONS, DEFAULT_FARE_CONFIG } from '../config/constants';

let supabaseAdmin: SupabaseClient;

function getClient(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }
    supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

// =====================================================
// ADMIN OPERATIONS
// =====================================================

export async function createTestAdmin(params: {
  email: string;
  password: string;
  role?: string;
}): Promise<{ adminId: string; error: string | null }> {
  const client = getClient();

  const { data: admin, error } = await client.from('admins').insert({
    email: params.email.toLowerCase().trim(),
    password_hash: params.password,
    role: params.role || 'super_admin',
  }).select('id').single();

  if (error || !admin) {
    if (error?.message?.includes('duplicate')) {
      return { adminId: 'existing', error: null };
    }
    return { adminId: '', error: error?.message || 'Failed to create admin' };
  }

  return { adminId: admin.id, error: null };
}

export async function ensureTestAdmin(): Promise<void> {
  const client = getClient();
  const email = env.adminEmail.toLowerCase().trim();
  const password = env.adminPassword;

  const { data: existing } = await client.from('admins').select('id').eq('email', email).single();

  if (!existing) {
    await client.from('admins').insert({
      email,
      password_hash: password,
      role: 'super_admin',
    });
  }
}

export async function createTestCustomer(params: {
  phone: string;
  name: string;
  email?: string;
  balance?: number;
  testRunId?: string;
}): Promise<{ userId: string; error: string | null }> {
  const client = getClient();

  // Create auth user first
  const { data: authUser, error: authError } = await client.auth.admin.createUser({
    phone: params.phone,
    phone_confirm: true,
    user_metadata: { name: params.name, test_run_id: params.testRunId },
  });

  if (authError || !authUser.user) {
    return { userId: '', error: authError?.message || 'Failed to create auth user' };
  }

  // Create user profile
  const { error: profileError } = await client.from('users').upsert({
    id: authUser.user.id,
    name: params.name,
    email: params.email || `test_${Date.now()}@cartr.test`,
    phone: params.phone,
    role: 'customer',
    balance: params.balance || 0,
    is_active: true,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
  });

  if (profileError) {
    return { userId: '', error: profileError.message };
  }

  return { userId: authUser.user.id, error: null };
}

export async function createTestDriver(params: {
  phone: string;
  name: string;
  vehicleType?: string;
  verificationStatus?: string;
  isOnline?: boolean;
  latitude?: number;
  longitude?: number;
  testRunId?: string;
}): Promise<{ userId: string; driverId: string; error: string | null }> {
  const client = getClient();

  // Create auth user
  const { data: authUser, error: authError } = await client.auth.admin.createUser({
    phone: params.phone,
    phone_confirm: true,
    user_metadata: { name: params.name, role: 'driver', test_run_id: params.testRunId },
  });

  if (authError || !authUser.user) {
    return { userId: '', driverId: '', error: authError?.message || 'Failed to create auth user' };
  }

  // Create user profile
  await client.from('users').upsert({
    id: authUser.user.id,
    name: params.name,
    email: `driver_${Date.now()}@cartr.test`,
    phone: params.phone,
    role: 'driver',
    is_active: true,
  });

  // Create driver profile
  const vehicleType = params.vehicleType || 'sedan';
  const { data: driver, error: driverError } = await client.from('drivers').insert({
    user_id: authUser.user.id,
    vehicle_type: vehicleType,
    vehicle_number: `MH01AB${Math.floor(1000 + Math.random() * 9000)}`,
    vehicle_model: 'Test Vehicle',
    vehicle_color: 'White',
    license_number: `DL${Date.now()}`,
    license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    verification_status: params.verificationStatus || VERIFICATION_STATUS.APPROVED,
    is_online: params.isOnline ?? false,
    current_latitude: params.latitude ?? null,
    current_longitude: params.longitude ?? null,
    rating: 4.5,
    is_verified: params.verificationStatus === VERIFICATION_STATUS.APPROVED,
    status: params.verificationStatus || 'approved',
  }).select('id').single();

  if (driverError || !driver) {
    return { userId: authUser.user.id, driverId: '', error: driverError?.message || 'Failed to create driver' };
  }

  return { userId: authUser.user.id, driverId: driver.id, error: null };
}

// =====================================================
// BOOKING OPERATIONS
// =====================================================

export async function createTestBooking(params: {
  customerId: string;
  driverId?: string;
  status?: string;
  vehicleType?: string;
  origin?: { address: string; latitude: number; longitude: number };
  destination?: { address: string; latitude: number; longitude: number };
  totalFare?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  receiverName?: string;
  receiverPhone?: string;
}): Promise<{ bookingId: string; bookingNumber: string; error: string | null }> {
  const client = getClient();
  const origin = params.origin || TEST_LOCATIONS.MUMBAI_ANDHERI;
  const destination = params.destination || TEST_LOCATIONS.MUMBAI_BANDRA;
  const vehicleType = params.vehicleType || 'sedan';
  const fareConfig = DEFAULT_FARE_CONFIG[vehicleType as keyof typeof DEFAULT_FARE_CONFIG];
  const totalFare = params.totalFare || fareConfig.minimumFare;

  const bookingNumber = `CARTR-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));

  const { data, error } = await client.from('bookings').insert({
    booking_number: bookingNumber,
    customer_id: params.customerId,
    driver_id: params.driverId || null,
    origin_address: origin.address,
    origin_latitude: origin.latitude,
    origin_longitude: origin.longitude,
    destination_address: destination.address,
    destination_latitude: destination.latitude,
    destination_longitude: destination.longitude,
    vehicle_type: vehicleType,
    base_fare: fareConfig.baseFare,
    total_fare: totalFare,
    status: params.status || BOOKING_STATUS.PENDING,
    payment_status: params.paymentStatus || PAYMENT_STATUS.PENDING,
    payment_method: params.paymentMethod || 'cash',
    pickup_otp: pickupOtp,
    estimated_distance: 8.5,
    estimated_duration: 20,
    receiver_name: params.receiverName || null,
    receiver_phone: params.receiverPhone || null,
    idempotency_key: `test_${Date.now()}_${Math.random()}`,
    expires_at: new Date(Date.now() + 120_000).toISOString(),
    accepted_at: params.status !== BOOKING_STATUS.PENDING ? new Date().toISOString() : null,
    started_at: params.status === BOOKING_STATUS.IN_PROGRESS ? new Date().toISOString() : null,
    completed_at: params.status === BOOKING_STATUS.COMPLETED ? new Date().toISOString() : null,
  }).select('id, booking_number').single();

  if (error || !data) {
    return { bookingId: '', bookingNumber: '', error: error?.message || 'Failed to create booking' };
  }

  return { bookingId: data.id, bookingNumber: data.booking_number, error: null };
}

// =====================================================
// DRIVER WALLET OPERATIONS
// =====================================================

export async function createDriverWallet(driverId: string, initialBalance: number = 0): Promise<{ error: string | null }> {
  const client = getClient();
  const { error } = await client.from('driver_wallets').upsert({
    driver_id: driverId,
    pending_balance: 0,
    available_balance: initialBalance,
    total_earned: initialBalance,
    total_withdrawn: 0,
  });
  return { error: error?.message || null };
}

export async function createWithdrawalRequest(driverId: string, amount: number): Promise<{ withdrawalId: string; error: string | null }> {
  const client = getClient();
  const { data, error } = await client.from('withdrawals').insert({
    driver_id: driverId,
    amount,
    status: 'pending',
    idempotency_key: `test_wd_${Date.now()}`,
  }).select('id').single();

  if (error || !data) {
    return { withdrawalId: '', error: error?.message || 'Failed' };
  }
  return { withdrawalId: data.id, error: null };
}

// =====================================================
// FARE CONFIG OPERATIONS
// =====================================================

export async function seedFareConfig(): Promise<void> {
  const client = getClient();
  for (const [vehicleType, config] of Object.entries(DEFAULT_FARE_CONFIG)) {
    const { error } = await client.from('fare_config').upsert({
      vehicle_type: vehicleType,
      base_fare: config.baseFare,
      per_km_rate: config.perKmRate,
      per_minute_rate: config.perMinRate,
      minimum_fare: config.minimumFare,
      cancellation_fee: config.cancellationFee,
      is_active: true,
      driver_search_radius_km: 10,
    }, { onConflict: 'vehicle_type' });
    if (error) console.error('Error seeding fare config:', error.message);
  }
}

// =====================================================
// QUERY HELPERS
// =====================================================

export async function getBooking(bookingId: string) {
  const client = getClient();
  const { data, error } = await client.from('bookings').select('*').eq('id', bookingId).single();
  if (error) throw new Error(`getBooking failed: ${error.message}`);
  return data;
}

export async function getBookingStatus(bookingId: string): Promise<string> {
  const booking = await getBooking(bookingId);
  return booking.status;
}

export async function getPaymentStatus(bookingId: string): Promise<string> {
  const booking = await getBooking(bookingId);
  return booking.payment_status;
}

export async function getWalletBalance(userId: string): Promise<number> {
  const client = getClient();
  const { data, error } = await client.from('users').select('balance').eq('id', userId).single();
  if (error) throw new Error(`getWalletBalance failed: ${error.message}`);
  return data.balance || 0;
}

export async function getDriverWalletBalance(driverId: string): Promise<{ pending: number; available: number }> {
  const client = getClient();
  const { data, error } = await client.from('driver_wallets').select('*').eq('driver_id', driverId).single();
  if (error) throw new Error(`getDriverWalletBalance failed: ${error.message}`);
  return { pending: data.pending_balance, available: data.available_balance };
}

export async function getDriverStatus(driverId: string) {
  const client = getClient();
  const { data, error } = await client.from('drivers').select('*').eq('id', driverId).single();
  if (error) throw new Error(`getDriverStatus failed: ${error.message}`);
  return data;
}

export async function setDriverOnline(driverId: string, latitude: number, longitude: number): Promise<void> {
  const client = getClient();
  await client.from('drivers').update({
    is_online: true,
    current_latitude: latitude,
    current_longitude: longitude,
    last_location_update: new Date().toISOString(),
  }).eq('id', driverId);
}

export async function setDriverOffline(driverId: string): Promise<void> {
  const client = getClient();
  await client.from('drivers').update({ is_online: false }).eq('id', driverId);
}

// =====================================================
// CLEANUP
// =====================================================

export async function cleanupTestData(testRunId: string): Promise<void> {
  const client = getClient();

  // Find test users by metadata
  const { data: users } = await client.auth.admin.listUsers();
  const testUsers = (users?.users || []).filter(
    (u) => u.user_metadata?.test_run_id === testRunId
  );

  for (const user of testUsers) {
    // Delete bookings
    await client.from('bookings').delete().eq('customer_id', user.id);

    // Delete driver data
    const { data: driver } = await client.from('drivers').select('id').eq('user_id', user.id).single();
    if (driver) {
      await client.from('driver_wallet_transactions').delete().eq('driver_id', driver.id);
      await client.from('driver_wallets').delete().eq('driver_id', driver.id);
      await client.from('driver_locations').delete().eq('driver_id', driver.id);
      await client.from('driver_rejections').delete().eq('driver_id', driver.id);
      await client.from('withdrawals').delete().eq('driver_id', driver.id);
      await client.from('drivers').delete().eq('id', driver.id);
    }

    // Delete user data
    await client.from('wallet_transactions').delete().eq('user_id', user.id);
    await client.from('ratings').delete().eq('from_user_id', user.id);
    await client.from('notifications').delete().eq('user_id', user.id);
    await client.from('saved_addresses').delete().eq('user_id', user.id);
    await client.from('support_tickets').delete().eq('user_id', user.id);
    await client.from('users').delete().eq('id', user.id);

    // Delete auth user
    await client.auth.admin.deleteUser(user.id);
  }
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const client = getClient();
  await client.from('booking_addons').delete().eq('booking_id', bookingId);
  await client.from('bookings').delete().eq('id', bookingId);
}

export { getClient as getSupabaseAdmin };
