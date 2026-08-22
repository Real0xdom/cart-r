# Cartr MVP Core Functional Testing Use Cases

This document provides a set of essential testing use cases for the core functionality of the Cartr Minimum Viable Product (MVP). These cases are designed to validate the primary "happy path" workflows and ensure the fundamental interactions between the Customer App, Driver App, and Admin Web Console are robust and reliable.

The test cases are organized by application component and focus on the main objective of an on-demand logistics platform: successfully moving a package from point A to point B.

## 1. Customer Application Use Cases (React Native)

The Customer App's core function is to allow users to book, track, and pay for a delivery.

| Test Case ID | Description | Steps | Expected Result | Tech Focus |
| :--- | :--- | :--- | :--- | :--- |
| **C-001** | **Successful End-to-End Booking and Completion** | 1. Log in. 2. Enter valid Pickup and Drop-off locations. 3. Get a quote and confirm booking. 4. Track driver arrival (Real-time). 5. Track trip progress (Real-time). 6. Trip completes, receive final invoice. 7. View trip in history. | Trip is successfully created, driver is assigned, real-time tracking works throughout, payment is processed, and trip details are visible in history. | Supabase Auth, Realtime, Database |
| **C-002** | **Real-time Driver Tracking** | 1. Book a trip and wait for driver assignment. 2. Observe the driver's icon on the map. 3. Close and re-open the app during transit. | Driver icon moves smoothly and accurately on the map. Tracking resumes instantly upon app re-opening. | React Native Location/Map, Supabase Realtime |
| **C-003** | **Trip Cancellation by Customer (Pre-Pickup)** | 1. Book a trip and wait for driver assignment. 2. Cancel the trip before the driver arrives at the pickup location. | Trip status updates to "Cancelled" instantly. Driver receives a "Trip Cancelled" notification. Customer is not charged a cancellation fee (or charged the minimum fee, if applicable). | Supabase Database, Realtime |
| **C-004** | **Payment Method Validation** | 1. Attempt to book a trip with an invalid/expired payment method. 2. Attempt to book a trip with a valid payment method. | Booking fails with a clear error message for the invalid method. Booking succeeds for the valid method. | Payment Gateway Integration, Next.js API Route |

## 2. Driver Application Use Cases (React Native)

The Driver App's core function is to manage the driver's availability and execute the delivery process efficiently.

| Test Case ID | Description | Steps | Expected Result | Tech Focus |
| :--- | :--- | :--- | :--- | :--- |
| **D-001** | **Go Online and Receive Order** | 1. Log in and set status to "Online." 2. Wait for a new order notification. 3. Accept the order. | Driver status updates to "Online" in the Admin Console. A clear, audible notification is received. Order details are displayed, and driver status changes to "En Route to Pickup." | Supabase Realtime, React Native Push Notifications |
| **D-002** | **Full Trip Execution** | 1. Accept an order. 2. Navigate to Pickup, tap "Arrived at Pickup." 3. Tap "Start Trip" (after loading package). 4. Navigate to Drop-off, tap "Arrived at Drop-off." 5. Tap "Complete Trip." | Customer tracking updates correctly at each stage. Driver is prompted to confirm delivery. Trip status changes to "Completed" in all systems. | React Native Location, Supabase Database |
| **D-003** | **Location Reporting in Background** | 1. Accept an order and start the trip. 2. Minimize the app and let it run in the background. 3. Check the customer app/admin console tracking. | Driver's location continues to update accurately in the background for a minimum of 10 minutes. | React Native Background Services, Supabase Realtime |
| **D-004** | **Network Interruption during Trip** | 1. Accept an order and start the trip. 2. Disconnect the device from the network (e.g., turn off Wi-Fi/Cellular). 3. Attempt to tap "Complete Trip." 4. Reconnect the network. | The app displays a "Network Error" or "Pending Sync" message. The "Complete Trip" action is successfully synced to the server upon network reconnection. | React Native Offline Sync Logic, Supabase API |

## 3. Admin Web Console Use Cases (Next.js)

The Admin Console's core function is to provide oversight, manage exceptions, and ensure system efficiency.

| Test Case ID | Description | Steps | Expected Result | Tech Focus |
| :--- | :--- | :--- | :--- | :--- |
| **A-001** | **Real-time Active Trip Monitoring** | 1. Log in to the Admin Console. 2. Have a customer book a trip and a driver accept it. 3. Observe the "Active Trips" dashboard. | The new trip appears instantly on the dashboard. The trip status and driver location update in real-time without manual refresh. | Next.js/Supabase Realtime Subscription, UI Rendering |
| **A-002** | **Manual Driver Assignment** | 1. Create a trip that is unassigned. 2. Select an available driver from the list. 3. Manually assign the driver to the trip. | The driver receives an immediate notification of the new assignment. The trip status changes from "Unassigned" to "Assigned" in the Admin Console. | Next.js API Route, Supabase Database Update |
| **A-003** | **Driver Status Management** | 1. View a driver's profile. 2. Change the driver's status from "Online" to "Offline" (or vice versa). 3. Check the driver app's status. | The driver's status updates instantly in the database and is reflected in the driver app's UI. | Next.js API Route, Supabase Database |
| **A-004** | **Trip History and Audit Log** | 1. Search for a completed trip (e.g., using Trip ID or Customer Name). 2. View the trip details page. | All trip details (pickup/drop-off, fare, driver, timestamps) are correctly displayed. A clear audit log of status changes (e.g., Booked -> Assigned -> Picked Up -> Completed) is visible. | Next.js Data Fetching, Supabase Database Queries |

***

This set of use cases covers the essential functionality required for a successful MVP launch. Once these core flows are validated, the comprehensive edge case testing guide provided previously should be used to ensure production-level stability.
