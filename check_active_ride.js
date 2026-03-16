const SUPABASE_URL = 'https://epevjbiymsvwmmzybzib.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI';

(async () => {
  const driverId = '4ef55e99-3f79-4c56-ad7a-06b86d39d6d0';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?driver_id=eq.${driverId}&status=in.("accepted","driver_arrived","in_progress")`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  console.log('Active bookings for driver:', data);
})();
