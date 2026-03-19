const fs = require('fs');
const path = 'c:/Users/pranav/Desktop/catr-latest/cart-r/apps/driver/app/(tabs)/requests.tsx';
let content = fs.readFileSync(path, 'utf8');

const searchString = 'if (isExpired) return null;';
const logString = `    console.log('[DEBUG] RideRequestCard rendering check:', { id: request.id, isExpired, timeLeft, expires_at: request.expires_at, now: new Date().toISOString() });
    if (isExpired) return null;`;

if (content.includes(searchString)) {
    content = content.replace(searchString, logString);
    fs.writeFileSync(path, content);
    console.log('Successfully added logging to requests.tsx');
} else {
    console.log('Could not find search string in requests.tsx');
}
