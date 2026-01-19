"use strict";
// Create Payment Order Edge Function
// Creates a Cashfree payment ORDER (Standard Gateway) instead of Link
// This is required for Native SDK integration and standard checkout
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
(0, server_ts_1.serve)(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID');
        const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY');
        // CASHFREE_ENV is the master switch
        const cashfreeEnv = Deno.env.get('CASHFREE_ENV') || 'sandbox';
        if (!cashfreeAppId || !cashfreeSecretKey) {
            console.error('Missing Cashfree credentials');
            return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Ensure correct base URL
        const cashfreeBaseUrl = cashfreeEnv === 'production'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
        console.log(`Using Cashfree Env: ${cashfreeEnv} (${cashfreeBaseUrl})`);
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseKey);
        const body = await req.json();
        const { booking_id, customer_id, customer_name, customer_email, customer_phone, amount, return_url } = body;
        if (!customer_id || !amount || amount <= 0) {
            return new Response(JSON.stringify({ error: 'Missing required fields: customer_id and amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const isWalletTopUp = !booking_id;
        // Order ID format: strict requirement for alphanumeric
        const orderId = isWalletTopUp
            ? `WALLET_${customer_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`
            : `BOOKING_${booking_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`;
        // For booking payments, verify the booking exists
        if (!isWalletTopUp) {
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('id, total_fare, payment_status')
                .eq('id', booking_id)
                .eq('customer_id', customer_id)
                .single();
            if (bookingError || !booking) {
                return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            if (booking.payment_status === 'paid') {
                return new Response(JSON.stringify({ error: 'Payment already completed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }
        // Create Payment Order using Cashfree Orders API
        const orderPayload = {
            order_id: orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
                customer_id: customer_id.replace(/-/g, '').substring(0, 10), // Strict ID requirements
                customer_phone: (customer_phone || '9999999999').replace(/\D/g, '').slice(-10),
                customer_email: customer_email || 'user@cartr.app',
                customer_name: (customer_name || 'CartR User').substring(0, 100),
            },
            order_meta: {
                return_url: return_url || `cartr://payment-complete?order_id=${orderId}`,
                notify_url: `${supabaseUrl}/functions/v1/payment-webhook`,
            },
            order_tags: {
                type: isWalletTopUp ? 'wallet' : 'booking',
                cid: customer_id,
                bid: booking_id || 'none'
            },
            order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins expiry
        };
        console.log('Creating Cashfree Order:', JSON.stringify(orderPayload, null, 2));
        const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': cashfreeAppId,
                'x-client-secret': cashfreeSecretKey,
                'x-api-version': '2023-08-01',
            },
            body: JSON.stringify(orderPayload),
        });
        const responseText = await cashfreeResponse.text();
        console.log('Cashfree response status:', cashfreeResponse.status);
        console.log('Cashfree response body:', responseText);
        if (!cashfreeResponse.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            }
            catch (_a) {
                errorData = { message: responseText };
            }
            console.error('Cashfree error:', errorData);
            return new Response(JSON.stringify({ error: 'Failed to create payment order', details: errorData }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const cashfreeData = JSON.parse(responseText);
        // Store transaction for tracking
        if (isWalletTopUp) {
            try {
                await supabase
                    .from('wallet_transactions')
                    .insert({
                    user_id: customer_id,
                    amount: amount,
                    type: 'credit',
                    status: 'pending',
                    payment_order_id: orderId, // Use order_id
                    description: 'Wallet top-up',
                });
            }
            catch (err) {
                console.log('Could not store wallet transaction:', err);
            }
        }
        else {
            await supabase
                .from('bookings')
                .update({
                payment_id: orderId,
                payment_method: 'online',
                updated_at: new Date().toISOString(),
            })
                .eq('id', booking_id);
        }
        // Generate proper Web Checkout URL for fallback (browser-based checkout)
        // We point to our own 'checkout-page' Edge Function which hosts the Cashfree JS SDK
        // We MUST use the SUPABASE_URL env var to ensure we get the public URL (project-ref.supabase.co)
        // avoiding internal hostnames like 'h-runtime' which cause 401 errors.
        const projectUrl = Deno.env.get('SUPABASE_URL');
        const checkoutPageUrl = `${projectUrl}/functions/v1/checkout-page`;
        const webCheckoutUrl = `${checkoutPageUrl}?session_id=${cashfreeData.payment_session_id}&env=${cashfreeEnv}`;
        return new Response(JSON.stringify({
            payment_session_id: cashfreeData.payment_session_id, // This is what Native SDK needs
            order_id: cashfreeData.order_id,
            order_status: cashfreeData.order_status,
            is_wallet_topup: isWalletTopUp,
            environment: cashfreeEnv, // Pass env explicitly to client
            // Provide a fallback checkout URL for Web/browser-based checkout
            checkout_url: webCheckoutUrl
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Error creating payment:', error);
        return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
