---
description: How to test Cashfree payments faster without rebuilding APK every time
---

# Fast Payment Testing Workflow

## The Problem
Building APKs for every change is slow (~10+ minutes each time). The native Cashfree SDK requires native modules that aren't available in Expo Go.

## Solutions (Fastest to Slowest)

### 1. 🚀 **Web Browser Checkout (FASTEST - No APK needed)**

The payment code now **automatically falls back to web checkout** when:
- Running in Expo Go
- Native SDK fails/crashes
- Running on web

**Steps:**
```bash
# Just run Expo normally
cd apps/customer
npx expo start
```
Open in Expo Go or web browser → Try payment → Opens browser checkout automatically!

---

### 2. ⚡ **Expo Dev Client (Build ONCE, iterate fast)**

Build a development client APK once that includes all native modules, then only reload JS changes:

**Initial Setup (One-time):**
```bash
cd apps/customer

# Install dev client
npx expo install expo-dev-client

# Build dev APK (takes ~15-20 min, but only needed ONCE unless dependencies change)
npx eas-cli build --platform android --profile development --local
```

**Daily Development:**
```bash
# Start dev server
npx expo start --dev-client

# Scan QR with your dev APK - JS reloads instantly!
```

---

### 3. 🔧 **Preview APK (When you need full native)**

Only use when you actually need to test the native SDK behavior:

```bash
cd apps/customer
npx eas-cli build --platform android --profile preview
```

---

## Debugging Payment Issues

### Check Edge Function Logs
```bash
# View live logs
npx supabase functions logs create-payment-order --tail
```

### Test API Directly (via Supabase Dashboard)
1. Go to: https://supabase.com/dashboard/project/epevjbiymsvwmmzybzib/functions
2. Click `create-payment-order`
3. Use the "Test" tab with sample JSON

### Sample Test Payload:
```json
{
  "amount": 100,
  "customer_id": "test-user-123",
  "customer_phone": "9876543210",
  "customer_name": "Test User",
  "customer_email": "test@example.com"
}
```

---

## Quick Reference

| Scenario | Method | Time to Test |
|----------|--------|--------------|
| JS/UI changes | Expo Go + Web Fallback | Instant |
| Logic changes | Expo Go + Web Fallback | Instant |
| Native SDK testing | Dev Client APK | 2-5 seconds reload |
| Full native behavior | Preview APK | 10-15 min build |

---

## Current Implementation Status

✅ Web checkout fallback implemented in `payment.tsx`
✅ Edge Function generates proper checkout URL
✅ Payment verification on browser return
✅ Works in Expo Go, Web, and APK
