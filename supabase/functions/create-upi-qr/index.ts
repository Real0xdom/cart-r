// Create UPI QR Edge Function
// Called by the driver app to generate a dynamic UPI QR code for payment collection.
// Creates a Cashfree PG Order and returns the payment_session_id for QR rendering.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID')
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY')
    const cashfreeEnv = Deno.env.get('CASHFREE_ENV') || 'sandbox'

    if (!cashfreeAppId || !cashfreeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { booking_id } = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_fare, driver_payout, payment_status, payment_id, customer_id, driver_id, booking_number, wallet_amount_used')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Payment already completed for this booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If a QR order was already created for this booking, return the existing one
    if (booking.payment_id) {
      // Check if the existing order is still valid
      try {
        const existingOrderRes = await fetch(`${cashfreeBaseUrl}/orders/${booking.payment_id}`, {
          headers: {
            'x-client-id': cashfreeAppId,
            'x-client-secret': cashfreeSecretKey,
            'x-api-version': '2023-08-01',
          },
        })
        
        if (existingOrderRes.ok) {
          const existingOrder = await existingOrderRes.json()
          if (existingOrder.order_status === 'ACTIVE') {
            console.log('Reusing existing active order:', booking.payment_id)

            // Build QR page URL
            const qrPageUrl = `${supabaseUrl}/functions/v1/checkout-page?session_id=${existingOrder.payment_session_id}&env=${cashfreeEnv}`

            return new Response(
              JSON.stringify({
                payment_session_id: existingOrder.payment_session_id,
                order_id: booking.payment_id,
                amount: existingOrder.order_amount,
                environment: cashfreeEnv,
                qr_page_url: qrPageUrl,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (e) {
        console.log('Could not fetch existing order, creating new one:', e)
      }
    }

    // Calculate amount to collect (considering partial wallet payments)
    const totalFare = booking.total_fare
    const walletUsed = booking.wallet_amount_used || 0
    const amountToCollect = booking.payment_status === 'partial_paid'
      ? totalFare - walletUsed
      : totalFare

    if (amountToCollect <= 0) {
      return new Response(
        JSON.stringify({ error: 'No amount to collect' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get customer info for the order
    const { data: customer } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('id', booking.customer_id)
      .single()

    // Create Cashfree PG Order for UPI QR
    const orderId = `UPIDR_${booking_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`

    const orderPayload = {
      order_id: orderId,
      order_amount: amountToCollect,
      order_currency: 'INR',
      customer_details: {
        customer_id: (booking.customer_id || 'guest').replace(/-/g, '').substring(0, 10),
        customer_phone: (customer?.phone || '9999999999').replace(/\D/g, '').slice(-10),
        customer_email: customer?.email || 'customer@cartr.app',
        customer_name: (customer?.name || 'Customer').substring(0, 100),
      },
      order_meta: {
        return_url: `cartr://payment-complete?order_id=${orderId}`,
        notify_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      },
      order_tags: {
        type: 'booking',
        cid: booking.customer_id,
        bid: booking_id,
        source: 'driver_upi_qr',
      },
      order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
    }

    console.log('Creating UPI QR Order:', orderId, 'Amount:', amountToCollect)

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(orderPayload),
    })

    const responseText = await cashfreeResponse.text()

    if (!cashfreeResponse.ok) {
      let errorData
      try { errorData = JSON.parse(responseText) } catch { errorData = { message: responseText } }
      console.error('Cashfree order creation failed:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to create UPI QR order', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cashfreeData = JSON.parse(responseText)

    // Store the order_id on the booking for webhook matching
    await supabase
      .from('bookings')
      .update({
        payment_id: orderId,
        payment_method: 'online', // UPI is mapped to online in the enum
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)

    // Build the QR page URL (uses our checkout-page edge function with Cashfree JS SDK)
    const qrPageUrl = `${supabaseUrl}/functions/v1/checkout-page?session_id=${cashfreeData.payment_session_id}&env=${cashfreeEnv}`

    console.log('UPI QR Order created:', orderId)

    return new Response(
      JSON.stringify({
        payment_session_id: cashfreeData.payment_session_id,
        order_id: cashfreeData.order_id,
        amount: amountToCollect,
        environment: cashfreeEnv,
        qr_page_url: qrPageUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating UPI QR:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
