import { supabase } from './supabase';

export interface InvoiceData {
  booking_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_phone: string;
  driver_name: string;
  driver_phone: string;
  vehicle_type: string;
  vehicle_number: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_time: string;
  dropoff_time: string;
  distance_km: number;
  base_fare: number;
  tip_amount: number;
  addon_charges: number;
  waiting_charges: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  addons?: Array<{
    name: string;
    price: number;
  }>;
}

/**
 * Generate invoice for completed booking
 */
export async function generateInvoice(bookingId: string): Promise<{
  data: InvoiceData | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('generate_invoice', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('[INVOICE] Error generating:', error);
      return { data: null, error: error.message };
    }

    console.log('[INVOICE] Generated successfully:', data);
    return { data, error: null };
  } catch (err: any) {
    console.error('[INVOICE] Exception:', err);
    return { data: null, error: err.message || 'Failed to generate invoice' };
  }
}

/**
 * Fetch existing invoice for a booking
 */
export async function getInvoice(bookingId: string): Promise<{
  data: InvoiceData | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (error) {
      console.error('[INVOICE] Error fetching:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('[INVOICE] Exception:', err);
    return { data: null, error: err.message || 'Failed to fetch invoice' };
  }
}

/**
 * Format invoice number (e.g., INV-2024-001234)
 */
export function formatInvoiceNumber(invoiceNumber: string): string {
  if (invoiceNumber.startsWith('INV-')) {
    return invoiceNumber;
  }
  const date = new Date();
  const year = date.getFullYear();
  return `INV-${year}-${invoiceNumber.padStart(6, '0')}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Format date for invoice
 */
export function formatInvoiceDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
