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
  onError?: (errorMessage: string) => void;
}

// Polyline decoding function (unchanged)
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
  onReady,
  onError,
}) => {
  const [coordinates, setCoordinates] = useState<LatLng[]>([]);

  useEffect(() => {
    let isActive = true;

    async function fetchRoute() {
      if (!origin || !destination) return;
      if (!olaMapsApiKey) {
        if (onError) onError("No API Key");
        return;
      }

      try {
        const url = `https://api.olamaps.io/routing/v1/directions?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&api_key=${olaMapsApiKey}&alternatives=false&steps=false`; // Optimized
        
        const requestId = `ola-route-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'X-Request-Id': requestId,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (data.status === "SUCCESS" || (data.routes && data.routes.length > 0)) {
          const route = data.routes[0];
          let polylineString = "";
          let distance = 0;
          let duration = 0;

          // Try multiple possible polyline fields
          if (route.overview_polyline?.points) {
            polylineString = route.overview_polyline.points;
          } else if (route.overview_polyline) {
            polylineString = route.overview_polyline;
          } else if (route.geometry) {
            polylineString = route.geometry;
          } else if (route.legs?.[0]?.steps?.[0]?.polyline) {
            polylineString = route.legs[0].steps[0].polyline.points;
          }

          // Try distance/duration fields
          if (route.distance?.value || route.legs?.[0]?.distance?.value) {
            distance = (route.distance?.value || route.legs[0].distance.value) || 0;
          }
          if (route.duration?.value || route.legs?.[0]?.duration?.value) {
            duration = (route.duration?.value || route.legs[0].duration.value) || 0;
          }

          const points = decodePolyline(polylineString);

          if (isActive && points.length > 1) {
            setCoordinates(points);
            if (onReady) {
              onReady({ distance: distance / 1000, duration: duration / 60, coordinates: points });
            }
          } else if (isActive) {
            // Fallback straight line
            setCoordinates([origin, destination]);
            if (onError) onError("No detailed route, using straight line");
          }
        } else {
          console.error("Ola Maps Directions error details:", {
            status: data.status,
            error_msg: data.error_msg,
            code: data.code,
            message: data.message,
            origin,
            destination,
            requestId
          });
          if (onError) onError(`Route error: ${data.error_msg || data.message || 'No route found. Check Ola coverage.'}`);
          if (isActive) {
            setCoordinates([origin, destination]);
          }
        }
      } catch (error: any) {
        console.error("Ola Maps Directions POST fetch failed:", {
          error: error.message,
          origin,
          destination
        });
        if (onError) onError(`Network error: ${error.message}`);
        if (isActive) {
          setCoordinates([origin, destination]);
        }
      }
    }

    fetchRoute();

    return () => {
      isActive = false;
    };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  if (coordinates.length === 0) return null;

  return (
    <Polyline
      coordinates={coordinates}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
    />
  );
};

export default OlaMapViewDirections;

