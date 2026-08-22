import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const dispatchScheduledRides = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[Scheduler] Checking for scheduled rides that need dispatching...');

    const { data: upcomingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date(Date.now() + 15 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('[Scheduler] Error fetching scheduled bookings:', fetchError);
      throw fetchError;
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      console.log('[Scheduler] No scheduled rides to dispatch right now.');
      res.status(200).json({ 
        message: 'No scheduled rides to dispatch right now.',
        count: 0
      });
      return;
    }

    console.log(`[Scheduler] Found ${upcomingBookings.length} rides to dispatch.`);
    let successCount = 0;

    for (const booking of upcomingBookings) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'pending' })
        .eq('id', booking.id);
        
      if (updateError) {
        console.error(`[Scheduler] Failed to dispatch booking ${booking.id}:`, updateError);
      } else {
        successCount++;
        console.log(`[Scheduler] Successfully dispatched booking ${booking.id} (status -> pending)`);
      }
    }

    console.log('[Scheduler] Cleaning up expired pending bookings...');
    const { data: cleanupCount, error: cleanupError } = await supabase.rpc('cleanup_expired_bookings');
    if (cleanupError) {
      console.error('[Scheduler] Failed to cleanup expired bookings:', cleanupError);
    } else if (cleanupCount > 0) {
      console.log(`[Scheduler] Successfully cleaned up ${cleanupCount} expired bookings.`);
    }

    res.status(200).json({ 
      success: true, 
      message: `Dispatched ${successCount}/${upcomingBookings.length} scheduled rides. Cleaned up ${cleanupCount || 0} expired rides.`,
      dispatched: successCount,
      cleanedUp: cleanupCount || 0
    });
  } catch (error: any) {
    console.error('[Scheduler] Critical Error:', error);
    res.status(500).json({ error: error.message });
  }
};
