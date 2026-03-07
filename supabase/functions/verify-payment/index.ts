// Verify Payment Edge Function
// Verifies the status of a Cashfree payment ORDER (Standard Gateway)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyPaymentRequest {
  order_id: string
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
        throw new Error("Missing Cashfree credentials");
    }

    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'

    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: VerifyPaymentRequest = await req.json()
    const { order_id } = body

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verifying payment order:', order_id)

    // 1. Get order status
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2025-01-01',
      },
    })

    const responseText = await cashfreeResponse.text()
    if (!cashfreeResponse.ok) {
        console.error('Cashfree verify error:', responseText)
        return new Response(
            JSON.stringify({ error: 'Failed to verify payment', details: JSON.parse(responseText) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const orderData = JSON.parse(responseText)

    // 2. Get specific payment transactions (to capture method and match user logic)
    // Matches: cashfree.PGOrderFetchPayments("your-order-id")
    // 2. Get specific payment transactions
    const paymentsResponse = await fetch(`${cashfreeBaseUrl}/orders/${order_id}/payments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
    })
    
    let paymentDetails = null;

    // Map Cashfree order status using user's requested logic
    let status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING'

    if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        
        // Logic requested by user:
        // Check if ANY payment is SUCCESS -> Success
        // Else if ANY payment is PENDING -> Pending
        // Else -> Failure
        
        const successTxns = paymentsData.filter((t: any) => t.payment_status === "SUCCESS");
        const pendingTxns = paymentsData.filter((t: any) => t.payment_status === "PENDING");

        if (successTxns.length > 0) {
            status = 'PAID';
            paymentDetails = successTxns[0];
        } else if (pendingTxns.length > 0) {
            status = 'PENDING';
        } else {
            status = 'FAILED';
        }
    } else {
        // Fallback to order level status if payments fetch fails
        if (orderData.order_status === 'PAID') {
            status = 'PAID';
        } else if (orderData.order_status === 'EXPIRED' || orderData.order_status === 'TERMINATED') {
            status = 'FAILED'; // Map cancelled/expired to failed for simplicity
        }
    }

    // Capture payment details
    const paymentAmount = orderData.order_amount;
    const orderTags = orderData.order_tags || {};

    // Extract metadata
    const type = orderTags.type;
    const cid = orderTags.cid;
    const bid = orderTags.bid;

    // If payment is successful, update the DB
    if (status === 'PAID') {
      if (type === 'wallet' && cid) {
        // Update wallet balance using atomic RPC with built-in idempotency
        const { data: wasCredited, error: creditError } = await supabase.rpc('atomic_credit_wallet_idempotent', {
          p_user_id: cid,
          p_amount: paymentAmount,
          p_order_id: order_id
        })

        if (!creditError) {
            if (paymentDetails) {
                // If we got the specific method, update the description
                await supabase
                    .from('wallet_transactions')
                    .update({ 
                        description: `Wallet top-up via ${paymentDetails.payment_group || 'online'}` 
                    })
                    .eq('payment_order_id', order_id)
            }
        } else {
            console.error('Failed to credit wallet atomically:', creditError)
        }
      } else if (type === 'booking' && bid && bid !== 'none') {
        // Update booking
         await supabase
          .from('bookings')
          .update({ 
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', bid)
      }
    } else if (status === 'FAILED') {
       // Also update failed status so user doesn't see "Pending" forever
       if (type === 'wallet') {
          await supabase
            .from('wallet_transactions')
            .update({ 
                status: 'failed'
                // Preserving original description (e.g. "Wallet top-up")
            })
            .eq('payment_order_id', order_id)
       } else if (type === 'booking' && bid && bid !== 'none') {
          await supabase
            .from('bookings')
            .update({ 
                payment_status: 'failed',
                updated_at: new Date().toISOString()
            })
            .eq('id', bid)
       }
    }

    return new Response(
      JSON.stringify({
        status,
        order_status: orderData.order_status,
        amount: orderData.order_amount,
        order_id: order_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
