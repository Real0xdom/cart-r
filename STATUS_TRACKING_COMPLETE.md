# Transfer Status Tracking - Complete Setup ✅

## Overview

Both admin console and driver app now have complete visibility into withdrawal/payout status with real-time updates.

## What Was Implemented

### 1. Webhook Handler (`apps/admin/app/api/webhooks/cashfree-payout/route.ts`)
- Receives real-time status updates from Cashfree
- Validates webhook signature for security
- Updates withdrawal status automatically
- Handles refunds for failed/reversed transfers
- Supports events: `TRANSFER_SUCCESS`, `TRANSFER_FAILED`, `TRANSFER_REVERSED`

### 2. Status Checker Edge Function (`supabase/functions/check-transfer-status/index.ts`)
- Manually polls Cashfree API for transfer status
- Can check single withdrawal or all pending withdrawals
- Updates database with latest status
- Handles refunds automatically
- Can be called on-demand or scheduled via cron

### 3. Admin Console Updates (`apps/admin/app/payouts/page.tsx`)
- Enhanced status badges with colors:
  - `RECEIVED` - Blue (transfer accepted)
  - `PENDING` - Yellow (processing)
  - `SUCCESS` - Green (completed)
  - `FAILED` - Red (failed)
  - `REVERSED` - Orange (reversed)
- "Check Status" button for pending transfers
- Shows payout reference and error messages
- Real-time status display

### 4. Driver App - Withdrawal History (`apps/driver/components/WithdrawalHistory.tsx`)
- New tab in Earnings page
- Shows all withdrawal requests with status
- Expandable details for each withdrawal:
  - Transfer reference
  - Processed date
  - Notes and admin notes
  - Error messages (if any)
  - Status explanations
- Color-coded status badges
- Pull-to-refresh functionality
- Real-time updates via Supabase subscriptions

### 5. Driver App - Earnings Page Updates (`apps/driver/app/(tabs)/earnings.tsx`)
- Added tab switcher: Earnings | Withdrawals
- Integrated WithdrawalHistory component
- Maintains existing earnings functionality

## Status Flow

```
Driver Requests Withdrawal
   ↓
Status: PENDING (awaiting admin approval)
   ↓
Admin Approves
   ↓
Status: APPROVED → Cashfree API called
   ↓
Cashfree Response: RECEIVED
   ↓
Status: PAID + Payout Status: RECEIVED
   ↓
Cashfree Processing...
   ↓
Payout Status: PENDING
   ↓
Final Status (via webhook or polling):
   - SUCCESS → Money in bank
   - FAILED → Refunded to wallet
   - REVERSED → Refunded to wallet
```

## Status Meanings

### Withdrawal Status (Main)
- **pending**: Awaiting admin approval
- **approved**: Admin approved, processing payout
- **paid**: Payout initiated/completed
- **rejected**: Admin rejected (refunded)
- **failed**: Payout failed (refunded)
- **reversed**: Bank reversed (refunded)

### Payout Status (Cashfree)
- **RECEIVED**: Cashfree accepted transfer
- **PENDING**: Processing with bank
- **SUCCESS**: Money transferred
- **FAILED**: Transfer failed
- **REVERSED**: Bank reversed transfer

## How to Use

### For Admin:

1. **View Payouts**: Go to `/payouts` page
2. **Check Status**: Click "Check Status" button for pending transfers
3. **Monitor**: Status updates automatically via webhooks
4. **Manual Check**: Use "Check Status" for manual refresh

### For Driver:

1. **View History**: Go to Earnings tab → Switch to "Withdrawals"
2. **See Details**: Tap on any withdrawal to expand details
3. **Understand Status**: Read status explanation at bottom
4. **Refresh**: Pull down to refresh

### Setup Webhooks (Recommended):

1. **Deploy Admin App** to get public URL
2. **Configure in Cashfree Dashboard**:
   - Go to: Developers → Webhooks
   - Add Webhook URL: `https://your-domain.com/api/webhooks/cashfree-payout`
   - Select V2 webhooks
   - Choose events: `TRANSFER_SUCCESS`, `TRANSFER_FAILED`, `TRANSFER_REVERSED`
   - Save

3. **Test Webhook**:
   - Create test withdrawal
   - Approve in admin
   - Check webhook logs in Cashfree dashboard
   - Verify status updates in your app

### Alternative: Polling (Without Webhooks):

If you can't use webhooks, set up a cron job to poll status:

```typescript
// Call every 5 minutes for pending transfers
POST https://your-project.supabase.co/functions/v1/check-transfer-status
Headers:
  Authorization: Bearer YOUR_ANON_KEY
Body: {} // Empty to check all pending
```

## Environment Variables Required

### Admin App (`.env.local`):
```env
CASHFREE_PAYOUT_SECRET_KEY=your_secret_key  # For webhook signature verification
```

### Edge Functions (Supabase secrets):
```bash
CASHFREE_PAYOUT_APP_ID=your_app_id
CASHFREE_PAYOUT_SECRET_KEY=your_secret_key
CASHFREE_ENV=sandbox  # or 'production'
```

## Testing

### Test Webhook Locally:
```bash
# Use ngrok or similar to expose local admin app
ngrok http 3000

# Configure ngrok URL in Cashfree dashboard
https://your-ngrok-url.ngrok.io/api/webhooks/cashfree-payout
```

### Test Status Checker:
```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/check-transfer-status' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"withdrawal_id": "your_withdrawal_id"}'
```

## Database Schema

The system uses these tables:
- `withdrawals` - Withdrawal requests with status
- `driver_wallet_transactions` - Transaction history
- `drivers` - Driver info with wallet balance

Key fields in `withdrawals`:
- `status` - Main withdrawal status
- `payout_reference` - Cashfree transfer ID
- `payout_status` - Cashfree transfer status
- `payout_error` - Error message if failed

## Notifications (TODO)

Currently, status updates are visible in the UI. To add push notifications:

1. **Driver App**: Use Expo Notifications
2. **Trigger**: In webhook handler or status checker
3. **Events**: 
   - Transfer successful
   - Transfer failed
   - Withdrawal approved/rejected

## Monitoring

### Check Webhook Delivery:
- Cashfree Dashboard → Webhooks → View Logs
- Check HTTP status codes (200 = success)

### Check Edge Function Logs:
- Supabase Dashboard → Edge Functions → Logs
- Filter by function name

### Check Database:
```sql
-- Recent withdrawals with status
SELECT id, amount, status, payout_status, created_at, processed_at
FROM withdrawals
ORDER BY created_at DESC
LIMIT 10;

-- Failed transfers
SELECT id, amount, payout_error, created_at
FROM withdrawals
WHERE payout_status = 'FAILED'
ORDER BY created_at DESC;
```

## Summary

✅ Webhooks configured for real-time updates
✅ Manual status checker for fallback
✅ Admin console shows detailed status
✅ Driver app shows withdrawal history
✅ Automatic refunds for failed transfers
✅ Color-coded status indicators
✅ Expandable details in driver app
✅ Pull-to-refresh functionality

The complete status tracking system is now in place! Both admin and drivers have full visibility into withdrawal/payout status with automatic updates.

