# Comprehensive Edge Case Testing Guide for Cartr Logistics MVP

This document outlines critical edge cases and failure patterns for the Cartr Minimum Viable Product (MVP), designed to ensure production readiness across the entire system architecture. The analysis is informed by common challenges in on-demand logistics platforms, such as Porter, and specific vulnerabilities inherent to the chosen technology stack: **React Native** for mobile applications, **Next.js** for the web console, and **Supabase** for the backend and real-time infrastructure [1] [2].

## The Importance of Edge Case Testing in Logistics

In the logistics domain, the "happy path" (a successful, uninterrupted delivery) is often the exception rather than the rule. Real-world variables—such as network instability, GPS inaccuracies, and human error—create complex scenarios that can lead to data corruption, financial loss, and customer frustration if not handled gracefully [3]. Edge case testing focuses on validating system behavior at operational boundaries and under extreme or unlikely conditions, which is paramount for a reliable service like Cartr.

## 1. Driver Application Edge Cases (React Native)

The Driver App is highly susceptible to environmental factors, making robust handling of network and location failures essential. The following table details critical edge cases for the Driver App.

| Category | Edge Case Scenario | Expected System Behavior |
| :--- | :--- | :--- |
| **Network Instability** | **Dead Zone Transition**: Driver enters an area with no signal (e.g., basement, tunnel) immediately after tapping "Start Trip" or "Complete Delivery." | The app must queue the action locally and retry submission immediately upon reconnection. The UI should clearly indicate the pending status to the driver. |
| **Real-time Failure** | **Supabase Reconnection**: The real-time subscription drops and fails to automatically re-establish, causing the driver to miss a new order notification. | The app must implement a robust reconnection and re-subscription logic, potentially falling back to a periodic REST API poll for critical updates if real-time fails persistently [4]. |
| **Location Services** | **GPS Drift/Inaccuracy**: Driver is physically at the pickup location, but GPS reports a location 50 meters away, preventing the "Arrived" button from activating. | The app should allow for a manual override of the "Arrived" status, subject to admin review, or implement a geofence with a generous buffer zone. |
| **Concurrency** | **Double Acceptance**: Two drivers attempt to accept the same order simultaneously. | The Supabase database must enforce atomic updates (e.g., using a transaction or a `WHERE` clause on the current status) to ensure only the first successful update is committed, and the second driver receives an immediate "Order Taken" notification. |
| **App State** | **Background Throttling**: The OS (iOS/Android) kills the app's background process while the driver is en route, stopping location updates. | The app must use foreground services (React Native background tasks) to maintain critical location tracking and notify the driver if the service is interrupted. |

## 2. Customer Application Edge Cases (React Native)

The Customer App requires seamless interaction, especially during high-stakes moments like payment and real-time tracking.

| Category | Edge Case Scenario | Expected System Behavior |
| :--- | :--- | :--- |
| **Payment Processing** | **Payment Gateway Timeout**: User submits payment, the gateway times out, but the payment is eventually successful. | The system must use a webhook from the payment gateway to confirm the final status, not just the app's immediate response. The order status should remain "Pending Payment" until confirmed, and the user should be notified of the delay. |
| **Pricing Logic** | **Price Fluctuation**: The calculated fare changes between the quote generation and the user clicking "Book Now" due to a sudden surge or a change in traffic data. | The app must present a clear confirmation dialog if the price has changed by more than a defined threshold (e.g., 5%) before final booking. |
| **Real-time Tracking** | **Stale Data**: The driver's location feed stops updating (e.g., due to driver app crash), and the customer sees a driver who is stationary for an extended period. | The app should display a warning message to the customer (e.g., "Driver's location is temporarily unavailable") after a set timeout (e.g., 5 minutes) and notify the Admin Console. |
| **User Input** | **Invalid Address**: User enters a valid-looking address that is outside the service area or cannot be geocoded by the mapping service. | The app must validate the address against the service area boundaries and provide specific, actionable feedback to the user (e.g., "This location is outside our current service zone"). |

## 3. Admin Web Console Edge Cases (Next.js)

The Admin Console, built with Next.js, is the control center and must handle data integrity and bulk operations reliably.

| Category | Edge Case Scenario | Expected System Behavior |
| :--- | :--- | :--- |
| **Data Integrity** | **Stale UI**: An Admin is viewing an order marked "Pending" while a driver accepts it via the mobile app. The Admin attempts to manually assign a different driver. | The Admin Console must use Supabase Realtime to subscribe to order status changes. The UI should update instantly, and the manual assignment action should be blocked with an error message like "Order status has changed to Accepted." |
| **Bulk Operations** | **Partial Failure**: An Admin attempts a bulk action (e.g., mass cancellation of 100 orders), and 5 orders fail due to database constraints or rate limits. | The Next.js API route must handle the bulk operation in a transactional or idempotent manner, logging all failures and providing the Admin with a detailed report of which orders succeeded and which failed. |
| **Security** | **Session Expiry**: An Admin performs a sensitive action (e.g., issuing a refund) just as their Supabase session token expires. | The application must catch the 401 Unauthorized error and redirect the user to the login page without executing the sensitive action, ensuring no partial state change occurs. |
| **Manual Override** | **Conflicting Status**: An Admin manually changes an order status (e.g., from "Picked Up" to "Cancelled") after the driver has already completed the delivery. | The system must enforce a strict state machine. The Admin should be prompted with a warning about the conflicting state, and the action should require a mandatory reason and potentially an audit log entry. |

## 4. Critical Supabase and Tech Stack Edge Cases

The Supabase backend is the core of the real-time functionality. Testing must focus on its limits and resilience.

### Real-time Connection Management
The real-time nature of a logistics app depends heavily on the stability of Supabase's Channels. Edge cases here relate to the resilience of the connection:

*   **Connection Quotas**: During peak demand, the number of concurrent connections (drivers, customers, admin users) may exceed the limits of the current Supabase plan (e.g., Nano/Micro). This will cause new users to fail to connect to the tracking channel. **Testing Requirement**: Simulate a high volume of concurrent users to verify the system's behavior when the quota is reached.
*   **Authorization Leaks**: Row Level Security (RLS) is crucial for ensuring a customer only sees their own order and a driver only sees relevant orders. **Testing Requirement**: Attempt to subscribe to a real-time channel for an order that the authenticated user (driver or customer) should not have access to. The RLS policy must prevent the subscription or return an empty result.

### Database Integrity and Concurrency
The database must maintain consistency, especially during simultaneous updates.

*   **Ghost Orders**: A database trigger responsible for sending a driver notification fails (e.g., due to a temporary database issue or a bug in the trigger function). The order is marked as "Accepted" in the main table but the driver is never notified. **Testing Requirement**: Manually induce a failure in a critical database trigger (e.g., by introducing a syntax error in a test environment) and observe the resulting order state.
*   **Race Conditions in Allocation**: The core logic for assigning a driver is a classic race condition. If two drivers are eligible and attempt to claim the job, the database must ensure only one succeeds. **Testing Requirement**: Simulate two concurrent API calls to the driver allocation function and verify that the database's locking mechanism (e.g., `FOR UPDATE` or a unique constraint on the assignment table) correctly serializes the operation.

## Conclusion

Testing the Cartr MVP for production requires moving beyond simple functional tests to focus on the complex, interconnected edge cases that define real-world logistics operations. By prioritizing testing in the areas of network resilience, location accuracy, concurrency handling, and Supabase-specific real-time limits, the Cartr team can significantly reduce the risk of critical failures upon launch. The table below summarizes the most critical edge cases for immediate testing.

| Component | Critical Edge Case | Failure Impact |
| :--- | :--- | :--- |
| **Driver App** | Network loss during "Start Trip" action. | Data inconsistency; trip is active in the app but not recorded in the database. |
| **Customer App** | Payment success but app crash before final confirmation. | Customer charged but no order created; high-priority support ticket. |
| **Admin Console** | Stale UI leading to manual assignment of an already accepted order. | Redundant work, driver frustration, and potential double-booking. |
| **Supabase Backend** | Real-time connection quota exceeded during peak hours. | New users cannot track orders or receive notifications; system appears down. |

***

### References

[1] The Code Work. *Porter Logistics Case-study: The Intra-city & Intercity logistics*. [URL: https://thecodework.com/explore/porter-intra-city-intercity-logistics/].
[2] QATestLab. *End-to-End Testing in Logistics: Why It Matters*. [URL: https://blog.qatestlab.com/2025/09/01/end-to-end-testing-in-logistics-why-it-matters-and-how-to-do-it-right/].
[3] Virtuoso QA. *Edge Case Testing Explained – What to Test & How to Do It*. [URL: https://www.virtuosoqa.com/post/edge-case-testing].
[4] Supabase. *Realtime Concepts: Connection Management*. [URL: https://supabase.com/docs/guides/realtime/concepts#connection-management].
