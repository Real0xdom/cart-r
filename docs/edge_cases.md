# Extreme Edge Case Scenarios

The integration test suite has been expanded to include 6 aggressive scenarios designed to find vulnerabilities and logic flaws.

## S5: Double Acceptance (Concurrency)
**Goal**: Verify if two drivers can accept the same booking effectively simultaneously.
**Expected**: The first `update` succeeds. The second `update` should fail (RLS Policy or Status Check) or be idempotent (no-op).
**Risk**: If both succeed, the booking has two drivers, leading to data corruption.

## S6: Invalid Transition (State Machine)
**Goal**: Verify if a driver can force a booking from `pending` directly to `completed`, skipping the ride.
**Expected**: Comparison logic or RLS triggering a failure.
**Risk**: Drivers getting paid for rides they didn't do.

## S7: Fuzzing / Invalid Inputs
**Goal**: Inject negative values (`total_fare: -50`), massive strings (5KB), and SQL injection patterns into booking fields.
**Expected**: Database constraints or input sanitization should reject or neutralize these.
**Risk**: Financial loss or database compromise.

## S8: Simultaneous Bookings
**Goal**: Verify if a customer can create a second pending booking while one is already active.
**Expected**: Business logic should prevent multiple active bookings per customer.
**Risk**: User confusion and state management issues.

## S9: Offline Acceptance
**Goal**: Verify if a driver can accept a booking *immediately* after marking themselves `offline`.
**Expected**: The system should allow acceptance only if `status` is `online`.
**Risk**: Drivers receiving assignments when they are not working.

## S10: Fare Tampering
**Goal**: Verify if a driver can manually override the `total_fare` to an arbitrary value (e.g., 0.01) when completing a ride.
**Expected**: The system should likely ignore the client-provided fare and calculate it server-side, or block the update.
**Risk**: Severe revenue loss.

## S11: Driver Self-Booking (Fraud)
**Goal**: Verify if a driver can accept a booking they created themselves (as a customer).
**Expected**: RLS or logic should prevent `driver_id` from being the same as `customer_id` (or linked user).
**Risk**: Incentive/Engagement fraud.

## S12: Status Regression (Immutable History)
**Goal**: Verify `completed` rides cannot be moved back to `in_progress`.
**Expected**: Database constraints or RLS should block transitions out of terminal states.
**Risk**: Data integrity and billing confusion.

## S13: Invalid OTP
**Goal**: Verify that providing the wrong OTP prevents the ride from starting (Transition to `in_progress`).
**Expected**: RPC should return error or update should fail.
**Risk**: Passenger safety (wrong passenger picked up).

## S14: Double Completion (Idempotency)
**Goal**: Verify that calling `complete` status update twice doesn't trigger side effects (like double payment).
**Expected**: Second call should be a no-op or return success without re-processing payment.
**Risk**: Double charging customers.

## S15: Withdrawal Flow
**Goal**: Verify the logic for requesting a payout.
**Expected**: Checks for bank details and sufficient balance before creating a `pending` withdrawal.
**Risk**: Financial errors (overdrawing).

## S16: Rating Security
**Goal**: Verify that a customer cannot directly update the `drivers.rating` column.
**Expected**: RLS policies should BLOCK this update.
**Risk**: Reputation manipulation.

## How to Run
```bash
# Requires Service Role Key or Valid User Credentials
npx ts-node -T apps/driver/integration-tests.ts
```
