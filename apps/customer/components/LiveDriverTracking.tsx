// Live Driver Tracking Component for Customer App
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Linking, Platform, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, AnimatedRegion } from 'react-native-maps';
import MapViewDirections from "react-native-maps-directions";
import { useAnimatedLocation } from '@/lib/mapAnimation';
import { subscribeToDriverLocation, getDriverCurrentLocation, estimateETA } from '@/lib/tracking';
import { icons, images } from '@/constants';

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  vehicle_number: string;
  vehicle_model: string;
}

interface Location {
  latitude: number;
  longitude: number;
}

interface LiveDriverTrackingProps {
  driver: DriverInfo;
  pickupLocation: Location;
  dropLocation: Location;
  bookingStatus: 'pending' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed';
  onCallDriver?: () => void;
}

const LiveDriverTracking: React.FC<LiveDriverTrackingProps> = ({
  driver,
  pickupLocation,
  dropLocation,
  bookingStatus,
  onCallDriver,
}) => {
  const mapRef = useRef<MapView>(null);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { animatedCoordinate, heading } = useAnimatedLocation(driverLocation);

  // Subscribe to driver location updates
  useEffect(() => {
    if (!driver?.id) return;

    // Get initial location
    getDriverCurrentLocation(driver.id).then((location) => {
      if (location) {
        setDriverLocation(location);
        updateETA(location);
      }
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToDriverLocation(driver.id, (location) => {
      setDriverLocation(location);
      updateETA(location);
    });

    return () => {
      unsubscribe();
    };
  }, [driver?.id]);

  // Pulse animation for driver marker
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Update ETA based on driver location
  const updateETA = (location: Location) => {
    const targetLocation = bookingStatus === 'in_progress' ? dropLocation : pickupLocation;
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      targetLocation.latitude,
      targetLocation.longitude
    );
    const etaMinutes = estimateETA(distance, 'sedan'); // Default to sedan speed
    setEta(etaMinutes);
  };

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current || !driverLocation) return;

    const coordinates = [pickupLocation];
    if (driverLocation) coordinates.push(driverLocation);
    if (bookingStatus === 'in_progress') coordinates.push(dropLocation);

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
    if (driver?.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    }
    onCallDriver?.();
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        customMapStyle={mapStyle}
      >
        {/* Pickup Marker */}
        <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <Image source={icons.point} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
        </Marker>

        {/* Drop Marker */}
        <Marker coordinate={dropLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <Image source={icons.pin} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
        </Marker>

        {/* Driver Marker */}
        {driverLocation && (
          <Marker.Animated coordinate={animatedCoordinate as any} anchor={{ x: 0.5, y: 0.5 }} rotation={heading} flat={true}>
            <Animated.View style={[{ transform: [{ scale: pulseAnim }], alignItems: 'center', justifyContent: 'center' }]}>
              <Image 
                source={images.truckTransparent}
                style={{ width: 40, height: 40, resizeMode: 'contain', transform: [{ rotate: '-90deg' }] }}
              />
            </Animated.View>
          </Marker.Animated>
        )}

        {/* Route Line */}
        {driverLocation && directionsAPI && (
          <MapViewDirections
            origin={driverLocation}
            destination={bookingStatus === 'in_progress' ? dropLocation : pickupLocation}
            apikey={directionsAPI}
            strokeColor="#22c55e"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusContent}>
          {/* Status Indicator */}
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(bookingStatus) }]} />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          {/* Driver Info Card */}
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.avatarText}>
                {driver.avatar_url ? '👤' : driver.name?.charAt(0) || 'D'}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.vehicleInfo}>
                {driver.vehicle_model} • {driver.vehicle_number}
              </Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallDriver}>
              <Text style={styles.callEmoji}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStatusColor = (status: string): string => {
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

const styles = StyleSheet.create({
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

export default LiveDriverTracking;
