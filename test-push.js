const payload = {
  to: 'ExponentPushToken[D6zLi4NGJA6aoJ-Z98r7Bh]',
  title: '🚨 Test Ride Request!',
  body: 'Testing direct push delivery',
  data: {
    booking_id: '6c3a8690-bced-4fcc-98e3-1c2fbb181606',
    type: 'new_booking',
    is_data_only: true
  },
  sound: 'default',
  priority: 'high',
  channelId: 'driver_ride_request_urgent',
  _displayInForeground: true
};

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
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(console.error);
