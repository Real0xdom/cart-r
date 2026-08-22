# Quick Start Guide - Missing Features Implementation

## Priority Order (Start Here)

### 🔴 CRITICAL (Week 1)
1. **Terms & Conditions Checkbox** - Legal requirement, easiest to implement
2. **Location Restrictions** - Prevent out-of-area bookings
3. **Vehicle Types** - Expand service offerings

### 🟡 IMPORTANT (Week 2-3)
4. **Waiting Charges** - Revenue generation
5. **Addon Services** - Increase order value

### 🟢 NICE TO HAVE (Week 4)
6. **Invoice Generation** - Better UX
7. **Driver Feedback** - Improve quality
8. **Animation Polish** - Visual enhancement

---

## Day 1 Action Items

### Backend Developer
```bash
# 1. Create first migration
cd supabase/migrations
touch 028_terms_acceptance.sql

# 2. Add terms acceptance table
# Copy SQL from implementation plan

# 3. Test migration
supabase db reset --local
```

### Frontend Developer
```bash
# 1. Create terms checkbox component
cd apps/customer/components
touch TermsCheckbox.tsx

# 2. Update registration screen
# Add checkbox to apps/customer/app/register.tsx

# 3. Test locally
npm run android # or ios
```

---

## Database Migration Order

Run these in sequence:

```bash
028_terms_acceptance.sql       # Day 1
029_service_areas.sql          # Day 2-3
030_vehicle_types.sql          # Day 4
031_waiting_charges.sql        # Day 5-6
032_addon_services.sql         # Day 7-8
033_invoice_generation.sql     # Day 9
```

---

## Key Files to Create

### Backend (Supabase)
- `supabase/functions/validate-location/index.ts`
- `supabase/functions/calculate-waiting-charges/index.ts`
- `supabase/functions/generate-invoice/index.ts`

### Customer App
- `apps/customer/components/TermsCheckbox.tsx`
- `apps/customer/components/AddonSelector.tsx`
- `apps/customer/components/InvoiceModal.tsx`
- `apps/customer/lib/location.ts` (update)

### Driver App
- `apps/driver/components/RateCustomer.tsx`
- `apps/driver/components/WaitingTimer.tsx`

---

## Testing Commands

```bash
# Test database migrations
supabase db reset --local
supabase db push

# Test edge functions
supabase functions serve validate-location
curl -X POST http://localhost:54321/functions/v1/validate-location \
  -H "Content-Type: application/json" \
  -d '{"lat": 28.6139, "lng": 77.2090}'

# Test mobile apps
cd apps/customer && npm run android
cd apps/driver && npm run android
```

---

## Common Issues & Solutions

### Issue: PostGIS not enabled
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Issue: Enum value already exists
```sql
-- Check existing values first
SELECT unnest(enum_range(NULL::vehicle_type));

-- Then add only if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'three_wheeler') THEN
    ALTER TYPE vehicle_type ADD VALUE 'three_wheeler';
  END IF;
END $$;
```

### Issue: Migration fails
```bash
# Rollback
supabase db reset --local

# Check logs
supabase logs
```

---

## Quick Reference: Database Schema Changes

### bookings table (7 new columns)
- `waiting_start_time`
- `waiting_end_time`
- `waiting_duration_minutes`
- `waiting_charges`
- `free_waiting_minutes`
- `addon_charges`
- `invoice_number`
- `invoice_generated_at`
- `invoice_url`

### users table (2 new columns)
- `terms_accepted`
- `terms_accepted_at`

### New tables (4)
- `service_areas`
- `user_terms_acceptance`
- `addon_services`
- `booking_addons`

---

## Feature Flags (Recommended)

Add to your config:

```typescript
const FEATURE_FLAGS = {
  LOCATION_RESTRICTIONS: true,
  WAITING_CHARGES: false, // Enable after testing
  ADDON_SERVICES: false,  // Enable after testing
  INVOICE_GENERATION: true,
  DRIVER_FEEDBACK: true,
};
```

---

## Support & Resources

- Full Plan: `MISSING_FEATURES_IMPLEMENTATION_PLAN.md`
- Database Schema: `database schema.txt`
- Current Schema: `current_schema.sql`

---

**Ready to start? Begin with Feature 2 (Terms Acceptance) - it's the quickest win!**
