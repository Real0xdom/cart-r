const EXPO_TOKEN = 'ExponentPushToken[D6zLi4NGJA6aoJ-Z98r7Bh]'; // This is one of the active devices in your DB

const payload = {
  to: EXPO_TOKEN,
  title: '🚨 Test Ride Request!',
  body: 'Testing direct push delivery from Node',
  data: {
    booking_id: 'test-booking-id123',
    type: 'new_booking',
    is_data_only: true
  },
  sound: 'default',
  priority: 'high',
  channelId: 'driver_ride_request_urgent',
  _displayInForeground: true
};

console.log('Sending Test Push to Expo API...');

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
  
  const hasFcmError = JSON.stringify(data).includes('InvalidCredentials');
  if (hasFcmError) {
    console.log('\n❌ ERROR: Your Expo project is missing the FCM Server Key!');
    console.log('Push notifications are failing because Firebase credentials are not properly configured in the Expo Dashboard (eas.json / credentials).');
    console.log('Normal notifications might work if they are local, but actual remote pushes will fail until FCM is fixed.');
  } else {
    console.log('\n✅ Push sent successfully! Check your phone.');
  }
})
.catch(console.error);
