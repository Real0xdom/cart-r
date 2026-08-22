# 🚚 Cart-R Logistics: The Master 6-Week Implementation Plan

> **Objective**: Deliver a production-grade Logistics MVP (Porter-like) with **3 High-Quality Interfaces** (Customer, Driver, Admin) by leveraging **Supabase** for speed and reliability.

## 🏗 Architecture Overview
| Component | Tech Stack | Key Responsibilities |
| :--- | :--- | :--- |
| **Customer App** | React Native (Expo) | Booking, Tracking, Payments, Safety (SOS) |
| **Driver App** | React Native (Expo) | Order Acceptance, Navigation, Earning Stats |
| **Admin Console** | Next.js (React) | Verification, Dispatch, Support, Analytics |
| **Backend** | Supabase | Auth, Database, Realtime, File Storage |
| **Logic Layer** | Edge Functions | Pricing Algo, Payment Signatures, Webhooks |
| **Payments** | Cashfree | UPI, Cards, Wallets, Split Payments |

---

## 📅 Week 1: Foundation & Infrastructure
**Goal**: Set up the unified backend, database schema, and initialize all client applications.

### 1. Unified Backend (Supabase)
- [ ] **Project Setup**: Initialize `cart-r-mvp`, configure Environment Variables (Production & Staging).
- [ ] **Database Schema (PostgreSQL)**:
  - `users`: Core profile table (linked to Auth).
  - `drivers`: Extended profile (License, Vehicle Details, Verification Status).
  - `vehicles`: Master list of vehicle types (Bike, Tata Ace, Pickup) & Base Pricing.
  - `bookings`: Central ledger of all trips & statuses.
  - `support_tickets` & `emergency_contacts`: Safety features tables.
- [ ] **Security**: Implement strict **Row Level Security (RLS)**.
  - *Rule*: Drivers view only their own bookings. Customers view their own. Admins view all.
- [ ] **Edge Functions (Business Logic)**:
  - `calculate-fare`: Secure server-side pricing engine.
  - `assign-driver`: Dispatch logic to find nearest online driver.

### 2. Multi-App Initialization
- [ ] **Customer App**: Audit existing code, remove legacy Stripe/Clerk code, install Supabase SDK.
- [ ] **Driver App**: Initialize new Expo project (`npx create-expo-app`). Copy shared UI components.
- [ ] **Admin Console**: Initialize Next.js project (`npx create-next-app`). Setup Shadcn UI dashboard.

---

## 📅 Week 2: Supply Side - The Driver Ecosystem
**Goal**: Enable drivers to register, upload documents, get verified, and go online.

### 1. Driver App (React Native)
- [ ] **Onboarding Flow**: Phone Auth -> Document Upload (DL, RC, Insurance) to Supabase Storage.
- [ ] **Verification State**: blocked "Pending Verification" screen until Admin approves.
- [ ] **Online/Offline Toggle**: Real-time switch updating `drivers` table `is_online` status.
- [ ] **Vehicle Configuration**: Select vehicle type during signup.

### 2. Admin Console (Web)
- [ ] **Verification Dashboard**:
  - List "Pending" drivers.
  - Document Viewer (Zoomable images of IDs).
  - Approve/Reject actions (Triggers Push Notification to Driver).
- [ ] **Driver Management**: View all registered drivers, ban/suspend capability.

---

## 📅 Week 3: The "Porter" Engine - Location & Realtime
**Goal**: Implement real-time tracking and the booking algorithm.

### 1. Real-Time Infrastructure (Supabase)
- [ ] **Geospatial Database**: Enable PostGIS extension.
- [ ] **Location Table**: `driver_locations` (Driver ID, Geography Point, Timestamp).
- [ ] **Indexing**: Create GiST index on location column for high-speed queries.

### 2. Driver App
- [ ] **Background Tracking**: Implement `expo-location` background service.
- [ ] **Heartbeat**: Ping DB with location every 10s (when online).

### 3. Customer App
- [ ] **Live Map**: Subscribe to Supabase Realtime for `driver_locations` updates.
- [ ] **"Find Truck"**: Query PostGIS `st_dwithin` to show available vehicles nearby.
- [ ] **Booking Request UX**: Select Pickup/Drop -> Choose Vehicle -> "Book Now".

---

## 📅 Week 4: Transactions & Trip Lifecycle
**Goal**: Handle payments (Cashfree) and the physical delivery workflow.

### 1. Dynamic Pricing (Edge Function)
- [ ] Logic: `Base Fare` + (`Distance` * `Per Km Rate`) + `Time Factor` + `Surge`.
- [ ] Distance Matrix: Integrate Google Routes API for accurate km/time.

### 2. Cashfree Integration
- [ ] **Backend**: Edge function `create-payment-order` to generate secure tokens.
- [ ] **Customer App**: Cashfree SDK integration (UPI/Card/Netbanking).
- [ ] **Webhook**: Handle `PAYMENT_SUCCESS` -> Update Booking status -> Notify Driver.

### 3. Trip Workflow
- [ ] **Flow**:
  1. `SEARCHING`: Customer waits.
  2. `OFFER`: Nearest drivers get pop-up (Round Robin or Broadcast).
  3. `ACCEPTED`: Driver assigned.
  4. `ARRIVED`: Notification to customer.
  5. `OTP START`: Customer shares OTP -> Trip Starts (Prevents theft).
  6. `COMPLETED`: Pay & Rate.

---

## 📅 Week 5: Professional Features (Safety, Support, Analytics)
**Goal**: Implement the robust "additive" features for a complete logistics platform.

### 1. Safety & Support (Crucial for Trust)
- [ ] **SOS Button**: Customer App (Floating Action Button). One-tap trigger to `sos-alert` function -> SMS to contacts.
- [ ] **Support System**:
  - In-App "Help" section creating rows in `support_tickets`.
  - Admin Dashboard "Support" tab to chat/resolve tickets.

### 2. Notifications (FCM)
- [ ] **System**: Supabase Database Webhooks -> Trigger Edge Function -> Send to Firebase Cloud Messaging.
- [ ] **Triggers**: "Driver Found", "Driver Arrived", "Payment Received", "Support Reply".

### 3. Analytics & Reporting (Admin)
- [ ] **Database Views**: Create SQL Views for `daily_revenue`, `active_drivers`, `cancelled_trips`.
- [ ] **Visuals**: Dashboard Charts showing performance trends and heatmaps.

---

## 📅 Week 6: Polish, Testing & Deployment
**Goal**: Ensure stability and release to production.

### 1. Security & Performance Audit
- [ ] **Audit**: Verify every RLS policy. Ensure no unauthorized data access.
- [ ] **Performance**: SQL `EXPLAIN ANALYZE` on tracking queries. Optimize indexes.

### 2. App Polish
- [ ] **Offline Handling**: Graceful error messages and retry logic when network drops.
- [ ] **Loading States**: Skeleton screens instead of spinners for better UX.

### 3. Launch
- [ ] **Admin**: Deploy to Vercel/Netlify.
- [ ] **Mobile**: Build `.aab` (Android) and `.ipa` (iOS) via EAS Build.
- [ ] **Store**: Submit store listings to Play Store & App Store.
