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
// Live Driver Tracking Component for Customer App
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const tracking_1 = require("@/lib/tracking");
const LiveDriverTracking = ({ driver, pickupLocation, dropLocation, bookingStatus, onCallDriver, }) => {
    var _a;
    const mapRef = (0, react_1.useRef)(null);
    const [driverLocation, setDriverLocation] = (0, react_1.useState)(null);
    const [eta, setEta] = (0, react_1.useState)(null);
    const pulseAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    // Subscribe to driver location updates
    (0, react_1.useEffect)(() => {
        if (!(driver === null || driver === void 0 ? void 0 : driver.id))
            return;
        // Get initial location
        (0, tracking_1.getDriverCurrentLocation)(driver.id).then((location) => {
            if (location) {
                setDriverLocation(location);
                updateETA(location);
            }
        });
        // Subscribe to real-time updates
        const unsubscribe = (0, tracking_1.subscribeToDriverLocation)(driver.id, (location) => {
            setDriverLocation(location);
            updateETA(location);
        });
        return () => {
            unsubscribe();
        };
    }, [driver === null || driver === void 0 ? void 0 : driver.id]);
    // Pulse animation for driver marker
    (0, react_1.useEffect)(() => {
        const pulse = react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.timing(pulseAnim, {
                toValue: 1.3,
                duration: 1000,
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
        ]));
        pulse.start();
        return () => pulse.stop();
    }, []);
    // Update ETA based on driver location
    const updateETA = (location) => {
        const targetLocation = bookingStatus === 'in_progress' ? dropLocation : pickupLocation;
        const distance = calculateDistance(location.latitude, location.longitude, targetLocation.latitude, targetLocation.longitude);
        const etaMinutes = (0, tracking_1.estimateETA)(distance, 'sedan'); // Default to sedan speed
        setEta(etaMinutes);
    };
    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };
    // Fit map to show all markers
    (0, react_1.useEffect)(() => {
        if (!mapRef.current || !driverLocation)
            return;
        const coordinates = [pickupLocation];
        if (driverLocation)
            coordinates.push(driverLocation);
        if (bookingStatus === 'in_progress')
            coordinates.push(dropLocation);
        mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
            animated: true,
        });
    }, [driverLocation, bookingStatus]);
    // Get status text
    const getStatusText = () => {
        switch (bookingStatus) {
            case 'accepted':
                return eta ? `Driver arriving in ${eta} mins` : 'Driver is on the way';
            case 'driver_arrived':
                return 'Driver has arrived!';
            case 'in_progress':
                return eta ? `Arriving at destination in ${eta} mins` : 'Trip in progress';
            case 'completed':
                return 'Trip completed';
            default:
                return 'Finding driver...';
        }
    };
    // Call driver function
    const handleCallDriver = () => {
        if (driver === null || driver === void 0 ? void 0 : driver.phone) {
            react_native_1.Linking.openURL(`tel:${driver.phone}`);
        }
        onCallDriver === null || onCallDriver === void 0 ? void 0 : onCallDriver();
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_maps_1.default ref={mapRef} style={styles.map} provider={react_native_maps_1.PROVIDER_GOOGLE} initialRegion={{
            latitude: pickupLocation.latitude,
            longitude: pickupLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }} customMapStyle={mapStyle}>
        {/* Pickup Marker */}
        <react_native_maps_1.Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 1 }}>
          <react_native_1.View style={styles.pickupMarker}>
            <react_native_1.Text style={styles.markerEmoji}>📍</react_native_1.Text>
          </react_native_1.View>
        </react_native_maps_1.Marker>

        {/* Drop Marker */}
        <react_native_maps_1.Marker coordinate={dropLocation} anchor={{ x: 0.5, y: 1 }}>
          <react_native_1.View style={styles.dropMarker}>
            <react_native_1.Text style={styles.markerEmoji}>🏁</react_native_1.Text>
          </react_native_1.View>
        </react_native_maps_1.Marker>

        {/* Driver Marker */}
        {driverLocation && (<react_native_maps_1.Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <react_native_1.Animated.View style={[styles.driverMarker, { transform: [{ scale: pulseAnim }] }]}>
              <react_native_1.Text style={styles.driverEmoji}>🚗</react_native_1.Text>
            </react_native_1.Animated.View>
          </react_native_maps_1.Marker>)}

        {/* Route Line */}
        {driverLocation && (<react_native_maps_1.Polyline coordinates={[
                driverLocation,
                bookingStatus === 'in_progress' ? dropLocation : pickupLocation,
            ]} strokeColor="#22c55e" strokeWidth={4} lineDashPattern={[10, 5]}/>)}
      </react_native_maps_1.default>

      {/* Status Bar */}
      <react_native_1.View style={styles.statusBar}>
        <react_native_1.View style={styles.statusContent}>
          {/* Status Indicator */}
          <react_native_1.View style={styles.statusIndicator}>
            <react_native_1.View style={[styles.statusDot, { backgroundColor: getStatusColor(bookingStatus) }]}/>
            <react_native_1.Text style={styles.statusText}>{getStatusText()}</react_native_1.Text>
          </react_native_1.View>

          {/* Driver Info Card */}
          <react_native_1.View style={styles.driverCard}>
            <react_native_1.View style={styles.driverAvatar}>
              <react_native_1.Text style={styles.avatarText}>
                {driver.avatar_url ? '👤' : ((_a = driver.name) === null || _a === void 0 ? void 0 : _a.charAt(0)) || 'D'}
              </react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View style={styles.driverInfo}>
              <react_native_1.Text style={styles.driverName}>{driver.name}</react_native_1.Text>
              <react_native_1.Text style={styles.vehicleInfo}>
                {driver.vehicle_model} • {driver.vehicle_number}
              </react_native_1.Text>
            </react_native_1.View>
            <react_native_1.TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
              <react_native_1.Text style={styles.callEmoji}>📞</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.View>);
};
const getStatusColor = (status) => {
    switch (status) {
        case 'accepted':
            return '#3b82f6'; // Blue
        case 'driver_arrived':
            return '#22c55e'; // Green
        case 'in_progress':
            return '#8b5cf6'; // Purple
        case 'completed':
            return '#10b981'; // Emerald
        default:
            return '#f59e0b'; // Yellow
    }
};
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    pickupMarker: {
        backgroundColor: '#22c55e',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    dropMarker: {
        backgroundColor: '#ef4444',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
    },
    driverMarker: {
        backgroundColor: '#3b82f6',
        padding: 12,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    markerEmoji: {
        fontSize: 20,
    },
    driverEmoji: {
        fontSize: 24,
    },
    statusBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    statusContent: {},
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    driverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 16,
    },
    driverAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 20,
        color: '#fff',
    },
    driverInfo: {
        flex: 1,
    },
    driverName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    vehicleInfo: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    callButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    callEmoji: {
        fontSize: 20,
    },
});
// Dark map style
const mapStyle = [
    {
        elementType: 'geometry',
        stylers: [{ color: '#242f3e' }],
    },
    {
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#242f3e' }],
    },
    {
        elementType: 'labels.text.fill',
        stylers: [{ color: '#746855' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#38414e' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#212a37' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#746855' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#17263c' }],
    },
];
exports.default = LiveDriverTracking;
