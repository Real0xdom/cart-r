# Missing Features Implementation Plan
## CartR Logistics App - Feature Enhancement

**Date:** February 12, 2026  
**Status:** Planning Phase  
**Priority:** High

---

## Executive Summary

This document outlines the implementation plan for 8 missing/incomplete features identified in the CartR customer and driver apps. The plan includes database schema changes, backend logic, and frontend UI updates.

---

## Database Schema Analysis

### ✅ Current Schema Strengths:
- `bookings` table has comprehensive fields for trip management
- `fare_config` table supports multiple vehicle types
- `ratings` table exists for feedback (bidirectional support)
- `users` table has `balance` field for wallet functionality
- `wallet_transactions` table for payment tracking

### ❌ Schema Gaps Identified:

1. **No service area/geofencing tables** - Need location restrictions
2. **No waiting charges tracking** - Missing in bookings table
3. **No addon services** - No table for load/unload helpers
4. **No terms acceptance tracking** - Missing user consent records
5. **Missing vehicle types** - Only 4 types in enum (need 8 total)

---

## Feature Implementation Plan


### Feature 1: Location Restriction / Service Area Geofencing

**Priority:** HIGH  
**Estimated Time:** 3-4 days  
**Complexity:** Medium

#### Database Changes Required:

```sql
-- New table for service areas
CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar NOT NULL,
  city varchar NOT NULL,
  state varchar NOT NULL,
  country varchar DEFAULT 'India',
  geometry geography(POLYGON, 4326) NOT NULL, -- PostGIS polygon
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for spatial queries
CREATE INDEX idx_service_areas_geometry ON public.service_areas USING GIST(geometry);

-- Function to check if point is in service area
CREATE OR REPLACE FUNCTION is_location_in_service_area(
  lat numeric,
  lng numeric
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM service_areas
    WHERE is_active = true
    AND ST_Contains(
      geometry::geometry,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  );
END;
$$ LANGUAGE plpgsql;
```

#### Backend Implementation:

**File:** `supabase/functions/validate-location/index.ts` (NEW)
- Create edge function to validate pickup/dropoff locations
- Return service area name if valid, error if outside

**File:** `supabase/functions/calculate-fare/index.ts` (UPDATE)
- Add location validation before fare calculation
- Return specific error for out-of-service locations


#### Frontend Implementation:

**Customer App:**
- `apps/customer/app/book-ride.tsx` - Add location validation
- `apps/customer/lib/location.ts` - Create `validateServiceArea()` function
- Show error modal if location is outside service area
- Suggest nearest supported city

**Driver App:**
- `apps/driver/app/onboarding/vehicle-info.tsx` - Validate driver's base location
- Only allow registration in supported cities

#### UI/UX Flow:
1. User enters pickup location
2. App validates against service areas
3. If invalid: Show modal "Service not available in [City]. We currently serve: [List]"
4. If valid: Proceed to destination entry
5. Repeat validation for destination

---

### Feature 2: Terms & Conditions Acceptance Checkbox

**Priority:** HIGH (Legal Compliance)  
**Estimated Time:** 1-2 days  
**Complexity:** Low

#### Database Changes Required:

```sql
-- New table for terms acceptance tracking
CREATE TABLE public.user_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id),
  terms_version varchar NOT NULL, -- e.g., "v1.0", "v2.0"
  accepted_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text,
  CONSTRAINT user_terms_acceptance_unique UNIQUE(user_id, terms_version)
);

-- Add terms_accepted flag to users table
ALTER TABLE public.users 
ADD COLUMN terms_accepted boolean DEFAULT false,
ADD COLUMN terms_accepted_at timestamptz;
```


#### Frontend Implementation:

**Customer App:**
- `apps/customer/app/register.tsx` - Add checkbox before "Register" button
- `apps/customer/app/sign-in.tsx` - Check if existing user accepted latest terms
- Create `apps/customer/components/TermsCheckbox.tsx` component

**Driver App:**
- `apps/driver/app/onboarding/personal-info.tsx` - Add terms checkbox
- Block onboarding until terms are accepted

#### Component Structure:

```tsx
<View className="flex-row items-start mb-4">
  <TouchableOpacity onPress={() => setAccepted(!accepted)}>
    <View className={`w-6 h-6 rounded border-2 ${accepted ? 'bg-green-500' : 'bg-white'}`}>
      {accepted && <Feather name="check" size={16} color="white" />}
    </View>
  </TouchableOpacity>
  <Text className="ml-3 text-gray-600">
    I agree to the{' '}
    <Text 
      className="text-blue-500 underline"
      onPress={() => router.push('/terms')}
    >
      Terms & Conditions
    </Text>
  </Text>
</View>
```

---

### Feature 3: Additional Vehicle Types

**Priority:** MEDIUM  
**Estimated Time:** 2 days  
**Complexity:** Low-Medium

#### Database Changes Required:

```sql
-- Update vehicle_type enum to include all types
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'three_wheeler';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'chota_hathi';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'pickup';

-- Add fare configurations for new vehicle types
INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, driver_search_radius_km)
VALUES 
  ('three_wheeler', 40, 12, 1.5, 50, 8),
  ('chota_hathi', 150, 18, 2.5, 200, 12),
  ('pickup', 120, 15, 2.0, 150, 10);
```


#### Frontend Implementation:

**Customer App:**
- `apps/customer/app/select-vehicle.tsx` - Update vehicle icons and descriptions
- `apps/customer/constants/index.ts` - Add vehicle emojis/icons

**Driver App:**
- `apps/driver/app/onboarding/vehicle-info.tsx` - Add new vehicle types to dropdown

#### Vehicle Icon Mapping:

```typescript
const vehicleEmojis: Record<string, string> = {
  bike: '🏍️',
  three_wheeler: '🛺',
  tempo: '🚐',
  chota_hathi: '🚛',
  pickup: '🚙',
  sedan: '🚗',
  truck: '🚚',
};

const vehicleDescriptions: Record<string, string> = {
  bike: 'Small packages up to 20kg',
  three_wheeler: 'Light goods up to 300kg',
  tempo: 'Medium loads up to 500kg',
  chota_hathi: 'Heavy goods up to 1500kg',
  pickup: 'Furniture & large items',
  sedan: 'Documents & small parcels',
  truck: 'Heavy goods moving',
};
```

---

### Feature 4: Waiting Charges (₹100/hour)

**Priority:** MEDIUM  
**Estimated Time:** 3 days  
**Complexity:** Medium

#### Database Changes Required:

```sql
-- Add waiting time tracking to bookings table
ALTER TABLE public.bookings 
ADD COLUMN waiting_start_time timestamptz,
ADD COLUMN waiting_end_time timestamptz,
ADD COLUMN waiting_duration_minutes integer DEFAULT 0,
ADD COLUMN waiting_charges numeric DEFAULT 0,
ADD COLUMN free_waiting_minutes integer DEFAULT 15; -- First 15 mins free

-- Update total_fare calculation trigger
CREATE OR REPLACE FUNCTION calculate_booking_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_fare = COALESCE(NEW.base_fare, 0) 
                 + COALESCE(NEW.distance_fare, 0)
                 + COALESCE(NEW.time_fare, 0)
                 + COALESCE(NEW.waiting_charges, 0)
                 + COALESCE(NEW.tip_amount, 0)
                 - COALESCE(NEW.discount_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```


#### Backend Implementation:

**File:** `supabase/functions/calculate-waiting-charges/index.ts` (NEW)
- Calculate waiting time from driver_arrived_at to started_at
- Apply ₹100/hour rate (₹1.67/minute)
- First 15 minutes free

**File:** `apps/driver/lib/bookings.ts` (UPDATE)
- Add `startWaitingTimer()` function when driver arrives
- Add `stopWaitingTimer()` function when trip starts
- Calculate charges automatically

#### Frontend Implementation:

**Driver App:**
- `apps/driver/app/ride/[id].tsx` - Show waiting timer when status is "driver_arrived"
- Display: "Waiting: 12 mins (Free: 15 mins)" or "Waiting: 20 mins (₹8.35 charges)"
- Auto-update every minute

**Customer App:**
- `apps/customer/app/track-ride.tsx` - Show waiting charges if applicable
- Display warning: "Driver is waiting. Charges apply after 15 minutes (₹100/hour)"

#### Calculation Logic:

```typescript
function calculateWaitingCharges(
  arrivedAt: Date,
  startedAt: Date,
  freeMinutes: number = 15
): number {
  const waitingMinutes = Math.floor(
    (startedAt.getTime() - arrivedAt.getTime()) / 60000
  );
  
  if (waitingMinutes <= freeMinutes) return 0;
  
  const chargeableMinutes = waitingMinutes - freeMinutes;
  const ratePerMinute = 100 / 60; // ₹1.67/min
  
  return Math.round(chargeableMinutes * ratePerMinute);
}
```

---

### Feature 5: Addon Services (Load/Unload Helper)

**Priority:** MEDIUM  
**Estimated Time:** 3-4 days  
**Complexity:** Medium

#### Database Changes Required:

```sql
-- New table for addon services
CREATE TABLE public.addon_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar NOT NULL,
  description text,
  price numeric NOT NULL,
  is_active boolean DEFAULT true,
  applicable_vehicle_types vehicle_type[] DEFAULT ARRAY[]::vehicle_type[],
  created_at timestamptz DEFAULT now()
);

-- Insert default addons
INSERT INTO addon_services (name, description, price, applicable_vehicle_types)
VALUES 
  ('Load Helper', 'Helper for loading goods', 100, ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[]),
  ('Unload Helper', 'Helper for unloading goods', 100, ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[]),
  ('Both Load & Unload', 'Helper for both loading and unloading', 150, ARRAY['tempo', 'chota_hathi', 'pickup', 'truck']::vehicle_type[]);
```


```sql
-- Junction table for booking addons
CREATE TABLE public.booking_addons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES addon_services(id),
  quantity integer DEFAULT 1,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT booking_addons_unique UNIQUE(booking_id, addon_id)
);

-- Add addon_charges to bookings table
ALTER TABLE public.bookings 
ADD COLUMN addon_charges numeric DEFAULT 0;

-- Update total calculation trigger to include addons
```

#### Frontend Implementation:

**Customer App:**
- `apps/customer/app/select-vehicle.tsx` - Add addon selection section
- Show checkboxes for applicable addons based on vehicle type
- Update total fare dynamically

**Component Structure:**

```tsx
{selectedVehicle && ['tempo', 'chota_hathi', 'pickup', 'truck'].includes(selectedVehicle.vehicle_type) && (
  <View className="bg-gray-50 rounded-2xl p-4 mt-4">
    <Text className="font-JakartaBold text-base mb-3">Add Helper Services</Text>
    
    <TouchableOpacity 
      onPress={() => toggleAddon('load_helper')}
      className="flex-row items-center mb-3"
    >
      <View className={`w-6 h-6 rounded border-2 ${addons.load_helper ? 'bg-brand-500' : 'bg-white'}`}>
        {addons.load_helper && <Feather name="check" size={16} color="white" />}
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-JakartaSemiBold">Load Helper</Text>
        <Text className="text-xs text-gray-500">Helper for loading goods</Text>
      </View>
      <Text className="font-JakartaBold text-brand-500">+₹100</Text>
    </TouchableOpacity>
    
    {/* Similar for unload_helper and both */}
  </View>
)}
```

---

### Feature 6: Payment Invoice Generation

**Priority:** MEDIUM  
**Estimated Time:** 2 days  
**Complexity:** Low-Medium

#### Database Changes Required:

```sql
-- Add invoice fields to bookings
ALTER TABLE public.bookings 
ADD COLUMN invoice_number varchar UNIQUE,
ADD COLUMN invoice_generated_at timestamptz,
ADD COLUMN invoice_url text;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS varchar AS $$
DECLARE
  year_month varchar;
  sequence_num integer;
BEGIN
  year_month := TO_CHAR(NOW(), 'YYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 10) AS integer)), 0) + 1
  INTO sequence_num
  FROM bookings
  WHERE invoice_number LIKE 'INV-' || year_month || '%';
  
  RETURN 'INV-' || year_month || '-' || LPAD(sequence_num::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
```


#### Backend Implementation:

**File:** `supabase/functions/generate-invoice/index.ts` (NEW)
- Generate PDF invoice using a template
- Include: booking details, fare breakdown, GST, company info
- Store in Supabase Storage
- Return download URL

#### Frontend Implementation:

**Customer App:**
- `apps/customer/app/ride-details/[id].tsx` - Add "Download Invoice" button
- `apps/customer/components/InvoiceModal.tsx` - Show invoice preview
- Allow sharing via WhatsApp/Email

**Invoice Template Structure:**
```
┌─────────────────────────────────────┐
│ CARTR LOGISTICS                     │
│ Tax Invoice                         │
│ INV-2602-00123                      │
├─────────────────────────────────────┤
│ Customer: [Name]                    │
│ Booking: [Number]                   │
│ Date: [Date]                        │
├─────────────────────────────────────┤
│ Base Fare:           ₹150.00        │
│ Distance Fare:       ₹240.00        │
│ Time Fare:           ₹45.00         │
│ Waiting Charges:     ₹50.00         │
│ Addon Services:      ₹100.00        │
│ Tip:                 ₹20.00         │
│ ─────────────────────────────       │
│ Subtotal:            ₹605.00        │
│ GST (18%):           ₹108.90        │
│ ─────────────────────────────       │
│ TOTAL PAID:          ₹713.90        │
└─────────────────────────────────────┘
```

---

### Feature 7: Driver Feedback System

**Priority:** LOW  
**Estimated Time:** 2 days  
**Complexity:** Low

#### Database Changes:
✅ **No changes needed** - `ratings` table already supports bidirectional ratings with `is_from_customer` flag

#### Frontend Implementation:

**Driver App:**
- `apps/driver/app/ride/collect-payment.tsx` - Add rating screen after payment
- Create `apps/driver/components/RateCustomer.tsx` component
- Similar to customer rating but for driver to rate customer

**Rating Categories for Customers:**
- Punctuality
- Goods condition
- Cooperation
- Payment method

```tsx
const CUSTOMER_RATING_TIPS = [
  '👍 On time',
  '📦 Goods well packed',
  '🤝 Cooperative',
  '💳 Smooth payment',
  '📍 Clear location',
  '😊 Polite',
];
```


---

### Feature 8: Enhanced Nearby Driver Animation

**Priority:** LOW  
**Estimated Time:** 1 day  
**Complexity:** Low

#### Implementation:
✅ **Already implemented** in `apps/customer/components/NearbyDriversMap.tsx`

**Enhancements to add:**
- Smooth marker transitions using `react-native-maps` animations
- Pulsing effect for driver markers
- Different colors for different vehicle types
- Show driver count badge

```tsx
// Enhanced marker with animation
<Marker
  coordinate={driverCoords}
  anchor={{ x: 0.5, y: 0.5 }}
>
  <Animated.View
    style={{
      transform: [{ scale: pulseAnim }],
    }}
  >
    <View className="bg-green-500 p-2 rounded-full border-2 border-white shadow-lg">
      <Text className="text-xl">{vehicleEmojis[driver.vehicle_type]}</Text>
    </View>
  </Animated.View>
</Marker>
```

---

## Implementation Timeline

### Phase 1: Critical Features (Week 1-2)
- ✅ Feature 1: Location Restrictions (4 days)
- ✅ Feature 2: Terms Acceptance (2 days)
- ✅ Feature 3: Vehicle Types (2 days)

### Phase 2: Revenue Features (Week 3)
- ✅ Feature 4: Waiting Charges (3 days)
- ✅ Feature 5: Addon Services (4 days)

### Phase 3: User Experience (Week 4)
- ✅ Feature 6: Invoice Generation (2 days)
- ✅ Feature 7: Driver Feedback (2 days)
- ✅ Feature 8: Animation Enhancement (1 day)

**Total Estimated Time:** 20 working days (4 weeks)

---

## Migration Strategy

### Step 1: Database Migrations
```bash
# Create migration files in order
supabase/migrations/028_service_areas.sql
supabase/migrations/029_terms_acceptance.sql
supabase/migrations/030_vehicle_types.sql
supabase/migrations/031_waiting_charges.sql
supabase/migrations/032_addon_services.sql
supabase/migrations/033_invoice_generation.sql
```

### Step 2: Backend Deployment
- Deploy edge functions one by one
- Test each function in sandbox environment
- Monitor error logs

### Step 3: Frontend Rollout
- Update customer app first (more users)
- Then update driver app
- Use feature flags for gradual rollout


---

## Testing Checklist

### Feature 1: Location Restrictions
- [ ] Test with coordinates inside service area
- [ ] Test with coordinates outside service area
- [ ] Test boundary edge cases
- [ ] Test with invalid coordinates
- [ ] Verify error messages are user-friendly

### Feature 2: Terms Acceptance
- [ ] New user cannot proceed without accepting terms
- [ ] Existing users prompted for new terms version
- [ ] Terms acceptance logged with timestamp
- [ ] "Read More" link opens terms page
- [ ] Checkbox state persists on screen rotation

### Feature 3: Vehicle Types
- [ ] All 7 vehicle types show in selection
- [ ] Fare calculation works for each type
- [ ] Driver can register with new vehicle types
- [ ] Icons display correctly
- [ ] Descriptions are accurate

### Feature 4: Waiting Charges
- [ ] Timer starts when driver marks "Arrived"
- [ ] First 15 minutes are free
- [ ] Charges calculated correctly (₹100/hour)
- [ ] Timer stops when trip starts
- [ ] Charges added to total fare
- [ ] Customer sees waiting charges breakdown

### Feature 5: Addon Services
- [ ] Addons show only for applicable vehicles
- [ ] Multiple addons can be selected
- [ ] Prices update total fare correctly
- [ ] Addons saved with booking
- [ ] Driver sees selected addons
- [ ] Invoice includes addon charges

### Feature 6: Invoice Generation
- [ ] Invoice generated after payment
- [ ] Unique invoice number assigned
- [ ] All charges itemized correctly
- [ ] GST calculated properly
- [ ] PDF downloadable
- [ ] Shareable via WhatsApp/Email

### Feature 7: Driver Feedback
- [ ] Driver can rate customer after trip
- [ ] Rating saved to database
- [ ] Customer rating visible in profile
- [ ] Cannot rate same trip twice
- [ ] Rating affects customer score

### Feature 8: Animation Enhancement
- [ ] Markers animate smoothly
- [ ] Pulsing effect works
- [ ] Different colors for vehicle types
- [ ] Performance is smooth with 20+ drivers
- [ ] Map doesn't lag

---

## Risk Assessment

### High Risk
1. **Location Restrictions** - May block legitimate users if boundaries are too strict
   - Mitigation: Start with generous boundaries, refine based on data

2. **Waiting Charges** - May cause customer complaints
   - Mitigation: Clear communication, prominent timer display

### Medium Risk
3. **Vehicle Type Enum** - Altering enums can be tricky in production
   - Mitigation: Test thoroughly in staging, have rollback plan

4. **Addon Services** - Complex pricing logic
   - Mitigation: Extensive unit tests for fare calculations

### Low Risk
5. **Terms Acceptance** - Straightforward implementation
6. **Invoice Generation** - Standard feature
7. **Driver Feedback** - Uses existing infrastructure
8. **Animation** - UI enhancement only

---

## Success Metrics

### Feature 1: Location Restrictions
- 0% bookings from unsupported areas
- <5% user complaints about restrictions

### Feature 2: Terms Acceptance
- 100% new users accept terms
- Legal compliance achieved

### Feature 3: Vehicle Types
- 20% increase in vehicle type diversity
- More driver registrations

### Feature 4: Waiting Charges
- Average waiting time reduced by 30%
- Driver earnings increase by 5-10%

### Feature 5: Addon Services
- 15-20% addon attachment rate
- ₹50-100 increase in average order value

### Feature 6: Invoice Generation
- 90% invoice download rate
- Reduced support tickets about receipts

### Feature 7: Driver Feedback
- 80% rating completion rate
- Improved customer behavior

### Feature 8: Animation
- Improved app store ratings
- Better user engagement

---

## Dependencies & Prerequisites

### Technical Requirements
- ✅ Supabase PostGIS extension enabled
- ✅ Supabase Storage configured
- ✅ Edge Functions deployed
- ✅ React Native Maps installed
- ✅ Expo Location permissions

### Team Requirements
- 1 Backend Developer (Database + Edge Functions)
- 1 Frontend Developer (React Native)
- 1 QA Engineer (Testing)
- 1 Product Manager (Requirements & UAT)

### External Dependencies
- PostGIS for geofencing
- PDF generation library (e.g., react-native-pdf)
- Map animation library

---

## Rollback Plan

If any feature causes critical issues:

1. **Immediate Actions:**
   - Disable feature via feature flag
   - Revert to previous app version
   - Notify users of temporary unavailability

2. **Database Rollback:**
   - Keep migration rollback scripts ready
   - Backup database before each migration
   - Test rollback in staging first

3. **Communication:**
   - Status page update
   - In-app notification
   - Support team briefing

---

## Next Steps

1. **Review & Approval** - Get stakeholder sign-off on this plan
2. **Resource Allocation** - Assign developers to features
3. **Environment Setup** - Prepare staging environment
4. **Sprint Planning** - Break down into 2-week sprints
5. **Kickoff Meeting** - Align team on priorities and timeline

---

## Appendix

### A. Database Schema Additions Summary

**New Tables:** 3
- `service_areas`
- `user_terms_acceptance`
- `addon_services`
- `booking_addons`

**Modified Tables:** 2
- `bookings` (7 new columns)
- `users` (2 new columns)

**New Functions:** 3
- `is_location_in_service_area()`
- `generate_invoice_number()`
- `calculate_booking_total()` (updated)

**New Enum Values:** 3
- `three_wheeler`
- `chota_hathi`
- `pickup`

### B. File Changes Summary

**New Files:** 15+
**Modified Files:** 20+
**Total Lines of Code:** ~3,000 LOC

---

**Document Version:** 1.0  
**Last Updated:** February 12, 2026  
**Author:** Development Team  
**Status:** Ready for Implementation
