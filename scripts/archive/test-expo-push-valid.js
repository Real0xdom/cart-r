const EXPO_TOKEN = 'ExponentPushToken[D6zLi4NGJA6aoJ-Z98r7Bh]'; // This is one of the active devices in your DB

const payload = {
  to: EXPO_TOKEN,
  data: {
    booking_id: '6c3a8690-bced-4fcc-98e3-1c2fbb181606', // Real UUID from your database!
    type: 'new_booking',
    is_data_only: true
  },
  // Removed title and body so the Android OS doesn't intercept it
  // and force a standard basic notification.
  priority: 'high',
  channelId: 'driver_ride_request_urgent'
};

console.log('Sending DATA-ONLY Test Push to Expo API...');

fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([payload])
})
.then(res => res.json())
.then(data => {
  console.log('\n--- EXPO API RESPONSE ---');
  console.log(JSON.stringify(data, null, 2));
})
.catch(console.error);
