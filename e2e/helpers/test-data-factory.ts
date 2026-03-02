/**
 * Test Data Factory
 * Generates realistic test data for CARTR test scenarios.
 */
import { TEST_LOCATIONS, VEHICLE_TYPES } from '../config/constants';

let phoneCounter = 0;

// =====================================================
// PHONE NUMBERS
// =====================================================

export function generatePhoneNumber(): string {
  phoneCounter++;
  const suffix = String(phoneCounter).padStart(5, '0');
  return `+919${suffix}${Date.now().toString().slice(-5)}`;
}

export function generateFixedPhoneNumber(index: number): string {
  return `+91999990${String(index).padStart(4, '0')}`;
}

// =====================================================
// USER DATA
// =====================================================

export function generateCustomerData(overrides: Partial<{
  phone: string;
  name: string;
  email: string;
  balance: number;
}> = {}) {
  const idx = Date.now() % 10000;
  return {
    phone: overrides.phone || generatePhoneNumber(),
    name: overrides.name || `Test Customer ${idx}`,
    email: overrides.email || `customer_${idx}@cartr.test`,
    balance: overrides.balance ?? 500,
  };
}

export function generateDriverData(overrides: Partial<{
  phone: string;
  name: string;
  vehicleType: string;
  verificationStatus: string;
  latitude: number;
  longitude: number;
}> = {}) {
  const idx = Date.now() % 10000;
  return {
    phone: overrides.phone || generatePhoneNumber(),
    name: overrides.name || `Test Driver ${idx}`,
    vehicleType: overrides.vehicleType || VEHICLE_TYPES.SEDAN,
    verificationStatus: overrides.verificationStatus || 'approved',
    latitude: overrides.latitude ?? TEST_LOCATIONS.MUMBAI_ANDHERI.latitude,
    longitude: overrides.longitude ?? TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
  };
}

// =====================================================
// BOOKING DATA
// =====================================================

export function generateBookingData(overrides: Partial<{
  origin: { address: string; latitude: number; longitude: number };
  destination: { address: string; latitude: number; longitude: number };
  vehicleType: string;
  totalFare: number;
  receiverName: string;
  receiverPhone: string;
}> = {}) {
  return {
    origin: overrides.origin || TEST_LOCATIONS.MUMBAI_ANDHERI,
    destination: overrides.destination || TEST_LOCATIONS.MUMBAI_BANDRA,
    vehicleType: overrides.vehicleType || VEHICLE_TYPES.SEDAN,
    totalFare: overrides.totalFare || 150,
    receiverName: overrides.receiverName || null,
    receiverPhone: overrides.receiverPhone || null,
  };
}

export function generateGoodsDeliveryData(overrides: Partial<{
  receiverName: string;
  receiverPhone: string;
  goodsDescription: string;
  goodsWeightKg: number;
}> = {}) {
  return {
    receiverName: overrides.receiverName || 'Test Receiver',
    receiverPhone: overrides.receiverPhone || '+919888800001',
    goodsDescription: overrides.goodsDescription || 'Test package - 2 boxes',
    goodsWeightKg: overrides.goodsWeightKg || 5,
  };
}

// =====================================================
// BANK / PAYMENT DATA
// =====================================================

export function generateBankDetails() {
  return {
    accountNumber: '1234567890123456',
    ifsc: 'SBIN0001234',
    accountHolderName: 'Test Driver Account',
    bankName: 'State Bank of India',
  };
}

export function generateWalletTopupData(amount: number = 500) {
  return {
    amount,
    customerName: 'Test Customer',
    customerEmail: 'test@cartr.test',
    customerPhone: '9999900001',
  };
}

// =====================================================
// ADMIN DATA
// =====================================================

export function generateAdminCredentials() {
  return {
    email: (process.env.ADMIN_EMAIL || 'admin@cartr.com').toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || 'adminpassword',
  };
}

// =====================================================
// RATINGS DATA
// =====================================================

export function generateRatingData(overrides: Partial<{
  rating: number;
  review: string;
  tags: string[];
}> = {}) {
  return {
    rating: overrides.rating || Math.floor(3 + Math.random() * 3), // 3-5 stars
    review: overrides.review || 'Good ride, arrived on time.',
    tags: overrides.tags || ['punctual', 'clean_vehicle'],
  };
}

// =====================================================
// SUPPORT TICKET DATA
// =====================================================

export function generateSupportTicketData(overrides: Partial<{
  subject: string;
  description: string;
  priority: string;
}> = {}) {
  return {
    subject: overrides.subject || 'Test Support Ticket',
    description: overrides.description || 'This is an automated test support ticket for E2E testing.',
    priority: overrides.priority || 'medium',
  };
}

// =====================================================
// COORDINATE HELPERS
// =====================================================

/**
 * Generate a random coordinate within a radius (in km) from a center point.
 */
export function randomCoordinateNear(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 5
): { latitude: number; longitude: number } {
  const radiusInDegrees = radiusKm / 111; // ~111 km per degree
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  return {
    latitude: centerLat + x,
    longitude: centerLng + y / Math.cos(centerLat * (Math.PI / 180)),
  };
}

/**
 * Calculate approximate distance between two coordinates (km).
 */
export function approximateDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
