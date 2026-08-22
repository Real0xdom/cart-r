import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

interface AssignDriverRequest {
  booking_id: string;
  max_radius_km?: number;
}

interface DriverResult {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  vehicle_model: string;
  rating: number;
  distance_km: number;
  user: {
    name: string;
    phone: string;
    avatar_url: string | null;
  };
}

export const assignDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_id, max_radius_km = 10 }: AssignDriverRequest = req.body;

    if (!booking_id) {
      res.status(400).json({ error: 'Missing booking_id' });
      return;
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.status !== 'payment_confirmed') {
      res.status(400).json({
        error: 'Booking payment not confirmed',
        status: booking.status,
        message: 'Driver assignment only available after payment is confirmed'
      });
      return;
    }

    if (booking.driver_id) {
      res.status(400).json({ error: 'Booking already has a driver assigned' });
      return;
    }

    // Find nearby available drivers
    const { data: drivers, error: driversError } = await supabase.rpc('find_nearby_drivers', {
      pickup_lat: booking.origin_latitude,
      pickup_lng: booking.origin_longitude,
      radius_km: max_radius_km,
      required_vehicle_type: booking.vehicle_type,
    });

    let availableDrivers: DriverResult[] = drivers || [];

    if (driversError || !drivers) {
      console.log('RPC not available, using client-side filtering');
      
      const { data: allDrivers, error: allDriversError } = await supabase
        .from('drivers')
        .select(`
          id,
          user_id,
          vehicle_type,
          vehicle_number,
          vehicle_model,
          rating,
          current_latitude,
          current_longitude,
          user:users!drivers_user_id_fkey(name, phone, avatar_url)
        `)
        .eq('is_online', true)
        .eq('verification_status', 'approved')
        .eq('vehicle_type', booking.vehicle_type);

      if (allDriversError || !allDrivers) {
        res.status(200).json({ error: 'No drivers available', assigned: false });
        return;
      }

      const { data: queuedBookings } = await supabase
        .from('bookings')
        .select('driver_id')
        .eq('status', 'queued')
        .not('driver_id', 'is', null);

      const queuedDriverIds = new Set((queuedBookings || []).map((booking: any) => booking.driver_id));

      availableDrivers = allDrivers
        .filter((d: any) => !queuedDriverIds.has(d.id))
        .filter((d: any) => d.current_latitude && d.current_longitude)
        .map((d: any) => ({
          ...d,
          distance_km: calculateDistance(
            booking.origin_latitude,
            booking.origin_longitude,
            d.current_latitude,
            d.current_longitude
          ),
        }))
        .filter((d: any) => d.distance_km <= max_radius_km)
        .sort((a: any, b: any) => {
          if (a.distance_km !== b.distance_km) {
            return a.distance_km - b.distance_km;
          }
          return b.rating - a.rating;
        });
    }

    if (availableDrivers.length === 0) {
      res.status(200).json({
        error: 'No drivers available in your area',
        assigned: false,
        searched_radius_km: max_radius_km,
      });
      return;
    }

    const assignedDriver = availableDrivers[0];

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        driver_id: assignedDriver.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('status', 'pending'); // Ensure still pending

    if (updateError) {
      res.status(500).json({ error: 'Failed to assign driver', details: updateError.message });
      return;
    }

    await supabase.from('notifications').insert({
      user_id: assignedDriver.user_id,
      title: 'New Ride Request!',
      body: `Pickup: ${booking.origin_address}`,
      data: { booking_id, type: 'new_booking', target_app: 'driver' },
    });

    res.status(200).json({
      assigned: true,
      driver: {
        id: assignedDriver.id,
        name: assignedDriver.user?.name,
        phone: assignedDriver.user?.phone,
        avatar_url: assignedDriver.user?.avatar_url,
        vehicle_number: assignedDriver.vehicle_number,
        vehicle_model: assignedDriver.vehicle_model,
        rating: assignedDriver.rating,
        distance_km: Math.round(assignedDriver.distance_km * 10) / 10,
      },
    });

  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
