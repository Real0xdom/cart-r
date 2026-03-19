"use strict";
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
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseKey);
        const { order_id, reason } = await req.json();
        if (!order_id) {
            throw new Error("Missing order_id");
        }
        console.log(`Cancelling order: ${order_id}, Reason: ${reason}`);
        // 1. Update Wallet Transaction if exists
        const { error: walletError } = await supabase
            .from('wallet_transactions')
            .update({
            status: 'failed',
            // We preserve description to keep "Wallet top-up"
        })
            .eq('payment_order_id', order_id);
        if (walletError)
            console.error("Wallet update error:", walletError);
        // 2. Update Booking if exists
        const { error: bookingError } = await supabase
            .from('bookings')
            .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString()
        })
            .eq('payment_id', order_id);
        if (bookingError)
            console.error("Booking update error:", bookingError);
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error("Cancel error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
