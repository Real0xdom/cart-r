import { describe, it, expect } from 'vitest';

function toRad(value: number): number {
  return value * (Math.PI / 180);
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

describe('Distance Calculation (Haversine)', () => {
  it('returns 0 for identical points', () => {
    expect(calculateDistance(18.5204, 73.8567, 18.5204, 73.8567)).toBe(0);
  });

  it('calculates expected distance (Pune to Mumbai)', () => {
    // Pune: ~18.5204, 73.8567
    // Mumbai: ~19.0760, 72.8777
    // Actual straight-line distance is ~120km
    const dist = calculateDistance(18.5204, 73.8567, 19.0760, 72.8777);
    
    expect(dist).toBeGreaterThan(115);
    expect(dist).toBeLessThan(125);
  });

  it('calculates proper symmetrical distances', () => {
    const lat1 = 18.5, lon1 = 73.8;
    const lat2 = 28.6, lon2 = 77.2;
    
    // Distance A -> B should be exactly distance B -> A
    const dist1 = calculateDistance(lat1, lon1, lat2, lon2);
    const dist2 = calculateDistance(lat2, lon2, lat1, lon1);
    
    expect(dist1).toBeCloseTo(dist2, 5);
  });

  it('handles antipodal points (~20,000 km)', () => {
    // North Pole to South Pole
    const dist = calculateDistance(90, 0, -90, 0);
    // 2 * π * R / 2 ≈ π * R ≈ 3.14159 * 6371 ≈ 20015 km
    expect(dist).toBeGreaterThan(20000);
    expect(dist).toBeLessThan(20030);
  });
});
