"use strict";
// Send Notification Edge Function
// Sends push notifications via Expo Push API
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
(0, server_ts_1.serve)(async (req) => {
    var _a, _b, _c, _d;
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseKey);
        const { user_id, title, body, data } = await req.json();
        if (!user_id || !title || !body) {
            return new Response(JSON.stringify({ error: 'Missing required fields: user_id, title, body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Get user's Expo push token from users table
        // Note: You'll need to add expo_push_token column to users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('expo_push_token')
            .eq('id', user_id)
            .single();
        if (userError || !user) {
            console.error('User not found:', user_id);
            return new Response(JSON.stringify({ error: 'User not found', sent: false }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!user.expo_push_token) {
            console.log('No push token for user:', user_id);
            // Still save notification to database for in-app notifications
            await supabase.from('notifications').insert({
                user_id,
                title,
                body,
                data,
            });
            return new Response(JSON.stringify({
                sent: false,
                reason: 'No push token registered',
                saved_to_db: true,
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Validate Expo push token format
        if (!user.expo_push_token.startsWith('ExponentPushToken[')) {
            console.error('Invalid push token format:', user.expo_push_token);
            return new Response(JSON.stringify({ error: 'Invalid push token format', sent: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Prepare Expo push message with high priority for overlay notifications
        const message = {
            to: user.expo_push_token,
            title,
            body,
            data: data || {},
            sound: 'default',
            priority: 'high',
            channelId: 'ride-requests', // Android notification channel for high-priority
            _displayInForeground: true, // Show even when app is in foreground
        };
        // Send to Expo Push API
        const pushResponse = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(message),
        });
        const pushResult = await pushResponse.json();
        // Save notification to database
        await supabase.from('notifications').insert({
            user_id,
            title,
            body,
            data,
        });
        // Check for errors in Expo response
        if (((_b = (_a = pushResult.data) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.status) === 'error') {
            console.error('Expo push error:', pushResult.data[0]);
            return new Response(JSON.stringify({
                sent: false,
                error: pushResult.data[0].message,
                details: pushResult.data[0].details,
                saved_to_db: true,
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.log('Notification sent successfully to:', user_id);
        return new Response(JSON.stringify({
            sent: true,
            ticket_id: (_d = (_c = pushResult.data) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.id,
            saved_to_db: true,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('Error sending notification:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
