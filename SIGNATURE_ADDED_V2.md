# V2 API with Signature - Complete Fix ✅

## The Issue

The V2 Payouts API requires the `X-Cf-Signature` header for authentication when using Public Key 2FA (which you have configured). I initially thought V2 didn't need it, but it does!

## What Was Added

Added RSA signature generation to the V2 transfer API call, using the same method as beneficiary creation.

## Complete Authentication Flow for V2

```typescript
// 1. Generate timestamp
const timestamp = Math.floor(Date.now() / 1000).toString()

// 2. Create signature string: clientId.timestamp
const signatureString = `${payoutsAppId}.${timestamp}`

// 3. RSA-OAEP encrypt with your public key
const encryptedBuffer = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  publicKey,
  encoder.encode(signatureString)
)

// 4. Base64 encode
const signature = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)))

// 5. Send in headers
headers: {
  'x-client-id': payoutsAppId,
  'x-client-secret': payoutsSecretKey,
  'x-cf-signature': signature,  // ← Required!
  'x-api-version': '2024-01-01',
}
```

## V2 Transfer API Call

```typescript
POST https://sandbox.cashfree.com/payout/transfers

Headers:
- Content-Type: application/json
- x-client-id: CF103943...
- x-client-secret: ***
- x-cf-signature: <RSA encrypted signature>
- x-api-version: 2024-01-01

Body:
{
  "transfer_id": "CARTR_WD_36cb637a_1772651405786",
  "transfer_amount": 100,
  "transfer_mode": "banktransfer",
  "beneficiary_details": {
    "beneficiary_id": "CARTR_DRV_e659a9a2"
  },
  "transfer_remarks": "CartR driver payout"
}
```

## Why Signature Is Required

Your Cashfree account uses **Public Key 2FA** (not IP whitelisting). This means:
- Every API call needs the `X-Cf-Signature` header
- Signature is generated using your public key
- Signature proves you have the private key (2FA)
- Works from any IP address (perfect for Supabase Edge Functions)

## Complete Flow

```
1. Admin approves withdrawal
   ↓
2. Edge function generates RSA signature
   - Uses your public key
   - Encrypts: clientId.timestamp
   - Base64 encodes result
   ↓
3. Calls V2 Transfer API
   POST /payout/transfers
   Headers: x-client-id, x-client-secret, x-cf-signature, x-api-version
   Body: { transfer_id, transfer_amount, beneficiary_details, ... }
   ↓
4. Cashfree validates signature and processes transfer
   ↓
5. Response: { data: { cf_transfer_id, transfer_status, ... } }
   ↓
6. Update withdrawal status in database
   ↓
7. Driver receives money
```

## Test Now

1. **Create withdrawal request** from driver app
2. **Approve in admin console**
3. **Check edge function logs** - should see:
   ```
   Initiating payout with V2 API: CARTR_WD_... Amount: 100 BeneId: CARTR_DRV_...
   Generated signature for timestamp: 1772651405
   Transfer payload: { ... }
   Cashfree V2 payout response: {
     "data": {
       "cf_transfer_id": "...",
       "transfer_status": "PENDING",
       ...
     }
   }
   Transfer successful!
   ```

## Expected Result

✅ Signature generated successfully
✅ V2 API accepts the request
✅ Transfer initiated
✅ Withdrawal marked as paid
✅ Driver receives money

## Both APIs Now Use Signature

| API | Endpoint | Signature Required? |
|-----|----------|---------------------|
| Create Beneficiary | `/payout/beneficiary` | ✅ Yes |
| V2 Transfer | `/payout/transfers` | ✅ Yes |

Both use the same signature generation method:
- RSA-OAEP encryption
- SHA-1 hash
- Base64 encoding
- Same public key

## Why This Works

- **Public Key 2FA** is configured in your Cashfree account
- **Same public key** used for both APIs
- **Same signature method** for consistency
- **No IP whitelisting needed** - works from any IP

## API Documentation

- **V2 Transfers**: https://docs.cashfree.com/reference/v2transfer
- **Authentication**: https://docs.cashfree.com/reference/authentication
- **Public Key 2FA**: https://docs.cashfree.com/docs/payouts/integrations/payouts-2fa

## Notes

- Signature is generated fresh for each API call
- Timestamp must be current (within a few minutes)
- Public key is hardcoded in edge function
- Same credentials for both beneficiary and transfer APIs

This should finally work! Both APIs now have proper signature authentication.

