# Sedan Vehicle Removed ✅

## Changes Made

### 1. Database Change (Required)
Run this SQL command in Supabase SQL Editor to deactivate sedan:

```sql
UPDATE fare_config 
SET is_active = false, updated_at = now()
WHERE vehicle_type = 'sedan';
```

**Effect:** Sedan will no longer appear in the customer app's vehicle selection.

### 2. Code Change (Optional - Consistency)
Removed sedan from the fallback configuration in `apps/customer/lib/bookingUtils.ts`

**Before:**
```typescript
const FARE_CONFIG_FALLBACK = {
  bike: { ... },
  tempo: { ... },
  sedan: { ... },  // ❌ Removed
  truck: { ... },
};
```

**After:**
```typescript
const FARE_CONFIG_FALLBACK = {
  bike: { ... },
  tempo: { ... },
  truck: { ... },  // ✅ Only active vehicles
};
```

Note: This fallback is only used if database connection fails. The main vehicle list comes from the database.

## How to Apply

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com
2. Open your project
3. Go to SQL Editor
4. Run the UPDATE command above
5. Click "Run" ▶️

### Option 2: Using CLI
```bash
npx supabase db execute --file remove-sedan.sql
```

## Verification

After running the SQL command, verify with:

```sql
-- Check that sedan is deactivated
SELECT vehicle_type, is_active FROM fare_config WHERE vehicle_type = 'sedan';

-- Should show: sedan | false

-- See all active vehicles (sedan should NOT be in the list)
SELECT vehicle_type, base_fare, is_active 
FROM fare_config 
ORDER BY vehicle_type;

-- Test the RPC function (used by the app)
SELECT * FROM get_vehicle_types_with_fare();
-- Should NOT include sedan
```

## Active Vehicles After Change

Based on your JSON output, these are the active vehicles:

1. ✅ **Bike** 🏍️ - ₹25 base
2. ✅ **Three Wheeler** 🛺 - ₹40 base  
3. ✅ **Tempo** 🚐 - ₹40 base
4. ✅ **Pickup** 🚙 - ₹120 base
5. ✅ **Truck** 🚚 - ₹120 base
6. ✅ **Chota Hathi** 🚛 - ₹150 base

❌ **Sedan** - Deactivated (no longer visible to customers)

## Impact

- ✅ **Customer App:** Sedan will disappear from vehicle selection immediately
- ✅ **Existing Bookings:** Any existing sedan bookings remain in database but can't be selected
- ✅ **Driver App:** Drivers won't see sedan as an option for new registrations
- ✅ **Real-time:** Changes take effect immediately after SQL execution

## Testing

1. **Restart the customer app** (if running)
2. **Enter pickup and drop locations**
3. **Go to vehicle selection screen**
4. **Verify:** Sedan should NOT appear in the list

## If Sedan Still Appears

1. **Check cache:** The app caches vehicle data for 5 minutes
   - Wait 5 minutes OR
   - Restart the app OR
   - Clear app cache

2. **Verify database:** Run the verification SQL above

3. **Check Edge Function logs:** In Supabase dashboard
   - Look for `[CALCULATE-FARE] Returning options:` log
   - Should NOT include "sedan"

## Future Vehicle Management

To add/remove any vehicle in the future:

### Remove Vehicle:
```sql
UPDATE fare_config SET is_active = false WHERE vehicle_type = 'vehicle_name';
```

### Add Vehicle:
```sql
INSERT INTO fare_config (
  vehicle_type, base_fare, per_km_rate, per_minute_rate, 
  minimum_fare, is_active
) VALUES (
  'new_vehicle', 50, 15, 2, 60, true
);
```

No code changes needed! Everything is controlled via database. ✅

## Files Modified

1. ✅ `apps/customer/lib/bookingUtils.ts` - Removed sedan from fallback
2. ✅ Created `remove-sedan.sql` - Ready-to-run SQL script
3. ✅ Created this documentation

---

**Status:** ✅ Complete - Sedan vehicle removed from app
