# Test Cashfree Beneficiary API V2 - Diagnostic Guide

## Quick Test Using cURL

Use this to test the Cashfree Payouts V2 API directly and see the exact error:

```bash
curl -X POST https://sandbox.cashfree.com/payout/beneficiary \
  -H "Content-Type: application/json" \
  -H "x-client-id: YOUR_CASHFREE_PAYOUT_APP_ID" \
  -H "x-client-secret: YOUR_CASHFREE_PAYOUT_SECRET_KEY" \
  -H "x-api-version: 2024-01-01" \
  -d '{
    "beneficiary_id": "TEST_DRIVER_001",
    "beneficiary_name": "Test Driver",
    "beneficiary_instrument_details": {
      "bank_account_number": "1234567890",
      "bank_ifsc": "HDFC0001234"
    },
    "beneficiary_contact_details": {
      "beneficiary_email": "test@example.com",
      "beneficiary_phone": "9999999999"
    }
  }'
```

Replace:
- `YOUR_CASHFREE_PAYOUT_APP_ID` with your actual Payouts App ID
- `YOUR_CASHFREE_PAYOUT_SECRET_KEY` with your actual Payouts Secret Key

**Note:** This uses the V2 API endpoint and structure.

## Expected Responses

### Success (200 OK)
```json
{
  "beneficiary_id": "TEST_DRIVER_001",
  "beneficiary_name": "Test Driver",
  "beneficiary_instrument_details": {
    "bank_account_number": "1234567890",
    "bank_ifsc": "HDFC0001234"
  },
  "beneficiary_contact_details": {
    "beneficiary_email": "test@example.com",
    "beneficiary_phone": "9999999999"
  },
  "status": "ACTIVE"
}
```

### Already Exists (409 Conflict)
```json
{
  "message": "Beneficiary already exists",
  "code": "beneficiary_already_exists"
}
```

### IP Not Whitelisted (403 Forbidden)
```json
{
  "message": "IP not whitelisted",
  "code": "ip_not_whitelisted"
}
```

### Invalid Credentials (401 Unauthorized)
```json
{
  "message": "Invalid credentials",
  "code": "unauthorized"
}
```

### Invalid Payload (400 Bad Request)
```json
{
  "message": "Invalid bank account number",
  "code": "invalid_bank_account"
}
```

## What to Check Based on Response

### If you get "IP not whitelisted"
1. Go to Cashfree Dashboard
2. Navigate to **Payouts > Developers > Two-Factor Authentication**
3. Add your IP address
4. For Supabase, you may need to use Public Key authentication instead

### If you get "Token is not valid"
1. Verify you're using Payouts credentials, not Payment Gateway
2. Check for typos in App ID and Secret Key
3. Ensure no extra spaces or newlines in credentials

### If you get "APIs not enabled"
1. Email care@cashfree.com
2. Request Payouts API enablement
3. Provide your Client ID and environment (Test/Production)

### If you get "Beneficiary already exists"
- This is actually good! It means the API is working
- The beneficiary was created in a previous attempt
- Check your Cashfree dashboard under Payouts > Beneficiaries

### If you get Success
- Perfect! The API is working correctly
- The issue might be in how the edge function is being called
- Check the driver app code and edge function logs

## Check Your Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions > create-beneficiary**
3. Click on **Logs** tab
4. Look for the most recent invocation
5. Check the console.log output for "Cashfree response:"

The logs will show you the exact response from Cashfree, which will tell you what's wrong.

## Verify Database After Test

After a successful API call, check your database:

```sql
SELECT 
  id,
  beneficiary_id,
  beneficiary_status,
  bank_details
FROM drivers
WHERE id = 'your_driver_id';
```

Expected:
- `beneficiary_id`: Should be set (e.g., `CARTR_DRV_12345678`)
- `beneficiary_status`: Should be `active`

## Common Issues Summary

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 403 - IP not whitelisted | Server IP not added | Whitelist IP or use public key auth |
| 403 - Token invalid | Wrong credentials | Use `CASHFREE_PG_*` variables |
| 403 - APIs not enabled | Account not activated | Email care@cashfree.com |
| 409 - Already exists | Duplicate beneficiary | Check dashboard, this is OK |
| 412 - Invalid JSON | Payload structure wrong | Already fixed in updated code |
| 200 but no beneficiary | Wrong environment | Check sandbox vs production |

## Next Steps

1. Run the cURL test above to isolate the issue
2. Check the exact error message
3. Follow the specific fix for that error
4. Redeploy edge function if you made changes
5. Test again from driver app
6. Check Cashfree dashboard for beneficiary

## Still Not Working?

If you've tried everything and it's still not working:

1. **Double-check environment variables in Supabase**
   - Go to Edge Functions settings
   - Verify `CASHFREE_PG_APP_ID`, `CASHFREE_PG_SECRET_KEY`, `CASHFREE_PG_ENV`

2. **Check you're looking at the right dashboard**
   - If `CASHFREE_PG_ENV=sandbox`, check Test dashboard
   - If `CASHFREE_PG_ENV=production`, check Production dashboard

3. **Contact Cashfree Support**
   - Email: care@cashfree.com
   - Provide: Client ID, error message, environment
   - Ask them to verify your account is set up correctly

4. **Check Edge Function Deployment**
   - Ensure the updated code is deployed
   - Redeploy if necessary: `supabase functions deploy create-beneficiary`
