import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/ratings - Fetch ratings with booking and user names.
 * Uses service role server-side so RLS does not block reading users (from_user_id, to_user_id).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type') || 'all';
  const starFilter = searchParams.get('star') || '0';

  try {
    let query = supabaseAdmin
      .from('ratings')
      .select(
        `
        id,
        booking_id,
        rating,
        review,
        rater_type,
        created_at,
        from_user_id,
        to_user_id,
        booking:bookings!ratings_booking_id_fkey(booking_number, origin_address, destination_address),
        from_user:users!ratings_from_user_id_fkey(id, name, email),
        to_user:users!ratings_to_user_id_fkey(id, name, email)
        `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeFilter !== 'all') {
      query = query.eq('rater_type', typeFilter);
    }
    if (Number(starFilter) > 0) {
      query = query.eq('rating', Number(starFilter));
    }

    const { data, error } = await query;

    if (error) {
      console.error('API ratings fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize nested relations (Supabase can return array or single object)
    const normalized = (data || []).map((row: any) => ({
      id: row.id,
      booking_id: row.booking_id,
      rating: row.rating,
      review: row.review,
      rater_type: row.rater_type,
      created_at: row.created_at,
      booking: row.booking?.[0] ?? row.booking ?? null,
      from_user: row.from_user?.[0] ?? row.from_user ?? null,
      to_user: row.to_user?.[0] ?? row.to_user ?? null,
    }));

    return NextResponse.json(normalized);
  } catch (err: any) {
    console.error('Server error fetching ratings:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
