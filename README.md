# CARTR - Complete Logistics Platform

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm or npm
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`npm install -g supabase`)
- EAS CLI (`npm install -g eas-cli`)

### Installation

```bash
# Clone and install
cd Cart-R-main
npm install

# Install app dependencies
cd apps/customer && npm install
cd ../driver && npm install
cd ../admin && npm install
```

### Environment Setup

Create `.env` files in each app with:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key

# Cashfree
EXPO_PUBLIC_CASHFREE_APP_ID=your_app_id
```

### Running Apps

```bash
# Customer App
cd apps/customer && npx expo start

# Driver App
cd apps/driver && npx expo start

# Admin Console
cd apps/admin && npm run dev
```

### Deploy Edge Functions

```bash
cd supabase
supabase login
supabase functions deploy calculate-fare
supabase functions deploy create-payment-order
supabase functions deploy assign-driver
supabase functions deploy payment-webhook
supabase functions deploy send-notification
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CARTR PLATFORM                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Customer App   │   Driver App    │     Admin Console       │
│  (React Native) │  (React Native) │       (Next.js)         │
├─────────────────┴─────────────────┴─────────────────────────┤
│                     Supabase Backend                        │
│  ┌─────────┬─────────┬──────────┬──────────┬─────────────┐  │
│  │  Auth   │Database │ Realtime │ Storage  │Edge Functions│ │
│  │ (Phone) │(PostGIS)│(Location)│  (Docs)  │   (APIs)    │  │
│  └─────────┴─────────┴──────────┴──────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   External Services                         │
│  ┌───────────┬─────────────────┬──────────────────────────┐ │
│  │  Cashfree │  Google Maps    │    Expo Push             │ │
│  │ (Payments)│ (Routes/Places) │   (Notifications)        │ │
│  └───────────┴─────────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features Implemented

### Week 1: Backend APIs ✅
- `calculate-fare` - Dynamic pricing with distance/duration
- `create-payment-order` - Cashfree integration
- `assign-driver` - PostGIS nearby driver search
- `payment-webhook` - Payment confirmation handling
- `send-notification` - Expo push notifications

### Week 2: Driver Ecosystem ✅
- Phone OTP authentication
- Document upload (DL, RC, Insurance)
- Verification status with real-time updates
- Online/offline toggle

### Week 3: Real-Time Tracking ✅
- Background GPS tracking (expo-location)
- Live driver location subscription
- Nearby drivers on map
- ETA calculation

### Week 4: Payments & Trip ✅
- Cashfree payment flow
- Complete booking lifecycle
- OTP verification at pickup
- Trip history and ratings

### Week 5: Professional Features ✅
- SOS/Emergency alerts
- Support ticket system
- Push notifications
- Admin analytics dashboard
- Ratings and reviews

### Week 6: Polish & Launch ✅
- Comprehensive RLS policies
- Audit logging
- Error handling utilities
- Performance optimization
- EAS build configuration

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All user profiles |
| `drivers` | Driver details, verification, location |
| `bookings` | Trip bookings with status |
| `driver_locations` | Location history |
| `notifications` | Push notification records |
| `support_tickets` | Customer support |
| `emergency_contacts` | SOS contacts |
| `emergency_alerts` | SOS alert logs |
| `fare_config` | Pricing configuration |
| `audit_logs` | Security audit trail |

---

## API Reference

### Edge Functions

| Function | Method | Purpose |
|----------|--------|---------|
| `/calculate-fare` | POST | Calculate trip fare |
| `/create-payment-order` | POST | Create Cashfree order |
| `/assign-driver` | POST | Find & assign driver |
| `/payment-webhook` | POST | Handle payment callback |
| `/send-notification` | POST | Send push notification |

---

## Build & Deploy

### Mobile Apps (EAS Build)

```bash
# Development build
cd apps/customer
eas build --profile development --platform android

# Production build
eas build --profile production --platform all
```

### Admin Console (Vercel)

```bash
cd apps/admin
vercel
```

---

## Security

- Row Level Security (RLS) on all tables
- Audit logging for sensitive operations
- Webhook signature verification
- Service role for admin operations

---

## Support

For issues, create a support ticket in the app or contact admin.
