"use strict";
// Verify Payment Edge Function
// Verifies the status of a Cashfree payment ORDER (Standard Gateway)
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
        const cashfreeEnv = Deno.env.get('CASHFREE_ENV') || 'sandbox';
        if (!cashfreeAppId || !cashfreeSecretKey) {
            throw new Error("Missing Cashfree credentials");
        }
        const cashfreeBaseUrl = cashfreeEnv === 'production'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseKey);
        const body = await req.json();
        const { order_id, force_fail } = body;
        if (!order_id) {
            return new Response(JSON.stringify({ error: 'Missing order_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.log('Verifying payment order:', order_id);
        // 1. Get order status
        const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${order_id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': cashfreeAppId,
                'x-client-secret': cashfreeSecretKey,
                'x-api-version': '2025-01-01',
            },
        });
        const responseText = await cashfreeResponse.text();
        if (!cashfreeResponse.ok) {
            console.error('Cashfree verify error:', responseText);
            return new Response(JSON.stringify({ error: 'Failed to verify payment', details: JSON.parse(responseText) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const orderData = JSON.parse(responseText);
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
        });
        let paymentDetails = null;
        // Map Cashfree order status using user's requested logic
        let status = 'PENDING';
        if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            // Logic requested by user:
            // Check if ANY payment is SUCCESS -> Success
            // Else if ANY payment is PENDING -> Pending (unless forced failure)
            // Else -> Failure
            const successTxns = paymentsData.filter((t) => t.payment_status === "SUCCESS");
            const pendingTxns = paymentsData.filter((t) => t.payment_status === "PENDING");
            if (successTxns.length > 0) {
                status = 'PAID';
                paymentDetails = successTxns[0];
            }
            else if (pendingTxns.length > 0) {
                // If explicit failure requested (e.g. user cancelled), override pending to failed
                if (force_fail) {
                    status = 'FAILED';
                }
                else {
                    status = 'PENDING';
                }
            }
            else {
                status = 'FAILED';
            }
        }
        else {
            // Fallback to order level status if payments fetch fails
            if (orderData.order_status === 'PAID') {
                status = 'PAID';
            }
            else if (orderData.order_status === 'EXPIRED' || orderData.order_status === 'TERMINATED') {
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
                // Update wallet balance
                // Check if transaction is already completed to avoid double credit
                const { data: txn } = await supabase
                    .from('wallet_transactions')
                    .select('status')
                    .eq('payment_order_id', order_id)
                    .single();
                if (txn && txn.status !== 'completed') {
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('balance')
                        .eq('id', cid)
                        .single();
                    if (!userError && userData) {
                        const newBalance = (userData.balance || 0) + paymentAmount;
                        await supabase
                            .from('users')
                            .update({ balance: newBalance })
                            .eq('id', cid);
                        await supabase
                            .from('wallet_transactions')
                            .update({
                            status: 'completed',
                            // Store payment method if available (e.g., 'upi', 'card')
                            description: paymentDetails ? `Wallet top-up via ${paymentDetails.payment_group || 'online'}` : 'Wallet top-up'
                        })
                            .eq('payment_order_id', order_id);
                    }
                }
            }
            else if (type === 'booking' && bid && bid !== 'none') {
                // Update booking
                await supabase
                    .from('bookings')
                    .update({
                    payment_status: 'paid',
                    updated_at: new Date().toISOString()
                })
                    .eq('id', bid);
            }
        }
        else if (status === 'FAILED') {
            // Also update failed status so user doesn't see "Pending" forever
            if (type === 'wallet') {
                await supabase
                    .from('wallet_transactions')
                    .update({
                    status: 'failed'
                    // Preserving original description (e.g. "Wallet top-up")
                })
                    .eq('payment_order_id', order_id);
            }
            else if (type === 'booking' && bid && bid !== 'none') {
                await supabase
                    .from('bookings')
                    .update({
                    payment_status: 'failed',
                    updated_at: new Date().toISOString()
                })
                    .eq('id', bid);
            }
        }
        return new Response(JSON.stringify({
            status,
            order_status: orderData.order_status,
            amount: orderData.order_amount,
            order_id: order_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Error verifying payment:', error);
        return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
