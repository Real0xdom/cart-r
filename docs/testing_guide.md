# Integration Testing Guide

The integration test suite verifies the end-to-end flows of the Cart-R application, including booking creation, driver acceptance, cancellation, and completion.

## Location
The main test script is located at `apps/driver/integration-tests.ts`.

## Prerequisites
The tests require authenticated users to perform database operations (due to Row Level Security).
You must provide credentials for a valid **Customer** and **Driver** account, OR provide the Service Role Key to bypass restrictions (not recommended for production).

## How to Run
Run the script using `ts-node`. You can pass environment variables inline or ensure they are in your `.env`.

### Option 1: Using Existing Users (Recommended)
Set the email and password for a verified Customer and Driver account.

```bash
# Windows (PowerShell)
$env:TEST_CUSTOMER_EMAIL="valid_customer@example.com"
$env:TEST_CUSTOMER_PASSWORD="customer_pass"
$env:TEST_DRIVER_EMAIL="valid_driver@example.com"
$env:TEST_DRIVER_PASSWORD="driver_pass"
npx ts-node -T apps/driver/integration-tests.ts
```

### Option 2: Default Credentials
The script defaults to `test_customer_e2e@cartr.com` / `password123`. If these users do not exist or are not verified, the test **will fail** with an authentication error.

## Scenarios Covered
1.  **Happy Path**: Full ride flow (Book -> Accept -> Arrive -> Start -> Complete).
2.  **Driver Cancellation**: Driver accepts then cancels -> Booking re-opens.
3.  **Driver Rejection**: Driver ignores/rejects a booking -> Logged in rejections.
4.  **Customer Cancellation**: Customer cancels an accepted ride -> Status `cancelled`.
5.  **Double Acceptance (Edge Case)**: Verifies behavior when multiple acceptances occur (Concurrency).
6.  **Invalid Transition (Edge Case)**: Verifies that invalid state jumps (Pending -> Completed) are blocked.
