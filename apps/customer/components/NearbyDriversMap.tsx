// Nearby Drivers Map Component for Customer App Home
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, Animated } from 'react-native';
import MapView, { Marker, Region, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { findNearbyDrivers, estimateETA } from '@/lib/tracking';
import { getActiveVehicleTypes, getVehicleIcon, VehicleType } from '@/lib/vehicleTypes';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

interface NearbyDriver {
  id: string;
  vehicle_type: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  user: {
    name: string;
  };
}

interface NearbyDriversMapProps {
  vehicleTypeFilter?: string;
  onDriversLoaded?: (count: number) => void;
  onRegionChange?: (region: Region) => void;
}



const NearbyDriversMap: React.FC<NearbyDriversMapProps> = ({
  vehicleTypeFilter,
  onDriversLoaded,
  onRegionChange,
}) => {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Vehicle specifications from database
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);
  
  // Animation refs for each driver marker
  const driverAnimations = useRef<Record<string, {
    pulse: Animated.Value;
    opacity: Animated.Value;
  }>>({});

  // Fetch vehicle specifications from database
  useEffect(() => {
    const fetchVehicleSpecs = async () => {
      const { data, error } = await getActiveVehicleTypes();
      if (data && !error) {
        setVehicleSpecs(data);
      }
    };
    fetchVehicleSpecs();
  }, []);

  // Get user location and nearby drivers on mount
  useEffect(() => {
    initializeMap();
  }, []);

  // Refresh drivers when filter changes
  useEffect(() => {
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
        accuracy: Location.Accuracy.Highest,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      await fetchNearbyDrivers(coords.latitude, coords.longitude);
    } catch (error) {
      console.error('Error initializing map:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyDrivers = async (lat: number, lng: number) => {
    try {
      setRefreshing(true);
      const { data, error } = await findNearbyDrivers(lat, lng, vehicleTypeFilter, 10);
      
      if (!error) {
        setNearbyDrivers(data);
        onDriversLoaded?.(data.length);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Initialize animations for new drivers
  useEffect(() => {
    nearbyDrivers.forEach(driver => {
      if (!driverAnimations.current[driver.id]) {
        // Create new animation values
        const pulse = new Animated.Value(1);
        const opacity = new Animated.Value(0);
        
        driverAnimations.current[driver.id] = { pulse, opacity };
        
        // Fade in
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();
        
        // Start pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1.2,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      }
    });
    
    // Clean up animations for drivers that are no longer nearby
    Object.keys(driverAnimations.current).forEach(driverId => {
      if (!nearbyDrivers.find(d => d.id === driverId)) {
        delete driverAnimations.current[driverId];
      }
    });
  }, [nearbyDrivers]);

  // Refresh drivers every 30 seconds
  useEffect(() => {
    if (!userLocation) return;

    const interval = setInterval(() => {
      fetchNearbyDrivers(userLocation.latitude, userLocation.longitude);
    }, 30000);

    return () => clearInterval(interval);
  }, [userLocation, vehicleTypeFilter]);

  const handleRegionChange = (region: Region) => {
    onRegionChange?.(region);
    
    // Optionally fetch drivers for new region center
    // fetchNearbyDrivers(region.latitude, region.longitude);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Finding drivers near you...</Text>
      </View>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorEmoji}>📍</Text>
        <Text style={styles.errorText}>Unable to get your location</Text>
        <Text style={styles.errorSubtext}>Please enable location services</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="standard"
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChange}
      >

        {/* Nearby Driver Markers - Now Animated */}
        {nearbyDrivers.map((driver) => {
          const animation = driverAnimations.current[driver.id];
          const vehicleIcon = getVehicleIcon(driver.vehicle_type, vehicleSpecs);
          
          return (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false} // Improve performance
            >
              {animation && (
                <Animated.View 
                  style={[
                    styles.driverMarker,
                    {
                      transform: [{ scale: animation.pulse }],
                      opacity: animation.opacity,
                    }
                  ]}
                >
                  <Text style={styles.driverEmoji}>
                    {vehicleIcon}
                  </Text>
                </Animated.View>
              )}
            </Marker>
          );
        })}
      </MapView>

      {/* Drivers Count Badge */}
      {nearbyDrivers.length > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {nearbyDrivers.length} {vehicleTypeFilter || 'vehicle'}{nearbyDrivers.length > 1 ? 's' : ''} nearby
          </Text>
          {refreshing && <ActivityIndicator size="small" color="#22c55e" style={styles.refreshIndicator} />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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

export default NearbyDriversMap;
