"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Nearby Drivers Map Component for Customer App Home
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const Location = __importStar(require("expo-location"));
const tracking_1 = require("@/lib/tracking");
const { width, height } = react_native_1.Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const vehicleEmojis = {
    bike: '🏍️',
    tempo: '🛺',
    sedan: '🚗',
    truck: '🚚',
};
const NearbyDriversMap = ({ vehicleTypeFilter, onDriversLoaded, onRegionChange, }) => {
    const mapRef = (0, react_1.useRef)(null);
    const [userLocation, setUserLocation] = (0, react_1.useState)(null);
    const [nearbyDrivers, setNearbyDrivers] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    // Get user location and nearby drivers on mount
    (0, react_1.useEffect)(() => {
        initializeMap();
    }, []);
    // Refresh drivers when filter changes
    (0, react_1.useEffect)(() => {
        if (userLocation) {
            fetchNearbyDrivers(userLocation.latitude, userLocation.longitude);
        }
    }, [vehicleTypeFilter]);
    const initializeMap = async () => {
        try {
            setLoading(true);
            // Request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Location permission denied');
                setLoading(false);
                return;
            }
            // Get current location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
            setUserLocation(coords);
            await fetchNearbyDrivers(coords.latitude, coords.longitude);
        }
        catch (error) {
            console.error('Error initializing map:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchNearbyDrivers = async (lat, lng) => {
        try {
            setRefreshing(true);
            const { data, error } = await (0, tracking_1.findNearbyDrivers)(lat, lng, vehicleTypeFilter, 10);
            if (!error) {
                setNearbyDrivers(data);
                onDriversLoaded === null || onDriversLoaded === void 0 ? void 0 : onDriversLoaded(data.length);
            }
        }
        catch (error) {
            console.error('Error fetching drivers:', error);
        }
        finally {
            setRefreshing(false);
        }
    };
    // Refresh drivers every 30 seconds
    (0, react_1.useEffect)(() => {
        if (!userLocation)
            return;
        const interval = setInterval(() => {
            fetchNearbyDrivers(userLocation.latitude, userLocation.longitude);
        }, 30000);
        return () => clearInterval(interval);
    }, [userLocation, vehicleTypeFilter]);
    const handleRegionChange = (region) => {
        onRegionChange === null || onRegionChange === void 0 ? void 0 : onRegionChange(region);
        // Optionally fetch drivers for new region center
        // fetchNearbyDrivers(region.latitude, region.longitude);
    };
    if (loading) {
        return (<react_native_1.View style={styles.loadingContainer}>
        <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
        <react_native_1.Text style={styles.loadingText}>Finding drivers near you...</react_native_1.Text>
      </react_native_1.View>);
    }
    if (!userLocation) {
        return (<react_native_1.View style={styles.loadingContainer}>
        <react_native_1.Text style={styles.errorEmoji}>📍</react_native_1.Text>
        <react_native_1.Text style={styles.errorText}>Unable to get your location</react_native_1.Text>
        <react_native_1.Text style={styles.errorSubtext}>Please enable location services</react_native_1.Text>
      </react_native_1.View>);
    }
    return (<react_native_1.View style={styles.container}>
      <react_native_maps_1.default ref={mapRef} style={styles.map} provider={react_native_maps_1.PROVIDER_GOOGLE} initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
        }} showsUserLocation showsMyLocationButton={false} onRegionChangeComplete={handleRegionChange} customMapStyle={darkMapStyle}>
        {/* Nearby Driver Markers */}
        {nearbyDrivers.map((driver) => (<react_native_maps_1.Marker key={driver.id} coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
            }} anchor={{ x: 0.5, y: 0.5 }}>
            <react_native_1.View style={styles.driverMarker}>
              <react_native_1.Text style={styles.driverEmoji}>
                {vehicleEmojis[driver.vehicle_type] || '🚗'}
              </react_native_1.Text>
            </react_native_1.View>
          </react_native_maps_1.Marker>))}
      </react_native_maps_1.default>

      {/* Drivers Count Badge */}
      {nearbyDrivers.length > 0 && (<react_native_1.View style={styles.countBadge}>
          <react_native_1.Text style={styles.countText}>
            {nearbyDrivers.length} {vehicleTypeFilter || 'vehicle'}{nearbyDrivers.length > 1 ? 's' : ''} nearby
          </react_native_1.Text>
          {refreshing && <react_native_1.ActivityIndicator size="small" color="#22c55e" style={styles.refreshIndicator}/>}
        </react_native_1.View>)}
    </react_native_1.View>);
};
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1f2937',
    },
    loadingText: {
        color: '#9ca3af',
        marginTop: 12,
        fontSize: 14,
    },
    errorEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    errorSubtext: {
        color: '#9ca3af',
        marginTop: 8,
        fontSize: 14,
    },
    driverMarker: {
        backgroundColor: '#22c55e',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    driverEmoji: {
        fontSize: 18,
    },
    countBadge: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    countText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    refreshIndicator: {
        marginLeft: 8,
    },
});
// Dark map style for modern look
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];
exports.default = NearbyDriversMap;
