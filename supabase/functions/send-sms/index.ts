import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY')!;
const FAST2SMS_ROUTE = Deno.env.get('FAST2SMS_ROUTE') || 'p';
const USE_FAST2SMS_IN_DEV = Deno.env.get('USE_FAST2SMS_IN_DEV') === 'true'; // Flag to control Fast2SMS usage

async function sendFast2SMS(phone: string, message: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const url = 'https://www.fast2sms.com/dev/bulkV2';

    const params = new URLSearchParams({
      authorization: FAST2SMS_API_KEY,
      message: message,
      language: 'english',
      route: FAST2SMS_ROUTE,
      numbers: phone.replace('+91', '').replace('+', ''),
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    const result = await response.json();

    if (result.return === true) {
      return { success: true, requestId: result.request_id };
    } else {
      const errorMsg = Array.isArray(result.message) 
        ? result.message.join(', ') 
        : (typeof result.message === 'string' ? result.message : 'Unknown error');
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    console.error('Fast2SMS Error:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    if (!pendingItems?.length) {
      return new Response(JSON.stringify({ message: 'No pending items', processed: 0 }));
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      const requestId = crypto.randomUUID();
      console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] Processing SMS for Booking: ${item.booking_id}, Phone: ${item.phone_number}`);
      
      try {
        let smsSent = false;
        if (FAST2SMS_API_KEY && item.phone_number) {
          const smsResult = await sendFast2SMS(item.phone_number, item.message);
          if (smsResult.success) {
            smsSent = true;
            console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] ✅ Fast2SMS Sent Successfully. Request ID: ${smsResult.requestId}`);
          } else {
            console.warn(`[${new Date().toISOString()}] [ReqID:${requestId}] ⚠️ Fast2SMS failed: ${smsResult.error}`);
          }
        }

        let pushSent = false;
        if (item.booking_id) {
          try {
            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('customer_id, booking_number')
                .eq('id', item.booking_id)
                .single();
                
            if (!bookingError && booking) {
              const { data: user, error: userError } = await supabase
                  .from('users')
                  .select('expo_push_token')
                  .eq('id', booking.customer_id)
                  .single();

              const pushToken = user?.expo_push_token;
              if (pushToken && pushToken.startsWith('ExponentPushToken')) {
                const messageBody = {
                    to: pushToken,
                    sound: 'default',
                    title: '📦 Delivery Confirmation Code',
                    body: item.message,
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
                if (expoResponse.ok && expoResult.data?.status === 'ok') {
                    pushSent = true;
                    console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] ✅ Push Sent Successfully. Ticket: ${expoResult.data.id}`);
                }
              }
            }
          } catch (pushError) {
            console.warn(`[${new Date().toISOString()}] [ReqID:${requestId}] ⚠️ Push notification failed:`, pushError);
          }
        }

        if (smsSent || pushSent) {
            await supabase
            .from('sms_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', item.id);

            successCount++;
        } else {
            throw new Error('Both SMS and Push notification failed');
        }

      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] [ReqID:${requestId}] 💥 Failed:`, error);
        
        const errorMessage = error.message || String(error);
        const isPermanentError = errorMessage.includes('Invalid phone') || 
                                 errorMessage.includes('Invalid API key') ||
                                 errorMessage.includes('Booking not found');
        
        await supabase
          .from('sms_queue')
          .update({
            status: isPermanentError ? 'failed_permanent' : 'failed',
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: errorMessage.substring(0, 1000), 
          })
          .eq('id', item.id);

        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'SMS processing complete',
        total: pendingItems.length,
        sent: successCount,
        failed: failCount,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
