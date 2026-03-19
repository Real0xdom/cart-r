import { describe, it, expect } from 'vitest';

// -----------------------------------------------------------------------------
// XSS Sanitization Tests
// -----------------------------------------------------------------------------

// Replicated escapeHtml from cashfree-checkout/index.ts for testing
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\\/g, '\\\\');
}

describe('XSS Sanitization - escapeHtml', () => {
  it('escapes script tags', () => {
    const malicious = '<script>alert("XSS")</script>';
    const safe = escapeHtml(malicious);
    expect(safe).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    // Ensure original malicious sequence is not present
    expect(safe).not.toContain('<script>');
  });

  it('escapes HTML attributes', () => {
    const malicious = 'onload="alert(1)" onload=\'alert(2)\'';
    const safe = escapeHtml(malicious);
    expect(safe).toBe('onload=&quot;alert(1)&quot; onload=&#039;alert(2)&#039;');
  });

  it('escapes standalone dangerous characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('\\')).toBe('\\\\');
  });

  it('returns safe string unchanged', () => {
    const safePayload = 'session_12345';
    expect(escapeHtml(safePayload)).toBe('session_12345');
  });
});

// -----------------------------------------------------------------------------
// OTP Crypto Generation Tests
// -----------------------------------------------------------------------------

// Replicating generateBookingOTP from lib/auth.ts for testing
const generateBookingOTP = (): string => {
  // Use crypto.getRandomValues if available (web/browser), fallback to Math.random for React Native
  let randomValue: number;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    randomValue = array[0];
  } else {
    // Fallback for React Native (crypto not available)
    randomValue = Math.floor(Math.random() * 9000);
  }
  return (1000 + (randomValue % 9000)).toString();
};

describe('OTP Crypto Generation - generateBookingOTP', () => {
  it('generates a 4-digit string', () => {
    const otp = generateBookingOTP();
    expect(typeof otp).toBe('string');
    expect(otp.length).toBe(4);
    // Should be purely numeric
    expect(/^\d{4}$/.test(otp)).toBe(true);
  });

  it('stays within 1000 and 9999 boundaries', () => {
    // Test 1000 iterations to check boundaries
    for (let i = 0; i < 1000; i++) {
      const otp = generateBookingOTP();
      const otpNum = parseInt(otp, 10);
      expect(otpNum).toBeGreaterThanOrEqual(1000);
      expect(otpNum).toBeLessThanOrEqual(9999);
    }
  });

  it('shows reasonable distribution (no obvious clustering)', () => {
    // Generate 1000 OTPs and make sure we get a good unique set
    const otps = new Set<string>();
    for (let i = 0; i < 1000; i++) {
        otps.add(generateBookingOTP());
    }
    // High probability we'll get at least 800 unique values out of 1000 attempts 
    // against 9000 possible values, mathematically expecting ~945.
    expect(otps.size).toBeGreaterThan(800);
  });
});

// -----------------------------------------------------------------------------
// Coordinate Validation Tests 
// -----------------------------------------------------------------------------

function isValidCoordinateSet(origin_lat: any, origin_lng: any, dest_lat: any, dest_lng: any) {
    if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
        return false;
    }
    return true;
}

describe('Coordinate Validation', () => {
    it('allows 0 as a valid coordinate', () => {
        expect(isValidCoordinateSet(0, 0, 0, 0)).toBe(true);
        expect(isValidCoordinateSet(12.34, 0, -56.78, 0)).toBe(true);
    });

    it('rejects null and undefined', () => {
        expect(isValidCoordinateSet(null, 1, 2, 3)).toBe(false);
        expect(isValidCoordinateSet(1, undefined, 2, 3)).toBe(false);
        expect(isValidCoordinateSet(undefined, undefined, undefined, undefined)).toBe(false);
    });
});
