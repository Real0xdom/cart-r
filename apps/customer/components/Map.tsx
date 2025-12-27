import React, { useEffect, useState, useMemo, useRef } from "react";
import { ActivityIndicator, Text, View, Alert, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, Region, Callout } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import Constants from 'expo-constants';

import { icons } from "@/constants";
import { supabase } from "@/lib/supabase";
import {
  calculateRegion,
} from "@/lib/map";
import { useDriverStore, useLocationStore } from "@/store";
import { MarkerData } from "@/types/type";

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Default region (centered on India as fallback)
const DEFAULT_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

interface MapProps {
  selectionMode?: 'from' | 'to' | null;
  onLocationSelected?: () => void;
}

const Map = ({ selectionMode = null, onLocationSelected }: MapProps) => {
  const {
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
    destinationAddress,
    userAddress,
    setUserLocation,
    setDestinationLocation,
  } = useLocationStore();
  const { selectedDriver } = useDriverStore();

  const mapRef = useRef<MapView>(null);
  const destinationMarkerRef = useRef<any>(null);

  // Temporary marker for selection
  const [tempMarker, setTempMarker] = useState<{ latitude: number; longitude: number } | null>(null);

  // Fetch drivers from Supabase
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show callout when destination is set
  useEffect(() => {
    if (destinationLatitude && destinationLongitude && destinationMarkerRef.current) {
      // Small delay to ensure marker is rendered
      setTimeout(() => {
        destinationMarkerRef.current?.showCallout();
      }, 500);
    }
  }, [destinationLatitude, destinationLongitude]);

  useEffect(() => {
    const fetchDrivers = async () => {
      // Only fetch if we have user location
      if (!userLatitude || !userLongitude) return;

      setLoading(true);
      try {
        // Fetch active drivers
        const { data: driversData, error: driversError } = await supabase
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

        if (driversError) throw driversError;

        // Mock locations near user for demo purpose since we don't have real driver GPS updates yet
        const loadedMarkers: MarkerData[] = (driversData || []).map((driver: any) => {
          const randomLatOffset = (Math.random() - 0.5) * 0.02;
          const randomLngOffset = (Math.random() - 0.5) * 0.02;

          return {
            id: driver.id,
            latitude: userLatitude + randomLatOffset,
            longitude: userLongitude + randomLngOffset,
            title: driver.users?.name || 'Driver',
            profile_image_url: driver.users?.avatar_url || 'https://via.placeholder.com/100',
            car_image_url: 'https://via.placeholder.com/100',
            car_seats: 4,
            rating: driver.rating,
            first_name: driver.users?.name?.split(' ')[0] || 'Driver',
            last_name: driver.users?.name?.split(' ')[1] || '',
            time: 5,
            price: '150',
          };
        });

        setMarkers(loadedMarkers);
      } catch (err: any) {
        console.error("Error fetching drivers:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
  }, [userLatitude, userLongitude]);

  const region = useMemo(() => {
    if (userLatitude && userLongitude) {
      return calculateRegion({
        userLatitude,
        userLongitude,
        destinationLatitude,
        destinationLongitude,
      });
    }
    return DEFAULT_REGION;
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);

  // Reverse geocode helper
  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const apiKey = GOOGLE_API_KEY;
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
        );
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      }
      return 'Selected Location';
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return 'Selected Location';
    }
  };

  // Handle map tap for location selection
  const handleMapPress = async (event: MapPressEvent) => {
    if (!selectionMode) return;

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
      } else if (selectionMode === 'to') {
        setDestinationLocation(locationData);
      }

      setTempMarker(null);

      if (onLocationSelected) {
        onLocationSelected();
      }
    } catch (err) {
      console.error("Error selecting location:", err);
      Alert.alert("Error", "Could not get address for this location. Please try again.");
      setTempMarker(null);
    }
  };

  // Show loading state while waiting for location
  if (!userLatitude || !userLongitude) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0286FF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
        <Text style={styles.loadingSubtext}>Please allow location access when prompted</Text>
      </View>
    );
  }

  // Web Fallback (to allow flow testing without Google Maps setup)
  if (Platform.OS === 'web') {
     return (
        <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' }]}>
           <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 10 }}>Map Placeholder (Web)</Text>
           <Text style={{ textAlign: 'center', color: '#6b7280', paddingHorizontal: 20, marginBottom: 20 }}>
              Google Maps is not configured for web in this demo.
              {'\n'}Use mobile for the full map experience.
           </Text>
           {selectionMode && (
              <View style={{ backgroundColor: '#bfdbfe', padding: 15, borderRadius: 10 }}>
                 <Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: 5 }}>Testing Mode active:</Text>
                 <Text style={{ color: '#1e40af' }} onPress={() => {
                    // Simulate selecting a location slightly offset from current
                    onLocationSelected?.();
                    if (selectionMode === 'to') setDestinationLocation({ latitude: userLatitude + 0.01, longitude: userLongitude + 0.01, address: 'Test Destination Address' });
                    else setUserLocation({ latitude: userLatitude, longitude: userLongitude, address: 'Test Pickup Address' });
                 }}>
                    Click here to simulate selecting a location on map
                 </Text>
              </View>
           )}
        </View>
     );
  }

  const shouldUseGoogleProvider = Platform.OS === 'android' && !isExpoGo;

  return (
    <MapView
      ref={mapRef}
      provider={shouldUseGoogleProvider ? PROVIDER_GOOGLE : undefined}
      style={styles.map}
      mapType="standard"
      showsPointsOfInterest={false}
      region={region}
      showsUserLocation={true}
      showsMyLocationButton={true}
      onPress={handleMapPress}
    >
      {/* Pickup location marker */}
      {userLatitude && userLongitude && userAddress && (
        <Marker
          key="pickup"
          coordinate={{
            latitude: userLatitude,
            longitude: userLongitude,
          }}
          pinColor="#22c55e"
        >
          <Callout tooltip>
            <View style={styles.calloutContainer}>
              <View style={styles.calloutBubble}>
                <Text style={styles.calloutTitle}>📦 Pickup Location</Text>
                <Text style={styles.calloutText} numberOfLines={2}>
                  {userAddress}
                </Text>
              </View>
              <View style={styles.calloutArrow} />
            </View>
          </Callout>
        </Marker>
      )}

      {/* Driver markers */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{
            latitude: marker.latitude,
            longitude: marker.longitude,
          }}
          title={marker.title}
          image={
            selectedDriver === +marker.id ? icons.selectedMarker : icons.marker
          }
        />
      ))}

      {/* Temporary selection marker */}
      {tempMarker && (
        <Marker
          key="temp-marker"
          coordinate={tempMarker}
          pinColor="#0286FF"
        >
          <Callout>
            <Text>Selecting location...</Text>
          </Callout>
        </Marker>
      )}

      {/* Destination marker with tooltip */}
      {destinationLatitude && destinationLongitude && (
        <>
          <Marker
            ref={destinationMarkerRef}
            key="destination"
            coordinate={{
              latitude: destinationLatitude,
              longitude: destinationLongitude,
            }}
            pinColor="#ef4444"
          >
            <Callout tooltip>
              <View style={styles.calloutContainer}>
                <View style={styles.dropCalloutBubble}>
                  <Text style={styles.calloutTitle}>📍 Drop Location</Text>
                  <Text style={styles.dropCalloutSubtitle}>Your goods will be dropped here</Text>
                  {destinationAddress && (
                    <Text style={styles.calloutText} numberOfLines={2}>
                      {destinationAddress}
                    </Text>
                  )}
                </View>
                <View style={styles.dropCalloutArrow} />
              </View>
            </Callout>
          </Marker>

          {/* Route line */}
          {userLatitude && userLongitude && directionsAPI && (
            <MapViewDirections
              origin={{
                latitude: userLatitude,
                longitude: userLongitude,
              }}
              destination={{
                latitude: destinationLatitude,
                longitude: destinationLongitude,
              }}
              apikey={directionsAPI}
              strokeColor="#0286FF"
              strokeWidth={4}
            />
          )}
        </>
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
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

export default Map;
