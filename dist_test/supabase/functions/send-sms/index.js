"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
// Environment variables (set in Supabase dashboard)
// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
(0, server_ts_1.serve)(async (req) => {
    var _a, _b;
    try {
        const supabase = (0, supabase_js_2_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        // Get pending items from queue
        const { data: pendingItems, error: fetchError } = await supabase
            .from('sms_queue')
            .select('*')
            .eq('status', 'pending')
            .lt('attempts', 3)
            .order('created_at', { ascending: true })
            .limit(10);
        if (fetchError) {
            console.error('Error fetching queue:', fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
        }
        if (!(pendingItems === null || pendingItems === void 0 ? void 0 : pendingItems.length)) {
            return new Response(JSON.stringify({ message: 'No pending items', processed: 0 }));
        }
        let successCount = 0;
        let failCount = 0;
        for (const item of pendingItems) {
            const requestId = crypto.randomUUID();
            console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] Processing Notification for Booking: ${item.booking_id}`);
            try {
                // 1. Get Customer ID from Booking
                if (!item.booking_id)
                    throw new Error('No booking_id associated with this message');
                const { data: booking, error: bookingError } = await supabase
                    .from('bookings')
                    .select('customer_id, booking_number')
                    .eq('id', item.booking_id)
                    .single();
                if (bookingError || !booking)
                    throw new Error('Booking not found: ' + ((bookingError === null || bookingError === void 0 ? void 0 : bookingError.message) || 'Unknown'));
                // 2. Get Push Token from User
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('expo_push_token')
                    .eq('id', booking.customer_id)
                    .single();
                if (userError)
                    throw new Error('User fetch failed: ' + userError.message);
                const pushToken = user === null || user === void 0 ? void 0 : user.expo_push_token;
                if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
                    throw new Error('Customer does not have a valid Expo Push Token. They might not be logged in or app not installed.');
                }
                // 3. Send Push Notification via Expo API
                console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] Sending Push to ${pushToken}...`);
                const messageBody = {
                    to: pushToken,
                    sound: 'default',
                    title: '📦 Delivery Confirmation Code',
                    body: item.message, // "Your DELIVERY OTP is..."
                    data: {
                        type: 'delivery_otp',
                        bookingId: item.booking_id,
                        message: item.message
                    },
                    priority: 'high',
                    channelId: 'booking-updates'
                };
                const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messageBody),
                });
                const expoResult = await expoResponse.json();
                if (expoResponse.ok && ((_a = expoResult.data) === null || _a === void 0 ? void 0 : _a.status) === 'ok') {
                    // Success
                    await supabase
                        .from('sms_queue')
                        .update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                    })
                        .eq('id', item.id);
                    successCount++;
                    console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] ✅ Push Sent Successfully. Ticket: ${expoResult.data.id}`);
                }
                else {
                    // Expo API returned error (or partial error)
                    const errDetails = JSON.stringify(expoResult);
                    throw new Error(`Expo API Error: ${errDetails}`);
                }
            }
            catch (error) {
                console.error(`[${new Date().toISOString()}] [ReqID:${requestId}] 💥 Failed:`, error);
                await supabase
                    .from('sms_queue')
                    .update({
                    status: 'failed',
                    attempts: item.attempts + 1,
                    last_attempt_at: new Date().toISOString(),
                    error_message: (_b = error.message) === null || _b === void 0 ? void 0 : _b.substring(0, 1000),
                })
                    .eq('id', item.id);
                failCount++;
            }
        }
        return new Response(JSON.stringify({
            message: 'Notification processing complete',
            total: pendingItems.length,
            sent: successCount,
            failed: failCount,
        }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Error in function:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
});
