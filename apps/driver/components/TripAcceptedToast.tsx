import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TripAcceptedToastProps {
  visible: boolean;
  pickupAddress: string;
  onDismiss: () => void;
}

export default function TripAcceptedToast({ visible, pickupAddress, onDismiss }: TripAcceptedToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-180)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      translateY.setValue(-180);
      opacity.setValue(0);
      return;
    }

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 160,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2400),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -180,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start(({ finished }) => {
      if (finished) {
        onDismiss();
      }
    });

    return () => {
      sequence.stop();
    };
  }, [onDismiss, opacity, translateY, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: Math.max(insets.top + 8, 16),
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.card}>
        <Text style={styles.icon}>✅</Text>
        <View style={styles.copy}>
          <Text style={styles.title}>Trip Accepted</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            Navigate to pickup: {pickupAddress || 'pickup location'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 10000,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    elevation: 8,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Jakarta-Bold',
    fontSize: 16,
    marginBottom: 2,
  },
  subtitle: {
    color: '#ECFDF5',
    fontFamily: 'Jakarta-Medium',
    fontSize: 13,
  },
});
