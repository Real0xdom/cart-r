// [G6] Battery Saver Detection Utility
// Checks if the device is in low-power / battery saver mode
// and warns the user that notifications may be delayed

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Alert, Linking, Platform } from 'react-native';

type ExpoBatteryModule = {
  isLowPowerModeEnabledAsync?: () => Promise<boolean>;
};

/**
 * Safely check if battery saver / low power mode is enabled.
 * Uses the native Expo battery module only when it is present in the running app.
 */
async function isBatterySaverEnabled(): Promise<boolean> {
  try {
    const batteryModule =
      requireOptionalNativeModule<ExpoBatteryModule>('ExpoBattery');

    if (!batteryModule?.isLowPowerModeEnabledAsync) {
      return false;
    }

    return await batteryModule.isLowPowerModeEnabledAsync();
  } catch (error) {
    // Battery saver detection is optional, so missing native support should never break startup.
    console.warn('[BatterySaver] Unable to read battery saver status:', error);
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
              // Android: open app settings so the user can adjust battery restrictions.
              Linking.openSettings();
            }
          },
        },
      ]
    );
  } catch (error) {
    // Silently fail because battery saver detection is non-critical.
    console.warn('[BatterySaver] Error checking battery saver:', error);
  }
}

export { isBatterySaverEnabled };
