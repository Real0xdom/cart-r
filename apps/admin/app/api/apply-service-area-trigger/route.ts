import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This route applies the service area geometry trigger to the database.
// It should be called once from the admin dashboard.
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const sql = `
    -- Create trigger function to auto-update geometry from center + radius
    CREATE OR REPLACE FUNCTION update_service_area_geometry()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.geometry := ST_Buffer(
        ST_SetSRID(ST_MakePoint(NEW.center_longitude::float8, NEW.center_latitude::float8), 4326)::geography,
        NEW.radius_km::float8 * 1000
      )::geometry;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_update_service_area_geometry ON public.service_areas;

    CREATE TRIGGER trg_update_service_area_geometry
    BEFORE INSERT OR UPDATE OF center_latitude, center_longitude, radius_km
    ON public.service_areas
    FOR EACH ROW
    EXECUTE FUNCTION update_service_area_geometry();

    -- Update all existing rows to regenerate geometry
    UPDATE service_areas 
    SET geometry = ST_Buffer(
      ST_SetSRID(ST_MakePoint(center_longitude::float8, center_latitude::float8), 4326)::geography,
      radius_km::float8 * 1000
    )::geometry
    WHERE center_latitude IS NOT NULL AND center_longitude IS NOT NULL AND radius_km IS NOT NULL;
  `;

  // Execute via rpc (requires pg_execute or similar) - use raw query via REST
  // Supabase JS doesn't support raw DDL directly, so we use the management API
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    return NextResponse.json({ error: 'Could not extract project ref' }, { status: 500 });
  }

  // Use Supabase Management API to run SQL
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Try alternative: use pg directly via supabase rpc
    // As a fallback, just return the SQL for manual execution
    return NextResponse.json({ 
      success: false,
      message: 'Please run this SQL in your Supabase dashboard → SQL Editor',
      sql 
    });
  }

  return NextResponse.json({ success: true, message: 'Trigger applied successfully!' });
}
