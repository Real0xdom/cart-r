# Cashfree Signature Fix - DEPLOYED ✅

## Problem
The edge functions were generating signatures using SHA-256 hashing, but Cashfree Payouts API requires RSA encryption with OAEP padding (SHA-1).

## Solution Implemented
Updated both edge functions to use the correct signature generation:

1. **String format**: `clientId.timestamp` (not `clientId + timestamp + secretKey`)
2. **Encryption**: RSA-OAEP with SHA-1 using the public key
3. **Encoding**: Base64 encode the encrypted result

## Files Updated & Deployed
- ✅ `supabase/functions/create-beneficiary/index.ts`
- ✅ `supabase/functions/process-withdrawal/index.ts`

## What Changed
```typescript
// OLD (incorrect)
const signatureString = payoutsAppId + timestamp + payoutsSecretKey
const hashBuffer = await crypto.subtle.digest('SHA-256', data)
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

// NEW (correct)
const signatureString = `${payoutsAppId}.${timestamp}`
const encryptedBuffer = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  publicKey,
  data
)
const signature = btoa(String.fromCharCode(...encryptedArray))
```

## Next Steps
Test the beneficiary creation again - the signature mismatch error should be resolved.
