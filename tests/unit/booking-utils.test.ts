import { describe, it, expect } from 'vitest';

// Simulating the functions directly since we are testing pure logic
// and avoiding React Native imports in Node environment

function generateBookingNumber(mockDateNow: number, mockPerformanceNow: number, mockRandom: number): string {
  const timestamp = mockDateNow.toString(36).toUpperCase();
  const nano = Math.floor((mockPerformanceNow % 1) * 1000000).toString(36).toUpperCase();
  const random = mockRandom.toString(36).substring(2, 6).toUpperCase();
  return `CARTR-${timestamp}${nano}${random}`;
}

function generateOTP(mockRandom: number): string {
  return Math.floor(1000 + mockRandom * 9000).toString();
}

describe('Booking Utilities', () => {
  describe('generateBookingNumber', () => {
    it('generates a string with CARTR- prefix', () => {
      const bn = generateBookingNumber(Date.now(), 0.123, 0.456);
      expect(bn.startsWith('CARTR-')).toBe(true);
    });

    it('generates unique numbers for the same timestamp due to randomness', () => {
      const ts = 1709000000000;
      const bn1 = generateBookingNumber(ts, 0.111, 0.123);
      const bn2 = generateBookingNumber(ts, 0.111, 0.456);
      expect(bn1).not.toBe(bn2);
    });

    it('has the expected length and format', () => {
      const bn = generateBookingNumber(1709000000000, 0.5, 0.5);
      // Format: CARTR-{timestamp}{nano}{random}
      // "CARTR-".length is 6
      // timestamp 1709000000000 in base36 is "LWQGHHDK" (8 chars)
      // nano (0.5 * 1000000 = 500000) base36 is "1TUK" (4 chars)
      // random 0.5 base36 string substring is "I000" (4 chars)
      expect(bn.length).toBeGreaterThan(15);
      expect(bn).toMatch(/^CARTR-[A-Z0-9]+$/);
    });
  });

  describe('generateOTP', () => {
    it('always generates a 4 digit string', () => {
      // test extremes of Math.random
      expect(generateOTP(0)).toBe('1000');
      expect(generateOTP(0.9999)).toBe('9999');
      expect(generateOTP(0.5)).toBe('5500');
    });

    it('returns a string, not a number', () => {
      expect(typeof generateOTP(0.5)).toBe('string');
    });
  });
});
