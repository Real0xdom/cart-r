import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const { adminSignOut } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    fetchDrivers();
    fetchRides();
  }, []);

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('id, user_id, is_verified, status');

    if (data) setDrivers(data);
  };

  const fetchRides = async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setRides(data);
  };

  const verifyDriver = async (id: string) => {
    await supabase
      .from('drivers')
      .update({ is_verified: true, status: 'approved' })
      .eq('id', id);

    fetchDrivers();
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: 'bold' }}>Admin Panel</Text>
        <TouchableOpacity onPress={adminSignOut}>
          <Text style={{ color: 'red' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* DRIVERS */}
      <Text style={{ fontSize: 20, marginTop: 30 }}>Drivers</Text>

      {drivers.length === 0 && (
        <Text style={{ color: 'gray', marginTop: 10 }}>
          No drivers yet
        </Text>
      )}

      {drivers.map(driver => (
        <View
          key={driver.id}
          style={{
            backgroundColor: '#fff',
            padding: 12,
            marginTop: 10,
            borderRadius: 8,
          }}
        >
          <Text>Driver ID: {driver.id}</Text>
          <Text>Status: {driver.status}</Text>

          {!driver.is_verified && (
            <TouchableOpacity
              onPress={() => verifyDriver(driver.id)}
              style={{
                backgroundColor: '#0286FF',
                padding: 10,
                marginTop: 10,
              }}
            >
              <Text style={{ color: '#fff', textAlign: 'center' }}>
                Verify Driver
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* RIDES */}
      <Text style={{ fontSize: 20, marginTop: 40 }}>Rides</Text>

      {rides.length === 0 && (
        <Text style={{ color: 'gray', marginTop: 10 }}>
          No rides yet
        </Text>
      )}

      {rides.map(ride => (
        <View
          key={ride.id}
          style={{
            backgroundColor: '#fff',
            padding: 12,
            marginTop: 10,
            borderRadius: 8,
          }}
        >
          <Text>Status: {ride.status}</Text>
          <Text>Pickup: {ride.pickup}</Text>
          <Text>Drop: {ride.dropoff}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
