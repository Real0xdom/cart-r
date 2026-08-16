import { useRef, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { AnimatedRegion } from 'react-native-maps';

interface Coordinate {
  latitude: number;
  longitude: number;
  heading?: number;
}

const MIN_VISUAL_MOVEMENT_METERS = 6;

export function useAnimatedLocation(coordinate: Coordinate | null) {
  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: coordinate?.latitude || 0,
      longitude: coordinate?.longitude || 0,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    })
  ).current;

  const [heading, setHeading] = useState(0);
  const previousCoord = useRef<Coordinate | null>(coordinate);

  useEffect(() => {
    if (!coordinate) return;

    if (!previousCoord.current) {
      // First time setting
      try {
        animatedCoordinate.setValue({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        if (coordinate.heading !== undefined) {
          setHeading(coordinate.heading);
        }
      } catch (e) {
        console.log('Error setting initial animated region value', e);
      }
      previousCoord.current = coordinate;
      return;
    }

    const { latitude: prevLat, longitude: prevLng } = previousCoord.current;
    const distanceMeters = haversineDistanceMeters(
      prevLat,
      prevLng,
      coordinate.latitude,
      coordinate.longitude
    );
     
    // Only animate if changed
    if (prevLat !== coordinate.latitude || prevLng !== coordinate.longitude) {
      if (distanceMeters < MIN_VISUAL_MOVEMENT_METERS) {
        if (coordinate.heading !== undefined && coordinate.heading !== heading) {
          setHeading(coordinate.heading);
        }
        return;
      }

      // Use provided heading or calculate bearing
      if (coordinate.heading !== undefined) {
        setHeading(coordinate.heading);
      } else {
        const calculatedHeading = calculateBearing(prevLat, prevLng, coordinate.latitude, coordinate.longitude);
        setHeading(calculatedHeading);
      }
      
      const newCoord = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      try {
        if (animatedCoordinate && animatedCoordinate.timing) {
          (animatedCoordinate.timing({
             ...newCoord,
             duration: 3000,
             easing: Easing.linear,
             useNativeDriver: false,
          } as any)).start();
        } else if (animatedCoordinate) { // Fallback if timing method isn't available
          animatedCoordinate.setValue(newCoord);
        }
      } catch (e) {
        console.log('Error animating coordinates', e);
      }
      
      previousCoord.current = coordinate;
    } else if (coordinate.heading !== undefined && coordinate.heading !== heading) {
      // Just heading changed
      setHeading(coordinate.heading);
    }
  }, [coordinate, animatedCoordinate, heading]);

  return { animatedCoordinate, heading };
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const toDeg = (val: number) => (val * 180) / Math.PI;

  const R1 = toRad(lat1);
  const R2 = toRad(lat2);
  const deltaLon = toRad(lon2 - lon1);

  const y = Math.sin(deltaLon) * Math.cos(R2);
  const x = Math.cos(R1) * Math.sin(R2) - Math.sin(R1) * Math.cos(R2) * Math.cos(deltaLon);
  const brng = toDeg(Math.atan2(y, x));

  return (brng + 360) % 360;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
