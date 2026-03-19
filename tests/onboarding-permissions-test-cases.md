# Cartr Customer App — Onboarding Permissions Test Cases

> **Scope:** Location & Notification permission flows during onboarding  
> **Code references:** `LocationContext.tsx`, `lib/notifications.ts`, `_layout.tsx`, `NearbyDriversMap.tsx`, `home.tsx`, `service-not-available.tsx`  
> **Date:** 2026-03-07

---

## Architecture Summary (from code analysis)

| Layer | File | What happens |
|---|---|---|
| **Location Context** | `LocationContext.tsx` L33–66 | On mount: `getForegroundPermissionsAsync()` → if not granted → `requestForegroundPermissionsAsync()`. Denied → `showPermissionDeniedAlert()` with "Open Settings" button. |
| **GPS Fallback** | `LocationContext.tsx` L88–122 | `getCurrentPositionAsync()` fails → fallback to `getLastKnownPositionAsync()`. Both fail → error message: *"Location services are disabled…"* |
| **Reverse Geocode** | `LocationContext.tsx` L124–174 | Expo geocode (3s timeout) → Google Maps API fallback → `"Current Location"` default |
| **Notification Init** | `_layout.tsx` L37–65 | After fonts load: `initializeNotifications()` → `requestNotificationPermissions()` → setup listeners. Runs in `useEffect` (non-blocking). |
| **Notification Permissions** | `lib/notifications.ts` L71–103 | `getPermissionsAsync()` → if not `granted` → `requestPermissionsAsync()`. Returns `boolean`. |
| **Push Token** | `lib/notifications.ts` L108–142 | `requestNotificationPermissions()` → `getExpoPushTokenAsync()` → returns token or `null`. |
| **Token Registration** | `lib/notifications.ts` L147–175 | `getExpoPushToken()` → `supabase.from('users').update({ expo_push_token })`. |
| **Android Channels** | `lib/notifications.ts` L37–58 | `booking-updates` (HIGH importance) + `default` (DEFAULT). |
| **Map Component** | `NearbyDriversMap.tsx` L76–105 | Requests location independently; shows 📍 error state if denied. |
| **Home Screen** | `home.tsx` L57–77 | Loads saved location from `SecureStore` as fallback; checks service area on focus. |
| **Provider Hierarchy** | `_layout.tsx` L72–93 | `LanguageProvider` → `LocationProvider` → `AuthProvider` → `Stack`. Location requested before auth completes. |

---

## 1. Location Permission

### TC-LOC-1 — Fresh Install: Location Permission Requested on App Open

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install, no prior permissions granted |
| **Steps** | 1. Install Cartr Customer app<br>2. Open app for the first time<br>3. Wait for splash screen to dismiss |
| **Expected Results** | ✅ `LocationProvider` mounts and calls `checkAndRequestLocation()` (L33–35)<br>✅ `getForegroundPermissionsAsync()` returns `undetermined`<br>✅ OS location permission dialog appears<br>✅ Splash screen hides after fonts load (independent of permission) |
| **Pass Criteria** | OS permission dialog shown before home screen loads |

### TC-LOC-2 — User Taps "Allow" → App Proceeds to Home, Shows Nearby Drivers

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install, permission dialog visible |
| **Steps** | 1. Tap "Allow" on location permission dialog |
| **Expected Results** | ✅ `status === 'granted'` → `fetchAndSetCurrentLocation()` called (L53–54)<br>✅ `getCurrentPositionAsync({ accuracy: Balanced })` retrieves GPS coords<br>✅ Reverse geocode resolves address (Expo → Google fallback)<br>✅ `setUserLocation({ latitude, longitude, address })` updates store<br>✅ Home screen displays address in pickup field (L230)<br>✅ `NearbyDriversMap` renders with user location marker + nearby driver markers<br>✅ Service area check runs: `isLocationSupported(lat, lng)` (L45)<br>✅ `errorMessage` is `null`, `hasLocationPermission` is `true` |
| **Pass Criteria** | Home screen shows address, map shows user location + drivers |

### TC-LOC-3 — User Taps "Deny" → App Blocks Booking, Shows Error

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install, permission dialog visible |
| **Steps** | 1. Tap "Deny" / "Don't Allow" on location permission dialog |
| **Expected Results** | ✅ `status !== 'granted'` → `setErrorMessage('Location permission denied…')` (L56)<br>✅ `showPermissionDeniedAlert()` fires Alert: *"Location Permission Required"* (L69–86)<br>✅ Alert body: *"Carter needs access to your location…"*<br>✅ Alert has "Cancel" and "Open Settings" buttons<br>✅ `hasLocationPermission` is `false`<br>✅ `NearbyDriversMap` renders error state: 📍 *"Unable to get your location"* + *"Please enable location services"* (L193–201)<br>✅ Home screen pickup field shows `"Detecting location…"` fallback text (L230)<br>✅ Booking flow (`/find-ride`) can still be entered but relies on manual location selection |
| **Pass Criteria** | Alert shown, map shows error state, no crash |
| **⚠️ Code Gap** | App does **not** hard-block the booking flow when location is denied. User can still navigate to `/find-ride` and manually enter addresses. The map just won't load nearby drivers. This is by design (see `service-not-available.tsx` which allows manual location selection). |

### TC-LOC-4 — User Denies Initially, Then Enables via OS Settings → App Detects Change

| Field | Detail |
|---|---|
| **Preconditions** | Location permission denied, app on home screen |
| **Steps** | 1. Deny location permission<br>2. Tap "Open Settings" on the alert → OS settings open<br>3. Enable location permission for Cartr<br>4. Return to app |
| **Expected Results** | ✅ Tapping "Open Settings" calls `Linking.openURL('app-settings:')` (iOS) or `Linking.openSettings()` (Android) (L77–81)<br>✅ On return, user can manually trigger `requestLocationPermission()` via UI interaction<br>✅ If user pulls to refresh or navigates to a screen that calls `getCurrentLocation()`, permission re-check occurs (L176–192)<br>✅ `NearbyDriversMap.initializeMap()` re-requests permission on mount (L81) |
| **Pass Criteria** | App resumes with location after manual re-request |
| **⚠️ Code Gap** | There is **no automatic AppState listener** to detect when user returns from settings. The `LocationProvider` only checks permission on mount (`useEffect([], [])` at L33). User must trigger a screen reload or pull-to-refresh for the app to detect changed permissions. **Recommendation:** Add an `AppState` listener to re-check permissions when app returns to foreground. |

### TC-LOC-5 — GPS Disabled at OS Level → App Prompts User to Enable GPS

| Field | Detail |
|---|---|
| **Preconditions** | Location permission granted, but GPS/location services disabled at OS level |
| **Steps** | 1. Grant location permission<br>2. Disable GPS/Location Services from device settings<br>3. Open or return to app |
| **Expected Results** | ✅ `getCurrentPositionAsync()` throws error (L96)<br>✅ Fallback: `getLastKnownPositionAsync()` attempted (L99)<br>✅ If last known position exists → app uses it with stale coordinates<br>✅ If last known position is `null` → `setErrorMessage('Location services are disabled…')` (L104)<br>✅ `NearbyDriversMap` shows error state: *"Unable to get your location"* (L197)<br>✅ Home screen shows saved location from `SecureStore` if available (L61–70) |
| **Pass Criteria** | Graceful degradation — error message shown or stale location used |
| **⚠️ Code Gap** | No explicit "Enable GPS" prompt/dialog is shown. The error message says *"…enable them in device settings"* but doesn't offer a button to open location settings (unlike the permission denied alert which has "Open Settings"). **Recommendation:** Show a similar alert with a button to open device location settings. |

---

## 2. Notifications Permission

### TC-NOTIF-1 — Fresh Install: Notification Permission Requested on App Open

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install, no prior notification permissions |
| **Steps** | 1. Open app for the first time<br>2. Wait for fonts to load and splash screen to dismiss |
| **Expected Results** | ✅ `_layout.tsx useEffect` fires after fonts load (L37–65)<br>✅ `initializeNotifications()` configures handler & Android channels<br>✅ `requestNotificationPermissions()` called → OS notification dialog appears<br>✅ On Android: `booking-updates` channel (HIGH) and `default` channel created (L39–52)<br>✅ Notification listeners registered for foreground + tap handling |
| **Pass Criteria** | OS notification permission dialog shown |
| **Note** | On Android 12 and below, notification permission is auto-granted. Dialog only appears on Android 13+ and iOS. |

### TC-NOTIF-2 — User Taps "Allow" → App Sends Booking Confirmations & Ride Updates

| Field | Detail |
|---|---|
| **Preconditions** | Notification permission dialog visible |
| **Steps** | 1. Tap "Allow" on notification permission dialog<br>2. Complete a booking<br>3. Wait for driver assignment and ride updates |
| **Expected Results** | ✅ `requestNotificationPermissions()` returns `true` (L94)<br>✅ `getExpoPushToken()` obtains Expo push token (L123–125)<br>✅ `registerPushToken(userId)` saves token to `users.expo_push_token` in Supabase (L159–162)<br>✅ Booking confirmation push notification received<br>✅ Ride status updates (driver assigned, arrived, in progress, completed) received as push notifications<br>✅ Foreground notifications show alert + play sound + set badge (L27–33)<br>✅ Tapping notification triggers `notificationResponseSubscription` handler (L52–54) |
| **Pass Criteria** | Push token saved to DB, notifications received for ride events |

### TC-NOTIF-3 — User Taps "Deny" → App Warns "You May Miss Ride Updates"

| Field | Detail |
|---|---|
| **Preconditions** | Notification permission dialog visible |
| **Steps** | 1. Tap "Don't Allow" on notification permission dialog |
| **Expected Results** | ✅ `requestNotificationPermissions()` returns `false` (L90)<br>✅ `getExpoPushToken()` returns `null` (no token obtained, L118–119)<br>✅ `registerPushToken()` returns `false` (L152–154)<br>✅ No push token saved to DB → server-side push notifications will fail silently<br>✅ App continues to function — booking flow works, ride tracking works (real-time via Supabase subscriptions, not push)<br>✅ User misses push notifications but in-app real-time updates still work |
| **Pass Criteria** | No crash, app functional without push notifications |
| **⚠️ Code Gap** | **No in-app warning** is shown to the user about missing notifications. The code logs `⚠️ Notification permissions not granted` (L89) to console but displays **no user-facing alert or banner**. **Recommendation:** Show a persistent banner or one-time alert: *"You may miss ride updates. Enable notifications in settings."* |

### TC-NOTIF-4 — User Denies Initially, Then Enables via OS Settings → App Resumes Notifications

| Field | Detail |
|---|---|
| **Preconditions** | Notification permission denied, app running |
| **Steps** | 1. Deny notification permission<br>2. Go to OS Settings → enable notifications for Cartr<br>3. Return to app<br>4. Trigger a new booking |
| **Expected Results** | ✅ On next `registerPushToken()` call (triggered by auth flow or app restart), permission re-check occurs via `getPermissionsAsync()` (L76)<br>✅ Since now granted → `getExpoPushTokenAsync()` succeeds<br>✅ Token saved to DB, push notifications resume |
| **Pass Criteria** | Push token registered after permission re-enabled |
| **⚠️ Code Gap** | Similar to location — **no automatic re-check** when returning from settings. Notification permission is only requested once in `_layout.tsx` `useEffect`. User must restart the app or trigger a flow that calls `registerPushToken()` again. **Recommendation:** Add AppState listener to re-attempt token registration on foreground resume. |

### TC-NOTIF-5 — Edge Case: Notifications Enabled but OS Battery Saver Blocks Them

| Field | Detail |
|---|---|
| **Preconditions** | Notification permission granted, battery saver / power optimization enabled |
| **Steps** | 1. Enable battery saver on device<br>2. Book a ride<br>3. Wait for ride updates |
| **Expected Results** | ✅ Push token is valid and saved in DB<br>✅ Server sends push notification via Expo Push API<br>✅ OS may delay or suppress notification delivery (OS-level, outside app control)<br>✅ In-app real-time updates (Supabase Realtime on `track-ride.tsx`) still work when app is in foreground |
| **Pass Criteria** | In-app updates work; push may be delayed |
| **⚠️ Code Gap** | No detection or warning for battery optimization interference. The app has **no mechanism** to check if battery saver is active or if notifications are being suppressed. **Recommendation:** Use `expo-battery` or native module to detect battery saver state and show a warning: *"Battery saver may delay ride notifications. Consider disabling it."* |

---

## 3. Combined Permissions

### TC-COMBO-1 — Both Permissions Denied → App Blocks Map, Warns About Missing Updates

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install |
| **Steps** | 1. Deny location permission<br>2. Deny notification permission |
| **Expected Results** | ✅ Location: `NearbyDriversMap` shows error state (📍 *"Unable to get your location"*)<br>✅ Location: Permission denied alert with "Open Settings" shown<br>✅ Notifications: No push token saved, no notifications delivered<br>✅ Home screen: Pickup address shows *"Detecting location…"*<br>✅ Booking **not fully blocked** — user can still tap "Book Delivery" and manually enter addresses on `/find-ride` screen<br>✅ Service area check may fail (no lat/lng) — but saved location from SecureStore may be used as fallback |
| **Pass Criteria** | App degrades gracefully — no crash, manual booking possible |

### TC-COMBO-2 — Both Permissions Granted → Seamless Onboarding

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install |
| **Steps** | 1. Allow location permission<br>2. Allow notification permission<br>3. Navigate home screen |
| **Expected Results** | ✅ GPS location acquired → address shown in pickup field<br>✅ `NearbyDriversMap` shows user location + animated driver markers<br>✅ Service area check passes (if in supported zone)<br>✅ Push token registered in DB<br>✅ Notification channels configured on Android<br>✅ Foreground notification handler active<br>✅ Booking flow fully functional: select destination → find ride → select vehicle → confirm → book |
| **Pass Criteria** | Full functionality — map, bookings, and push notifications all working |

### TC-COMBO-3 — Location Granted, Notifications Denied → Booking Works, Updates Missing

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install |
| **Steps** | 1. Allow location permission<br>2. Deny notification permission<br>3. Book a ride |
| **Expected Results** | ✅ Map loads with user location and nearby drivers<br>✅ Booking flow completes successfully<br>✅ No push notifications for ride updates<br>✅ In-app ride tracking page (`/track-ride`) still shows real-time driver location via Supabase Realtime<br>✅ User must stay in app to track ride progress |
| **Pass Criteria** | Booking succeeds, in-app tracking works, no push notifications |

### TC-COMBO-4 — Location Denied, Notifications Granted → Manual Booking Required

| Field | Detail |
|---|---|
| **Preconditions** | Fresh install |
| **Steps** | 1. Deny location permission<br>2. Allow notification permission<br>3. Attempt to book a ride |
| **Expected Results** | ✅ Push token registered → notifications will be received<br>✅ Map shows error state, no nearby drivers visible<br>✅ Home screen shows *"Detecting location…"* in pickup field<br>✅ User taps "Book Delivery" → navigates to `/find-ride` → can manually type/search addresses<br>✅ If user selects a valid address in a supported zone, booking proceeds normally<br>✅ Ride update notifications (driver assigned, arrived, etc.) received via push |
| **Pass Criteria** | Manual booking works, push notifications received |

---

## 4. Edge Cases

### TC-EDGE-1 — App Crash During Onboarding → Permissions Persist After Restart

| Field | Detail |
|---|---|
| **Preconditions** | Permission dialog is showing |
| **Steps** | 1. Open app, wait for permission dialogs<br>2. Force-kill app during permission flow (before or after granting)<br>3. Relaunch app |
| **Expected Results** | ✅ OS-level permissions persist (granted or denied) — this is OS behavior, not app-controlled<br>✅ On relaunch: `LocationProvider.checkAndRequestLocation()` calls `getForegroundPermissionsAsync()` (L43)<br>✅ If previously granted → `status === 'granted'` → proceeds to get location<br>✅ If previously denied → `requestForegroundPermissionsAsync()` may show dialog again (OS behavior varies)<br>✅ Notification: `requestNotificationPermissions()` calls `getPermissionsAsync()` (L76) → same pattern<br>✅ No corrupted state — both modules handle fresh-start gracefully |
| **Pass Criteria** | App restarts cleanly, permissions reflect OS state |

### TC-EDGE-2 — Network Drop During Onboarding → App Retries Gracefully

| Field | Detail |
|---|---|
| **Preconditions** | Permissions granted, network drops during onboarding |
| **Steps** | 1. Grant permissions<br>2. Lose network during reverse geocoding or push token registration<br>3. Observe app behavior |
| **Expected Results** | ✅ **Reverse geocode failure:** Expo geocode times out (3s) → Google API fallback fails → address defaults to `"Current Location"` (L173)<br>✅ **Push token failure:** `getExpoPushTokenAsync()` may fail → `getExpoPushToken()` catches exception and returns `null` (L134–141)<br>✅ **Token registration failure:** `supabase.from('users').update()` fails → `registerPushToken()` returns `false` (L164–166)<br>✅ Home screen still loads — location coords may be available even without geocoding<br>✅ Service area check (`isLocationSupported`) may fail silently (L45)<br>✅ Location data saved to `SecureStore` if coords available (L82–95, `home.tsx`) |
| **Pass Criteria** | App loads with degraded functionality, no crash |
| **⚠️ Code Gap** | No automatic retry mechanism for failed push token registration. If the first attempt fails due to network, the token is never registered until app restart. **Recommendation:** Add retry logic with exponential backoff for `registerPushToken()`. |

### TC-EDGE-3 — App Update/Reinstall → Permissions Re-requested if Reset

| Field | Detail |
|---|---|
| **Preconditions** | App previously installed with permissions granted |
| **Steps** | 1. Uninstall and reinstall app (or clear app data)<br>2. Open app |
| **Expected Results** | ✅ **iOS:** Reinstall resets permissions → OS permission dialogs shown again<br>✅ **Android:** Reinstall resets permissions → dialogs shown again; update preserves permissions<br>✅ `SecureStore` data (`user_pickup_preference`) cleared on reinstall → no saved location fallback<br>✅ Push token may change → old token in Supabase DB becomes stale<br>✅ On login, `registerPushToken(userId)` called → new token overwrites old in DB |
| **Pass Criteria** | Fresh permission flow, new push token registered |

### TC-EDGE-4 — Multiple Devices with Same Account → Permissions Handled Per Device

| Field | Detail |
|---|---|
| **Preconditions** | Same account logged in on Device A and Device B |
| **Steps** | 1. Log in on Device A → grant all permissions → push token registered<br>2. Log in on Device B → grant all permissions → push token registered |
| **Expected Results** | ✅ Each device runs independent `LocationProvider` → permissions are per-device (OS-level)<br>✅ Each device calls `registerPushToken(userId)` independently<br>✅ **DB stores single token:** `users.expo_push_token` is overwritten by the last device to register (L159–162)<br>✅ Only the **last registered device** receives push notifications<br>✅ Location data on each device is independent |
| **Pass Criteria** | Both devices function, but only last-registered receives push |
| **⚠️ Code Gap** | Single `expo_push_token` column means only one device can receive push notifications at a time. **Recommendation:** Use a `push_tokens` junction table to support multiple devices per user. |

### TC-EDGE-5 — Permission Dialog Dismissed Without Action (Android Back Button)

| Field | Detail |
|---|---|
| **Preconditions** | Permission dialog visible, Android device |
| **Steps** | 1. When location permission dialog appears, press Android back button |
| **Expected Results** | ✅ Dialog dismissed → treated as "Deny" by OS<br>✅ `requestForegroundPermissionsAsync()` returns `status === 'denied'`<br>✅ Same flow as TC-LOC-3: error message + alert shown |
| **Pass Criteria** | Treated as denial, no crash |

### TC-EDGE-6 — "Only While Using the App" Permission (iOS)

| Field | Detail |
|---|---|
| **Preconditions** | iOS device, permission dialog visible |
| **Steps** | 1. Select "Allow While Using App" (not "Always Allow") |
| **Expected Results** | ✅ `requestForegroundPermissionsAsync()` returns `granted` (foreground is sufficient)<br>✅ App functions normally — foreground location works<br>✅ Background location **not** required for customer app (unlike driver app)<br>✅ If app goes to background → location updates stop (by design for customer) |
| **Pass Criteria** | Full functionality with foreground-only permission |

### TC-EDGE-7 — Slow Device / Low Memory → Permission Dialog Delayed

| Field | Detail |
|---|---|
| **Preconditions** | Low-memory device, fresh install |
| **Steps** | 1. Open app on slow device<br>2. Observe startup sequence |
| **Expected Results** | ✅ Splash screen remains visible until fonts loaded<br>✅ `LocationProvider` mounts after fonts → permission dialog may appear with delay<br>✅ Notification initialization also delayed but non-blocking<br>✅ `isLoadingLocation === true` during delay → loading spinner shown on map |
| **Pass Criteria** | No ANR, no crash, permission dialog eventually appears |

### TC-EDGE-8 — Location Permission Revoked Mid-Session

| Field | Detail |
|---|---|
| **Preconditions** | App running with location permission granted |
| **Steps** | 1. While app is in foreground, go to OS settings and revoke location permission<br>2. Return to app<br>3. Try to book a ride |
| **Expected Results** | ✅ Next `getCurrentLocation()` call triggers `requestLocationPermission()` (L195–197)<br>✅ OS shows permission dialog again (or immediately denies on Android if "Don't ask again" was set)<br>✅ If denied → returns `null`, booking flow continues with last-known location from store<br>✅ `NearbyDriversMap` won't refresh driver positions (next `initializeMap` call fails) |
| **Pass Criteria** | Graceful fallback, no crash |

---

## 5. Summary of Code Gaps Discovered (Fixed ✅)

| # | Gap | Status | Resolution |
|---|---|---|---|
| **G1** | No `AppState` listener to re-check location permission when returning from settings | ✅ Fixed | Added `AppState.addEventListener('change')` in `LocationContext.tsx` to call `checkAndRequestLocation()` on foreground resume |
| **G2** | No user-facing warning when notification permission is denied | ✅ Fixed | Added `showNotificationDeniedAlert()` in `notifications.ts`, called from `_layout.tsx` when permission denied |
| **G3** | GPS disabled shows error text but no actionable "Enable GPS" button | ✅ Fixed | Added `showGPSDisabledAlert()` in `LocationContext.tsx` with "Open Settings" button |
| **G4** | No automatic retry for failed push token registration | ✅ Fixed | Already implemented in `AuthContext.tsx` L131-160 (3 attempts with backoff) |
| **G5** | Single `expo_push_token` column — only one device receives push per user | ✅ Fixed | Created `push_tokens` table migration + upsert in `registerPushToken()` |
| **G6** | No battery saver detection / notification suppression warning | ✅ Fixed | Created `batterySaver.ts` utility using `expo-battery`, integrated in `_layout.tsx` |

---

## 6. Pass/Fail Criteria Summary

| Test Case | Criteria | Status |
|---|---|---|
| TC-LOC-1 | OS permission dialog shown on first open | ⬜ Not Run |
| TC-LOC-2 | Home screen shows address + map with drivers | ⬜ Not Run |
| TC-LOC-3 | Alert shown, map shows error state | ⬜ Not Run |
| TC-LOC-4 | App resumes after enabling in settings | ⬜ Not Run |
| TC-LOC-5 | Graceful degradation, error message shown | ⬜ Not Run |
| TC-NOTIF-1 | Notification permission dialog shown | ⬜ Not Run |
| TC-NOTIF-2 | Push token saved, notifications received | ⬜ Not Run |
| TC-NOTIF-3 | No crash, app works without push | ⬜ Not Run |
| TC-NOTIF-4 | Token registered after re-enable | ⬜ Not Run |
| TC-NOTIF-5 | In-app updates work despite battery saver | ⬜ Not Run |
| TC-COMBO-1 | Graceful degradation, manual booking possible | ⬜ Not Run |
| TC-COMBO-2 | Full functionality — map, bookings, push | ⬜ Not Run |
| TC-COMBO-3 | Booking works, no push notifications | ⬜ Not Run |
| TC-COMBO-4 | Manual booking works, push received | ⬜ Not Run |
| TC-EDGE-1 | Clean restart, permissions persist | ⬜ Not Run |
| TC-EDGE-2 | App loads with degraded functionality | ⬜ Not Run |
| TC-EDGE-3 | Fresh permission flow, new push token | ⬜ Not Run |
| TC-EDGE-4 | Both devices function, push to last-registered | ⬜ Not Run |
| TC-EDGE-5 | Back button treated as denial | ⬜ Not Run |
| TC-EDGE-6 | Foreground-only permission works fully | ⬜ Not Run |
| TC-EDGE-7 | No ANR, permission dialog appears eventually | ⬜ Not Run |
| TC-EDGE-8 | Graceful fallback on mid-session revocation | ⬜ Not Run |
