# Signature Added to Authorization ✅

## What Was Fixed

The `/payout/v1/authorize` call was missing the required `X-Cf-Signature` header. Since Supabase Edge Functions don't have a static IP address, Cashfree requires RSA signature-based authentication.

## Changes Made

Updated `supabase/functions/process-withdrawal/index.ts` to:

1. **Load your public key** (from `public-key/accountId_1044500_public_key.pem`)
2. **Generate RSA signature** using the formula: `RSA_OAEP_SHA1_Encrypt(clientId.timestamp)`
3. **Add signature to authorization headers**:
   ```typescript
   headers: {
     'X-Client-Id': payoutsAppId,
     'X-Client-Secret': payoutsSecretKey,
     'X-Cf-Signature': signature,  // ← Added this
   }
   ```

## How It Works

```typescript
// 1. Generate timestamp
const timestamp = Math.floor(Date.now() / 1000).toString()

// 2. Create signature string: clientId.timestamp
const signatureString = `${payoutsAppId}.${timestamp}`

// 3. Encrypt with RSA-OAEP using your public key
const encryptedBuffer = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  publicKey,
  encoder.encode(signatureString)
)

// 4. Base64 encode
const signature = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)))

// 5. Send in header
headers: { 'X-Cf-Signature': signature }
```

## Complete Authorization Flow

```
1. Generate signature with public key
2. Call /payout/v1/authorize with signature
3. Receive bearer token (valid for 6 minutes)
4. Use token to call /payout/v1/requestTransfer
5. Transfer initiated successfully
```

## Test Now

1. **Create withdrawal request** from driver app
2. **Approve in admin console**
3. **Check edge function logs** - should see:
   ```
   Generated signature for timestamp: 1772649849
   Step 1: Getting authorization token...
   Authorization successful, token received
   Step 2: Initiating transfer...
   Cashfree payout response: { status: "SUCCESS", ... }
   ```

## Expected Result

✅ Authorization succeeds with signature
✅ Bearer token received
✅ Transfer initiated successfully
✅ Withdrawal status changes to "SUCCESS"
✅ Driver receives money in bank account

## Notes

- **Public key is hardcoded** in the edge function (from your `public-key/accountId_1044500_public_key.pem`)
- **Signature is generated fresh** for each authorization call
- **Token expires after 6 minutes** - we get a new one for each payout
- **No IP whitelisting needed** - signature-based auth works from any IP

## If It Still Fails

Check the logs for:
- "Authorization successful" message
- Token value in response
- Any error messages from Cashfree

If authorization fails, verify:
- Client ID and Secret are correct
- Public key matches your Cashfree account
- Timestamp is current (not too far in past/future)

