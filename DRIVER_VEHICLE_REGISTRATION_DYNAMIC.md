# Driver Vehicle Registration - Dynamic Vehicle Types

## Overview
New drivers registering for approval will now **only see vehicles approved by admin**, not a hardcoded list.

## Changes Made

### Updated File: `apps/driver/app/onboarding/vehicle-info.tsx`

**Before:**
- Hardcoded vehicle list (Bike, Tempo, Sedan, Truck only)
- Drivers saw same vehicles regardless of admin settings

**After:**
- Fetches from `getActiveVehicleTypes()` RPC
- Shows **only admin-approved vehicles** with `is_active = true`
- Loading state while fetching
- Error handling if no vehicles available
- Uses dynamic data: `display_name`, `icon_emoji`, `description`

## How It Works

### Step 1: Driver Opens Registration
```
Driver App → Onboarding → Vehicle Info Screen
```

### Step 2: Component Fetches Available Vehicles
```typescript
// On mount, fetches from database
const { data, error } = await getActiveVehicleTypes();
// Returns only vehicles where is_active = true
```

### Step 3: Driver Selects from Available List
- Only sees vehicles admin has approved
- Each vehicle shows:
  - ✓ Emoji icon (e.g., 🏍️, 🛺, 🚚)
  - ✓ Display name (e.g., "Bike", "Tempo")
  - ✓ Description (e.g., "2-wheeler delivery")

### Step 4: Selection Stored
```typescript
router.push({
  pathname: "/onboarding/documents",
  params: {
    vehicleType: selectedType,  // e.g., "bike"
    // ... other details
  },
});
```

## Admin Controls Vehicle Visibility

### Scenario 1: Admin Adds New Vehicle Type
1. Admin: `/vehicle-types` → "+ Add Vehicle Type"
2. Fills in "Auto Rickshaw", `auto_rickshaw`, 🛵
3. System auto-creates fare_config
4. ✅ **Immediately appears** in driver registration

### Scenario 2: Admin Deletes Vehicle Type
1. Admin: `/vehicle-types` → Delete "Auto Rickshaw"
2. System sets `fare_config.is_active = false`
3. ✅ **Immediately disappears** from driver registration

### Scenario 3: Admin Deactivates Vehicle (Manual)
```sql
UPDATE fare_config 
SET is_active = false 
WHERE vehicle_type = 'auto_rickshaw';
```
Driver registration refreshes → vehicle disappears

## Data Flow

```
Admin Console (web)
    ↓
vehicle_specifications table
    ↓
fare_config table (is_active = true/false)
    ↓
RPC: get_vehicle_types_with_fare()
    ↓
Driver App (mobile)
    ↓
Vehicle Registration Screen
```

## Features

✅ **Dynamic** - Changes in admin instantly reflect in driver app  
✅ **Safe** - Only approved vehicles shown  
✅ **User-friendly** - Loading state + error messages  
✅ **Logged** - Console logs: `[VEHICLE INFO] Loaded X vehicle types`  
✅ **Fallback** - Alerts user if no vehicles available  

## Testing

### Test 1: New Vehicle Shows Up
1. Admin: Add "Sedan" vehicle
2. Driver app: Refresh vehicle-info screen
3. Expected: "Sedan" appears in list

### Test 2: Deleted Vehicle Disappears
1. Admin: Delete "Sedan"
2. Driver app: Refresh vehicle-info screen
3. Expected: "Sedan" is gone

### Test 3: Error Handling
1. Force database offline (testing)
2. Driver app: Tries to load vehicles
3. Expected: Alert "Failed to load vehicle types"

### Test 4: Logging
Open browser console → Should see:
```
[VEHICLE INFO] Fetching admin-approved vehicle types...
[VEHICLE INFO] Loaded vehicle types: 5 bike, three_wheeler, tempo, pickup, chota_hathi
```

## No Database Migration Needed
This uses existing infrastructure:
- ✓ `vehicle_specifications` table
- ✓ `fare_config` table
- ✓ `get_vehicle_types_with_fare()` RPC
- ✓ RLS policies

## Related Components

Also updated to use dynamic vehicles:
- ✓ `apps/customer/app/select-vehicle.tsx` - Customer booking
- ✓ `apps/admin/app/vehicle-types/page.tsx` - Admin management
- ✓ `supabase/functions/calculate-fare/index.ts` - Edge function

All three user flows now pull from admin-approved vehicles!
