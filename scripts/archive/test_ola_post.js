const https = require('https');

const originLonLat = '73.8567,18.5204'; // Pune center (LON,LAT for OSRM)
const destLonLat = '73.87,18.533'; 
const url = `https://router.project-osrm.org/route/v1/driving/${originLonLat};${destLonLat}?overview=full&geometries=polyline`;

console.log('Testing OSRM Directions for Ola Maps fallback (Pune):', url);

https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Success! Routes:', json.routes?.length || 0);
      if (json.routes && json.routes[0]) {
        console.log('Distance:', json.routes[0].distance / 1000, 'km');
        console.log('Duration:', json.routes[0].duration / 60, 'min');
        console.log('Polyline preview:', json.routes[0].geometry.substring(0,50) + '...');
      }
    } catch (e) {
      console.log('Raw response:', data.slice(0,1000));
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
