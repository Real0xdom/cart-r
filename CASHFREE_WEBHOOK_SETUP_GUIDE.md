# Cashfree Payout Webhooks Setup Guide

## Current Issue

The check-transfer-status function is getting an authentication error:
```json
{"status":"ERROR","subCode":"403","message":"Token is not valid"}
```

This means the API credentials or authentication method is incorrect.

## Solution: Use Webhooks Instead

Instead of manually checking status, Cashfree will automatically notify your system when transfer status changes via webhooks.

## Step 1: Configure Webhook URL in Cashfree Dashboard

### For Test Environment:
1. Go to [Cashfree Payouts Dashboard](https://payouts.cashfree.com/)
2. Navigate to **Developers** → **Webhooks**
3. Add webhook URL: `https://your-domain.com/api/webhooks/cashfree-payout`
   - Replace `your-domain.com` with your actual admin app domain
4. Select events to subscribe:
   - ✅ `TRANSFER_SUCCESS` - When transfer completes successfully
   - ✅ `TRANSFER_FAILED` - When transfer fails
   - ✅ `TRANSFER_REVERSED` - When transfer is reversed by bank
   - ✅ `TRANSFER_ACKNOWLEDGED` - When Cashfree receives the transfer request

### Webhook URL Format:
```
Production: https://admin.yourdomain.com/api/webhooks/cashfree-payout
Staging: https://staging-admin.yourdomain.com/api/webhooks/cashfree-payout
Local Testing: Use ngrok or similar tunnel
```

## Step 2: Webhook Signature Verification

Your webhook handler already has signature verification:

```typescript
const secretKey = process.env.CASHFREE_PAYOUT_SECRET_KEY;
if (secretKey && signature && timestamp) {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(timestamp + body)
    .digest('base64');
  
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
}
```

## Step 3: Webhook Payload Structure (V1 API)

Cashfree sends webhooks in this format:

```json
{
  "event": "TRANSFER_SUCCESS",
  "transfer": {
    "transfer_id": "CARTR_WD_xxx",
    "cf_transfer_id": "123456789",
    "status": "SUCCESS",
    "transferStatus": "SUCCESS",
    "amount": 100,
    "reason": "",
    "remarks": "Transfer completed",
    "utr": "123456789012"
  }
}
```

### Status Values:
- `SUCCESS` - Transfer completed successfully
- `FAILED` - Transfer failed
- `REVERSED` - Transfer reversed by bank
- `PENDING` - Transfer is being processed
- `ON_HOLD` - Transfer is on hold

## Step 4: Fix Check Transfer Status API

The current issue is with authentication. Cashfree Payouts V1 API uses simple header-based auth:

### Correct API Call:
```typescript
const response = await fetch(
  `${baseUrl}/payout/v1/getTransferStatus?transferId=${transferId}`,
  {
    method: 'GET',
    headers: {
      'X-Client-Id': CASHFREE_PAYOUT_APP_ID,
      'X-Client-Secret': CASHFREE_PAYOUT_SECRET_KEY,
    },
  }
)
```

### Base URLs:
- **Test**: `https://payout-gamma.cashfree.com`
- **Production**: `https://payout-api.cashfree.com`

## Step 5: Updated Edge Function

I've updated the `check-transfer-status` function to:
1. Use V1 API endpoint with correct authentication
2. Detect API authentication errors vs transfer status errors
3. Use correct status field extraction
4. Handle all failure statuses properly

## Step 6: Deploy Updated Function

```bash
supabase functions deploy check-transfer-status
```

## Step 7: Test Webhook Locally (Optional)

### Using ngrok:
```bash
# Install ngrok
npm install -g ngrok

# Start your admin app
npm run dev

# In another terminal, create tunnel
ngrok http 3000

# Use the ngrok URL in Cashfree dashboard
https://abc123.ngrok.io/api/webhooks/cashfree-payout
```

## Step 8: Verify Webhook is Working

### Check Logs:
1. Make a test withdrawal
2. Check your admin app logs for: `Cashfree webhook received`
3. Check Supabase logs for webhook processing
4. Verify withdrawal status updates automatically

### Cashfree Dashboard:
1. Go to **Developers** → **Webhooks** → **Logs**
2. See all webhook delivery attempts
3. Check response codes (200 = success)

## How It Works Now

### Without Webhooks (Manual Check):
1. Admin approves withdrawal
2. Payout is initiated
3. Status shows "RECEIVED" or "PENDING"
4. Admin must manually click "Check Status"
5. System queries Cashfree API
6. Status updates

### With Webhooks (Automatic):
1. Admin approves withdrawal
2. Payout is initiated
3. Status shows "RECEIVED" or "PENDING"
4. **Cashfree automatically sends webhook when status changes**
5. Your system receives webhook
6. Status updates automatically
7. Driver sees updated status immediately

## Webhook Events Flow

```
Withdrawal Created
    ↓
TRANSFER_ACKNOWLEDGED (Cashfree received request)
    ↓
Processing...
    ↓
TRANSFER_SUCCESS ✅
    OR
TRANSFER_FAILED ❌
    OR
TRANSFER_REVERSED ⚠️
```

## Environment Variables Required

Make sure these are set in your admin app:

```env
CASHFREE_PAYOUT_APP_ID=your_app_id
CASHFREE_PAYOUT_SECRET_KEY=your_secret_key
CASHFREE_ENV=sandbox  # or production
```

## Testing Checklist

- [ ] Webhook URL configured in Cashfree dashboard
- [ ] Environment variables set correctly
- [ ] Edge function deployed with V1 API changes
- [ ] Test withdrawal created
- [ ] Webhook received and logged
- [ ] Status updated automatically
- [ ] Driver sees correct status in app

## Troubleshooting

### Webhook not received:
1. Check webhook URL is publicly accessible
2. Verify URL in Cashfree dashboard is correct
3. Check firewall/security settings
4. Look at Cashfree webhook logs for delivery failures

### Authentication errors:
1. Verify `CASHFREE_PAYOUT_APP_ID` is correct
2. Verify `CASHFREE_PAYOUT_SECRET_KEY` is correct
3. Check you're using correct environment (sandbox vs production)
4. Ensure credentials match the environment

### Status not updating:
1. Check webhook signature verification isn't failing
2. Verify `payout_reference` in database matches Cashfree `transfer_id`
3. Check Supabase logs for errors
4. Verify database permissions for webhook handler

## Production Deployment

Before going live:
1. ✅ Test webhooks thoroughly in sandbox
2. ✅ Verify all status transitions work
3. ✅ Test refund flow for failed transfers
4. ✅ Update webhook URL to production domain
5. ✅ Switch `CASHFREE_ENV` to `production`
6. ✅ Use production credentials
7. ✅ Monitor webhook logs for first few days

## References

- [Cashfree Webhooks V1 Documentation](https://docs.cashfree.com/docs/payouts/webhooks)
- [Get Transfer Status API](https://docs.cashfree.com/reference/pgettransferstatus)
- [Webhook Signature Verification](https://docs.cashfree.com/docs/payouts/webhooks#webhook-signature-verification)
