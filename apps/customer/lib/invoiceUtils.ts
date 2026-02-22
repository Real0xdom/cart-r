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
export function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return `₹${Number(n).toFixed(2)}`;
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

/**
 * Escape HTML to prevent XSS and break tags
 */
function escapeHtml(text: string): string {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

/**
 * Build HTML string for invoice (for PDF generation)
 */
export function invoiceToHtml(invoice: InvoiceData): string {
  const invNum = formatInvoiceNumber(invoice.invoice_number);
  const invDate = formatInvoiceDate(invoice.invoice_date);
  const pickupTime = formatInvoiceDate(invoice.pickup_time);
  const dropoffTime = formatInvoiceDate(invoice.dropoff_time);
  const fmt = (n: number | null | undefined) => `₹${(n ?? 0).toFixed(2)}`;

  const addonsRows =
    invoice.addons && invoice.addons.length > 0
      ? invoice.addons
          .map(
            (a) =>
              `<tr><td style="padding:4px 8px;color:#666;">• ${escapeHtml(a.name)}</td><td style="padding:4px 8px;text-align:right;">${fmt(a.price)}</td></tr>`
          )
          .join('')
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #333; padding: 20px; max-width: 100%; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #FF9800; padding-bottom: 12px; }
    .company { font-size: 18px; font-weight: bold; color: #111; }
    .tagline { font-size: 10px; color: #666; }
    .inv-label { background: #FF9800; color: #fff; padding: 6px 12px; font-weight: bold; font-size: 11px; }
    .section { margin: 14px 0; }
    .section-title { font-weight: bold; font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; }
    .row-2 { display: flex; gap: 24px; }
    .col { flex: 1; }
    .total-row { font-weight: bold; font-size: 14px; margin-top: 10px; padding-top: 10px; border-top: 2px solid #eee; }
    .payment { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">Cart-R</div>
      <div class="tagline">Goods Transportation Services</div>
    </div>
    <span class="inv-label">INVOICE</span>
  </div>

  <div class="section">
    <table>
      <tr><td style="color:#666;">Invoice Number</td><td>${escapeHtml(invNum)}</td></tr>
      <tr><td style="color:#666;">Invoice Date</td><td>${escapeHtml(invDate)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Customer & Driver</div>
    <div class="row-2">
      <div class="col">
        <strong>${escapeHtml(invoice.customer_name)}</strong><br/>
        <span style="color:#666;">${escapeHtml(invoice.customer_phone)}</span>
      </div>
      <div class="col">
        <strong>${escapeHtml(invoice.driver_name)}</strong><br/>
        <span style="color:#666;">${escapeHtml(invoice.driver_phone)}</span><br/>
        <span style="color:#666;">${escapeHtml(invoice.vehicle_number)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Trip</div>
    <p><strong>Pickup</strong> ${escapeHtml(invoice.pickup_address)}<br/><span style="color:#666;">${escapeHtml(pickupTime)}</span></p>
    <p><strong>Drop</strong> ${escapeHtml(invoice.dropoff_address)}<br/><span style="color:#666;">${escapeHtml(dropoffTime)}</span></p>
    <p>Vehicle: ${escapeHtml(invoice.vehicle_type)} &nbsp;|&nbsp; Distance: ${Number(invoice.distance_km).toFixed(2)} km</p>
  </div>

  <div class="section">
    <div class="section-title">Charges</div>
    <table>
      <tr><td>Base Fare</td><td style="text-align:right;">${fmt(invoice.base_fare)}</td></tr>
      ${invoice.tip_amount > 0 ? `<tr><td>Tip</td><td style="text-align:right;">${fmt(invoice.tip_amount)}</td></tr>` : ''}
      ${invoice.addon_charges > 0 ? `<tr><td>Add-on Services</td><td style="text-align:right;">${fmt(invoice.addon_charges)}</td></tr>${addonsRows}` : ''}
      ${invoice.waiting_charges > 0 ? `<tr><td>Waiting Charges</td><td style="text-align:right;">${fmt(invoice.waiting_charges)}</td></tr>` : ''}
    </table>
    <div class="total-row">Total Amount: ${fmt(invoice.total_amount)}</div>
  </div>

  <div class="payment">
    <span>Payment: <strong>${escapeHtml(invoice.payment_method)}</strong></span>
    <span style="background:${invoice.payment_status === 'paid' ? '#22c55e' : '#f59e0b'};color:#fff;padding:4px 8px;font-size:10px;">${escapeHtml(invoice.payment_status.toUpperCase())}</span>
  </div>

  <div class="footer">
    Thank you for using Cart-R! &nbsp;|&nbsp; support@cart-r.com
  </div>
</body>
</html>
  `.trim();
}
