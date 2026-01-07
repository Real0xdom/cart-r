# SMS Integration Guide

## Overview
The system now queues SMS messages to send delivery OTP to receivers when shipments start.

## Current Implementation

### Database Changes (Migration 009)
- ✅ Created `sms_queue` table to store outgoing SMS
- ✅ Created trigger to queue SMS when trip status → `in_progress`
- ✅ SMS message: "CARTR Delivery: Your delivery OTP is XXXXXX. Share this with the driver upon delivery. Booking #YYYY"

### SMS Queue Processing
Messages are queued but need external service to actually send them.

## Integration Options

### Option 1: Twilio (Recommended for Production)

**Setup:**
1. Sign up at [twilio.com](https://www.twilio.com)
2. Get Account SID, Auth Token, and Phone Number
3. Configure in database:
```sql
ALTER DATABASE postgres SET app.settings.twilio_account_sid = 'AC...';
ALTER DATABASE postgres SET app.settings.twilio_auth_token = 'your_token';
ALTER DATABASE postgres SET app.settings.twilio_phone = '+1234567890';
```

**Create Supabase Edge Function** (`supabase/functions/process-sms/index.ts`):
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const twilioPhone = Deno.env.get('TWILIO_PHONE')!

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get pending SMS
  const { data: smsQueue } = await supabase.rpc('get_pending_sms', { p_limit: 10 })

  for (const sms of smsQueue || []) {
    try {
      // Send via Twilio
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: sms.phone_number,
            From: twilioPhone,
            Body: sms.message,
          }),
        }
      )

      if (response.ok) {
        await supabase.rpc('mark_sms_sent', { p_sms_id: sms.id })
      } else {
        const error = await response.text()
        await supabase.rpc('mark_sms_failed', { 
          p_sms_id: sms.id, 
          p_error: error 
        })
      }
    } catch (error) {
      await supabase.rpc('mark_sms_failed', { 
        p_sms_id: sms.id, 
        p_error: error.message 
      })
    }
  }

  return new Response(JSON.stringify({ processed: smsQueue?.length || 0 }))
})
```

**Deploy:**
```bash
supabase functions deploy process-sms
```

**Schedule with Cron:**
```sql
-- Run every minute
SELECT cron.schedule(
  'process-sms-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/process-sms',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Option 2: MSG91 (India-specific, cheaper)

Similar to Twilio but uses MSG91 API:
```typescript
const response = await fetch('https://api.msg91.com/api/v5/flow/', {
  method: 'POST',
  headers: {
    'authkey': MSG91_AUTH_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    flow_id: 'YOUR_FLOW_ID',
    sender: 'CARTR',
    mobiles: sms.phone_number,
    OTP: otp,
  }),
})
```

### Option 3: For Development/Testing

**View Queued SMS:**
```sql
SELECT * FROM sms_queue WHERE status = 'pending' ORDER BY created_at DESC;
```

**Manually mark as sent:**
```sql
SELECT mark_sms_sent(id) FROM sms_queue WHERE status = 'pending' LIMIT 1;
```

**Clear queue:**
```sql
DELETE FROM sms_queue WHERE created_at < NOW() - INTERVAL '1 day';
```

## Testing

1. **Run migration:**
   ```bash
   psql -h your-db-host -U postgres -d postgres -f supabase/migrations/009_sms_delivery_otp.sql
   ```

2. **Create a booking and start trip**
   - Driver clicks "Arrived & Start Trip"
   - Status changes to `in_progress`

3. **Check SMS queue:**
   ```sql
   SELECT * FROM sms_queue ORDER BY created_at DESC LIMIT 5;
   ```

4. **You should see:**
   - Entry with receiver's phone number
   - Message with delivery OTP
   - Status: 'pending'

## Production Checklist

- [ ] Choose SMS provider (Twilio/MSG91)
- [ ] Set up account and get credentials
- [ ] Create Edge Function for SMS sending
- [ ] Configure database settings
- [ ] Set up cron job to process queue
- [ ] Test with real phone numbers
- [ ] Monitor SMS delivery rates
- [ ] Set up alerts for failed SMS

## Cost Estimates

**Twilio:**
- India SMS: ~$0.01 per SMS (~₹0.80)
- 1000 SMS/month: ~$10 (~₹800)

**MSG91:**
- India SMS: ~₹0.10-0.20 per SMS
- 1000 SMS/month: ~₹100-200

**Recommended:** MSG91 for India-focused app, Twilio for global reach.
