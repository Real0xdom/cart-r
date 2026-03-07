import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';

const NetworkBanner = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [anim] = useState(new Animated.Value(-100)); // Start off-screen

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isConnected ? -100 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected]);

  if (isConnected && anim._value === -100) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: anim }] }]}>
      <View className="flex-row items-center justify-center p-3 bg-red-600">
        <Feather name="wifi-off" size={18} color="white" />
        <Text className="text-white font-JakartaBold ml-2 text-sm">
          No Internet Connection. Some features may be unavailable.
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});

export default NetworkBanner;
