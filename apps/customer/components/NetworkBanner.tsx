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

  // Removed conditional null return to stabilize view tree and prevent layout issues
  // The Animated.View starts at translateY: -100 so it's hidden off-screen anyway

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: anim }] }]}>
      <View style={styles.banner}>
        <Feather name="wifi-off" size={18} color="white" />
        <Text style={styles.text}>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#DC2626', // bg-red-600
  },
  text: {
    color: 'white',
    fontFamily: 'Jakarta-Bold',
    marginLeft: 8,
    fontSize: 14,
  },
});

export default NetworkBanner;
