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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const react_native_maps_directions_1 = __importDefault(require("react-native-maps-directions"));
const expo_constants_1 = __importDefault(require("expo-constants"));
const constants_1 = require("@/constants");
const supabase_1 = require("@/lib/supabase");
const map_1 = require("@/lib/map");
const store_1 = require("@/store");
const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
// Check if running in Expo Go
const isExpoGo = expo_constants_1.default.appOwnership === 'expo';
// Default region (centered on India as fallback)
const DEFAULT_REGION = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
};
const Map = ({ selectionMode = null, onLocationSelected }) => {
    const { userLongitude, userLatitude, destinationLatitude, destinationLongitude, destinationAddress, userAddress, setUserLocation, setDestinationLocation, } = (0, store_1.useLocationStore)();
    const { selectedDriver } = (0, store_1.useDriverStore)();
    const mapRef = (0, react_1.useRef)(null);
    const destinationMarkerRef = (0, react_1.useRef)(null);
    // Temporary marker for selection
    const [tempMarker, setTempMarker] = (0, react_1.useState)(null);
    // Fetch drivers from Supabase
    const [markers, setMarkers] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    // Show callout when destination is set
    (0, react_1.useEffect)(() => {
        if (destinationLatitude && destinationLongitude && destinationMarkerRef.current) {
            // Small delay to ensure marker is rendered
            setTimeout(() => {
                var _a;
                (_a = destinationMarkerRef.current) === null || _a === void 0 ? void 0 : _a.showCallout();
            }, 500);
        }
    }, [destinationLatitude, destinationLongitude]);
    (0, react_1.useEffect)(() => {
        const fetchDrivers = async () => {
            // Only fetch if we have user location
            if (!userLatitude || !userLongitude)
                return;
            setLoading(true);
            try {
                // Fetch active drivers
                const { data: driversData, error: driversError } = await supabase_1.supabase
                    .from('drivers')
                    .select(`
            id,
            rating,
            vehicle_type,
            user_id,
            users:users!drivers_user_id_fkey (
              name,
              avatar_url
            )
          `)
                    .eq('is_online', true);
                if (driversError)
                    throw driversError;
                // Mock locations near user for demo purpose since we don't have real driver GPS updates yet
                const loadedMarkers = (driversData || []).map((driver) => {
                    var _a, _b, _c, _d, _e, _f;
                    const randomLatOffset = (Math.random() - 0.5) * 0.02;
                    const randomLngOffset = (Math.random() - 0.5) * 0.02;
                    return {
                        id: driver.id,
                        latitude: userLatitude + randomLatOffset,
                        longitude: userLongitude + randomLngOffset,
                        title: ((_a = driver.users) === null || _a === void 0 ? void 0 : _a.name) || 'Driver',
                        profile_image_url: ((_b = driver.users) === null || _b === void 0 ? void 0 : _b.avatar_url) || 'https://via.placeholder.com/100',
                        car_image_url: 'https://via.placeholder.com/100',
                        car_seats: 4,
                        rating: driver.rating,
                        first_name: ((_d = (_c = driver.users) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d.split(' ')[0]) || 'Driver',
                        last_name: ((_f = (_e = driver.users) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.split(' ')[1]) || '',
                        time: 5,
                        price: '150',
                    };
                });
                setMarkers(loadedMarkers);
            }
            catch (err) {
                console.error("Error fetching drivers:", err);
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        fetchDrivers();
    }, [userLatitude, userLongitude]);
    const region = (0, react_1.useMemo)(() => {
        if (userLatitude && userLongitude) {
            return (0, map_1.calculateRegion)({
                userLatitude,
                userLongitude,
                destinationLatitude,
                destinationLongitude,
            });
        }
        return DEFAULT_REGION;
    }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);
    // Reverse geocode helper
    const reverseGeocode = async (latitude, longitude) => {
        try {
            const apiKey = GOOGLE_API_KEY;
            if (apiKey) {
                const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    return data.results[0].formatted_address;
                }
            }
            return 'Selected Location';
        }
        catch (error) {
            console.error('Error reverse geocoding:', error);
            return 'Selected Location';
        }
    };
    // Handle map tap for location selection
    const handleMapPress = async (event) => {
        if (!selectionMode)
            return;
        const { latitude, longitude } = event.nativeEvent.coordinate;
        setTempMarker({ latitude, longitude });
        try {
            const address = await reverseGeocode(latitude, longitude);
            const locationData = {
                latitude,
                longitude,
                address,
            };
            if (selectionMode === 'from') {
                setUserLocation(locationData);
            }
            else if (selectionMode === 'to') {
                setDestinationLocation(locationData);
            }
            setTempMarker(null);
            if (onLocationSelected) {
                onLocationSelected();
            }
        }
        catch (err) {
            console.error("Error selecting location:", err);
            react_native_1.Alert.alert("Error", "Could not get address for this location. Please try again.");
            setTempMarker(null);
        }
    };
    // Show loading state while waiting for location
    if (!userLatitude || !userLongitude) {
        return (<react_native_1.View style={styles.loadingContainer}>
        <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
        <react_native_1.Text style={styles.loadingText}>Getting your location...</react_native_1.Text>
        <react_native_1.Text style={styles.loadingSubtext}>Please allow location access when prompted</react_native_1.Text>
      </react_native_1.View>);
    }
    // Web Fallback (to allow flow testing without Google Maps setup)
    if (react_native_1.Platform.OS === 'web') {
        return (<react_native_1.View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' }]}>
           <react_native_1.Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 10 }}>Map Placeholder (Web)</react_native_1.Text>
           <react_native_1.Text style={{ textAlign: 'center', color: '#6b7280', paddingHorizontal: 20, marginBottom: 20 }}>
              Google Maps is not configured for web in this demo.
              {'\n'}Use mobile for the full map experience.
           </react_native_1.Text>
           {selectionMode && (<react_native_1.View style={{ backgroundColor: '#bfdbfe', padding: 15, borderRadius: 10 }}>
                 <react_native_1.Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: 5 }}>Testing Mode active:</react_native_1.Text>
                 <react_native_1.Text style={{ color: '#1e40af' }} onPress={() => {
                    // Simulate selecting a location slightly offset from current
                    onLocationSelected === null || onLocationSelected === void 0 ? void 0 : onLocationSelected();
                    if (selectionMode === 'to')
                        setDestinationLocation({ latitude: userLatitude + 0.01, longitude: userLongitude + 0.01, address: 'Test Destination Address' });
                    else
                        setUserLocation({ latitude: userLatitude, longitude: userLongitude, address: 'Test Pickup Address' });
                }}>
                    Click here to simulate selecting a location on map
                 </react_native_1.Text>
              </react_native_1.View>)}
        </react_native_1.View>);
    }
    const shouldUseGoogleProvider = react_native_1.Platform.OS === 'android' && !isExpoGo;
    return (<react_native_maps_1.default ref={mapRef} provider={shouldUseGoogleProvider ? react_native_maps_1.PROVIDER_GOOGLE : undefined} style={styles.map} mapType="standard" showsPointsOfInterest={false} region={region} showsUserLocation={true} showsMyLocationButton={true} onPress={handleMapPress}>
      {/* Pickup location marker */}
      {userLatitude && userLongitude && userAddress && (<react_native_maps_1.Marker key="pickup" coordinate={{
                latitude: userLatitude,
                longitude: userLongitude,
            }} pinColor="#22c55e">
          <react_native_maps_1.Callout tooltip>
            <react_native_1.View style={styles.calloutContainer}>
              <react_native_1.View style={styles.calloutBubble}>
                <react_native_1.Text style={styles.calloutTitle}>📦 Pickup Location</react_native_1.Text>
                <react_native_1.Text style={styles.calloutText} numberOfLines={2}>
                  {userAddress}
                </react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.calloutArrow}/>
            </react_native_1.View>
          </react_native_maps_1.Callout>
        </react_native_maps_1.Marker>)}

      {/* Driver markers */}
      {markers.map((marker) => (<react_native_maps_1.Marker key={marker.id} coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
            }} title={marker.title} image={selectedDriver === +marker.id ? constants_1.icons.selectedMarker : constants_1.icons.marker}/>))}

      {/* Temporary selection marker */}
      {tempMarker && (<react_native_maps_1.Marker key="temp-marker" coordinate={tempMarker} pinColor="#FF9800">
          <react_native_maps_1.Callout>
            <react_native_1.Text>Selecting location...</react_native_1.Text>
          </react_native_maps_1.Callout>
        </react_native_maps_1.Marker>)}

      {/* Destination marker with tooltip */}
      {destinationLatitude && destinationLongitude && (<>
          <react_native_maps_1.Marker ref={destinationMarkerRef} key="destination" coordinate={{
                latitude: destinationLatitude,
                longitude: destinationLongitude,
            }} pinColor="#ef4444">
            <react_native_maps_1.Callout tooltip>
              <react_native_1.View style={styles.calloutContainer}>
                <react_native_1.View style={styles.dropCalloutBubble}>
                  <react_native_1.Text style={styles.calloutTitle}>📍 Drop Location</react_native_1.Text>
                  <react_native_1.Text style={styles.dropCalloutSubtitle}>Your goods will be dropped here</react_native_1.Text>
                  {destinationAddress && (<react_native_1.Text style={styles.calloutText} numberOfLines={2}>
                      {destinationAddress}
                    </react_native_1.Text>)}
                </react_native_1.View>
                <react_native_1.View style={styles.dropCalloutArrow}/>
              </react_native_1.View>
            </react_native_maps_1.Callout>
          </react_native_maps_1.Marker>

          {/* Route line */}
          {userLatitude && userLongitude && directionsAPI && (<react_native_maps_directions_1.default origin={{
                    latitude: userLatitude,
                    longitude: userLongitude,
                }} destination={{
                    latitude: destinationLatitude,
                    longitude: destinationLongitude,
                }} apikey={directionsAPI} strokeColor="#FF9800" strokeWidth={4}/>)}
        </>)}
    </react_native_maps_1.default>);
};
const styles = react_native_1.StyleSheet.create({
    map: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
    },
    // Callout styles
    calloutContainer: {
        alignItems: 'center',
    },
    calloutBubble: {
        backgroundColor: '#22c55e',
        borderRadius: 12,
        padding: 12,
        maxWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    dropCalloutBubble: {
        backgroundColor: '#ef4444',
        borderRadius: 12,
        padding: 12,
        maxWidth: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    calloutArrow: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderTopColor: '#22c55e',
        borderWidth: 10,
        alignSelf: 'center',
        marginTop: -1,
    },
    dropCalloutArrow: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderTopColor: '#ef4444',
        borderWidth: 10,
        alignSelf: 'center',
        marginTop: -1,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    dropCalloutSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fef2f2',
        marginBottom: 6,
    },
    calloutText: {
        fontSize: 11,
        color: '#fff',
        opacity: 0.9,
    },
});
exports.default = Map;
