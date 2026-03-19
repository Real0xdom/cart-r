const fs = require('fs');
const path = 'c:/Users/pranav/Desktop/catr-latest/cart-r/apps/driver/contexts/RideNotificationContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const searchInsert = 'console.log(\'[NOTIFICATION CONTEXT] New booking received:\', newBooking.id);';
const logInsert = `console.log('[NOTIFICATION CONTEXT] New booking received:', newBooking.id, 'at', new Date().toISOString(), 'expires_at:', newBooking.expires_at);`;

if (content.includes(searchInsert)) {
    content = content.replace(searchInsert, logInsert);
}

const searchDisplay = 'await displayFullScreenRideRequest(payload);';
const logDisplay = `console.log('[NOTIFICATION CONTEXT] Calling displayFullScreenRideRequest for:', payload.id);
          await displayFullScreenRideRequest(payload);
          console.log('[NOTIFICATION CONTEXT] displayFullScreenRideRequest called successfully');`;

if (content.includes(searchDisplay)) {
    content = content.replace(searchDisplay, logDisplay);
}

fs.writeFileSync(path, content);
console.log('Successfully added logging to RideNotificationContext.tsx');
