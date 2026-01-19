# Cart-R Integration Test Plan

This document outlines the detailed test cases for end-to-end integration testing of the Cart-R logistics platform.

## Test Environment Prerequisites
- Supabase project running and accessible.
- Two test accounts:
    - **Customer**: `test_customer@cartr.com` / `password123`
    - **Driver**: `test_driver@cartr.com` / `password123` (Must be verified and online)

## Test Scenarios

### Scenario 1: The Happy Path (Complete Ride)
**Objective**: Verify the standard flow from booking to completion works without errors.
**Steps**:
1.  Customer logs in.
2.  Driver logs in and sets status to `online`.
3.  Customer creates a booking (`status: pending`).
    - *Check*: Booking created in DB.
4.  Driver searches for available bookings.
    - *Check*: The new booking appears in the list.
5.  Driver accepts the booking (`status: accepted`).
    - *Check*: Booking status updates to `accepted`.
    - *Check*: Customer receives update (simulated check).
6.  Driver arrives at pickup (`status: driver_arrived`).
7.  Driver verifies OTP and starts trip (`status: in_progress`).
8.  Driver completes trip (`status: completed`).
9.  *Check*: Payment record created.

### Scenario 2: Driver Cancellation (The "Requeue" Logic)
**Objective**: Verify that when a driver cancels, the booking becomes available for others again.
**Steps**:
1.  Customer creates a booking.
2.  Driver accepts the booking.
3.  Driver decides to cancel (Reason: "Vehicle issue").
4.  *Check*:
    - Booking status reverts to `pending`.
    - `driver_id` is set to `null`.
    - Entry added to `driver_rejections` table.
5.  Driver searches for bookings again.
    - *Check*: This specific booking should NOT appear for this driver anymore (filtered by `driver_rejections`).

### Scenario 3: Customer Cancellation
**Objective**: Verify customer can cancel an active booking.
**Steps**:
1.  Customer creates a booking.
2.  Driver accepts.
3.  Customer cancels.
4.  *Check*: Booking status updates to `cancelled`.

### Scenario 4: Driver Rejection (Ignore)
**Objective**: Verify a driver can reject a request without accepting it first.
**Steps**:
1.  Customer creates a booking.
2.  Driver sees booking and clicks "Decline".
3.  *Check*:
    - Booking remains `pending`.
    - Entry added to `driver_rejections`.
    - Booking no longer visible to this driver.

## execution
Scripts will be located in `scripts/integration-tests/` and run using `ts-node`.
