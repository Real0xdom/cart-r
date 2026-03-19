/**
 * API Client for Supabase Edge Functions
 * Makes HTTP calls to edge functions for integration/API testing.
 */
import env from '../config/environments';

interface ApiResponse<T = any> {
  status: number;
  data: T;
  ok: boolean;
  error?: string;
}

async function callEdgeFunction<T = any>(
  functionName: string,
  body: Record<string, any>,
  authToken?: string
): Promise<ApiResponse<T>> {
  const url = `${env.supabaseUrl}/functions/v1/${functionName}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': env.supabaseAnonKey,
    'Authorization': `Bearer ${authToken || env.supabaseServiceKey}`,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;
    return {
      status: response.status,
      data: data as T,
      ok: response.ok,
      error: response.ok ? undefined : (data?.error || data?.message || 'Unknown error'),
    };
  } catch (err: any) {
    return {
      status: 0,
      data: {} as T,
      ok: false,
      error: err.message || 'Network error',
    };
  }
}

// =====================================================
// DRIVER ASSIGNMENT
// =====================================================

export interface AssignDriverResponse {
  assigned: boolean;
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicle_number: string;
    vehicle_model: string;
    rating: number;
    distance_km: number;
  };
  error?: string;
  searched_radius_km?: number;
}

export async function callAssignDriver(
  bookingId: string,
  maxRadiusKm: number = 10
): Promise<ApiResponse<AssignDriverResponse>> {
  return callEdgeFunction<AssignDriverResponse>('assign-driver', {
    booking_id: bookingId,
    max_radius_km: maxRadiusKm,
  });
}

// =====================================================
// FARE CALCULATION
// =====================================================

export interface CalculateFareResponse {
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  total_fare: number;
  minimum_fare: number;
  surge_multiplier: number;
}

export async function callCalculateFare(params: {
  vehicle_type?: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  get_all_vehicles?: boolean;
}): Promise<ApiResponse<CalculateFareResponse>> {
  return callEdgeFunction<CalculateFareResponse>('calculate-fare', params);
}

// =====================================================
// PAYMENT OPERATIONS
// =====================================================

export interface CreatePaymentOrderResponse {
  payment_session_id: string;
  order_id: string;
  order_status: string;
  is_wallet_topup: boolean;
  environment: string;
  checkout_url: string;
}

export async function callCreatePaymentOrder(params: {
  booking_id?: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  amount: number;
  return_url?: string;
  topup_target?: 'customer_wallet' | 'driver_wallet';
}): Promise<ApiResponse<CreatePaymentOrderResponse>> {
  return callEdgeFunction<CreatePaymentOrderResponse>('create-payment-order', params);
}

export interface VerifyPaymentResponse {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  order_status: string;
  amount: number;
  order_id: string;
  wallet_credited?: boolean;
  credit_error?: string | null;
}

export async function callVerifyPayment(
  orderId: string,
  forceFail: boolean = false
): Promise<ApiResponse<VerifyPaymentResponse>> {
  return callEdgeFunction<VerifyPaymentResponse>('verify-payment', {
    order_id: orderId,
    force_fail: forceFail,
  });
}

// =====================================================
// WITHDRAWAL / PAYOUT
// =====================================================

export interface ProcessWithdrawalResponse {
  success: boolean;
  mode: 'automatic' | 'manual';
  transfer_id?: string;
  message?: string;
  error?: string;
}

export async function callProcessWithdrawal(
  withdrawalId: string
): Promise<ApiResponse<ProcessWithdrawalResponse>> {
  return callEdgeFunction<ProcessWithdrawalResponse>('process-withdrawal', {
    withdrawal_id: withdrawalId,
  });
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export async function callSendNotification(params: {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<ApiResponse> {
  return callEdgeFunction('send-notification', params);
}

// =====================================================
// SMS
// =====================================================

export async function callSendSms(params: {
  phone: string;
  message: string;
  booking_id?: string;
}): Promise<ApiResponse> {
  return callEdgeFunction('send-sms', params);
}

// =====================================================
// UPI QR
// =====================================================

export async function callCreateUpiQr(params: {
  amount: number;
  booking_id: string;
  customer_name?: string;
}): Promise<ApiResponse> {
  return callEdgeFunction('create-upi-qr', params);
}

// =====================================================
// CREATE BENEFICIARY (for driver payout)
// =====================================================

export async function callCreateBeneficiary(params: {
  driver_id: string;
  bank_account_number: string;
  bank_ifsc: string;
  account_holder_name: string;
}): Promise<ApiResponse> {
  return callEdgeFunction('create-beneficiary', params);
}

export { callEdgeFunction };
