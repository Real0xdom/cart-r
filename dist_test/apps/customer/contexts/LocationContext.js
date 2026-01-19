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
exports.useLocation = exports.LocationProvider = void 0;
const react_1 = __importStar(require("react"));
const Location = __importStar(require("expo-location"));
const react_native_1 = require("react-native");
const store_1 = require("@/store");
const LocationContext = (0, react_1.createContext)(undefined);
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const LocationProvider = ({ children }) => {
    const [locationPermissionStatus, setLocationPermissionStatus] = (0, react_1.useState)(null);
    const [isLoadingLocation, setIsLoadingLocation] = (0, react_1.useState)(true);
    const [errorMessage, setErrorMessage] = (0, react_1.useState)(null);
    const { setUserLocation, userLatitude, userLongitude } = (0, store_1.useLocationStore)();
    // Check and request location permission on mount
    (0, react_1.useEffect)(() => {
        checkAndRequestLocation();
    }, []);
    const checkAndRequestLocation = async () => {
        setIsLoadingLocation(true);
        setErrorMessage(null);
        try {
            // First check current permission status
            const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
            if (existingStatus === 'granted') {
                setLocationPermissionStatus(existingStatus);
                await fetchAndSetCurrentLocation();
            }
            else {
                // Request permission
                const { status } = await Location.requestForegroundPermissionsAsync();
                setLocationPermissionStatus(status);
                if (status === 'granted') {
                    await fetchAndSetCurrentLocation();
                }
                else {
                    setErrorMessage('Location permission denied. Please enable it in settings.');
                    showPermissionDeniedAlert();
                }
            }
        }
        catch (error) {
            console.error('Error checking/requesting location permission:', error);
            setErrorMessage('Failed to access location services');
        }
        finally {
            setIsLoadingLocation(false);
        }
    };
    const showPermissionDeniedAlert = () => {
        react_native_1.Alert.alert('Location Permission Required', 'Carter needs access to your location to show nearby drivers and provide delivery services. Please enable location access in your device settings.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Open Settings',
                onPress: () => {
                    if (react_native_1.Platform.OS === 'ios') {
                        react_native_1.Linking.openURL('app-settings:');
                    }
                    else {
                        react_native_1.Linking.openSettings();
                    }
                }
            }
        ]);
    };
    const fetchAndSetCurrentLocation = async () => {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = location.coords;
            // Reverse geocode to get address
            const address = await reverseGeocode(latitude, longitude);
            setUserLocation({
                latitude,
                longitude,
                address,
            });
        }
        catch (error) {
            console.error('Error fetching current location:', error);
            setErrorMessage('Unable to get your current location');
        }
    };
    const reverseGeocode = async (latitude, longitude) => {
        try {
            // First try using Expo's built-in reverse geocoding
            const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (result) {
                const parts = [];
                if (result.name)
                    parts.push(result.name);
                if (result.street)
                    parts.push(result.street);
                if (result.city)
                    parts.push(result.city);
                if (result.region)
                    parts.push(result.region);
                if (parts.length > 0) {
                    return parts.join(', ');
                }
            }
            // Fallback to Google Geocoding API
            if (GOOGLE_PLACES_API_KEY) {
                const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_PLACES_API_KEY}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    return data.results[0].formatted_address;
                }
            }
            return 'Current Location';
        }
        catch (error) {
            console.error('Error reverse geocoding:', error);
            return 'Current Location';
        }
    };
    const requestLocationPermission = (0, react_1.useCallback)(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermissionStatus(status);
            if (status === 'granted') {
                await fetchAndSetCurrentLocation();
                return true;
            }
            else {
                showPermissionDeniedAlert();
                return false;
            }
        }
        catch (error) {
            console.error('Error requesting location permission:', error);
            return false;
        }
    }, []);
    const getCurrentLocation = (0, react_1.useCallback)(async () => {
        if (locationPermissionStatus !== 'granted') {
            const granted = await requestLocationPermission();
            if (!granted)
                return null;
        }
        try {
            setIsLoadingLocation(true);
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = location.coords;
            const address = await reverseGeocode(latitude, longitude);
            const locationData = { latitude, longitude, address };
            setUserLocation(locationData);
            return locationData;
        }
        catch (error) {
            console.error('Error getting current location:', error);
            return null;
        }
        finally {
            setIsLoadingLocation(false);
        }
    }, [locationPermissionStatus, setUserLocation]);
    const hasLocationPermission = locationPermissionStatus === 'granted';
    return (<LocationContext.Provider value={{
            locationPermissionStatus,
            isLoadingLocation,
            hasLocationPermission,
            requestLocationPermission,
            getCurrentLocation,
            errorMessage,
        }}>
      {children}
    </LocationContext.Provider>);
};
exports.LocationProvider = LocationProvider;
const useLocation = () => {
    const context = (0, react_1.useContext)(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
exports.useLocation = useLocation;
exports.default = LocationContext;
