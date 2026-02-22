# Vehicle Deletion & Deactivation Fix

## Problem
When admin deleted a vehicle from the `/vehicle-types` console:
- ❌ Vehicle still appeared in customer app
- ❌ Vehicle persisted in admin console after refresh
- ❌ No proper cascading delete/deactivate

## Root Cause
1. **Delete handler only removed vehicle_specifications** but left `fare_config` record with `is_active = true`
2. **Edge function (calculate-fare)** queries `fare_config WHERE is_active = true`, so deleted vehicles still returned results
3. **RPC function used LEFT JOIN** allowing inactive vehicles to still appear

## Solution

### Updated Components:

#### 1. **Admin Delete Handler** (`apps/admin/app/vehicle-types/page.tsx`)
```typescript
// OLD: Only deleted vehicle_specifications
await supabase.from('vehicle_specifications').delete().eq('id', id)

// NEW: Deactivates fare config first, then deletes vehicle
await supabase.from('fare_config').update({ is_active: false }).eq('vehicle_type', vehicle.vehicle_type)
await supabase.from('vehicle_specifications').delete().eq('id', id)
```

**Benefits:**
- ✅ Fare configs retained for audit trail
- ✅ Can be reactivated if needed
- ✅ Won't cause cascade errors

#### 2. **RPC Function** (`get_vehicle_types_with_fare`)
```sql
-- OLD: LEFT JOIN (returns vehicles even if fare_config is inactive)
FROM vehicle_specifications vs
LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
WHERE (fc.is_active IS NULL OR fc.is_active = true)

-- NEW: INNER JOIN (only returns active vehicles)
FROM vehicle_specifications vs
INNER JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
WHERE fc.is_active = true
```

**Benefits:**
- ✅ Only returns active vehicles
- ✅ Deleted vehicles filtered out automatically
- ✅ Simpler, more explicit logic

#### 3. **Edge Function** (`calculate-fare`)
Added null check for empty results:
```typescript
if (!allConfigs || allConfigs.length === 0) {
  return new Response(JSON.stringify({ options: [] }), { status: 200, ... })
}
```

## How It Works Now

### Admin Deletes a Vehicle:
1. Admin clicks delete on "Tempo"
2. Confirms deletion
3. System:
   - Sets `fare_config.is_active = false` for "tempo"
   - Deletes `vehicle_specifications` row for "tempo"
   - Refreshes fare config cache
   - Updates UI

### Customer App:
1. Calls `calculateFares()`
2. Edge function queries: `SELECT * FROM fare_config WHERE is_active = true`
3. "Tempo" no longer in results
4. Customer app refreshes, "Tempo" disappears ✓

### RPC (Alternative fetch):
1. Queries `get_vehicle_types_with_fare()`
2. INNER JOINs with `is_active = true`
3. "Tempo" filtered out ✓

## Deployment

### Via Migrations:
```bash
# Apply both migrations
npx supabase migration push
```

Migrations:
- `041_fix_vehicle_delete_cascade.sql` - Updates RPC function
- Admin code changes auto-applied on next deploy

### Or Manual SQL:
```sql
-- Update RPC function
DROP FUNCTION IF EXISTS get_vehicle_types_with_fare();

CREATE OR REPLACE FUNCTION get_vehicle_types_with_fare()
RETURNS TABLE(...)
AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM vehicle_specifications vs
  INNER JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
  WHERE fc.is_active = true
  ORDER BY fc.base_fare ASC;
END;
$$ LANGUAGE plpgsql;
```

## Testing

1. **Add a vehicle**: Admin → Vehicle Types → "+ Add Vehicle Type"
2. **Verify it shows**: Refresh customer app → should appear
3. **Delete the vehicle**: Admin → click trash icon → confirm
4. **Verify it hides**: Refresh customer app → should disappear
5. **Check admin**: Admin console should not show deleted vehicle

## Behavior After Fix

| Action | Before | After |
|--------|--------|-------|
| Add vehicle | Shows in customer app after fare_config created | ✓ Shows immediately |
| Edit vehicle | Changes apply after save | ✓ Changes apply immediately |
| Delete vehicle | Still shows in customer app | ✓ Disappears after refresh |
| Refresh admin | Deleted vehicles reappear | ✓ Stay deleted |
| Refresh customer app | Deleted vehicles persist | ✓ Disappear |

## Key Changes Summary

1. **Admin vehicle delete**: Now deactivates fare_config first
2. **RPC function**: Changed to INNER JOIN + is_active = true
3. **Edge function**: Added null check for consistency
4. **Cascade logic**: Proper deactivate-then-delete pattern

## Rollback

If needed to revert deletions:
```sql
UPDATE fare_config 
SET is_active = true, updated_at = now() 
WHERE vehicle_type = 'tempo';
```

This will restore deleted vehicle visibility.
