const https = require('https');

const olakey = 'A70C6jFd8UHrsk5ADwIG17AbgQTFgamsH7izgU1e';
const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=18.579016,73.908681&api_key=${olakey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error(err);
});
