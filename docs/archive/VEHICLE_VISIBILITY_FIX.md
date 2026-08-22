# Vehicle Type Visibility Fix - Admin Control

## Problem
The customer app is showing vehicle types (like "sedan") that the admin has not configured or doesn't want to display. This happens because the system is fetching vehicles from the database without properly checking which ones are marked as **active**.

## Root Cause
The `calculate-fare` Edge function correctly filters by `is_active = true`, but the database may have old vehicle types (like sedan) that are still marked as active even though the admin doesn't want them.

## Solution

### Option 1: Quick Fix Using SQL (Recommended)

Run the SQL script I created to deactivate unwanted vehicles:

```bash
# Connect to your Supabase database
npx supabase db execute --file fix-active-vehicles.sql
```

Or manually run these SQL commands in Supabase SQL Editor:

```sql
-- Check what's currently active
SELECT vehicle_type, is_active FROM fare_config ORDER BY vehicle_type;

-- Deactivate 'sedan' (or any other unwanted vehicle)
UPDATE fare_config 
SET is_active = false, updated_at = now()
WHERE vehicle_type = 'sedan';

-- Verify the change
SELECT vehicle_type, is_active FROM fare_config ORDER BY vehicle_type;
```

### Option 2: Admin Dashboard (If Available)

If you have an admin dashboard with vehicle management:
1. Go to Admin Dashboard → Vehicle Management
2. Find the vehicle type you want to hide (e.g., "Sedan")
3. Toggle the "Active" switch to OFF
4. Save changes

The vehicle will immediately disappear from the customer app.

## How It Works

### Data Flow:
1. **Customer selects pickup & drop locations** → Customer app
2. **App calls `calculateFares()`** → `apps/customer/lib/fare.ts`
3. **Calls Edge Function** → `supabase/functions/calculate-fare/index.ts`
4. **Queries Database** → `fare_config` table WHERE `is_active = true`
5. **Returns only ACTIVE vehicles** → Customer sees only approved vehicles

### Key Files:
- **Edge Function:** `supabase/functions/calculate-fare/index.ts` (Line 269-272)
  - Already filters by `is_active = true` ✅
  
- **RPC Function:** `get_vehicle_types_with_fare()` (Migration 041)
  - Uses INNER JOIN to ensure only active vehicles shown ✅
  
- **Frontend Helper:** `apps/customer/lib/vehicleTypes.ts`
  - Calls the RPC function to get active vehicles ✅

### Database Tables:
- `fare_config` - Controls pricing AND visibility (`is_active` column)
- `vehicle_specifications` - Contains display info (emoji, description, etc.)

## Testing

### 1. Test in Supabase SQL Editor:
```sql
-- This should ONLY show active vehicles
SELECT * FROM get_vehicle_types_with_fare();
```

### 2. Test in Customer App:
1. Open customer app
2. Enter pickup and drop locations
3. Go to vehicle selection screen
4. **Expected:** Only see active vehicles (bike, tempo, truck, etc.)
5. **Not Expected:** Should NOT see deactivated vehicles (sedan)

### 3. Debug Logs:
The Edge function now logs which vehicles it's returning. Check your Supabase Edge Function logs:

```
[CALCULATE-FARE] Fetched active vehicles: 4
[CALCULATE-FARE] Active vehicle types: bike, tempo, truck, three_wheeler
[CALCULATE-FARE] Returning options: bike, tempo, three_wheeler, truck
```

## Adding New Vehicle Types in Future

When you want to add a new vehicle type:

1. **Add to database** (Supabase SQL Editor):
```sql
INSERT INTO fare_config (
  vehicle_type, base_fare, per_km_rate, per_minute_rate, 
  minimum_fare, is_active
) VALUES (
  'new_vehicle', 50, 15, 2, 60, true
);
```

2. **Add specifications**:
```sql
INSERT INTO vehicle_specifications (
  vehicle_type, display_name, description, icon_emoji,
  max_weight_kg, suitable_for
) VALUES (
  'new_vehicle', 'New Vehicle', 'Description here', '🚗',
  500, ARRAY['Use case 1', 'Use case 2']
);
```

3. **Vehicle automatically appears** in customer app for users to select ✅

## Removing Vehicle Types

To hide a vehicle type from customers:

```sql
UPDATE fare_config 
SET is_active = false 
WHERE vehicle_type = 'vehicle_to_hide';
```

The vehicle will immediately disappear from the customer app ✅

## Summary

✅ **Vehicles shown to customers = Only those with `is_active = true` in `fare_config` table**

✅ **Admin controls visibility** by toggling `is_active` flag in database

✅ **No code changes needed** to hide/show vehicles - just update database

✅ **Real-time updates** - Changes take effect immediately

## Troubleshooting

### If vehicles still showing incorrectly:

1. **Check database directly:**
   ```sql
   SELECT vehicle_type, is_active FROM fare_config;
   ```

2. **Test RPC function:**
   ```sql
   SELECT * FROM get_vehicle_types_with_fare();
   ```

3. **Clear app cache** and restart the customer app

4. **Check Edge Function logs** in Supabase dashboard for debug messages

5. **Verify migration 041 is deployed:**
   ```sql
   -- Should return only active vehicles
   SELECT * FROM get_vehicle_types_with_fare();
   ```

## Files Modified

1. ✅ `supabase/functions/calculate-fare/index.ts` - Added debug logging
2. ✅ Created `fix-active-vehicles.sql` - SQL script to fix vehicle visibility
3. ✅ Created this guide

## Next Steps

1. Run the SQL script to deactivate unwanted vehicles
2. Test the customer app to verify only desired vehicles show
3. Keep this guide for future vehicle management reference
