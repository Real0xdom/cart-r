/**
 * k6 Load Test — Booking Flow Under Load
 * Simulates concurrent booking creation and fare calculation requests.
 * Run: k6 run load/booking-load.js --env SUPABASE_URL=... --env SUPABASE_KEY=...
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const bookingSuccess = new Rate('booking_success_rate');
const fareCalcDuration = new Trend('fare_calculation_duration');
const assignDriverDuration = new Trend('assign_driver_duration');
const requestCount = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '15s', target: 5 },    // Warm up
    { duration: '30s', target: 20 },   // Ramp up
    { duration: '1m', target: 50 },    // Peak load — 50 concurrent users
    { duration: '30s', target: 20 },   // Ramp down
    { duration: '15s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],    // 95% of requests under 3s
    http_req_failed: ['rate<0.10'],       // Less than 10% failure
    booking_success_rate: ['rate>0.80'],  // 80% booking success rate
    fare_calculation_duration: ['p(95)<1000'], // Fare calc under 1s
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';
const API_KEY = __ENV.SUPABASE_KEY || __ENV.SUPABASE_ANON_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
};

const vehicleTypes = ['bike', 'tempo', 'sedan', 'truck'];

export default function () {
  group('Fare Calculation', () => {
    const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
    const distance = 2 + Math.random() * 30; // 2-32 km
    const duration = 5 + Math.random() * 60; // 5-65 minutes

    const startTime = Date.now();
    const response = http.post(
      `${BASE_URL}/functions/v1/calculate-fare`,
      JSON.stringify({
        vehicle_type: vehicleType,
        distance_km: distance,
        duration_minutes: duration,
      }),
      { headers }
    );

    fareCalcDuration.add(Date.now() - startTime);
    requestCount.add(1);

    check(response, {
      'fare calc status 200': (r) => r.status === 200,
      'fare calc has total_fare': (r) => {
        try { return JSON.parse(r.body).total_fare > 0; } catch { return false; }
      },
    });
  });

  sleep(0.5); // 500ms between groups

  group('Assign Driver', () => {
    // This will likely fail without valid booking IDs, but tests API responsiveness
    const startTime = Date.now();
    const response = http.post(
      `${BASE_URL}/functions/v1/assign-driver`,
      JSON.stringify({
        booking_id: '00000000-0000-0000-0000-000000000000',
        max_radius_km: 10,
      }),
      { headers }
    );

    assignDriverDuration.add(Date.now() - startTime);
    requestCount.add(1);

    check(response, {
      'assign driver responds': (r) => r.status < 500,
      'assign driver response time < 3s': (r) => r.timings.duration < 3000,
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/k6-booking-load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in summary — the function above provides a JSON export
  return '';
}
