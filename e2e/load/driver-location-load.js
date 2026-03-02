/**
 * k6 Load Test — Driver Location Updates Under Load
 * Simulates 100 drivers sending concurrent location updates.
 * Run: k6 run load/driver-location-load.js --env SUPABASE_URL=... --env SUPABASE_KEY=...
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const locationUpdateDuration = new Trend('location_update_duration');
const locationUpdateSuccess = new Rate('location_update_success');

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 100 },  // 100 concurrent drivers updating location
    { duration: '1m', target: 100 },   // Sustained load
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    location_update_success: ['rate>0.90'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const API_KEY = __ENV.SUPABASE_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
  'Prefer': 'return=minimal',
};

// Mumbai area coordinates
const CENTER_LAT = 19.076;
const CENTER_LNG = 72.877;

export default function () {
  const driverId = `test-driver-${__VU}`; // Virtual user as driver ID
  const latitude = CENTER_LAT + (Math.random() - 0.5) * 0.1;
  const longitude = CENTER_LNG + (Math.random() - 0.5) * 0.1;
  const heading = Math.random() * 360;
  const speed = Math.random() * 60;

  const startTime = Date.now();

  // Simulate location insert (would normally go through Supabase REST API)
  const response = http.post(
    `${BASE_URL}/rest/v1/driver_locations`,
    JSON.stringify({
      driver_id: driverId,
      latitude: latitude,
      longitude: longitude,
      heading: heading,
      speed: speed,
      accuracy: 10 + Math.random() * 20,
    }),
    { headers }
  );

  locationUpdateDuration.add(Date.now() - startTime);
  locationUpdateSuccess.add(response.status < 400 ? 1 : 0);

  check(response, {
    'location update accepted': (r) => r.status < 400,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(2); // Location update every 2 seconds per driver
}
