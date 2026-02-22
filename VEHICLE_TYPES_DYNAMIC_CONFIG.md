# Vehicle Types Dynamic Configuration System

## Overview
The vehicle type system is now fully dynamic. Admin users can add/edit vehicle types in the admin console, and they automatically appear to customers and drivers without code changes.

## Architecture

### 1. **Admin Control** (`/vehicle-types` in admin dashboard)
- Admins add/edit/delete vehicle specifications
- Each vehicle has:
  - Type key (unique identifier, e.g., `bike`, `truck`)
  - Display name (e.g., "Bike", "Truck")
  - Icon emoji
  - Max weight capacity
  - Passenger capacity
  - Suitable use cases (tags)

### 2. **Fare Configuration** (Automatic + Manual)
- **Automatic**: When admin adds a new vehicle, a default `fare_config` is auto-created via trigger
- **Manual**: Admin can edit fares using the 💰 button in the vehicle list
- Fare config includes:
  - Base fare
  - Per km rate
  - Per minute rate
  - Minimum fare
  - Active/inactive toggle

### 3. **Backend Flow**
```
Admin adds vehicle_type
        ↓
Trigger creates default fare_config
        ↓
Customer/Driver app calls calculateFares()
        ↓
Edge Function queries fare_config (WHERE is_active = true)
        ↓
Returns all active vehicles with dynamic fares
```

### 4. **Customer/Driver Apps** (Fully Dynamic)
- **File**: `apps/customer/lib/vehicleTypes.ts`, `apps/driver/lib/vehicleTypes.ts`
- Calls `getActiveVehicleTypes()` RPC which queries:
  - `vehicle_specifications` JOIN `fare_config` WHERE `is_active = true`
- No hardcoded vehicle lists anywhere
- Automatically shows any vehicle added by admin

## Key Files

### Database
- `supabase/migrations/030_vehicle_types.sql` - Initial schema
- `supabase/migrations/035_auto_fare_config.sql` - **NEW:** Auto-creation trigger + backfill

### Edge Functions
- `supabase/functions/calculate-fare/index.ts` - Queries `fare_config` dynamically with `get_all_vehicles=true`

### Admin Panel
- `apps/admin/app/vehicle-types/page.tsx` - **UPDATED:** Shows fare status + edit fares button

### Apps
- `apps/customer/lib/vehicleTypes.ts` - Fetches from RPC
- `apps/customer/app/select-vehicle.tsx` - Renders dynamic vehicle list
- `apps/driver/lib/vehicleTypes.ts` - Same as customer
- Similar driver app screens

## How It Works (Step by Step)

### Admin Adds New Vehicle
1. Admin goes to `/vehicle-types` in admin dashboard
2. Clicks "+ Add Vehicle Type"
3. Fills in details (e.g., "Mini Truck", `mini_truck`, 🚚, etc.)
4. Clicks "Add Vehicle"
5. **Automatic**: Database trigger creates matching `fare_config` row with sensible defaults

### Admin Customizes Pricing
1. In vehicle types table, admin sees "✓ Active" badge with base fare
2. Clicks 💰 button next to vehicle
3. Opens modal to edit:
   - Base fare
   - Per km rate
   - Per minute rate
   - Minimum fare
   - Active/inactive toggle
4. Changes are instantly reflected in customer/driver apps

### Customer Sees Updated List
1. Customer opens app and navigates to booking
2. App calls `getActiveVehicleTypes()` → RPC `get_vehicle_types_with_fare()`
3. RPC returns all vehicles from `vehicle_specifications` JOIN `fare_config` WHERE `is_active = true`
4. Customer sees new vehicle with correct pricing
5. **No app restart needed** - data is fetched on demand

## Deployment

To apply these changes:

1. **Run migration**:
   ```bash
   npx supabase migration up
   ```

2. **Backfill missing fares** (if any existing vehicles lack fare configs):
   - The migration `035_auto_fare_config.sql` includes a backfill script
   - It creates default fares for all vehicle_specifications without fare_config entries

3. **Verify**:
   - Check admin panel `/vehicle-types` - all vehicles should show status
   - Add a test vehicle - should auto-create fare config
   - Customer app should fetch and show new vehicle

## Default Fares (Auto-Created)

When a new vehicle is added, these defaults are applied:

| Vehicle Type | Base Fare | Per KM | Per Min | Min Fare |
|---|---|---|---|---|
| bike | ₹25 | ₹3 | ₹1 | ₹30 |
| sedan | ₹50 | ₹5 | ₹1.5 | ₹60 |
| three_wheeler | ₹40 | ₹5 | ₹1.5 | ₹50 |
| tempo | ₹60 | ₹6 | ₹2 | ₹70 |
| pickup | ₹120 | ₹6 | ₹2 | ₹150 |
| truck | ₹150 | ₹8 | ₹3 | ₹200 |
| chota_hathi | ₹150 | ₹7 | ₹3 | ₹200 |

Admins should review and adjust based on market conditions.

## Troubleshooting

**Vehicle added but not showing in customer app:**
1. Check fare_config table - does vehicle_type exist?
2. Check is_active = true in fare_config
3. Try admin panel refresh

**Vehicle showing but with wrong pricing:**
1. Click 💰 to edit fare config
2. Check if base_fare/per_km_rate are correct
3. Verify minimum_fare setting

**Can't edit vehicle specs:**
1. Ensure you have admin role
2. Check for any validation errors in admin UI
