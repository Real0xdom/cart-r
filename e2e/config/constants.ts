/**
 * Test constants — timeouts, test data, and shared values
 */

// =====================================================
// TIMEOUTS (milliseconds)
// =====================================================
export const TIMEOUTS = {
  SHORT: 5_000,
  MEDIUM: 15_000,
  LONG: 30_000,
  EXTRA_LONG: 60_000,
  BOOKING_EXPIRY: 120_000,
  PAYMENT_TIMEOUT: 30 * 60 * 1_000, // 30 minutes (Cashfree order expiry)
  ELEMENT_WAIT: 10_000,
  ANIMATION_WAIT: 1_000,
  POLLING_INTERVAL: 2_000,
};

// =====================================================
// BOOKING STATUSES
// =====================================================
export const BOOKING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DRIVER_ARRIVED: 'driver_arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// =====================================================
// PAYMENT STATUSES
// =====================================================
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
} as const;

export const PAYMENT_METHOD = {
  CASH: 'cash',
  ONLINE: 'online',
  WALLET: 'wallet',
} as const;

// =====================================================
// DRIVER VERIFICATION STATUSES
// =====================================================
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// =====================================================
// VEHICLE TYPES
// =====================================================
export const VEHICLE_TYPES = {
  BIKE: 'bike',
  TEMPO: 'tempo',
  SEDAN: 'sedan',
  TRUCK: 'truck',
} as const;

// =====================================================
// TEST LOCATIONS (Real Indian coordinates)
// =====================================================
export const TEST_LOCATIONS = {
  MUMBAI_ANDHERI: {
    address: 'Andheri West, Mumbai, Maharashtra',
    latitude: 19.1364,
    longitude: 72.8296,
  },
  MUMBAI_BANDRA: {
    address: 'Bandra West, Mumbai, Maharashtra',
    latitude: 19.0596,
    longitude: 72.8295,
  },
  MUMBAI_DADAR: {
    address: 'Dadar West, Mumbai, Maharashtra',
    latitude: 19.0178,
    longitude: 72.8478,
  },
  DELHI_CONNAUGHT: {
    address: 'Connaught Place, New Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
  },
  DELHI_AIRPORT: {
    address: 'IGI Airport Terminal 3, New Delhi',
    latitude: 28.5562,
    longitude: 77.1000,
  },
  BANGALORE_KORAMANGALA: {
    address: 'Koramangala, Bangalore, Karnataka',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  BANGALORE_WHITEFIELD: {
    address: 'Whitefield, Bangalore, Karnataka',
    latitude: 12.9698,
    longitude: 77.7500,
  },
};

// =====================================================
// DEFAULT FARE CONFIG (mirrors DB fare_config table)
// =====================================================
export const DEFAULT_FARE_CONFIG = {
  bike: { baseFare: 25, perKmRate: 8, perMinRate: 1, minimumFare: 30, cancellationFee: 20 },
  tempo: { baseFare: 40, perKmRate: 15, perMinRate: 2, minimumFare: 60, cancellationFee: 30 },
  sedan: { baseFare: 60, perKmRate: 18, perMinRate: 2.5, minimumFare: 90, cancellationFee: 50 },
  truck: { baseFare: 120, perKmRate: 25, perMinRate: 3.5, minimumFare: 180, cancellationFee: 80 },
};

// =====================================================
// TEST PRIORITIES
// =====================================================
export const PRIORITY = {
  P0_CRITICAL: 'P0-Critical',
  P1_HIGH: 'P1-High',
  P2_MEDIUM: 'P2-Medium',
  P3_LOW: 'P3-Low',
} as const;

// =====================================================
// TEST TAGS
// =====================================================
export const TAGS = {
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  EDGE_CASE: '@edge-case',
  LOAD: '@load',
  MULTI_USER: '@multi-user',
} as const;
