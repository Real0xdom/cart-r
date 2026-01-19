# 🧪 Live Driver Tracking - End-to-End Test Script

## Prerequisites
- [x] Both apps running: `npx expo` in customer and driver directories
- [x] Two phones connected to Expo Go (or one phone + one emulator)
- [x] Same network OR ensure Supabase URL is cloud (not localhost)
- [x] Location permissions enabled on driver phone

---

## 📱 Test Setup

### Device Assignment
- **Phone 1 (Driver Phone):** Driver App
- **Phone 2 (Customer Phone):** Customer App

### Test Accounts Needed
1. **Customer Account:** Any phone number for OTP login
2. **Driver Account:** Must be verified/approved in database

---

## 🎬 Test Script: Complete Live Tracking Flow

### **PHASE 1: Driver Preparation** (Driver Phone)

#### Step 1.1: Login as Driver
```
1. Open Customer app folder in terminal
2. Scan QR code with Phone 1 (Driver)
3. Navigate to Driver app
4. Login with driver credentials
5. Complete onboarding if first time
```

**✅ Expected:** Driver home screen appears

#### Step 1.2: Go Online
```
1. On Driver home screen, toggle "Status" switch to Online
2. Grant location permissions when prompted:
   - Allow "Foreground" permission
   - Allow "Background" permission (CRITICAL!)
3. Wait for confirmation
```

**✅ Expected:**
- Status shows "🟢 Online"
- Notification appears: "CARTR Driver - Tracking your location"
- Console logs: "📍 Initial location set: [lat, lng]"
- Console logs: "✅ Location tracking started"

#### Step 1.3: Verify Location Updates
```
1. Keep driver app open
2. Walk around with Phone 1 (30-50 meters)
3. Watch console logs for location updates
```

**✅ Expected:** Every ~10 seconds, see log:
```
📍 Location updated: [latitude], [longitude]
```

---

### **PHASE 2: Customer Booking** (Customer Phone)

#### Step 2.1: Login as Customer
```
1. Open Customer app on Phone 2
2. Login with phone number
3. Enter OTP
```

**✅ Expected:** Home screen with map

#### Step 2.2: Create Booking
```
1. Tap "Book a Ride"
2. Select pickup location (use current location or search)
3. Tap "Continue"
4. Select destination (should be 1-5 km away for testing)
5. Tap "Continue"
6. Select vehicle type (e.g., "Bike" or "Auto")
7. Review fare estimate
8. Tap "Confirm Booking"
9. Enter receiver details:
   - Name: Test Receiver
   - Phone: Any 10-digit number
10. Tap "Find Driver"
```

**✅ Expected:**
- Navigates to "Finding Driver" screen
- Shows searching animation
- After 5-30 seconds, driver is found

---

### **PHASE 3: Driver Accepts Ride** (Driver Phone)

#### Step 3.1: Accept Request
```
1. Wait for ride request notification
2. Tap notification OR
3. Go to "Requests" tab in driver app
4. Review booking details
5. Tap "Accept Request"
```

**✅ Expected:**
- Booking status changes to "Accepted"
- Navigates to Active Ride screen
- Map shows route from driver to pickup

---

### **PHASE 4: LIVE TRACKING TEST** (Customer Phone) 🎯

#### Step 4.1: Open Track Screen
```
1. Customer app should auto-navigate to "Track Shipment" screen
2. If not, tap on active booking card
```

**✅ Expected - Customer sees:**
- Map with 3 markers:
  - 📍 Green pin (Pickup)
  - 🏁 Red pin (Drop-off)
  - 🚗 Blue car (Driver - YOUR LOCATION)
- Status badge: "🚗 Driver is on the way to pickup"
- Driver info card with name, vehicle, phone

#### Step 4.2: Verify Live Movement
```
THIS IS THE CRITICAL TEST!

1. Keep customer phone STATIONARY (Phone 2)
2. Take driver phone (Phone 1) and WALK SLOWLY
3. Walk in a circle or straight line (50-100 meters)
4. Watch Customer phone screen (Phone 2) while walking
```

**✅ Expected - On CUSTOMER phone:**
- The 🚗 driver marker should MOVE in real-time
- Every ~10 seconds, the car jumps/glides to new position
- The dashed line from driver to pickup updates
- Map camera may adjust to keep driver visible

**❌ If marker doesn't move:**
- Check driver phone console for location updates
- Ensure driver is_online = true in database
- Verify Supabase Realtime is working (no errors in console)

#### Step 4.3: Test Throughout Trip
```
1. Walk driver phone to a different location
2. On Driver app, tap "Arrived at Pickup"
3. Watch Customer screen update
```

**✅ Expected:**
- Customer sees status: "📍 Driver has arrived"
- Driver marker is now at pickup location

```
4. On Driver app, enter OTP and start trip
5. Walk driver phone toward destination
6. Watch Customer screen
```

**✅ Expected:**
- Customer sees status: "🚚 Trip in progress"
- Driver marker moves toward RED destination pin
- Green pickup pin becomes gray
- Dashed line is now RED (driver → destination)

---

### **PHASE 5: Trip Completion**

#### Step 5.1: Complete Delivery
```
1. Walk to destination (or just tap "Complete" for testing)
2. Driver enters delivery OTP
3. Customer confirms delivery
```

**✅ Expected:**
- Trip completes
- Payment screen appears
- Tracking stops

---

## 🐛 Troubleshooting

### Issue: Driver marker doesn't appear
**Fix:**
- Check: `drivers.current_latitude` and `current_longitude` in Supabase
- Ensure driver went online and granted permissions
- Check console for "Location tracking started"

### Issue: Marker appears but doesn't move
**Fix:**
- Ensure background permission granted
- Check: `drivers.last_location_update` timestamp in database
- Should update every ~10 seconds
- Walk at least 50 meters (driver app has `distanceInterval: 50`)

### Issue: "No drivers available"
**Fix:**
- Verify driver is online
- Check `drivers.is_online = true` in database
- Ensure driver location is within 10km of pickup

### Issue: Real-time updates not working
**Fix:**
- Check Supabase Realtime is enabled in dashboard
- Verify subscription in console: "📍 Subscribing to driver location: [id]"
- Check for CORS or network errors

---

## 📊 Success Criteria

✅ **Test passes if:**
1. Driver location updates every 10 seconds in database
2. Customer sees driver marker on map
3. Driver marker MOVES when driver phone moves
4. Live tracking works in ALL states:
   - ✅ "Accepted" (driver going to pickup)
   - ✅ "Driver Arrived" (at pickup)
   - ✅ "In Progress" (delivering to destination)

---

## 🎥 Recording the Demo

For client presentation:
1. Use phone screen recording on customer phone
2. Start recording before driver accepts
3. Show the full flow with live marker movement
4. This will be your most impressive demo feature!

---

## 📝 Test Results

**Date:** _________  
**Tester:** _________

- [ ] Driver can go online
- [ ] Background location tracking starts
- [ ] Customer can create booking
- [ ] Driver receives and accepts request
- [ ] Customer sees driver marker on map
- [ ] **Driver marker moves in real-time** ⭐
- [ ] Tracking works during entire trip
- [ ] Trip completes successfully

**Notes:**
_______________________________________
_______________________________________
