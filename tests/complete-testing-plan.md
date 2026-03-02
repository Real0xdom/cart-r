# CartR — Complete Production-Level Testing Plan

> **Generated**: 2026-02-28 | **Scope**: Full Platform (Customer App, Driver App, Admin Panel, Backend, Database, Payments)

---

## STEP 1 — ARCHITECTURE ANALYSIS

### 1.1 App Architecture

| Layer | Technology | Details |
|-------|-----------|---------|
| **Customer App** | React Native (Expo) | Expo Router, NativeWind/Tailwind CSS, Supabase SDK |
| **Driver App** | React Native (Expo) | Expo Router, Notifee for full-screen ride alerts, background location tracking |
| **Admin Panel** | Next.js (App Router) | Server-side rendering, Supabase client + server SDK, Lucide icons |
| **Backend** | Supabase (PostgreSQL + Edge Functions) | 14 Deno Edge Functions, 63 SQL migrations, PostGIS for geo queries |
| **Auth** | Supabase Auth | Phone OTP + Google OAuth (customer/driver), Direct email+password (admin) |
| **Real-time** | Supabase Realtime (Postgres Changes) | Booking status, driver location, wallet balance, payment status — all via `postgres_changes` channels |
| **Payments** | Cashfree PG + Payouts | Standard Gateway for collections, Payouts API v1 for driver bank transfers |
| **Notifications** | Expo Push + Notifee | Queue-based (`notifications` table → Edge Function → Expo API), Notifee for Android full-screen intents |
| **SMS/OTP** | Expo Push (not actual SMS) | `sms_queue` table processed as push notifications, NOT real SMS |

### 1.2 Backend Structure

- **Edge Functions** (Supabase Deno): `create-payment-order`, `verify-payment`, `payment-webhook`, `process-withdrawal`, `create-beneficiary`, `assign-driver`, `calculate-fare`, `process-notifications`, `send-sms`, `checkout-page`, `cancel-payment-order`, `create-upi-qr`, `send-notification`, `cashfree-checkout`
- **RPC Functions** (PostgreSQL): `pay_with_wallet`, `complete_partial_payment`, `rollback_partial_wallet_payment`, `request_withdrawal`, `approve_withdrawal`, `reject_withdrawal`, `credit_driver_earning`, `release_pending_earning`, `find_nearby_drivers`, `accept_booking_atomic`, `decline_booking`, `check_phone_exists`, `get_driver_wallet_info`, `get_driver_balance`
- **Triggers**: `on_booking_payment_received`, `on_booking_completed`, `on_booking_cancelled`, notification insert triggers, service area triggers

### 1.3 API Patterns

- **Client → Backend**: Supabase JS SDK direct queries (`.from().select()`, `.rpc()`) + `fetch()` to Edge Functions with Bearer tokens
- **Edge Functions**: Deno `serve()` handlers with CORS headers, `SUPABASE_SERVICE_ROLE_KEY` for privileged ops
- **Webhook**: Cashfree → `payment-webhook` Edge Function with HMAC-SHA256 signature verification
- **Admin API**: Next.js API Routes (`/api/auth/login`, `/api/drivers/*`, `/api/bookings/*`, `/api/withdrawals/*`)

### 1.4 Database Schema Relationships

```
users (1) ──→ (N) bookings (customer_id)
drivers (1) ──→ (N) bookings (driver_id)
drivers (1) ──→ (1) driver_wallets
drivers (1) ──→ (N) driver_wallet_transactions
drivers (1) ──→ (N) withdrawals
bookings (1) ──→ (N) booking_addons
bookings (1) ──→ (N) driver_locations
bookings (1) ──→ (N) ratings
bookings (1) ──→ (N) wallet_transactions
users (1) ──→ (N) wallet_transactions (customer wallet)
users (1) ──→ (N) notifications
users (1) ──→ (N) saved_addresses / saved_routes
fare_config ──→ per vehicle_type pricing
waiting_charges_config ──→ per vehicle_type waiting rates
```

### 1.5 External Integrations

| Integration | Purpose | Env Toggle |
|------------|---------|------------|
| **Cashfree PG** | Online payments (orders, UPI QR, verification) | `CASHFREE_ENV` = sandbox/production |
| **Cashfree Payouts** | Driver bank transfers | `CASHFREE_PAYOUT_ENV` |
| **Google Maps** | Geocoding, Places Autocomplete, Directions | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` |
| **Expo Push** | Push notifications to mobile apps | Expo Push API (`exp.host`) |
| **Supabase Auth** | Phone OTP, Google OAuth | Supabase project config |
| **PostGIS** | Geospatial queries (`find_nearby_drivers`) | Installed on Supabase PostgreSQL |

### 1.6 State Management

- **Customer App**: React `useState`/`useEffect` + Supabase Realtime subscriptions; `useLocationStore` (Zustand); `AuthContext` (React Context)
- **Driver App**: React local state + Supabase Realtime; `AuthContext`; `expo-location` background tracking
- **Admin Panel**: React `useState` with direct Supabase queries; cookie-based session (`admin_session`)

### 1.7 Error Handling Design

- **Edge Functions**: try/catch wrapping entire handler, JSON error responses with status codes
- **RPC Functions**: `EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM)`
- **Mobile Apps**: try/catch in every API call returning `{ data, error }` patterns; `console.error` logging; `Alert.alert()` for user-facing errors
- **⚠️ GAPS IDENTIFIED**:
  - No centralized error reporting (no Sentry/Bugsnag integration)
  - No structured logging in Edge Functions
  - Admin panel has no global error boundary
  - No retry logic for failed Expo Push sends (only SMS queue has retry with `attempts < 3`)

---

## STEP 2 — CRITICAL FLOW IDENTIFICATION

### 2.1 Business-Critical Flows

#### Flow 1: Customer Signup/Login
```
Phone OTP → Supabase Auth → users table upsert → push token registration → terms acceptance check
Google OAuth → Supabase Auth → redirect → users table upsert
```

#### Flow 2: Booking Creation
```
find-ride.tsx (locations) → select-vehicle.tsx (fare calc) → receiver-details.tsx → confirm-ride.tsx
→ createBooking() [generates booking_number, pickup_otp, sets expires_at]
→ Supabase INSERT → triggers notify_drivers → notifications table → process-notifications Edge Function
→ waiting-for-driver.tsx [3-min timeout, real-time subscription]
```

#### Flow 3: Driver Assignment / Acceptance
```
Driver sees ride notification (Notifee full-screen) → acceptBooking() RPC [accept_booking_atomic]
→ Atomic: checks status=pending, sets driver_id + status=accepted
→ Customer's real-time subscription fires → track-ride.tsx
```

#### Flow 4: Ride Lifecycle
```
accepted → driver_arrived (markDriverArrived) → pickup_otp_verified (verifyPickupOTPAndStartTrip)
→ in_progress (location tracking) → delivered → collect-payment.tsx
→ completed (completeTrip) → rating → home
```

#### Flow 5: Payment Success
```
Cash: driver marks payment_confirmed_by_customer → completeTrip → on_booking_completed trigger → credit_driver_earning(cash=true)
Online: createPaymentOrder → Cashfree checkout → payment-webhook → payment_status='paid' → on_booking_payment_received trigger → credit_driver_earning(online)
Wallet: payWithWallet RPC → deduct user balance → mark paid
Split: wallet partial + online remainder → completePartialPayment after online success
```

#### Flow 6: Cancellation Handling
```
Customer cancels: cancelBooking() → status='cancelled' → on_booking_cancelled trigger → reversal if earning existed
Driver cancels: cancelBookingByDriver() → RPC decline_booking → re-queue booking for other drivers
Timeout: expires_at passes → customer can retry with increased fare_multiplier/tip
```

#### Flow 7: Driver Wallet & Withdrawal
```
Earning credited (trigger) → pending_balance (online) or available_balance (cash)
Trip completed → release_pending_earning → available_balance
requestWithdrawal RPC (advisory lock, idempotency) → admin approve_withdrawal → process-withdrawal Edge Function
→ Cashfree Payouts API (authorize → requestTransfer) → bank transfer
```

### 2.2 Frontend ↔ Backend Dependency Map

| Frontend Action | Backend Endpoint | DB Impact |
|----------------|-----------------|-----------|
| Create booking | Direct Supabase INSERT | bookings, notifications |
| Accept ride | RPC `accept_booking_atomic` | bookings (atomic update) |
| Pay with wallet | RPC `pay_with_wallet` | users.balance, wallet_transactions, bookings |
| Complete trip | Direct Supabase UPDATE | bookings → triggers wallet |
| Request withdrawal | RPC `request_withdrawal` | withdrawals, driver_wallets, driver_wallet_transactions |
| Online payment | Edge Function `create-payment-order` | Cashfree API + bookings |
| Verify payment | Edge Function `verify-payment` | Cashfree API + bookings/wallet_transactions |

---

## STEP 3 — RISK ANALYSIS

### 3.1 CRITICAL Risks (🔴)

| # | Risk | Location | Impact |
|---|------|----------|--------|
| R1 | **Race condition in booking acceptance** | `acceptBooking()` uses RPC `accept_booking_atomic` but `assign-driver` Edge Function does NOT use atomic RPC — it uses `.update().eq('status','pending')` which is weaker | Two drivers could accept the same booking |
| R2 | **Admin auth uses plaintext password comparison** | `admin/app/api/auth/login/route.ts` line 37: `admin.password_hash !== password` | Passwords stored in plaintext in `admins` table, no bcrypt |
| R3 | **Admin session is base64-encoded JSON, not signed** | `middleware.ts` — session cookie is just `JSON → base64`, no HMAC/JWT signature | Anyone can forge admin sessions by crafting base64 JSON |
| R4 | **Double-credit risk on payment webhook** | `payment-webhook` updates `payment_status='paid'` → fires trigger → `credit_driver_earning`. But `verify-payment` Edge Function ALSO updates `payment_status='paid'` | Driver could be double-credited if webhook AND verify both fire |
| R5 | **Wallet balance update is NOT atomic in verify-payment** | `verify-payment` reads balance, adds amount, writes back (`userData.balance + paymentAmount`) — classic TOCTOU race | Concurrent top-ups could lose money |
| R6 | **No webhook signature verification enforced** | `payment-webhook/index.ts` has `verifySignature()` function but it's unclear if it blocks on invalid signatures | Spoofed webhooks could mark bookings as paid |

### 3.2 HIGH Risks (🟠)

| # | Risk | Location | Impact |
|---|------|----------|--------|
| R7 | **No rate limiting on any Edge Function** | All 14 Edge Functions | DDoS, brute force, payment spam |
| R8 | **SMS queue is actually push notifications, not SMS** | `send-sms/index.ts` sends Expo Push, not SMS | Delivery OTP won't reach users without app installed |
| R9 | **Booking expiry is client-side only** | `expires_at` is set but no server-side cleanup job exists | Stale pending bookings accumulate in DB |
| R10 | **No idempotency on booking creation** | `createBooking()` in customer app has `idempotency_key` field but it uses `Date.now()` which can collide | Duplicate bookings on network retry |
| R11 | **CORS headers allow all origins** (`Access-Control-Allow-Origin: '*'`) | All Edge Functions | Cross-origin attacks possible |
| R12 | **Driver location tracked in `drivers` table directly** | `drivers.current_latitude/longitude` updated per location change | High write load on main drivers table |

### 3.3 MEDIUM Risks (🟡)

| # | Risk | Location | Impact |
|---|------|----------|--------|
| R13 | OTP is 4-digit (`Math.floor(1000 + Math.random() * 9000)`) | `auth.ts`, `bookings.ts` | Brute-forceable (9000 combinations) |
| R14 | No input sanitization on booking addresses | `createBooking()` | XSS in admin panel when displaying addresses |
| R15 | `@ts-ignore` used extensively in driver wallet code | `driver/lib/wallet.ts` | Type safety bypassed, runtime errors possible |
| R16 | No pagination on admin dashboard queries | `admin/app/page.tsx` fetches all bookings | Performance degradation with scale |
| R17 | Hardcoded fare config fallback in driver app | `driver/lib/bookings.ts` FARE_CONFIG object | Out of sync with DB `fare_config` table |

---

## STEP 4 — AUTOMATED TEST PLAN

### 4.1 Unit Tests

| ID | Test Name | Pre-condition | Steps | Expected Result | Priority | Tool |
|----|----------|---------------|-------|----------------|----------|------|
| UT-01 | `calculateFare` returns correct fare for bike | None | Call with 5km, 10min, 'bike' | `max(25 + 5*8 + 10*1, 30) = 75` | High | Jest |
| UT-02 | `calculateFare` returns minimum fare | None | Call with 0.1km, 1min, 'bike' | Returns 30 (minimum) | High | Jest |
| UT-03 | `generateBookingNumber` is unique | None | Generate 1000 numbers | All unique, format `CARTR-*` | High | Jest |
| UT-04 | `generateOTP` is 4-digit | None | Generate 100 OTPs | All 4 digits, 1000-9999 | Medium | Jest |
| UT-05 | `calculatePaymentSplit` full wallet | Balance=500, Total=300 | Call function | `canPayFull=true, walletAmount=300, onlineAmount=0` | High | Jest |
| UT-06 | `calculatePaymentSplit` partial wallet | Balance=100, Total=300 | Call function | `canPayFull=false, walletAmount=100, onlineAmount=200` | High | Jest |
| UT-07 | `calculateDistance` Haversine accuracy | None | Known coords (Mumbai-Pune) | ~150km ±5km | Medium | Jest |
| UT-08 | `estimateETA` returns reasonable values | None | 10km by bike | ~26 min (10/25*60+2) | Low | Jest |
| UT-09 | `calculateTotalWithFees` math | baseFare=100 | Call with defaults | `{baseFare:100, platformFee:0, gst:0, total:100}` | Medium | Jest |
| UT-10 | Admin session parsing handles malformed cookies | Invalid base64 | Parse in middleware | Redirects to login | High | Jest |

### 4.2 API Test Cases

| ID | Test Name | Pre-condition | Steps | Expected Result | Priority | Tool |
|----|----------|---------------|-------|----------------|----------|------|
| API-01 | Create payment order — valid | Authenticated user, existing booking | POST `/functions/v1/create-payment-order` with valid body | 200 + `payment_session_id` | High | Postman |
| API-02 | Create payment order — already paid | Booking with `payment_status='paid'` | POST create-payment-order | 400 "Payment already completed" | High | Postman |
| API-03 | Create payment order — missing fields | No `customer_id` | POST create-payment-order | 400 "Missing required fields" | Medium | Postman |
| API-04 | Verify payment — paid order | Valid `order_id` with SUCCESS status | POST `/functions/v1/verify-payment` | 200 + `status: 'PAID'` | High | Postman |
| API-05 | Verify payment — failed order | Failed order | POST verify-payment | 200 + `status: 'FAILED'` | High | Postman |
| API-06 | Payment webhook — valid signature | Valid Cashfree webhook payload | POST `/functions/v1/payment-webhook` | 200 + booking updated | High | Postman |
| API-07 | Payment webhook — invalid signature | Tampered payload | POST payment-webhook | 400 or no DB update | High | Postman |
| API-08 | Process withdrawal — not approved | Withdrawal `status='pending'` | POST `/functions/v1/process-withdrawal` | 400 "must be approved first" | High | Postman |
| API-09 | Process withdrawal — no beneficiary | Driver without beneficiary_id | POST process-withdrawal | 400 "not registered as beneficiary" | Medium | Postman |
| API-10 | Assign driver — no nearby drivers | Booking in remote area | POST `/functions/v1/assign-driver` | 200 + `assigned: false` | Medium | Postman |
| API-11 | Admin login — valid credentials | Admin exists in `admins` table | POST `/api/auth/login` | 200 + session cookie set | High | Postman |
| API-12 | Admin login — wrong password | Admin exists | POST with wrong password | 401 "Invalid email or password" | High | Postman |
| API-13 | Wallet RPC — pay_with_wallet full | User has enough balance | Call RPC | `success: true, fully_paid: true` | High | Postman |
| API-14 | Wallet RPC — pay_with_wallet insufficient | Balance < fare | Call RPC with `useFullWallet=true` | Error about insufficient balance | High | Postman |
| API-15 | Request withdrawal — below minimum | Amount < ₹100 | Call RPC | `success: false, error: 'Minimum withdrawal...'` | Medium | Postman |

### 4.3 Integration Test Scenarios

| ID | Test Name | Pre-condition | Steps | Expected Result | Priority | Tool |
|----|----------|---------------|-------|----------------|----------|------|
| INT-01 | Booking → Accept → Complete (cash) | Customer + verified driver online | 1. Create booking 2. Accept via RPC 3. Mark arrived 4. Verify OTP 5. Complete trip | Booking completed, driver wallet credited with cash earning | High | Playwright + Supabase |
| INT-02 | Booking → Accept → Online Payment → Complete | Same | 1-4 same 5. Create payment order 6. Simulate webhook 7. Complete | Booking paid, wallet credited as pending → released on complete | High | Playwright + Supabase |
| INT-03 | Booking → Customer Cancel | Active booking | 1. Create 2. Accept 3. Cancel by customer | Booking cancelled, earning reversed if credited | High | Playwright + Supabase |
| INT-04 | Booking → Driver Cancel → Re-queue | Accepted booking | 1. Create 2. Accept 3. Driver cancel | Booking re-queued (pending), new notifications sent | High | Playwright + Supabase |
| INT-05 | Wallet top-up → Pay with wallet | User with ₹0 balance | 1. Create payment order (wallet type) 2. Webhook success 3. Verify balance updated 4. Book ride 5. Pay with wallet | Balance increases then decreases correctly | High | Postman chain |
| INT-06 | Split payment (wallet + online) | User with partial balance | 1. Pay with wallet (partial) 2. Create online order for remainder 3. Webhook → complete_partial_payment | Both amounts recorded, booking marked paid | High | Postman chain |
| INT-07 | Withdrawal full lifecycle | Driver with ₹500 available | 1. Request withdrawal ₹200 2. Admin approve 3. Process withdrawal | Balance deducted, Cashfree payout initiated | High | Postman + Admin UI |
| INT-08 | Withdrawal rejection refund | Pending withdrawal | 1. Request ₹200 2. Admin reject | Balance restored, reversal transaction logged | High | Postman |

### 4.4 E2E Test Flows (Appium/Playwright)

| ID | Test Name | Steps | Expected Result | Priority | Tool |
|----|----------|-------|----------------|----------|------|
| E2E-01 | Customer full ride (happy path) | Sign in → Find ride → Select vehicle → Enter receiver → Confirm → Wait → Track → Pay → Rate | Ride completed, invoice shown | High | Appium |
| E2E-02 | Driver onboarding | Sign in → Personal info → Vehicle info → Documents → Verification pending | Driver created with `verification_status=pending` | High | Appium |
| E2E-03 | Driver accept and complete ride | Go online → Receive notification → Accept → Navigate → Verify OTP → Start → Deliver → Collect → Complete | Earnings appear in wallet | High | Appium |
| E2E-04 | Admin dashboard overview | Login → View stats → Check recent bookings → Navigate sections | All page loads with correct data | High | Playwright |
| E2E-05 | Admin approve driver | Login → Drivers → Select pending → Approve | Driver `verification_status=approved` | High | Playwright |
| E2E-06 | Admin process withdrawal | Login → Payouts → Select pending → Approve → Process | Withdrawal status moves through pipeline | High | Playwright |
| E2E-07 | Customer cancels during wait | Book ride → Wait → Cancel → Confirm | Booking cancelled, back to home | Medium | Appium |
| E2E-08 | Customer retries with tip after timeout | Book → Wait 3min → Timeout → Increase price → Wait | New search starts with updated fare | Medium | Appium |

### 4.5 Edge Case Automation

| ID | Scenario | Steps | Expected | Priority | Tool |
|----|---------|-------|----------|----------|------|
| EDGE-01 | Double-tap accept button | Two rapid acceptBooking calls for same booking | Only one succeeds (atomic RPC) | High | k6 |
| EDGE-02 | Payment webhook arrives twice | Send identical webhook payload twice | Only one DB update (idempotency check) | High | Postman |
| EDGE-03 | Wallet payment during concurrent top-up | Simultaneously top-up and pay | Final balance = initial + topup - payment | High | k6 |
| EDGE-04 | Cancel after payment received | Pay online → webhook → then cancel | Earning reversed, wallet refund triggered | High | Postman |
| EDGE-05 | Driver goes offline mid-ride | Set `is_online=false` while status=in_progress | Ride should continue, booking not affected | Medium | Postman |
| EDGE-06 | App killed during payment | Create order → kill app → return | Payment status checkable via verify-payment | Medium | Appium |
| EDGE-07 | Zero-amount booking attempt | Set total_fare=0 | Rejected at creation or payment | Medium | Postman |
| EDGE-08 | Expired booking acceptance | Accept booking where `expires_at < now()` | Atomic RPC should reject | High | Postman |

### 4.6 Regression Suite Structure

```
tests/
├── unit/
│   ├── fare-calculation.test.ts
│   ├── booking-number-generation.test.ts
│   ├── otp-generation.test.ts
│   ├── payment-split.test.ts
│   ├── distance-calculation.test.ts
│   └── admin-session.test.ts
├── api/
│   ├── payment-order.test.ts
│   ├── verify-payment.test.ts
│   ├── payment-webhook.test.ts
│   ├── assign-driver.test.ts
│   ├── process-withdrawal.test.ts
│   ├── admin-auth.test.ts
│   └── wallet-rpc.test.ts
├── integration/
│   ├── booking-lifecycle.test.ts
│   ├── payment-flow.test.ts
│   ├── wallet-operations.test.ts
│   ├── withdrawal-lifecycle.test.ts
│   └── cancellation-refund.test.ts
├── e2e/
│   ├── customer-booking.test.ts
│   ├── driver-ride.test.ts
│   ├── admin-dashboard.test.ts
│   └── payment-collection.test.ts
└── load/
    ├── concurrent-bookings.k6.js
    ├── payment-webhook-flood.k6.js
    └── driver-location-updates.k6.js
```

### 4.7 Parallel Multi-User Simulation

| ID | Scenario | Users | Steps | Expected | Tool |
|----|---------|-------|-------|----------|------|
| PAR-01 | 10 drivers accept 1 booking | 10 concurrent | All call `accept_booking_atomic` | Exactly 1 succeeds, 9 fail | k6 |
| PAR-02 | 50 customers book simultaneously | 50 concurrent | Create bookings | All 50 created with unique numbers | k6 |
| PAR-03 | 20 wallet top-ups for same user | 20 concurrent | All call verify-payment with PAID | Balance = sum of all 20 amounts | k6 |
| PAR-04 | Driver double-withdrawal | 2 concurrent | Same driver requests ₹500 twice with ₹500 balance | Only 1 succeeds (advisory lock) | k6 |

---

## STEP 5 — MANUAL TESTING CHECKLIST

### 5.1 Functional Testing

- [ ] Customer can sign up with phone OTP
- [ ] Customer can sign in with Google OAuth
- [ ] Customer can set pickup and drop locations via Google Places
- [ ] Service area validation blocks bookings outside supported zones
- [ ] Vehicle selection shows correct fares from `fare_config` table
- [ ] Receiver details form validates phone number format
- [ ] Booking creation generates unique booking number
- [ ] Waiting screen shows 3-minute countdown timer
- [ ] Real-time subscription updates booking status correctly
- [ ] Customer can cancel during pending/accepted states
- [ ] Customer can retry with increased fare after timeout
- [ ] Track ride shows driver location in real-time
- [ ] OTP display shows correct pickup OTP to customer
- [ ] Payment page shows correct breakdown (fare + addons + waiting)
- [ ] Wallet balance displayed correctly
- [ ] Cash payment flow marks booking as completed
- [ ] Online payment opens Cashfree checkout
- [ ] Wallet payment deducts balance atomically
- [ ] Split payment (wallet + online) works correctly
- [ ] Rating modal appears after ride completion
- [ ] Ride history shows all past bookings
- [ ] Driver can complete onboarding (personal → vehicle → documents)
- [ ] Driver verification status blocks ride acceptance until approved
- [ ] Driver can go online/offline
- [ ] Driver receives ride notification (Notifee full-screen)
- [ ] Driver can accept/decline from notification
- [ ] Driver arrives → customer notified
- [ ] Pickup OTP verification starts trip
- [ ] Delivery OTP sent to customer via push notification
- [ ] Driver can collect cash or generate UPI QR
- [ ] Driver completes trip → earnings credited to wallet
- [ ] Driver can view wallet balance and transaction history
- [ ] Driver can request withdrawal with bank details
- [ ] Admin can log in with email/password
- [ ] Admin dashboard shows correct stats (users, drivers, bookings, revenue)
- [ ] Admin can approve/reject driver verification
- [ ] Admin can view and manage bookings
- [ ] Admin can approve/reject withdrawals
- [ ] Admin can process approved withdrawals (Cashfree payout)
- [ ] Admin can manage fare config per vehicle type
- [ ] Admin can manage addon services
- [ ] Admin can manage service areas
- [ ] Admin can view support tickets

### 5.2 UI/UX Testing

- [ ] All screens render correctly on small phones (320px width)
- [ ] All screens render correctly on tablets
- [ ] Dark mode elements are readable (if applicable)
- [ ] Map renders correctly and shows markers
- [ ] Map route shows road directions (not straight lines)
- [ ] Bottom sheets snap to correct positions
- [ ] Loading spinners shown during API calls
- [ ] Error messages are user-friendly (not raw error codes)
- [ ] Back navigation works correctly on all screens
- [ ] Keyboard doesn't cover input fields
- [ ] Forms have proper input types (phone → numeric keyboard)
- [ ] Animations are smooth (no jank on 60fps)

### 5.3 Offline Scenarios

- [ ] App shows meaningful error when network is lost during booking
- [ ] App recovers gracefully when network restores
- [ ] Supabase Realtime reconnects after network drop
- [ ] Cached data (if any) displays while offline
- [ ] Payment page warns before proceeding without network
- [ ] Driver location stops updating when offline (no crashes)

### 5.4 Permission Handling

- [ ] Location permission requested at appropriate time
- [ ] App works with "While Using" location (customer)
- [ ] Driver app requests "Always" location permission for background tracking
- [ ] Notification permission requested and handled if denied
- [ ] Camera permission for document uploads (driver onboarding)
- [ ] Storage permission for proof of delivery image

### 5.5 Force Close Scenarios

- [ ] App relaunches to correct screen after force close during ride
- [ ] Active booking detected on app relaunch (driver)
- [ ] Payment status verified on relaunch if payment was in progress
- [ ] Push notification tap opens correct screen after force close

### 5.6 Background/Foreground Behavior

- [ ] Driver location continues updating in background
- [ ] Notifee ride request notification shows even when app is killed
- [ ] Accept/Decline actions work from notification (background handler)
- [ ] App state change doesn't cause multiple subscriptions
- [ ] Timer on waiting screen continues correctly after backgrounding

### 5.7 Push Notifications

- [ ] Customer receives notification when driver accepts ride
- [ ] Customer receives delivery OTP notification
- [ ] Customer receives booking status updates
- [ ] Driver receives ride request as full-screen notification
- [ ] Notification tap navigates to correct screen
- [ ] Notifications work on Android 13+ (notification channels)
- [ ] Data-only notifications handled by Notifee (not shown by OS)

### 5.8 Device Compatibility

- [ ] Tested on Android 10, 12, 13, 14
- [ ] Tested on iOS 15, 16, 17 (if applicable)
- [ ] Tested on low-RAM devices (2GB)
- [ ] Map performance on older devices
- [ ] Google Places autocomplete works on all devices

### 5.9 Payment Edge Cases

- [ ] Payment succeeds but webhook delayed → verify-payment recovers
- [ ] Payment fails → booking remains payable
- [ ] Cashfree order expires (30 min) → user can create new order
- [ ] Partial wallet payment → online fails → rollback restores wallet
- [ ] UPI QR payment displayed → scanned → payment confirmed
- [ ] Multiple payment attempts for same booking (idempotency)
- [ ] Zero-balance wallet → skip wallet option, show online only
- [ ] Network error during payment → resume possible

### 5.10 Admin Misuse Scenarios

- [ ] Admin cannot approve already-approved withdrawal
- [ ] Admin cannot reject already-paid withdrawal
- [ ] Two admins approving same withdrawal simultaneously → only 1 succeeds (`FOR UPDATE NOWAIT`)
- [ ] Admin cannot access API without valid session cookie
- [ ] Expired admin session redirects to login
- [ ] Admin cannot delete driver with active bookings
- [ ] Admin modifying fare config applies to new bookings only (not in-progress)

---

## STEP 6 — LOAD & PERFORMANCE TESTING

### 6.1 API Load Test Plan

| Test | Endpoint | VUs | Duration | RPS Target | Tool |
|------|---------|-----|----------|-----------|------|
| LT-01 | Create booking (Supabase INSERT) | 50 | 5 min | 100 rps | k6 |
| LT-02 | Find nearby drivers RPC | 100 | 5 min | 200 rps | k6 |
| LT-03 | Accept booking RPC (atomic) | 20 | 2 min | 50 rps | k6 |
| LT-04 | Payment webhook | 30 | 3 min | 60 rps | k6 |
| LT-05 | Verify payment | 50 | 5 min | 100 rps | k6 |
| LT-06 | Get booking by ID | 200 | 5 min | 500 rps | k6 |
| LT-07 | Admin dashboard stats query | 20 | 3 min | 40 rps | k6 |
| LT-08 | Driver location update | 200 | 10 min | 400 rps | k6 |

### 6.2 Concurrency Test Cases

| ID | Scenario | Setup | Expected |
|----|---------|-------|----------|
| CON-01 | 100 bookings created in 10 seconds | 100 unique customers | All succeed with unique booking_numbers |
| CON-02 | 50 drivers accept 10 bookings | 50 drivers, 10 bookings | Exactly 10 acceptances, 40 rejections |
| CON-03 | 20 concurrent wallet payments | Same user, same booking | Exactly 1 succeeds |
| CON-04 | 10 concurrent withdrawal requests | Same driver, balance = ₹500, each ₹500 | Exactly 1 succeeds (advisory lock) |
| CON-05 | Realtime subscriptions under load | 500 active subscriptions | All receive updates within 2 seconds |

### 6.3 Database Stress Tests

- **Write-heavy**: Simulate 200 drivers updating location every 5 seconds → `drivers` table (4800 updates/min)
- **Read-heavy**: 500 customers querying booking status simultaneously
- **Join-heavy**: Admin dashboard querying bookings with customer+driver joins across 100K records
- **Index validation**: Verify indexes exist on `bookings.customer_id`, `bookings.driver_id`, `bookings.status`, `drivers.is_online`, `driver_wallet_transactions.booking_id`
- **Connection pool**: Max Supabase connections under 100 concurrent users

### 6.4 Ride Assignment Under High Traffic

| Scenario | Detail | Risk |
|---------|--------|------|
| 100 bookings, 10 drivers | All same vehicle type, same area | Ensure fair distribution, no deadlocks |
| 50 bookings, 0 drivers | All pending, no drivers online | Graceful "no drivers" response, no resource exhaustion |
| Spike: 500 bookings in 1 minute | Sudden demand surge | Edge Function cold start latency, Supabase connection limits |

### 6.5 Memory & CPU Risk Points

- **Customer App**: `Map.tsx` (13KB), `LiveDriverTracking.tsx` (11KB) — multiple map layers with polylines and markers
- **Customer App**: `pay-booking.tsx` (32KB) — complex state with WebView/Cashfree SDK
- **Driver App**: `collect-payment.tsx` (32KB) — SMS polling, QR generation, OTP verification
- **Driver App**: Background location tracking — continuous GPS drain
- **Admin Panel**: Dashboard fetching all bookings without pagination — memory spike at scale
- **Supabase**: Realtime channels — each active booking creates 2-3 channels (booking, driver location, payment)

---

## STEP 7 — PRE-PRODUCTION RELEASE CHECKLIST

### 7.1 Stability

- [ ] All critical E2E flows pass (booking → payment → completion)
- [ ] No console errors in production build
- [ ] App doesn't crash on Android 10-14 for 1 hour of continuous use
- [ ] Memory leak test: no unbounded growth after 50 rides
- [ ] All Supabase Realtime channels properly unsubscribed on screen unmount
- [ ] Edge Functions respond within 3 seconds (p95)
- [ ] Database query times under 500ms (p95)

### 7.2 Monitoring

- [ ] **MISSING**: Set up error tracking (Sentry/Bugsnag) for both mobile apps + Edge Functions
- [ ] **MISSING**: Set up APM for Edge Function latency monitoring
- [ ] Supabase dashboard monitoring enabled (query performance, connection pool)
- [ ] **MISSING**: Set up alerting for failed payments (webhook failures)
- [ ] **MISSING**: Set up alerting for driver wallet balance discrepancies
- [ ] Cashfree webhook delivery monitoring enabled in Cashfree dashboard

### 7.3 Logging

- [ ] All Edge Functions log request/response in structured format
- [ ] Payment flows log order_id, amount, status transitions
- [ ] **MISSING**: Centralized log aggregation (no ELK/CloudWatch)
- [ ] Supabase Postgres logs enabled for slow queries
- [ ] Audit trail: `audit_logs` table captures critical changes

### 7.4 Crash Reporting

- [ ] **MISSING**: No crash reporting SDK integrated (Sentry/Crashlytics)
- [ ] **RECOMMENDATION**: Add `@sentry/react-native` to both apps
- [ ] **RECOMMENDATION**: Add Sentry to Deno Edge Functions
- [ ] Uncaught exception handler in React Native app `_layout.tsx`

### 7.5 Backups

- [ ] Supabase automated daily backups enabled (check Supabase dashboard)
- [ ] Point-in-time recovery enabled (requires Pro plan)
- [ ] **RECOMMENDATION**: Export `fare_config`, `platform_settings`, `service_areas` as seed SQL for disaster recovery
- [ ] `.env` files and Cashfree credentials backed up securely (not in git)

### 7.6 Security

- [ ] **CRITICAL FIX NEEDED**: Hash admin passwords with bcrypt (`admin/api/auth/login/route.ts`)
- [ ] **CRITICAL FIX NEEDED**: Sign admin session cookies with HMAC or replace with JWT
- [ ] **FIX NEEDED**: Restrict CORS to specific origins (not `*`) on Edge Functions
- [ ] **FIX NEEDED**: Add rate limiting to Edge Functions (especially payment endpoints)
- [ ] Verify Cashfree webhook signatures are enforced (not just validation function existing)
- [ ] RLS policies verified on all tables (existing migration `004_security_rls_policies.sql`)
- [ ] Supabase anon key not exposed in admin panel (admin uses `supabase-server.ts` with service role)
- [ ] Service role key only used server-side (Edge Functions, admin API routes)
- [ ] No secrets in client-side code (check `.env` files)
- [ ] Cashfree environment correctly set to `production` (not `sandbox`) before go-live
- [ ] SSL/HTTPS enforced on all endpoints
- [ ] API keys rotated from development values

### 7.7 Final Go-Live Steps

1. [ ] Run full regression suite (unit + API + integration)
2. [ ] Execute manual testing checklist (Section 5)
3. [ ] Run load tests at 2x expected peak (Section 6)
4. [ ] Fix all Critical (🔴) risks from Section 3
5. [ ] Switch Cashfree to production environment
6. [ ] Verify webhook URLs point to production Supabase
7. [ ] Verify Google Maps API key restrictions (HTTP referrers, app bundle IDs)
8. [ ] Clear test/sandbox data from production database
9. [ ] Deploy admin panel to production Vercel domain
10. [ ] Build production APKs for customer and driver apps
11. [ ] Submit to Google Play Store / Apple App Store
12. [ ] Monitor first 24 hours for errors, failed payments, notification failures

---

## APPENDIX — MISSING ARCHITECTURE ITEMS

| Item | Status | Recommendation |
|------|--------|---------------|
| Error monitoring (Sentry) | ❌ Not implemented | Add `@sentry/react-native` + Sentry Deno SDK |
| Rate limiting | ❌ Not implemented | Add Upstash Redis rate limiter to Edge Functions |
| API versioning | ❌ Not implemented | Version Edge Functions (e.g., `/v1/create-payment-order`) |
| Database indexing audit | ⚠️ Unknown | Run `EXPLAIN ANALYZE` on critical queries |
| Automated CI/CD testing | ❌ Not implemented | Add GitHub Actions with Jest + Postman Newman |
| Environment variable validation | ❌ No startup checks | Add Zod schema validation for env vars in Edge Functions |
| Structured logging | ❌ Using `console.log` | Switch to structured JSON logging library |
| Health check endpoint | ❌ Not implemented | Add `/health` Edge Function for uptime monitoring |
| Backup testing | ❌ Never tested | Schedule monthly restore drill from Supabase backup |
| Admin audit trail | ⚠️ Partial (`audit_logs` table exists) | Ensure all admin actions write to audit_logs |
