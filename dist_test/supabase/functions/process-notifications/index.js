"use strict";
// Process Notification Queue Edge Function
// Polls the notifications table and sends push notifications via Expo
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
(0, server_ts_1.serve)(async (req) => {
    var _a;
    try {
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseServiceKey);
        // Fetch unprocessed notifications with user push tokens
        const { data: notifications, error: fetchError } = await supabase
            .from('notifications')
            .select(`
        id,
        user_id,
        title,
        body,
        data,
        notification_type,
        users!inner(expo_push_token)
      `)
            .is('processed_at', null)
            .order('created_at', { ascending: true })
            .limit(100);
        if (fetchError) {
            console.error('Error fetching notifications:', fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        if (!notifications || notifications.length === 0) {
            return new Response(JSON.stringify({ message: 'No notifications to process', processed: 0 }), { headers: { 'Content-Type': 'application/json' } });
        }
        // Prepare Expo push messages
        const messages = [];
        const notificationIds = [];
        for (const notification of notifications) {
            const pushToken = (_a = notification.users) === null || _a === void 0 ? void 0 : _a.expo_push_token;
            if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
                console.log(`Skipping notification ${notification.id}: Invalid push token`);
                continue;
            }
            messages.push({
                to: pushToken,
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
                sound: 'default',
                priority: 'high',
                channelId: notification.notification_type === 'booking_update' ? 'booking-updates' : 'default',
            });
            notificationIds.push(notification.id);
        }
        // Send to Expo Push API
        if (messages.length > 0) {
            const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
            const pushResponse = await fetch(expoPushEndpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });
            const pushResult = await pushResponse.json();
            console.log(`Sent ${messages.length} notifications:`, pushResult);
        }
        // Mark notifications as processed
        if (notificationIds.length > 0) {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ processed_at: new Date().toISOString() })
                .in('id', notificationIds);
            if (updateError) {
                console.error('Error marking notifications as processed:', updateError);
            }
        }
        return new Response(JSON.stringify({
            message: 'Notifications processed',
            processed: messages.length,
            skipped: notifications.length - messages.length,
        }), { headers: { 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Error processing notifications:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
