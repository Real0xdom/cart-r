"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    try {
        let query = supabase_server_1.supabaseAdmin
            .from('drivers')
            .select(`
        *,
        user:users!drivers_user_id_fkey(name, email, phone)
      `)
            .order('created_at', { ascending: false });
        // Handle different filter types
        if (filter === 'resubmissions') {
            // Resubmissions are pending drivers where updated_at > created_at
            // This means they were rejected and resubmitted their application
            // Supabase can't compare two columns directly, so we filter in JS
            query = query.eq('verification_status', 'pending');
        }
        else if (filter !== 'all') {
            query = query.eq('verification_status', filter);
        }
        const { data, error } = await query;
        if (error) {
            console.error('API Error fetching drivers:', error);
            return server_1.NextResponse.json({ error: error.message }, { status: 500 });
        }
        // For resubmissions, filter drivers where updated_at > created_at
        let filteredData = data || [];
        if (filter === 'resubmissions') {
            filteredData = filteredData.filter((driver) => {
                const createdAt = new Date(driver.created_at).getTime();
                const updatedAt = new Date(driver.updated_at).getTime();
                // Consider it a resubmission if updated significantly after creation (> 1 minute difference)
                return updatedAt - createdAt > 60000;
            });
        }
        return server_1.NextResponse.json(filteredData);
    }
    catch (err) {
        console.error('Server error:', err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, verification_status, rejection_reason } = body;
        // First, get the current driver data to create a document snapshot
        const { data: currentDriver, error: fetchError } = await supabase_server_1.supabaseAdmin
            .from('drivers')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) {
            return server_1.NextResponse.json({ error: fetchError.message }, { status: 500 });
        }
        const updateData = { verification_status };
        if (verification_status === 'approved') {
            updateData.verified_at = new Date().toISOString();
        }
        else if (verification_status === 'rejected') {
            updateData.rejection_reason = rejection_reason;
        }
        const { data, error } = await supabase_server_1.supabaseAdmin
            .from('drivers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            return server_1.NextResponse.json({ error: error.message }, { status: 500 });
        }
        // Record verification history entry
        const documentSnapshot = {
            license_image_url: currentDriver.license_image_url,
            rc_image_url: currentDriver.rc_image_url,
            insurance_image_url: currentDriver.insurance_image_url,
            vehicle_image_url: currentDriver.vehicle_image_url,
            license_number: currentDriver.license_number,
            license_expiry: currentDriver.license_expiry,
            vehicle_number: currentDriver.vehicle_number,
            vehicle_model: currentDriver.vehicle_model,
            vehicle_type: currentDriver.vehicle_type,
        };
        const historyEntry = {
            driver_id: id,
            action: verification_status === 'approved' ? 'approved' : 'rejected',
            rejection_reason: verification_status === 'rejected' ? rejection_reason : null,
            document_snapshot: documentSnapshot,
            admin_id: null, // Could be populated if we track admin user
        };
        console.log('Recording verification history for driver:', id, 'action:', historyEntry.action);
        const { data: historyData, error: historyError } = await supabase_server_1.supabaseAdmin
            .from('driver_verification_history')
            .insert(historyEntry)
            .select();
        if (historyError) {
            console.error('Failed to record verification history:', historyError);
            // Don't fail the request if history insert fails
        }
        else {
            console.log('Verification history recorded successfully:', historyData);
        }
        return server_1.NextResponse.json(data);
    }
    catch (err) {
        console.error('Server error:', err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
