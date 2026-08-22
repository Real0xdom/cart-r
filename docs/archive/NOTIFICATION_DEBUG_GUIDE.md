# 🔔 Notification Delivery Debugging Guide

## Issue: Notifications Not Arriving on Android Installed App

### ✅ What I Fixed

1. **Moved notification listeners from AuthContext to _layout.tsx** - Listeners were being set up too late/incorrectly
2. **Added comprehensive logging** - Now you can see exactly what's happening
3. **Fixed cleanup logic** - Listeners now properly attach and detach
4. **Added permission debugging** - Shows permission status in logs

---

## 🔍 How to Debug Notifications

### Step 1: Check Console Logs on Device

When you open the app, you should see these logs:

```
✅ Customer notification channels configured
📱 Current permission status: granted
✅ Notification permissions granted
🔄 Getting Expo push token...
✅ Got Expo push token: ExponentPushToken[...
✅ Customer push token registered successfully
📬 [RootLayout] Notification received: (your notification title)
```

### Step 2: If Logs Show "NOT GRANTED"

**Problem:** Notification permissions denied

**Solution:**
```
1. Go to phone Settings
2. Find your app (carter-customer or carter-driver)
3. Tap Permissions → Notifications
4. Enable "Allow notifications"
5. Restart the app
```

### Step 3: Check Database for Token

Open Supabase and run:

```sql
SELECT id, name, role, expo_push_token, created_at 
FROM users 
WHERE role = 'customer'
LIMIT 5;
```

Should show tokens like: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]`

❌ **If NULL** → Token registration failed  
✅ **If has value** → Token is saved

### Step 4: Check Admin Console Logs

When sending notification from admin console, check browser console for:

```
[AdminNotif] Starting notification process (Server Action)...
[AdminNotif] Success! Sent to X users.
```

### Step 5: Test Expo Push Notification

Use curl to manually test:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[your_token_here]",
    "title": "Test Notification",
    "body": "This is a test",
    "sound": "default",
    "priority": "high"
  }'
```

---

## 🚨 Common Issues & Fixes

### Issue 1: "expo_push_token is NULL"

**Cause:** Token registration failed

**Check Logs For:**
```
❌ No push token obtained
❌ No notification permissions
```

**Fix:**
1. Check permissions (Step 2 above)
2. Clear app cache: Settings → Apps → [Your App] → Storage → Clear Cache
3. Uninstall and reinstall app
4. Check network connection (needs internet to get token)

---

### Issue 2: "Notification Arrived But Didn't Show"

**Cause:** Notification handler not triggered

**Check Logs For:**
```
📬 [RootLayout] Notification received: [title]
👆 [RootLayout] Notification tapped: [title]
```

**If NOT in logs:**
- Listeners not set up properly
- Listeners attached after notification arrived
- **Solution:** Force stop app and restart

**If IN logs but no visible notification:**
- Notification handler config issue
- Android notification channel problem
- **Solution:** Check Android notification channel settings

---

### Issue 3: Android Doze Mode / Battery Saver

**Cause:** Android killed the notification in background

**Fix:**
1. Settings → Battery → Battery Saver Mode → Turn OFF
2. Settings → Apps → [Your App] → Battery → Allow Background Activity
3. Settings → Notifications → [Your App] → Show as Heads-up Notification

---

### Issue 4: Notification Channel Mismatch

**Check:** The notification being sent should use `channelId` that matches configured channels:
- `booking-updates` (HIGH priority)
- `default` (DEFAULT priority)

**Current Setup:** Admin console doesn't specify channelId, uses default

---

## 📊 Complete Notification Flow Diagram

```
1. App Starts (_layout.tsx)
   ↓
2. initializeNotifications()
   ├─ Sets handler (shouldShowAlert: true)
   ├─ Creates Android channels
   └─ Logs: "✅ Customer notification channels configured"
   ↓
3. requestNotificationPermissions()
   └─ Logs: "📱 Current permission status: ..."
   ↓
4. getExpoPushToken()
   ├─ Calls Expo API
   └─ Logs: "✅ Got Expo push token: ..."
   ↓
5. User Logs In (AuthContext)
   ↓
6. registerPushToken(userId)
   ├─ Sends token to Supabase
   └─ Logs: "✅ Customer push token registered successfully"
   ↓
7. addNotificationReceivedListener() setup in _layout.tsx
   ├─ Listens for incoming notifications
   └─ Logs: "📬 [RootLayout] Notification received: ..."
   ↓
8. Admin Sends Notification
   ↓
9. Expo Delivers to Device
   ↓
10. Listener triggers
    ├─ Handler displays notification
    └─ Shows in notification panel
```

---

## ✅ Verification Checklist

When testing notifications:

- [ ] App logs show "✅ ... notification channels configured"
- [ ] App logs show "📱 Current permission status: granted"
- [ ] App logs show "✅ Got Expo push token: ExponentPushToken[..."
- [ ] App logs show "✅ ... push token registered successfully"
- [ ] Database shows `expo_push_token` is NOT NULL
- [ ] Admin console shows "Success! Sent to X users"
- [ ] Logs show "📬 [RootLayout] Notification received: ..."
- [ ] Notification appears in Android notification panel

---

## 🔧 Force Reset Notifications

If stuck, run this in app:

```typescript
import * as Notifications from 'expo-notifications';

// Clear all notifications
await Notifications.dismissAllNotificationsAsync();

// Restart listeners
// (requires re-opening app)
```

---

## 📝 Required Changes Made

1. **apps/customer/app/_layout.tsx**
   - Added notification listener setup
   - Added comprehensive logging

2. **apps/customer/lib/notifications.ts**
   - Enhanced all logging
   - Better error messages
   - Debug output for each step

3. **apps/customer/contexts/AuthContext.tsx**
   - Removed listener setup (moved to _layout.tsx)
   - Kept only token registration

4. **Same changes for driver app**

---

## 🎯 Next Steps

1. **Rebuild the app** with these changes
2. **Check console logs** for all the checkmarks above
3. **Verify database** has push token
4. **Send test notification** from admin console
5. **Check logs again** for notification received message
6. **Verify notification appears** in Android notification panel

If still not working, share the console logs and I can help debug further.
