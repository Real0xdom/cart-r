"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminDashboard;
const react_native_1 = require("react-native");
const react_1 = require("react");
const supabase_1 = require("@/lib/supabase");
const AuthContext_1 = require("@/contexts/AuthContext");
function AdminDashboard() {
    const { adminSignOut } = (0, AuthContext_1.useAuth)();
    const [drivers, setDrivers] = (0, react_1.useState)([]);
    const [rides, setRides] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        fetchDrivers();
        fetchRides();
    }, []);
    const fetchDrivers = async () => {
        const { data } = await supabase_1.supabase
            .from('drivers')
            .select('id, user_id, is_verified, status');
        if (data)
            setDrivers(data);
    };
    const fetchRides = async () => {
        const { data } = await supabase_1.supabase
            .from('rides')
            .select('*')
            .order('created_at', { ascending: false });
        if (data)
            setRides(data);
    };
    const verifyDriver = async (id) => {
        await supabase_1.supabase
            .from('drivers')
            .update({ is_verified: true, status: 'approved' })
            .eq('id', id);
        fetchDrivers();
    };
    return (<react_native_1.ScrollView style={{ padding: 20 }}>
      <react_native_1.View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <react_native_1.Text style={{ fontSize: 26, fontWeight: 'bold' }}>Admin Panel</react_native_1.Text>
        <react_native_1.TouchableOpacity onPress={adminSignOut}>
          <react_native_1.Text style={{ color: 'red' }}>Logout</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      {/* DRIVERS */}
      <react_native_1.Text style={{ fontSize: 20, marginTop: 30 }}>Drivers</react_native_1.Text>

      {drivers.length === 0 && (<react_native_1.Text style={{ color: 'gray', marginTop: 10 }}>
          No drivers yet
        </react_native_1.Text>)}

      {drivers.map(driver => (<react_native_1.View key={driver.id} style={{
                backgroundColor: '#fff',
                padding: 12,
                marginTop: 10,
                borderRadius: 8,
            }}>
          <react_native_1.Text>Driver ID: {driver.id}</react_native_1.Text>
          <react_native_1.Text>Status: {driver.status}</react_native_1.Text>

          {!driver.is_verified && (<react_native_1.TouchableOpacity onPress={() => verifyDriver(driver.id)} style={{
                    backgroundColor: '#0286FF',
                    padding: 10,
                    marginTop: 10,
                }}>
              <react_native_1.Text style={{ color: '#fff', textAlign: 'center' }}>
                Verify Driver
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>)}
        </react_native_1.View>))}

      {/* RIDES */}
      <react_native_1.Text style={{ fontSize: 20, marginTop: 40 }}>Rides</react_native_1.Text>

      {rides.length === 0 && (<react_native_1.Text style={{ color: 'gray', marginTop: 10 }}>
          No rides yet
        </react_native_1.Text>)}

      {rides.map(ride => (<react_native_1.View key={ride.id} style={{
                backgroundColor: '#fff',
                padding: 12,
                marginTop: 10,
                borderRadius: 8,
            }}>
          <react_native_1.Text>Status: {ride.status}</react_native_1.Text>
          <react_native_1.Text>Pickup: {ride.pickup}</react_native_1.Text>
          <react_native_1.Text>Drop: {ride.dropoff}</react_native_1.Text>
        </react_native_1.View>))}
    </react_native_1.ScrollView>);
}
