import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  const search = searchParams.get('search')?.toLowerCase() || '';

  try {
    let query = supabaseAdmin
      .from('drivers')
      .select(`
        *,
        user:users!drivers_user_id_fkey(name, email, phone)
      `)
      .order('created_at', { ascending: false });

    // Handle verification status filter
    if (filter === 'resubmissions') {
      // Handled in JS below
      query = query.eq('verification_status', 'pending');
    } else if (filter !== 'all') {
      query = query.eq('verification_status', filter);
    }

    const { data: rawData, error } = await query;

    if (error) {
      console.error('API Error fetching drivers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filteredData = rawData || [];

    // 1. Filter by Search Query (Client-side logic on Server for joined fields)
    if (search) {
      filteredData = filteredData.filter((driver: any) => {
        const userName = driver.user?.name?.toLowerCase() || '';
        const userEmail = driver.user?.email?.toLowerCase() || '';
        const userPhone = driver.user?.phone || '';
        const vehicleNumber = driver.vehicle_number?.toLowerCase() || '';
        
        return (
          userName.includes(search) ||
          userEmail.includes(search) ||
          userPhone.includes(search) ||
          vehicleNumber.includes(search)
        );
      });
    }

    // 2. Filter Resubmissions
    if (filter === 'resubmissions') {
      filteredData = filteredData.filter((driver: any) => {
        const createdAt = new Date(driver.created_at).getTime();
        const updatedAt = new Date(driver.updated_at).getTime();
        return updatedAt - createdAt > 60000;
      });
    }

    return NextResponse.json(filteredData);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      verification_status,
      rejection_reason,
      vehicle_number,
      vehicle_model,
      vehicle_type,
      driver_app_enabled,
    } = body;

    // First, get the current driver data
    const { data: currentDriver, error: fetchError } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Build update object
    const updateData: any = {};
    
    // Status Updates
    if (verification_status) {
        updateData.verification_status = verification_status;
        if (verification_status === 'approved') {
          updateData.verified_at = new Date().toISOString();
        } else if (verification_status === 'rejected') {
          updateData.rejection_reason = rejection_reason;
        }
    }

    if (driver_app_enabled !== undefined) {
      updateData.driver_app_enabled = driver_app_enabled;
      if (driver_app_enabled === false) {
        updateData.is_online = false;
      }
    }

    // Details Updates (Edit Functionality)
    if (vehicle_number) updateData.vehicle_number = vehicle_number;
    if (vehicle_model) updateData.vehicle_model = vehicle_model;
    if (vehicle_type) updateData.vehicle_type = vehicle_type;

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('driver_app_enabled')) {
        return NextResponse.json({ error: 'Live database is missing the driver access migration.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record verification history entry ONLY if status changed
    if (verification_status && verification_status !== currentDriver.verification_status) {
        const documentSnapshot = {
          license_image_url: currentDriver.license_image_url,
          rc_image_url: currentDriver.rc_image_url,
          insurance_image_url: currentDriver.insurance_image_url,
          vehicle_image_url: currentDriver.vehicle_image_url,
          license_number: currentDriver.license_number,
          license_expiry: currentDriver.license_expiry,
          vehicle_number: currentDriver.vehicle_number, // Snapshot old or new? Usually snapshot current state.
          vehicle_model: currentDriver.vehicle_model,
          vehicle_type: currentDriver.vehicle_type,
        };
    
        const historyEntry = {
          driver_id: id,
          action: verification_status === 'approved' ? 'approved' : 'rejected',
          rejection_reason: verification_status === 'rejected' ? rejection_reason : null,
          document_snapshot: documentSnapshot,
          admin_id: null,
        };
    
        console.log('Recording verification history for driver:', id, 'action:', historyEntry.action);
    
        await supabaseAdmin.from('driver_verification_history').insert(historyEntry);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
