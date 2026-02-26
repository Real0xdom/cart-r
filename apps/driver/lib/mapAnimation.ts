import { useRef, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { AnimatedRegion } from 'react-native-maps';

interface Coordinate {
  latitude: number;
  longitude: number;
}

export function useAnimatedLocation(coordinate: Coordinate | null) {
  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: coordinate?.latitude || 0,
      longitude: coordinate?.longitude || 0,
      latitudeDelta: 0,
      longitudeDelta: 0,
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
          latitudeDelta: 0,
          longitudeDelta: 0,
        });
      } catch (e) {
        console.log('Error setting initial animated region value', e);
      }
      previousCoord.current = coordinate;
      return;
    }

    const { latitude: prevLat, longitude: prevLng } = previousCoord.current;
    
    // Only animate if changed
    if (prevLat !== coordinate.latitude || prevLng !== coordinate.longitude) {
      const newHeading = calculateBearing(prevLat, prevLng, coordinate.latitude, coordinate.longitude);
      setHeading(newHeading);
      
      const newCoord = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      };

      try {
        if (animatedCoordinate && animatedCoordinate.timing) {
          animatedCoordinate.timing({
             ...newCoord,
             latitudeDelta: 0,
             longitudeDelta: 0,
             toValue: 0,
             duration: 1000,
             easing: Easing.linear,
             useNativeDriver: false,
          }).start();
        } else if (animatedCoordinate) { // Fallback if timing method isn't available
          animatedCoordinate.setValue(newCoord);
        }
      } catch (e) {
        console.log('Error animating coordinates', e);
      }
      
      previousCoord.current = coordinate;
    }
  }, [coordinate, animatedCoordinate]);

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
