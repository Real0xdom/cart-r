import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-native-maps';

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface OlaMapViewDirectionsProps {
  origin: LatLng;
  destination: LatLng;
  strokeWidth?: number;
  strokeColor?: string;
  onReady?: (result: { distance: number; duration: number; coordinates: LatLng[] }) => void;
  lineDashPattern?: number[];
}

// Polyline decoding function for OSRM / Google format
function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];
  
  let poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    let p = {
      latitude: (lat / 1e5),
      longitude: (lng / 1e5)
    };
    poly.push(p);
  }
  return poly;
}

export const OlaMapViewDirections: React.FC<OlaMapViewDirectionsProps> = ({
  origin,
  destination,
  strokeWidth = 3,
  strokeColor = "black",
  lineDashPattern,
  onReady,
  onError,
}) => {
  const [coordinates, setCoordinates] = useState<LatLng[]>([]);

  useEffect(() => {
    let isActive = true;

    async function fetchRoute() {
      if (!origin || !destination) return;
      // OSRM fallback - no API key needed

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const polylineString = route.geometry;
          const distance = route.distance || 0; // meters
          const duration = route.duration || 0; // seconds

          const points = decodePolyline(polylineString);

          if (isActive) {
            setCoordinates(points);
            if (onReady) {
              // Convert to km and min
              onReady({ distance: distance / 1000, duration: duration / 60, coordinates: points });
            }
          }
        } else {
          // Log specific errors
          console.warn("Directions error:", data.message || data.error || "No routes");
          if (onError) onError(data.message || "No routes");

          // Fallback: draw straight line if route fails so map isn't totally empty
          if (isActive) {
            setCoordinates([origin, destination]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Ola Maps directions", error);
        if (onError) onError("Failed to fetch");
        if (isActive) {
          setCoordinates([origin, destination]);
        }
      }
    }

    fetchRoute();

    return () => {
      isActive = false;
    };
  }, [origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

  if (coordinates.length === 0) return null;

  return (
    <Polyline
      coordinates={coordinates}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
      lineDashPattern={lineDashPattern}
    />
  );
};

export default OlaMapViewDirections;
