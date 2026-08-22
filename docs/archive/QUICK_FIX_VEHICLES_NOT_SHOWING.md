# Quick Fix: Vehicles Not Showing in Customer App

## Problem
Admin added vehicles in `/vehicle-types` console, but customer app shows 0 vehicles when booking.

## Root Cause
Vehicles in `vehicle_specifications` table don't have corresponding `fare_config` rows with `is_active = true`. The calculate-fare edge function queries `fare_config` table, so missing fares = no vehicles shown.

## Solution (Choose One)

### Option A: Use Supabase SQL Editor (Easiest)

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" (left sidebar)
   - Click "+ New Query"

2. **Copy & Paste the FIX Script**
   - Open file: [`VEHICLE_DEBUG_AND_FIX.sql`](./VEHICLE_DEBUG_AND_FIX.sql)
   - Copy the "STEP 2: IMMEDIATE FIX" section (lines 39-165)
   - Paste into SQL Editor
   - Click "Run"

3. **Verify**
   - Uncomment the queries in "STEP 3: VERIFY" section
   - Run them to confirm all vehicles now have fares
   - Expected output: All vehicles show `✓ HAS FARE` and `is_active = true`

### Option B: Deploy New Migrations (Production)

If using Supabase CLI:

```bash
# Ensure you have latest migrations
npx supabase migration pull

# Apply pending migrations (035 and 040)
npx supabase migration push

# If that doesn't work, manually run in SQL Editor
```

### Option C: Manual SQL Commands

Run these one-by-one in Supabase SQL Editor:

```sql
-- 1. Activate any inactive fares
UPDATE fare_config 
SET is_active = true, updated_at = now() 
WHERE is_active = false;

-- 2. Create fares for vehicles without them
WITH vehicle_list AS (
  SELECT DISTINCT vehicle_type FROM vehicle_specifications
)
INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
SELECT 
  vehicle_type,
  CASE WHEN vehicle_type = 'bike' THEN 25 WHEN vehicle_type = 'sedan' THEN 50 WHEN vehicle_type = 'three_wheeler' THEN 40 WHEN vehicle_type = 'tempo' THEN 60 WHEN vehicle_type = 'pickup' THEN 120 WHEN vehicle_type = 'truck' THEN 150 WHEN vehicle_type = 'chota_hathi' THEN 150 ELSE 75 END,
  CASE WHEN vehicle_type = 'bike' THEN 3 WHEN vehicle_type = 'sedan' THEN 5 WHEN vehicle_type = 'three_wheeler' THEN 5 WHEN vehicle_type = 'tempo' THEN 6 WHEN vehicle_type = 'pickup' THEN 6 WHEN vehicle_type = 'truck' THEN 8 WHEN vehicle_type = 'chota_hathi' THEN 7 ELSE 6 END,
  CASE WHEN vehicle_type = 'bike' THEN 1 WHEN vehicle_type = 'sedan' THEN 1.5 WHEN vehicle_type = 'three_wheeler' THEN 1.5 WHEN vehicle_type = 'tempo' THEN 2 WHEN vehicle_type = 'pickup' THEN 2 WHEN vehicle_type = 'truck' THEN 3 WHEN vehicle_type = 'chota_hathi' THEN 3 ELSE 2 END,
  CASE WHEN vehicle_type = 'bike' THEN 30 WHEN vehicle_type = 'sedan' THEN 60 WHEN vehicle_type = 'three_wheeler' THEN 50 WHEN vehicle_type = 'tempo' THEN 70 WHEN vehicle_type = 'pickup' THEN 150 WHEN vehicle_type = 'truck' THEN 200 WHEN vehicle_type = 'chota_hathi' THEN 200 ELSE 100 END,
  CASE WHEN vehicle_type = 'bike' THEN 10 WHEN vehicle_type = 'sedan' THEN 20 WHEN vehicle_type = 'three_wheeler' THEN 20 WHEN vehicle_type = 'tempo' THEN 30 WHEN vehicle_type = 'pickup' THEN 40 WHEN vehicle_type = 'truck' THEN 50 WHEN vehicle_type = 'chota_hathi' THEN 50 ELSE 30 END,
  CASE WHEN vehicle_type = 'bike' THEN 5 WHEN vehicle_type = 'sedan' THEN 10 WHEN vehicle_type = 'three_wheeler' THEN 8 WHEN vehicle_type = 'tempo' THEN 10 WHEN vehicle_type = 'pickup' THEN 12 WHEN vehicle_type = 'truck' THEN 15 WHEN vehicle_type = 'chota_hathi' THEN 12 ELSE 10 END,
  true
FROM vehicle_list
WHERE NOT EXISTS (SELECT 1 FROM fare_config fc WHERE fc.vehicle_type = vehicle_list.vehicle_type)
ON CONFLICT (vehicle_type) DO NOTHING;

-- 3. Verify
SELECT 
  vs.vehicle_type,
  vs.display_name,
  CASE WHEN fc.id IS NOT NULL THEN 'HAS FARE' ELSE 'MISSING' END as status
FROM vehicle_specifications vs
LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
ORDER BY vs.display_name;
```

## After Fix

1. **Refresh Customer App**
   - Force close and reopen the app
   - Or navigate away and back to booking screen

2. **Should See**
   - ✓ All admin-added vehicles appear
   - ✓ Correct pricing shows
   - ✓ Vehicles sorted by bike first, then by price
   - ✓ Console shows: `[SELECT VEHICLE] Vehicle types: bike, three_wheeler, tempo, ...`

3. **Verify in Admin**
   - Go to admin `/vehicle-types`
   - All vehicles should show "✓ Active" badge
   - Click 💰 to edit pricing if needed

## Why This Happened

1. **Migration 035** (`035_auto_fare_config.sql`) has a trigger that auto-creates fares when new vehicles are added
2. **But** if vehicles were added BEFORE this migration ran, or if the trigger failed, they won't have fares
3. **Solution**: The backfill script manually creates missing fares

## Prevent Future Issues

- Future vehicle additions via admin will auto-create fares (via trigger)
- Always ensure migrations 030, 035, and 040 are applied
- When admin adds new vehicle in console, it should immediately appear in customer app within 5 seconds

## Troubleshooting

**Still not working?**

1. **Check fare_config directly** (SQL Editor):
   ```sql
   SELECT * FROM fare_config WHERE is_active = true ORDER BY base_fare;
   ```
   Should show all your vehicle types.

2. **Check vehicle_specifications**:
   ```sql
   SELECT * FROM vehicle_specifications ORDER BY display_name;
   ```

3. **Check for errors**:
   - Customer app: Open Developer Tools > Console
   - Look for "[SELECT VEHICLE]" logs
   - Should see vehicles being fetched

4. **Clear app cache**:
   - Delete and reinstall app
   - Or clear app data on device

5. **Check edge function logs**:
   - Supabase Dashboard > Functions > calculate-fare > Logs
   - Should show no errors
