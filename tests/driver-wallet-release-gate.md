# Driver Wallet Release Gate

## Automated Execution
- DB regression: `psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/driver-wallet-db-tests.sql`
- Unit and API logic checks: `npm run test:wallet:unit`
- Staging API and multi-user checks: `npm run test:wallet:api`

## Staging Setup
- Confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, and `ADMIN_URL`.
- Use a staging Supabase project and Cashfree sandbox.
- Seed or create dedicated customer and driver accounts tagged for cleanup.
- Run `tests/driver-wallet-monitoring.sql` before and after test execution to capture deltas.

## Manual Device Matrix

### Core Scenarios
1. Cash ride with positive wallet balance
   - Start with driver balance `Rs 500`.
   - Complete a `Rs 1000` cash ride at `15%` commission.
   - Verify collect-payment screen shows `15%`, `-Rs 150`, and net `Rs 850`.
   - Verify wallet moves `Rs 500 -> Rs 350`.
   - Verify earnings page updates within 2 seconds and ledger shows one `earning` plus one `platform_fee`.

2. Cash ride that creates negative balance
   - Start with driver balance `Rs 80`.
   - Complete a `Rs 800` cash ride at `15%`.
   - Verify wallet moves `Rs 80 -> -Rs 40`.
   - Verify negative balance styling is visible and debt text shows `Rs 40`.
   - Verify driver can still go online and accept a new ride.

3. Wallet blocking below threshold
   - Start with driver balance `-Rs 120`.
   - Try to go online and accept a new ride.
   - Verify the app shows "Wallet Recharge Required", exact balance, and recommended recharge `Rs 220`.
   - Recharge `Rs 300`.
   - Verify wallet becomes `Rs 180` and the driver can go online again.

4. Realtime wallet update across devices
   - Log into the same driver on two physical devices.
   - Keep device A on the earnings screen.
   - Complete a cash ride or successful wallet top-up on device B.
   - Verify device A updates balance and ledger within 2 seconds without manual refresh.
   - Verify the visual change indicator appears, then disappears after a few seconds.

5. Recharge flow resilience
   - Start a driver wallet top-up and background the app during checkout.
   - Return after payment success.
   - Verify `verify-payment` or webhook completion updates the wallet exactly once.
   - Confirm no duplicate credit appears in `driver_wallet_transactions`.

### Edge Cases
- Recharge while a ride is already in progress.
- Network loss during realtime update, then reconnect.
- Five rapid rides in two minutes with no missing commission deductions.
- Missing commission settings row falls back to `15%` and does not crash the app.
- Negative available balance with positive pending balance displays both values clearly.
- Withdrawal action remains blocked when `available_balance <= 0` or when a pending withdrawal exists.
- App reinstall or new device login restores wallet state from the server.
- Very large debt such as `-Rs 10000` still computes the correct required recharge.

## Release Blockers
- Any commission display mismatch with backend deduction.
- Duplicate driver-wallet top-up credit.
- Acceptance allowed below `-100.00`.
- Wallet or ledger realtime update slower than 2 seconds.
- Settlement drift greater than `Rs 1`.
- Commission-rate change scenario shows a different behavior than the product decision.

## Known Risk To Validate Explicitly
- Current backend behavior recalculates commission from live `platform_settings` when `credit_driver_earning` runs.
- If the product requirement is "rides already in progress keep the old rate", treat any live-rate recalculation as a no-go blocker until booking-level commission snapshotting exists.
