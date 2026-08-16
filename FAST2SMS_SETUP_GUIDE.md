# Fast2SMS Integration Setup Guide

This guide explains how to set up Fast2SMS for OTP-based authentication and delivery OTP notifications in your Cartr app.

## Overview

The Fast2SMS integration replaces Supabase Auth's built-in OTP with Fast2SMS for:
1. **Customer & Driver Registration/Login** - Phone-based OTP verification
2. **Delivery OTP** - SMS sent to receiver when driver starts the trip

## What Changed

### Database
- New table `fast2sms_otp_requests` tracks OTP generation and verification
- New functions:
  - `generate_fast2sms_otp()` - Generates and stores OTP
  - `verify_fast2sms_otp()` - Verifies OTP code
  - `create_or_update_user_after_otp()` - Creates/updates user after verification

### Edge Functions
- **fast2sms** - Sends OTP via Fast2SMS API
- **send-sms** - Updated to send actual SMS via Fast2SMS (not just push notifications)

### Mobile Apps
- **Customer App** - `AuthContext.tsx` now uses Fast2SMS instead of Supabase Auth
- **Driver App** - `AuthContext.tsx` now uses Fast2SMS instead of Supabase Auth

## Setup Instructions

### 1. Get Fast2SMS API Key

1. Sign up at [Fast2SMS](https://www.fast2sms.com/)
2. Go to Dashboard → API Keys
3. Copy your **Authorization Key**
4. Note your **Route** (p = promotional, t = transactional, d = DLT)

### 2. Configure Supabase Environment Variables

In your Supabase Dashboard → Edge Functions → Variables:

```bash
FAST2SMS_API_KEY=your_fast2sms_authorization_key_here
FAST2SMS_ROUTE=p  # or 't' for transactional
```

### 3. Run Database Migration

```bash
cd c:\Users\pranav\Desktop\catr-latest\cart-r
supabase db push
```

Or apply manually:
```sql
-- Run the migration file
\i supabase/migrations/099_fast2sms_integration.sql
```

### 4. Deploy Edge Functions

```bash
# Deploy the Fast2SMS function
supabase functions deploy fast2sms

# Deploy the updated send-sms function
supabase functions deploy send-sms
```

### 5. Install AsyncStorage (Mobile Apps)

Both apps need `@react-native-async-storage/async-storage` for session persistence:

```bash
# Customer app
cd apps/customer
npx expo install @react-native-async-storage/async-storage

# Driver app
cd apps/driver
npx expo install @react-native-async-storage/async-storage
```

### 6. Enable SMS Queue Processing

Set up a cron job or scheduled function to process the SMS queue:

```bash
# Option 1: Using Supabase Cron (recommended)
supabase functions schedule send-sms "*/5 * * * *"  # Every 5 minutes

# Option 2: Using an external scheduler (e.g., GitHub Actions, Vercel Cron)
# Call the send-sms function every 5 minutes
```

## How It Works

### Authentication Flow (Customer/Driver)

1. User enters phone number → `signInWithPhone()` is called
2. `generate_fast2sms_otp()` creates a 6-digit OTP in the database
3. `fast2sms` edge function sends the OTP via SMS
4. User enters OTP → `verifyOtp()` is called
5. `verify_fast2sms_otp()` validates the OTP
6. `create_or_update_user_after_otp()` creates/updates the user
7. Session is stored locally in AsyncStorage
8. User is logged in

### Delivery OTP Flow

1. When driver marks trip as "in_progress", trigger fires
2. `queue_delivery_otp_sms()` adds SMS to queue with receiver's phone
3. `send-sms` function processes queue:
   - Sends actual SMS via Fast2SMS to receiver
   - Also sends push notification to customer app (as backup)
4. Receiver gets OTP via SMS
5. Driver asks for OTP at delivery and verifies it

## API Usage

### Send OTP

```typescript
// This is called automatically when user requests OTP
const { error } = await supabase.functions.invoke('fast2sms', {
  body: {
    action: 'send-otp',
    phone: '+919876543210',
    otp: '123456',
    purpose: 'auth'  // or 'delivery', 'registration'
  }
});
```

### Verify OTP (via RPC)

```typescript
const { data, error } = await supabase.rpc('verify_fast2sms_otp', {
  p_phone_number: '+919876543210',
  p_otp_code: '123456',
  p_purpose: 'auth'
});

// Returns: { success: true/false, message: '...', user_id: '...', booking_id: '...' }
```

## Testing

### Dev Testing Mode (No SMS Credits Used)

For development and testing without burning SMS credits, use the configured dev phone number:

**Dev Phone Number:** `7744066077` (or `+917744066077`)
**Fixed OTP:** `123456`

When using this number:
- No actual SMS is sent (API call is bypassed)
- Fixed OTP `123456` is always generated
- OTP expiry is extended to 30 minutes for easier testing

```typescript
// Example dev testing login
const phone = '+917744066077';  // or just '7744066077'
await signInWithPhone(phone);   // Generates OTP: 123456
await verifyOtp(phone, '123456'); // Always succeeds
```

**To Add More Dev Numbers:**

1. **Edge Functions** - Update both files:
   - `supabase/functions/fast2sms/index.ts` - Add to `DEV_PHONE_NUMBERS` array
   - `supabase/functions/send-sms/index.ts` - Add to `DEV_PHONE_NUMBERS` array

2. **Database Function** - Update `generate_fast2sms_otp()`:
   ```sql
   DEV_NUMBERS TEXT[] := ARRAY['7744066077', '917744066077', 'YOUR_NEW_NUMBER'];
   ```

### Test Authentication Flow

1. Open customer or driver app
2. Enter phone number
3. Check console logs for `[DEV] OTP for +91...: XXXXXX`
4. Enter the OTP
5. Verify successful login

### Test Delivery OTP

1. Create a booking with receiver phone number
2. Driver accepts and starts trip
3. Check that SMS is queued: `SELECT * FROM sms_queue WHERE status = 'pending';`
4. Run send-sms function or wait for cron
5. Verify SMS status: `SELECT * FROM sms_queue WHERE status = 'sent';`

## Troubleshooting

### SMS Not Sending

1. Check Fast2SMS API key is set correctly
2. Verify your Fast2SMS account has sufficient balance
3. Check `fast2sms` function logs in Supabase Dashboard
4. Verify phone number format (+91XXXXXXXXXX)

### OTP Not Verifying

1. Check OTP hasn't expired (5 minute limit)
2. Verify `fast2sms_otp_requests` table has the OTP record
3. Check attempts haven't exceeded max (3 attempts)

### Session Not Persisting

1. Ensure `@react-native-async-storage/async-storage` is installed
2. Check for storage permission issues
3. Review AsyncStorage keys in logs

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `FAST2SMS_API_KEY` | Yes | Your Fast2SMS authorization key |
| `FAST2SMS_ROUTE` | No | SMS route: 'p' (promotional), 't' (transactional), 'd' (DLT) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |

## Important Notes

- **DLT Registration**: For production in India, you may need DLT registration for transactional SMS
- **Rate Limiting**: Fast2SMS has rate limits. Check your plan details
- **OTP Expiry**: OTPs expire after 5 minutes by default
- **Max Attempts**: Users have 3 attempts to enter correct OTP
- **Fallback**: During development, OTP is logged to console if Fast2SMS fails

## Security Considerations

1. Store `FAST2SMS_API_KEY` securely (Supabase Edge Function env vars)
2. OTPs are stored hashed in the database (plaintext in memory only)
3. Session tokens are stored locally in AsyncStorage (secure device storage)
4. Always verify OTP server-side via RPC
5. Implement rate limiting on OTP generation per phone number

## Migration from Supabase Auth

If you have existing users from Supabase Auth:
1. They need to re-verify their phone number once
2. User profiles in the `users` table remain intact
3. The new auth system uses the same `users` table
4. No data migration needed - just a fresh login

## Support

For Fast2SMS support:
- Website: https://www.fast2sms.com/
- Documentation: https://docs.fast2sms.com/
- Check your Fast2SMS dashboard for delivery reports
