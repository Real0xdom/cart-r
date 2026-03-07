// [G6] Battery Saver Detection Utility
// Checks if the device is in low-power / battery saver mode
// and warns the user that notifications may be delayed

import { Alert, Linking, Platform } from 'react-native';

/**
 * Safely check if battery saver / low power mode is enabled.
 * Uses expo-battery if available, falls back gracefully.
 */
async function isBatterySaverEnabled(): Promise<boolean> {
  try {
    const Battery = require('expo-battery');
    if (!Battery || !Battery.isLowPowerModeEnabledAsync) {
      return false;
    }
    return await Battery.isLowPowerModeEnabledAsync();
  } catch (error) {
    // Module not available — gracefully return false
    console.warn('[BatterySaver] expo-battery not available:', error);
    return false;
  }
}

/**
 * Check battery saver status and warn user if it may block notifications.
 * Should be called once during app initialization, after notification setup.
 */
export async function checkBatterySaverAndWarn(): Promise<void> {
  try {
    const batterySaverOn = await isBatterySaverEnabled();
    
    if (!batterySaverOn) return;

    Alert.alert(
      'Battery Saver Active',
      'Battery saver mode may delay or block ride update notifications. For the best experience, consider disabling battery saver while using Cartr.',
      [
        { text: 'Got It', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              // Android: open battery optimization settings
              Linking.openSettings();
            }
          }
        }
      ]
    );
  } catch (error) {
    // Silently fail — battery saver detection is non-critical
    console.warn('[BatterySaver] Error checking battery saver:', error);
  }
}

export { isBatterySaverEnabled };
