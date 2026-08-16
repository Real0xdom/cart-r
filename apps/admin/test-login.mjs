const testLogin = async (email, password) => {
  console.log(`\n--- Testing login for ${email} ---`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const timeTaken = Date.now() - startTime;
    console.log(`Status Status: ${response.status} ${response.statusText} (${timeTaken}ms)`);
    
    // Print the Set-Cookie headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log('Got Set-Cookie headers ✅');
    } else {
      console.log('NO Set-Cookie headers received ❌');
      // Let's print out all headers just in case
      response.headers.forEach((value, name) => {
        console.log(`Header ${name}: ${value}`);
      });
    }

    const data = await response.json();
    console.log(`Response JSON:`, data);
  } catch (err) {
    console.error(`Fetch failed for ${email}:`, err);
  }
};

(async () => {
  await testLogin('admin@cartr.com', 'adminpassword');
  await testLogin('manager@cartr.com', 'managerpassword');
})();
