# Cashfree Payouts Testing Guide - Complete Flow

## Overview
This guide walks you through testing the complete withdrawal flow from driver app → admin approval → bank transfer in Cashfree's sandbox environment.

## Prerequisites ✅
- [x] Beneficiary created successfully (driver's bank account registered)
- [ ] Cashfree Payout credentials configured
- [ ] Edge function deployed with correct environment variables

---

## Step 1: Configure Cashfree Payout Credentials

### A. Get Your Test API Keys
1. Go to [Cashfree Merchant Dashboard](https://merchant.cashfree.com/)
2. Navigate to: **Developers → API Keys**
3. Click **Generate API Keys** (select **Test/Sandbox** environment)
4. Copy:
   - `Client ID` (App ID)
   - `Client Secret` (Secret Key)

### B. Add to Environment Variables

#### For Edge Function (Supabase)
Add these to your Supabase Edge Function secrets:

```bash
# Navigate to Supabase Dashboard → Edge Functions → Secrets
CASHFREE_PAYOUT_APP_ID=your_test_client_id
CASHFREE_PAYOUT_SECRET_KEY=your_test_client_secret
CASHFREE_ENV=sandbox
```

Or via CLI:
```bash
supabase secrets set CASHFREE_PAYOUT_APP_ID=your_test_client_id
supabase secrets set CASHFREE_PAYOUT_SECRET_KEY=your_test_client_secret
supabase secrets set CASHFREE_ENV=sandbox
```

#### For Admin App (Next.js)
Add to `apps/admin/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Step 2: Test the Complete Flow

### A. Driver Creates Withdrawal Request

1. **Open Driver App**
2. **Navigate to Earnings/Wallet**
3. **Click "Withdraw"**
4. **Enter amount** (e.g., ₹500)
5. **Submit withdrawal request**

The driver app should:
- Deduct amount from available balance
- Create a `withdrawal` record with status `pending`
- Create a `driver_wallet_transaction` with type `withdrawal`

### B. Admin Approves Withdrawal

1. **Open Admin Console** (`http://localhost:3000/payouts`)
2. **Find the pending withdrawal** in the list
3. **Click "Approve" button**

What happens:
- Status changes from `pending` → `approved`
- The `approve_withdrawal` database function is called
- Automatically triggers the `process-withdrawal` edge function
- Edge function initiates Cashfree payout

### C. Cashfree Processes Payout

The edge function (`supabase/functions/process-withdrawal/index.ts`) will:

1. **Validate withdrawal status** (must be `approved`)
2. **Check beneficiary** (must have `beneficiary_id` and status `active`)
3. **Call Cashfree Payouts API V2**:
   ```
   POST https://sandbox.cashfree.com/payout/transfer
   ```
4. **Update withdrawal record**:
   - `payout_reference`: Transfer ID (e.g., `CARTR_WD_12345678_1234567890`)
   - `payout_status`: `INITIATED` (success) or `FAILED` (error)
   - `status`: `completed` (if payout initiated successfully)

---

## Step 3: Monitor Payout Status

### Option 1: Check in Admin Console
1. Go to **Payouts** page
2. Look at the **Payout** column
3. You'll see:
   - Transfer ID (e.g., `CARTR_WD_12345678_1234567890`)
   - Status: `INITIATED`, `FAILED`, or `MANUAL`

### Option 2: Check Cashfree Dashboard
1. Go to [Cashfree Merchant Dashboard](https://merchant.cashfree.com/)
2. Navigate to: **Payouts → Transfers**
3. Find your transfer by Transfer ID
4. Check status:
   - **SUCCESS**: Money transferred to beneficiary
   - **PENDING**: Processing
   - **FAILED**: Transfer failed (check error message)

### Option 3: Use Cashfree API
```bash
curl -X GET \
  'https://sandbox.cashfree.com/payout/transfer/CARTR_WD_12345678_1234567890' \
  -H 'x-client-id: your_client_id' \
  -H 'x-client-secret: your_client_secret' \
  -H 'x-api-version: 2024-01-01'
```

---

## Step 4: Webhook Setup (Optional but Recommended)

Webhooks provide real-time updates on payout status changes.

### A. Create Webhook Endpoint
Create `apps/admin/app/api/webhooks/cashfree-payout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-webhook-signature');
    
    // Verify webhook signature (recommended)
    const secretKey = process.env.CASHFREE_PAYOUT_SECRET_KEY!;
    const computedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(body))
      .digest('base64');
    
    if (signature !== computedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { event, transfer } = body;
    
    // Extract transfer_id from the webhook
    const transferId = transfer.transfer_id;
    
    // Find withdrawal by payout_reference
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('id')
      .eq('payout_reference', transferId)
      .single();
    
    if (!withdrawal) {
      console.log('Withdrawal not found for transfer:', transferId);
      return NextResponse.json({ received: true });
    }

    // Update based on event type
    let updateData: any = {
      payout_status: transfer.status,
      updated_at: new Date().toISOString(),
    };

    if (event === 'TRANSFER_SUCCESS') {
      updateData.status = 'paid';
      updateData.processed_at = new Date().toISOString();
    } else if (event === 'TRANSFER_FAILED' || event === 'TRANSFER_REVERSED') {
      updateData.status = 'failed';
      updateData.payout_error = transfer.reason || 'Transfer failed';
    }

    await supabaseAdmin
      .from('withdrawals')
      .update(updateData)
      .eq('id', withdrawal.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
```

### B. Configure in Cashfree Dashboard
1. Go to **Developers → Webhooks**
2. Click **Add Webhook**
3. Enter URL: `https://your-domain.com/api/webhooks/cashfree-payout`
4. Select events:
   - `TRANSFER_SUCCESS`
   - `TRANSFER_FAILED`
   - `TRANSFER_REVERSED`
5. Save

---

## Testing in Sandbox Environment

### Important Notes:
✅ **No real money is transferred** in sandbox mode
✅ **Test bank accounts** can be used (any valid IFSC + account number)
✅ **Instant processing** - transfers complete immediately in test mode
✅ **All API calls** work exactly like production

### Test Scenarios:

#### 1. Successful Payout
- Use valid beneficiary with `beneficiary_status = 'active'`
- Amount: Any positive value
- Expected: Status changes to `INITIATED` → `SUCCESS`

#### 2. Failed Payout (Invalid Beneficiary)
- Use beneficiary without `beneficiary_id`
- Expected: Error message "Driver is not registered as Cashfree beneficiary"

#### 3. Manual Processing (No Credentials)
- Remove Cashfree credentials from edge function
- Expected: Status changes to `MANUAL`, admin must process manually

---

## Troubleshooting

### Issue: "Cashfree Payouts not configured"
**Solution**: Check edge function environment variables
```bash
supabase secrets list
```

### Issue: "Driver is not registered as Cashfree beneficiary"
**Solution**: 
1. Check `drivers` table: `beneficiary_id` should not be null
2. Check `beneficiary_status` = `'active'`
3. Re-run beneficiary creation if needed

### Issue: "Withdrawal must be approved first"
**Solution**: Withdrawal status must be `approved` before processing payout

### Issue: Payout API returns 401 Unauthorized
**Solution**: 
1. Verify Client ID and Secret Key are correct
2. Check signature generation in edge function
3. Ensure `x-api-version: 2024-01-01` header is present

### Issue: Payout API returns 400 Bad Request
**Solution**: Check payload format:
```json
{
  "transfer_id": "unique_id",
  "beneficiary_id": "BENE_ID_FROM_REGISTRATION",
  "amount": 500,
  "remarks": "Payout description"
}
```

---

## Quick Test Commands

### Check Withdrawal Status
```sql
SELECT id, driver_id, amount, status, payout_reference, payout_status
FROM withdrawals
WHERE id = 'your_withdrawal_id';
```

### Check Driver Beneficiary Status
```sql
SELECT id, beneficiary_id, beneficiary_status, bank_details
FROM drivers
WHERE id = 'your_driver_id';
```

### Manually Trigger Payout (if auto-trigger fails)
```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/process-withdrawal' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"withdrawal_id": "your_withdrawal_id"}'
```

---

## Next Steps

1. ✅ Test the complete flow in sandbox
2. ✅ Set up webhooks for real-time updates
3. ✅ Add error handling and retry logic
4. ✅ Test edge cases (insufficient balance, invalid beneficiary, etc.)
5. 🚀 Move to production when ready

---

## Production Checklist

Before going live:
- [ ] Switch to production API keys
- [ ] Update `CASHFREE_ENV=production`
- [ ] Configure production webhook URL
- [ ] Test with real bank accounts (small amounts first)
- [ ] Set up monitoring and alerts
- [ ] Add IP whitelisting in Cashfree dashboard (if required)
- [ ] Review payout limits and fees

---

## Support

- **Cashfree Docs**: https://docs.cashfree.com/reference/payouts-api
- **Cashfree Support**: support@cashfree.com
- **Dashboard**: https://merchant.cashfree.com/

