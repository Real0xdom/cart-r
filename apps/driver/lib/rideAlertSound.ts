import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Vibration } from 'react-native';

const RIDE_ALERT_SOUND_NAME = 'ride_request_alert';
const RIDE_ALERT_SOURCE = require('../assets/sounds/ride_request_alert.mp3');
const VIBRATION_PATTERN = [0, 180, 2200] as const;

let rideAlertSound: Audio.Sound | null = null;
let isPreparingSound = false;

export function getRideAlertSoundName() {
  return RIDE_ALERT_SOUND_NAME;
}

export async function playRideAlertSound() {
  Vibration.cancel();
  Vibration.vibrate([...VIBRATION_PATTERN], true);

  if (isPreparingSound) {
    return;
  }

  try {
    isPreparingSound = true;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playThroughEarpieceAndroid: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      staysActiveInBackground: false,
    });

    if (!rideAlertSound) {
      const { sound } = await Audio.Sound.createAsync(
        RIDE_ALERT_SOURCE,
        {
          isLooping: true,
          shouldPlay: true,
          volume: 1,
          progressUpdateIntervalMillis: 500,
        }
      );
      rideAlertSound = sound;
      return;
    }

    const status = await rideAlertSound.getStatusAsync();
    if (!status.isLoaded) {
      await rideAlertSound.unloadAsync().catch(() => {});
      rideAlertSound = null;
      await playRideAlertSound();
      return;
    }

    if (!status.isPlaying) {
      await rideAlertSound.setIsLoopingAsync(true);
      await rideAlertSound.playAsync();
    }
  } catch (error) {
    console.warn('[RIDE ALERT SOUND] Failed to play looped alert sound:', error);
  } finally {
    isPreparingSound = false;
  }
}

export async function stopRideAlertSound() {
  Vibration.cancel();

  if (!rideAlertSound) {
    return;
  }

  try {
    const status = await rideAlertSound.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await rideAlertSound.stopAsync();
      }
      await rideAlertSound.unloadAsync();
    }
  } catch (error) {
    console.warn('[RIDE ALERT SOUND] Failed to stop alert sound:', error);
  } finally {
    rideAlertSound = null;
  }
}
