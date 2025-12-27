# CARTR Backend & API Documentation

## Quick Reference

| What | Where |
|------|-------|
| Supabase URL | `EXPO_PUBLIC_SUPABASE_URL` |
| Anon Key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Functions Base | `{SUPABASE_URL}/functions/v1/` |

---

## 1. Authentication

### Phone OTP Login
```typescript
// Step 1: Send OTP
const { error } = await supabase.auth.signInWithOtp({
  phone: '+919876543210'
});

// Step 2: Verify OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+919876543210',
  token: '123456',
  type: 'sms'
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();
```

---

## 2. Database Tables

### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (matches auth.users) |
| email | varchar | User email |
| name | varchar | Full name |
| phone | varchar | Phone number |
| role | enum | `customer`, `driver`, `admin` |
| avatar_url | text | Profile photo URL |
| expo_push_token | text | Push notification token |

### `drivers`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| vehicle_type | enum | `bike`, `auto`, `mini`, `sedan`, `suv`, `truck` |
| vehicle_number | varchar | Registration plate |
| vehicle_model | varchar | Model name |
| license_number | varchar | DL number |
| verification_status | enum | `pending`, `approved`, `rejected` |
| is_online | boolean | Available for rides |
| current_latitude | numeric | Live location |
| current_longitude | numeric | Live location |
| rating | numeric | Average rating (1-5) |

### `bookings`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| booking_number | varchar | Human-readable ID |
| customer_id | uuid | FK to users |
| driver_id | uuid | FK to drivers |
| origin_address | text | Pickup address |
| origin_latitude | numeric | Pickup coordinates |
| origin_longitude | numeric | Pickup coordinates |
| destination_address | text | Drop address |
| destination_latitude | numeric | Drop coordinates |
| destination_longitude | numeric | Drop coordinates |
| vehicle_type | enum | Selected vehicle |
| total_fare | numeric | Final amount |
| status | enum | See status values below |
| payment_status | enum | `pending`, `paid`, `failed` |
| pickup_otp | varchar | 4-digit verification code |

**Booking Status Flow**: 
```
pending → accepted → driver_arrived → in_progress → completed
                                                  → cancelled
```

### `fare_config`
| Column | Type | Description |
|--------|------|-------------|
| vehicle_type | enum | Vehicle type |
| base_fare | numeric | Starting fare |
| per_km_rate | numeric | Price per km |
| per_minute_rate | numeric | Price per minute |
| minimum_fare | numeric | Minimum charge |

### `support_tickets`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| subject | varchar | Issue title |
| description | text | Details |
| status | enum | `open`, `in_progress`, `resolved`, `closed` |
| priority | enum | `low`, `medium`, `high`, `urgent` |

### `emergency_contacts`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| name | varchar | Contact name |
| phone | varchar | Phone number |
| relationship | varchar | Relation type |
| is_primary | boolean | Primary contact |

---

## 3. Edge Functions API

### Calculate Fare
**Endpoint:** `POST /functions/v1/calculate-fare`

```json
// Request
{
  "origin_lat": 12.9716,
  "origin_lng": 77.5946,
  "destination_lat": 12.9352,
  "destination_lng": 77.6245,
  "vehicle_type": "mini"
}

// Response
{
  "distance_km": 5.2,
  "duration_min": 18,
  "base_fare": 50,
  "distance_fare": 52,
  "time_fare": 18,
  "total_fare": 120,
  "vehicle_type": "mini"
}
```

---

### Create Payment Order
**Endpoint:** `POST /functions/v1/create-payment-order`

```json
// Request
{
  "booking_id": "uuid",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "9876543210",
  "amount": 120
}

// Response
{
  "order_id": "cartr_abc123",
  "payment_session_id": "session_xyz",
  "order_status": "ACTIVE"
}
```

---

### Assign Driver
**Endpoint:** `POST /functions/v1/assign-driver`

```json
// Request
{
  "booking_id": "uuid",
  "origin_lat": 12.9716,
  "origin_lng": 77.5946,
  "vehicle_type": "mini",
  "radius_km": 5
}

// Response
{
  "success": true,
  "driver": {
    "id": "uuid",
    "name": "Rahul",
    "phone": "9876543210",
    "vehicle_number": "KA-01-1234",
    "rating": 4.8,
    "distance_km": 1.2,
    "eta_minutes": 4
  }
}
```

---

### Send Notification
**Endpoint:** `POST /functions/v1/send-notification`

```json
// Request
{
  "user_id": "uuid",
  "title": "Driver Arrived",
  "body": "Your driver is at the pickup point",
  "data": {
    "type": "driver_arrived",
    "booking_id": "uuid"
  }
}
```

---

## 4. Common Queries

### Create Booking
```typescript
const { data, error } = await supabase
  .from('bookings')
  .insert({
    customer_id: user.id,
    origin_address: 'MG Road',
    origin_latitude: 12.97,
    origin_longitude: 77.59,
    destination_address: 'Airport',
    destination_latitude: 13.19,
    destination_longitude: 77.70,
    vehicle_type: 'mini',
    total_fare: 350,
    status: 'pending',
    pickup_otp: Math.floor(1000 + Math.random() * 9000).toString()
  })
  .select()
  .single();
```

### Get Nearby Drivers (PostGIS)
```typescript
const { data } = await supabase.rpc('find_nearby_drivers', {
  lat: 12.97,
  lng: 77.59,
  radius_km: 5,
  v_type: 'mini'
});
```

### Update Driver Location
```typescript
await supabase
  .from('drivers')
  .update({
    current_latitude: lat,
    current_longitude: lng,
    last_location_update: new Date().toISOString()
  })
  .eq('user_id', user.id);
```

### Get User Bookings
```typescript
const { data } = await supabase
  .from('bookings')
  .select(`
    *,
    driver:drivers(
      vehicle_number,
      user:users(name, phone)
    )
  `)
  .eq('customer_id', user.id)
  .order('created_at', { ascending: false });
```

### Update Booking Status
```typescript
await supabase
  .from('bookings')
  .update({ status: 'accepted', accepted_at: new Date().toISOString() })
  .eq('id', bookingId);
```

---

## 5. Real-Time Subscriptions

### Subscribe to Booking
```typescript
const channel = supabase
  .channel('booking-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'bookings',
    filter: `id=eq.${bookingId}`
  }, (payload) => {
    console.log('New status:', payload.new.status);
  })
  .subscribe();

// Cleanup
channel.unsubscribe();
```

### Subscribe to Driver Location
```typescript
const channel = supabase
  .channel('driver-location')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'drivers',
    filter: `id=eq.${driverId}`
  }, (payload) => {
    const { current_latitude, current_longitude } = payload.new;
    // Update map marker
  })
  .subscribe();
```

---

## 6. Storage Buckets

| Bucket | Purpose | Path Format |
|--------|---------|-------------|
| `driver-documents` | License, RC, Insurance | `{userId}/license.jpg` |
| `profile-photos` | User avatars | `{userId}/avatar.jpg` |
| `vehicle-photos` | Vehicle images | `{driverId}/vehicle.jpg` |

### Upload Example
```typescript
const { data, error } = await supabase.storage
  .from('driver-documents')
  .upload(`${userId}/license.jpg`, file, {
    contentType: 'image/jpeg'
  });

// Get URL
const { data: { publicUrl } } = supabase.storage
  .from('driver-documents')
  .getPublicUrl(`${userId}/license.jpg`);
```

---

## 7. Environment Variables

### Mobile Apps (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
EXPO_PUBLIC_CASHFREE_APP_ID=...
```

### Supabase Edge Function Secrets
```
CASHFREE_APP_ID
CASHFREE_SECRET_KEY
GOOGLE_MAPS_API_KEY
```

---

## 8. Notification Types

| type | Trigger | Data |
|------|---------|------|
| `new_ride_request` | New booking | booking_id |
| `ride_accepted` | Driver accepts | booking_id |
| `driver_arrived` | At pickup | booking_id |
| `trip_started` | OTP verified | booking_id |
| `trip_completed` | Ride ends | booking_id, fare |
| `payment_success` | Payment done | booking_id |
| `verification_approved` | Admin approves | - |
| `verification_rejected` | Admin rejects | reason |

---

## 9. Useful CLI Commands

```bash
# Deploy all Edge Functions
cd Cart-R-main
supabase functions deploy calculate-fare create-payment-order assign-driver payment-webhook send-notification

# View function logs
supabase functions logs calculate-fare

# Push DB migrations
supabase db push

# Generate types
supabase gen types typescript --local > types/supabase.ts
```
