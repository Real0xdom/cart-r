import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BookingRow = {
  id: string
  booking_number: string
  quoted_total_fare: number | null
  cancellation_penalty_amount: number | null
  wallet_escrow_amount: number | null
  wallet_escrow_status: string | null
  wallet_escrow_released_at: string | null
  wallet_escrow_refunded_at: string | null
  customer_id: string
  total_fare: number | null
  driver_payout: number | null
  payment_status: string | null
  payment_method: string | null
  payment_id: string | null
  online_payment_order_id: string | null
  wallet_amount_used: number | null
  refund_status: string | null
  refund_amount: number | null
  refund_reason: string | null
  refund_error: string | null
  refund_id: string | null
  refund_source: string | null
  refund_initiated_at: string | null
  started_at: string | null
  status: string
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function calculateRefundBreakdown(booking: BookingRow) {
  const capturedTotal = Number(booking.quoted_total_fare ?? booking.total_fare ?? 0)
  const chargeableFare = Number(booking.total_fare ?? 0)
  const walletAlreadyRefunded =
    booking.wallet_escrow_status === 'refunded' ||
    booking.wallet_escrow_status === 'partially_refunded'
  const walletHeld = walletAlreadyRefunded
    ? 0
    : Number(booking.wallet_escrow_amount ?? booking.wallet_amount_used ?? 0)
  const preStartCancellation = !booking.started_at
  const totalCaptured = preStartCancellation ? capturedTotal : capturedTotal
  const refundableAmount = preStartCancellation
    ? totalCaptured
    : Math.max(totalCaptured - chargeableFare, 0)
  let walletRefund = 0
  let onlineRefund = 0

  switch (booking.payment_method) {
    case 'wallet':
      if (booking.payment_status === 'paid' || booking.payment_status === 'partial_paid') {
        walletRefund = Math.min(refundableAmount, walletHeld > 0 ? walletHeld : totalCaptured)
      }
      break
    case 'partial_wallet':
      walletRefund = Math.min(refundableAmount, walletHeld)
      break
    case 'wallet_plus_online':
      walletRefund = Math.min(refundableAmount, walletHeld)
      onlineRefund = Math.max(refundableAmount - walletRefund, 0)
      break
    case 'online':
      if (booking.payment_status === 'paid') {
        onlineRefund = refundableAmount
      }
      break
  }

  const totalRefund = roundAmount(walletRefund + onlineRefund)
  const orderId = booking.online_payment_order_id || booking.payment_id

  return {
    capturedTotal: roundAmount(totalCaptured),
    chargeableFare: roundAmount(chargeableFare),
    walletRefund: roundAmount(walletRefund),
    onlineRefund: roundAmount(onlineRefund),
    totalRefund,
    orderId,
  }
}

function mapCashfreeRefundStatus(status: string | null | undefined): 'processing' | 'succeeded' | 'failed' {
  switch ((status || '').toUpperCase()) {
    case 'SUCCESS':
      return 'succeeded'
    case 'FAILED':
    case 'CANCELLED':
      return 'failed'
    default:
      return 'processing'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let bookingId: string | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID')
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY')
    const cashfreeEnv =
      Deno.env.get('CASHFREE_ENV') ||
      Deno.env.get('CASHFREE_ENVIRONMENT') ||
      'sandbox'

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { booking_id } = await req.json()
    bookingId = booking_id ?? null

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing booking_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_number,
        quoted_total_fare,
        cancellation_penalty_amount,
        wallet_escrow_amount,
        wallet_escrow_status,
        wallet_escrow_released_at,
        wallet_escrow_refunded_at,
        customer_id,
        total_fare,
        driver_payout,
        payment_status,
        payment_method,
        payment_id,
        online_payment_order_id,
        wallet_amount_used,
        refund_status,
        refund_amount,
        refund_reason,
        refund_error,
        refund_id,
        refund_source,
        refund_initiated_at,
        started_at,
        status
      `)
      .eq('id', booking_id)
      .single()

    const booking = data as BookingRow | null

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (booking.status !== 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, skipped: 'booking_not_cancelled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { walletRefund, onlineRefund, totalRefund, orderId, capturedTotal } = calculateRefundBreakdown(booking)

    if (totalRefund <= 0) {
      await supabase
        .from('bookings')
        .update({
          refund_status: 'not_applicable',
          refund_amount: 0,
          wallet_escrow_status:
            Number(booking.wallet_escrow_amount ?? 0) > 0 &&
            booking.wallet_escrow_status === 'held'
              ? 'released'
              : booking.wallet_escrow_status,
          wallet_escrow_released_at:
            Number(booking.wallet_escrow_amount ?? 0) > 0 &&
            booking.wallet_escrow_status === 'held'
              ? new Date().toISOString()
              : booking.wallet_escrow_released_at,
          refund_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      return new Response(
        JSON.stringify({ success: true, skipped: 'no_refund_due' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (booking.refund_status === 'succeeded') {
      return new Response(
        JSON.stringify({ success: true, skipped: 'already_refunded' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const refundId =
      booking.refund_id || `refund_${booking.id.replace(/-/g, '').slice(0, 18)}`

    await supabase
      .from('bookings')
      .update({
        refund_status: 'processing',
        refund_id: refundId,
        refund_error: null,
        refund_initiated_at: booking.refund_initiated_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)

    let walletRefundCompleted = walletRefund <= 0
    let onlineRefundStatus: 'processing' | 'succeeded' | 'failed' = onlineRefund > 0 ? 'processing' : 'succeeded'
    let onlineRefundMessage: string | null = null

    if (walletRefund > 0) {
      const walletRefundRef = `BOOKING_REFUND_${booking.id}_WALLET`
      const { data: credited, error: walletError } = await supabase.rpc('atomic_credit_wallet_idempotent', {
        p_user_id: booking.customer_id,
        p_amount: walletRefund,
        p_order_id: walletRefundRef,
      })

      if (walletError) {
        throw new Error(`Wallet refund failed: ${walletError.message}`)
      }

      walletRefundCompleted = Boolean(credited)

      if (!walletRefundCompleted) {
        const { data: existingWalletRefund } = await supabase
          .from('wallet_transactions')
          .select('status')
          .eq('payment_order_id', walletRefundRef)
          .maybeSingle()

        walletRefundCompleted = existingWalletRefund?.status === 'completed'
      }

      await supabase
        .from('wallet_transactions')
        .update({
          booking_id: booking.id,
          description: `Trip refund - Booking #${booking.booking_number}`,
          updated_at: new Date().toISOString(),
        })
        .eq('payment_order_id', walletRefundRef)
    }

    if (onlineRefund > 0) {
      if (!cashfreeAppId || !cashfreeSecretKey) {
        throw new Error('Cashfree refund credentials are missing')
      }

      if (!orderId) {
        throw new Error('No online order id found for original payment source')
      }

      const cashfreeBaseUrl =
        cashfreeEnv === 'production'
          ? 'https://api.cashfree.com/pg'
          : 'https://sandbox.cashfree.com/pg'

      const refundResponse = await fetch(`${cashfreeBaseUrl}/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': cashfreeAppId,
          'x-client-secret': cashfreeSecretKey,
          'x-api-version': '2023-08-01',
        },
        body: JSON.stringify({
          refund_amount: onlineRefund,
          refund_id: refundId,
          refund_note: `${booking.refund_reason || 'Trip cancelled'} - Booking #${booking.booking_number}`,
          refund_speed: 'STANDARD',
        }),
      })

      const refundText = await refundResponse.text()
      let refundPayload: any = null

      try {
        refundPayload = JSON.parse(refundText)
      } catch {
        refundPayload = refundText
      }

      if (!refundResponse.ok) {
        throw new Error(
          `Cashfree refund failed: ${
            typeof refundPayload === 'string'
              ? refundPayload
              : JSON.stringify(refundPayload)
          }`,
        )
      }

      const refundRecord = Array.isArray(refundPayload) ? refundPayload[0] : refundPayload
      onlineRefundStatus = mapCashfreeRefundStatus(refundRecord?.refund_status)
      onlineRefundMessage =
        refundRecord?.status_description ||
        refundRecord?.refund_message ||
        null
    }

    const finalStatus =
      walletRefundCompleted && onlineRefundStatus === 'succeeded'
        ? 'succeeded'
        : onlineRefundStatus === 'failed'
          ? 'failed'
          : 'processing'

    const walletHeld = Number(booking.wallet_escrow_amount ?? booking.wallet_amount_used ?? 0)
    const finalWalletEscrowStatus =
      walletHeld <= 0
        ? booking.wallet_escrow_status
        : finalStatus === 'failed'
          ? 'failed'
          : walletRefund >= walletHeld - 0.01
            ? 'refunded'
            : walletRefund > 0
              ? 'partially_refunded'
              : booking.status === 'cancelled'
                ? 'released'
                : booking.wallet_escrow_status

    const updatePayload: Record<string, string | number | null> = {
      refund_status: finalStatus,
      refund_amount: totalRefund,
      refund_id: refundId,
      refund_error: finalStatus === 'failed' ? onlineRefundMessage || 'Refund could not be completed automatically' : null,
      refund_completed_at: finalStatus === 'succeeded' ? new Date().toISOString() : null,
      wallet_escrow_status: finalWalletEscrowStatus,
      wallet_escrow_refunded_at:
        finalStatus === 'succeeded' && walletRefund > 0
          ? new Date().toISOString()
          : booking.wallet_escrow_refunded_at,
      updated_at: new Date().toISOString(),
    }

    if (finalStatus === 'succeeded' && totalRefund >= capturedTotal - 0.01) {
      updatePayload.payment_status = 'refunded'
    }

    await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking.id)

    const customerMessage =
      finalStatus === 'failed'
        ? 'We could not complete your refund automatically. Our team has been notified and will help shortly.'
        : walletRefund > 0 && onlineRefund > 0
          ? finalStatus === 'succeeded'
            ? `Rs.${walletRefund.toFixed(2)} has been returned to your wallet. The remaining Rs.${onlineRefund.toFixed(2)} is headed back to your original payment source and usually reflects within 7 to 10 business days.`
            : `Rs.${walletRefund.toFixed(2)} is being returned to your wallet. The remaining Rs.${onlineRefund.toFixed(2)} is being refunded to your original payment source and usually reflects within 7 to 10 business days.`
          : walletRefund > 0
            ? finalStatus === 'succeeded'
              ? `Rs.${walletRefund.toFixed(2)} has been returned to your wallet and should reflect shortly.`
              : `Rs.${walletRefund.toFixed(2)} is being returned to your wallet and should reflect shortly.`
            : finalStatus === 'succeeded'
              ? `Your refund of Rs.${totalRefund.toFixed(2)} has been processed. Funds usually reflect within 7 to 10 business days.`
              : `Your refund of Rs.${totalRefund.toFixed(2)} is being processed. Funds usually reflect within 7 to 10 business days.`

    await supabase.from('notifications').insert({
      user_id: booking.customer_id,
      title: finalStatus === 'failed' ? 'Refund delayed' : 'Refund update',
      body: customerMessage,
      data: {
        booking_id: booking.id,
        type: 'refund_update',
        refund_status: finalStatus,
        refund_amount: totalRefund,
        wallet_refund: walletRefund,
        online_refund: onlineRefund,
      },
      notification_type: 'refund_update',
      is_read: false,
    })

    return new Response(
      JSON.stringify({
        success: true,
        refund_status: finalStatus,
        refund_amount: totalRefund,
        wallet_refund: walletRefund,
        online_refund: onlineRefund,
        driver_payout: booking.driver_payout ?? null,
        penalty_amount: booking.cancellation_penalty_amount ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('process-booking-refund error:', error)

    if (bookingId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        await supabase
          .from('bookings')
          .update({
            refund_status: 'failed',
            refund_error: String(error),
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)

        const { data: booking } = await supabase
          .from('bookings')
          .select('customer_id')
          .eq('id', bookingId)
          .maybeSingle()

        if (booking?.customer_id) {
          await supabase.from('notifications').insert({
            user_id: booking.customer_id,
            title: 'Refund delayed',
            body: 'We could not complete your refund automatically. Our team has been notified and will help shortly.',
            data: {
              booking_id: bookingId,
              type: 'refund_update',
              refund_status: 'failed',
            },
            notification_type: 'refund_update',
            is_read: false,
          })
        }
      } catch (writebackError) {
        console.error('Failed to persist refund error state:', writebackError)
      }
    }

    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
