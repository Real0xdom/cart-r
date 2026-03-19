import React, { useEffect, useState, useMemo, useRef } from "react";
import { ActivityIndicator, Text, View, Alert, StyleSheet, Platform } from "react-native";
import MapView, { Marker, MapPressEvent, Region, Callout, UrlTile } from "react-native-maps";
import OlaMapViewDirections from "./OlaMapViewDirections";
import Constants from 'expo-constants';

import { icons } from "@/constants";
import { supabase } from "@/lib/supabase";
import {
  calculateRegion,
} from "@/lib/map";
import { useLocationStore } from "@/store";
import { reverseGeocode } from "@/lib/location";

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Default region (Pune, India - zoomed in)
const DEFAULT_REGION: Region = {
  latitude: 18.5204,
  longitude: 73.8567,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
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
  const mapRef = useRef<MapView>(null);
  const destinationMarkerRef = useRef<any>(null);

  // Temporary marker for selection
  const [tempMarker, setTempMarker] = useState<{ latitude: number; longitude: number } | null>(null);

  // Note: Drivers fetch removed as requested ("remove fake car icons")
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

  const region = useMemo(() => {
    if (userLatitude && userLongitude) {
      return calculateRegion({
        userLatitude,
        userLongitude,
        destinationLatitude,
        destinationLongitude,
      });
    }
    return {
      ...DEFAULT_REGION,
      ...(tempMarker ? { latitude: tempMarker.latitude, longitude: tempMarker.longitude } : {})
    };
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude, tempMarker]);

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
      Alert.alert("Error", "Could not process location. Please try again.");
      setTempMarker(null);
    }
  };

  // Show loading state while waiting for location
  if (!userLatitude || !userLongitude) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
        <Text style={styles.loadingText}>Getting your location...</Text>
        <Text style={styles.loadingSubtext}>Please allow location access when prompted</Text>
      </View>
    );
  }

  // Web Fallback
  if (Platform.OS === 'web') {
     return (
        <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' }]}>
           <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 10 }}>Ola Maps (Web Placeholder)</Text>
           <Text style={{ textAlign: 'center', color: '#6b7280', paddingHorizontal: 20, marginBottom: 20 }}>
              Full Ola Maps experience on mobile.
           </Text>
           {selectionMode && (
              <View style={{ backgroundColor: '#bfdbfe', padding: 15, borderRadius: 10 }}>
                 <Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: 5 }}>Test Mode:</Text>
                 <Text style={{ color: '#1e40af' }} onPress={() => {
                    onLocationSelected?.();
                    if (selectionMode === 'to') setDestinationLocation({ latitude: userLatitude! + 0.01, longitude: userLongitude! + 0.01, address: 'Test Destination' });
                    else setUserLocation({ latitude: userLatitude!, longitude: userLongitude!, address: 'Test Pickup' });
                 }}>
                    Simulate location selection
                 </Text>
              </View>
           )}
        </View>
     );
  }

  return (
    <MapView
      ref={mapRef}
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

      {/* Temporary selection marker */}
      {tempMarker && (
        <Marker
          key="temp-marker"
          coordinate={tempMarker}
          pinColor="#FF9800"
        >
          <Callout>
            <Text>Selecting location...</Text>
          </Callout>
        </Marker>
      )}

      {/* Destination marker */}
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
          {userLatitude && userLongitude && (
            <OlaMapViewDirections
              origin={{
                latitude: userLatitude,
                longitude: userLongitude,
              }}
              destination={{
                latitude: destinationLatitude,
                longitude: destinationLongitude,
              }}
              strokeColor="#FF9800"
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

