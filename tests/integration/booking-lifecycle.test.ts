import { describe, it, expect } from 'vitest';

describe('Booking Lifecycle Integration Simulator', () => {
  it('moves booking from pending to accepted to completed', () => {
    // Simulated DB state
    const db = {
      bookings: [
        { id: 'b1', status: 'pending', driver_id: null }
      ]
    };

    // 1. Driver Accept (simulate atomic RPC)
    const acceptBooking = (bookingId: string, driverId: string) => {
      const b = db.bookings.find(x => x.id === bookingId);
      if (!b) return { success: false, error: 'Not found' };
      if (b.status !== 'pending') return { success: false, error: 'Already accepted' };
      
      b.status = 'accepted';
      b.driver_id = driverId;
      return { success: true };
    };

    const accept1 = acceptBooking('b1', 'd1');
    expect(accept1.success).toBe(true);
    expect(db.bookings[0].status).toBe('accepted');
    expect(db.bookings[0].driver_id).toBe('d1');

    // 2. Race condition test: second driver tries to accept
    const accept2 = acceptBooking('b1', 'd2');
    expect(accept2.success).toBe(false);
    expect(accept2.error).toBe('Already accepted');
    expect(db.bookings[0].driver_id).toBe('d1'); // still belongs to d1

    // 3. Mark Arrived
    const markArrived = (bookingId: string) => {
       const b = db.bookings.find(x => x.id === bookingId);
       if (b && b.status === 'accepted') {
         b.status = 'driver_arrived';
         return true;
       }
       return false;
    };
    
    expect(markArrived('b1')).toBe(true);
    expect(db.bookings[0].status).toBe('driver_arrived');

    // 4. Start Trip
    const startTrip = (bookingId: string) => {
       const b = db.bookings.find(x => x.id === bookingId);
       if (b && b.status === 'driver_arrived') {
         b.status = 'in_progress';
         return true;
       }
       return false;
    };

    expect(startTrip('b1')).toBe(true);
    expect(db.bookings[0].status).toBe('in_progress');

    // 5. Complete
    const completeTrip = (bookingId: string) => {
       const b = db.bookings.find(x => x.id === bookingId);
       if (b && (b.status === 'in_progress' || b.status === 'delivered')) {
         b.status = 'completed';
         return true;
       }
       return false;
    };

    expect(completeTrip('b1')).toBe(true);
    expect(db.bookings[0].status).toBe('completed');
  });
});
