import { describe, it, expect } from 'vitest';

// Fare configuration mock (matching the one in apps/driver/lib/bookings.ts)
const FARE_CONFIG = {
  bike: { baseFare: 25, perKmRate: 8, perMinRate: 1, minimumFare: 30 },
  tempo: { baseFare: 40, perKmRate: 15, perMinRate: 2, minimumFare: 60 },
  sedan: { baseFare: 60, perKmRate: 18, perMinRate: 2.5, minimumFare: 90 },
  truck: { baseFare: 120, perKmRate: 25, perMinRate: 3.5, minimumFare: 180 },
} as const;

function calculateFare(
  distanceKm: number,
  durationMinutes: number,
  vehicleType: keyof typeof FARE_CONFIG
): number {
  const config = FARE_CONFIG[vehicleType];
  const distanceFare = distanceKm * config.perKmRate;
  const timeFare = durationMinutes * config.perMinRate;
  const totalFare = config.baseFare + distanceFare + timeFare;
  
  return Math.max(Math.round(totalFare), config.minimumFare);
}

describe('Fare Calculation', () => {
  it('calculates correct fare for bike', () => {
    // base: 25, 5km * 8 = 40, 10min * 1 = 10 -> total = 75
    expect(calculateFare(5, 10, 'bike')).toBe(75);
  });

  it('calculates correct fare for sedan', () => {
    // base: 60, 10km * 18 = 180, 20min * 2.5 = 50 -> total = 290
    expect(calculateFare(10, 20, 'sedan')).toBe(290);
  });

  it('enforces minimum fare for short trips', () => {
    // bike base: 25, 0.1km * 8 = 0.8, 1min * 1 = 1 -> total = 26.8
    // minimum fare is 30
    expect(calculateFare(0.1, 1, 'bike')).toBe(30);
    
    // sedan base: 60, 0.5km * 18 = 9, 2min * 2.5 = 5 -> total = 74
    // minimum fare is 90
    expect(calculateFare(0.5, 2, 'sedan')).toBe(90);
  });

  it('handles zero distance and duration', () => {
    // Should return minimum fare
    expect(calculateFare(0, 0, 'tempo')).toBe(60);
    expect(calculateFare(0, 0, 'truck')).toBe(180);
  });

  it('rounds fare to nearest integer', () => {
    // tempo base: 40, 2.7km * 15 = 40.5, 5.3min * 2 = 10.6 -> total = 91.1 (rounds to 91)
    expect(calculateFare(2.7, 5.3, 'tempo')).toBe(91);
    
    // tempo base: 40, 2.7km * 15 = 40.5, 5.4min * 2 = 10.8 -> total = 91.3 (rounds to 91)
    expect(calculateFare(2.7, 5.4, 'tempo')).toBe(91);
    
    // tempo base: 40, 2.7km * 15 = 40.5, 5.5min * 2 = 11.0 -> total = 91.5 (rounds to 92)
    expect(calculateFare(2.7, 5.5, 'tempo')).toBe(92);
  });
});
