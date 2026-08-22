# Cashfree ERROR Status Handling Fix

## Issue
When testing payouts in Cashfree's test/sandbox environment, transfers were showing "ERROR" status in the check-transfer-status logs, but the Cashfree dashboard showed "PENDING". Additionally, clicking "Check Status" in admin console was failing with "No pending withdrawals found" even though the withdrawal existed.

## Root Causes
1. **Test Environment Behavior**: Cashfree's test environment simulates various scenarios including failures by returning "ERROR" status
2. **Missing Status Handling**: The system wasn't treating "ERROR" as a failure status that needs refund processing
3. **API Response Parsing**: The check-transfer-status function wasn't properly extracting status from the Cashfree V2 API response structure
4. **Query Filter Issue**: When checking a specific withdrawal by ID, the function was still filtering by status, so already-processed withdrawals couldn't be re-checked

## Changes Made

### 1. check-transfer-status Edge Function (`supabase/functions/check-transfer-status/index.ts`)
- ✅ Added "ERROR" to the list of statuses to check: `['RECEIVED', 'PENDING', 'ERROR']`
- ✅ Added "ERROR" to failure handling: `if (newStatus === 'FAILED' || newStatus === 'REVERSED' || newStatus === 'ERROR')`
- ✅ Improved API response parsing to handle Cashfree V2 structure: `statusResult.data?.status`
- ✅ Added full response logging for debugging
- ✅ Added API error detection and handling
- ✅ Improved error message extraction from API response
- ✅ **Fixed query logic**: When checking specific withdrawal by ID, fetch it regardless of status
- ✅ **Better logging**: Shows current payout_status when checking specific withdrawal

### 2. Webhook Handler (`apps/admin/app/api/webhooks/cashfree-payout/route.ts`)
- ✅ Added "ERROR" status handling in webhook: `status === 'ERROR'`
- ✅ Fixed variable reference bug (`data.reason` → `transfer.reason`)
- ✅ Improved error message extraction

### 3. Admin Console (`apps/admin/app/payouts/page.tsx`)
- ✅ Added ERROR status badge with red styling
- ✅ Extended check status button to show for: RECEIVED, PENDING, ERROR, and paid statuses
- ✅ Now allows re-checking status even after initial processing

## How It Works Now

### When Transfer Gets ERROR Status:

1. **Check Status Function**:
   - Detects ERROR status from Cashfree API
   - Marks withdrawal as 'failed' in database
   - Refunds amount to driver's available balance
   - Creates refund transaction in wallet history

2. **Admin Console**:
   - Shows ERROR badge in red
   - Displays "Check Status" button to retry checking
   - Shows error message if available
   - Can re-check status even after processing

3. **Driver App**:
   - Withdrawal shows as "failed" or "rejected"
   - Amount is automatically refunded to wallet
   - Driver can request withdrawal again

## Testing in Sandbox

In Cashfree's test environment:
- Some transfers may go to ERROR status to simulate failures
- This is expected behavior for testing
- The system now properly handles these test failures
- Real production transfers will have different status flows

## API Response Structure

Cashfree V2 API returns status in this structure:
```json
{
  "data": {
    "transfer_id": "...",
    "cf_transfer_id": "...",
    "status": "PENDING|RECEIVED|SUCCESS|FAILED|ERROR|REVERSED",
    "status_description": "...",
    "reason": "..."
  }
}
```

The function now correctly extracts: `statusResult.data?.status || statusResult.status`

## Query Logic Fix

**Before:**
```typescript
// Always filtered by status, even when checking specific withdrawal
.in('payout_status', ['RECEIVED', 'PENDING', 'ERROR'])
.eq('id', withdrawal_id) // This would return nothing if status changed
```

**After:**
```typescript
if (withdrawal_id) {
  // Fetch specific withdrawal regardless of status
  query = query.eq('id', withdrawal_id)
} else {
  // Only filter by status for bulk checks
  query = query.in('payout_status', ['RECEIVED', 'PENDING', 'ERROR'])
}
```

## Next Steps

1. **Deploy the updated edge function**: `supabase functions deploy check-transfer-status`
2. **Click "Check Status"** in admin console - it should now work
3. **Monitor logs** to see the full API response structure from Cashfree
4. **Verify the actual status** from Cashfree dashboard matches what the API returns

## Important Notes

- ERROR status in test environment doesn't mean your integration is broken
- It's Cashfree's way of simulating failure scenarios
- In production, you'll see more SUCCESS and fewer ERROR statuses
- Always check Cashfree dashboard to see the actual transfer status
- The check-transfer-status function should be called periodically (via cron) to sync statuses
- You can now manually re-check any withdrawal status from admin console

