import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkDriverWalletEligibility, getDriverWalletRechargeNavigationTarget } from '@/lib/wallet';

const COUNTDOWN_SECONDS = 10;
const TOTAL_TIMEOUT_SECONDS = 30;

interface RideRequestModalProps {
  visible: boolean;
  driverId?: string;
  pickupAddress: string;
  dropAddress: string;
  fare: number | null | undefined;
  distance: number | null | undefined;
  estimatedDuration: number | null | undefined;
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `₹${Math.round(value)}` : 'Fare pending';
}

function formatDistance(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} km` : '-- km';
}

function formatDuration(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `~${Math.round(value)} min` : '-- min';
}

export default function RideRequestModal({
  visible,
  driverId,
  pickupAddress,
  dropAddress,
  fare,
  distance,
  estimatedDuration,
  onAccept,
  onReject,
  onTimeout,
}: RideRequestModalProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);

  const statsLabel = `${formatCurrency(fare)} • ${formatDistance(distance)} • ${formatDuration(estimatedDuration)}`;

  useEffect(() => {
    if (!visible) {
      setCountdown(COUNTDOWN_SECONDS);
      setButtonsEnabled(false);
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    void AccessibilityInfo.announceForAccessibility?.('New ride request. Please wait ten seconds before responding.');

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: COUNTDOWN_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    setCountdown(COUNTDOWN_SECONDS);
    setButtonsEnabled(false);

    const countdownTimer = setInterval(() => {
      setCountdown((previous) => {
        const next = previous - 1;

        if (next <= 0) {
          clearInterval(countdownTimer);
          setButtonsEnabled(true);
          return 0;
        }

        return next;
      });
    }, 1000);

    const timeoutTimer = setTimeout(() => {
      onTimeout();
    }, TOTAL_TIMEOUT_SECONDS * 1000);

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(timeoutTimer);
      progress.stopAnimation();
    };
  }, [onTimeout, progress, visible]);

  if (!visible) {
    return null;
  }

  const handleAcceptPress = async () => {
    if (!buttonsEnabled || isCheckingWallet) {
      return;
    }

    if (!driverId) {
      onAccept();
      return;
    }

    try {
      setIsCheckingWallet(true);
      const eligibility = await checkDriverWalletEligibility(driverId);
      console.log('[RIDE REQUEST MODAL] Wallet eligibility:', eligibility);

      if (!eligibility.canAcceptRides) {
        Alert.alert(
          'Cannot Accept Ride',
          `Your wallet balance is \u20b9${eligibility.currentBalance.toFixed(2)}.\n\nRecharge \u20b9${(eligibility.requiredRecharge || 0).toFixed(0)} to accept new ride requests again.`,
          [
            { text: 'Dismiss', onPress: onReject },
            {
              text: 'Recharge Now',
              onPress: () => {
                onReject();
                router.push(getDriverWalletRechargeNavigationTarget() as any);
              },
            },
          ]
        );
        return;
      }

      onAccept();
    } catch (error) {
      console.error('[RIDE REQUEST MODAL] Wallet check failed:', error);
      Alert.alert('Error', 'Failed to verify wallet status.');
    } finally {
      setIsCheckingWallet(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { marginTop: Math.max(insets.top + 12, 24) }]} accessibilityRole="alert">
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚚</Text>
            <Text style={styles.headerText} maxFontSizeMultiplier={1.2}>
              NEW RIDE REQUEST
            </Text>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationCopy}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {pickupAddress || 'Pickup location unavailable'}
                </Text>
              </View>
            </View>

            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationCopy}>
                <Text style={styles.locationLabel}>Drop</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {dropAddress || 'Drop location unavailable'}
                </Text>
              </View>
            </View>

            <Text style={styles.statsText} numberOfLines={1}>
              {statsLabel}
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text
              style={buttonsEnabled ? styles.progressReadyText : styles.progressCountdownText}
              accessibilityLabel={
                buttonsEnabled ? 'You can now respond to this ride request.' : `${countdown} seconds remaining before you can respond.`
              }
            >
              {buttonsEnabled ? 'You can now respond' : `Please wait ${countdown}s before responding`}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !buttonsEnabled }}
              accessibilityLabel={buttonsEnabled ? 'Reject ride request' : `Reject disabled for ${countdown} seconds`}
              disabled={!buttonsEnabled}
              onPress={onReject}
              style={({ pressed }) => [
                styles.button,
                styles.rejectButton,
                !buttonsEnabled && styles.buttonDisabled,
                pressed && buttonsEnabled && styles.buttonPressed,
              ]}
            >
              <Text style={styles.rejectButtonText}>{buttonsEnabled ? 'Reject' : `Wait ${countdown}s`}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !buttonsEnabled || isCheckingWallet }}
              accessibilityLabel={buttonsEnabled ? 'Accept ride request' : `Accept disabled for ${countdown} seconds`}
              disabled={!buttonsEnabled || isCheckingWallet}
              onPress={handleAcceptPress}
              style={({ pressed }) => [
                styles.button,
                styles.acceptButton,
                (!buttonsEnabled || isCheckingWallet) && styles.buttonDisabled,
                pressed && buttonsEnabled && !isCheckingWallet && styles.buttonPressed,
              ]}
            >
              <Text style={styles.acceptButtonText}>
                {isCheckingWallet ? 'Checking...' : buttonsEnabled ? 'Accept Ride' : `Wait ${countdown}s`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    minHeight: 188,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  headerIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  headerText: {
    color: '#111827',
    fontFamily: 'Jakarta-Bold',
    fontSize: 18,
    flexShrink: 1,
  },
  detailsSection: {
    paddingVertical: 14,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  locationCopy: {
    flex: 1,
  },
  locationLabel: {
    color: '#6B7280',
    fontFamily: 'Jakarta-Medium',
    fontSize: 12,
    marginBottom: 2,
  },
  locationAddress: {
    color: '#111827',
    fontFamily: 'Jakarta-SemiBold',
    fontSize: 14,
  },
  statsText: {
    color: '#0F9F6E',
    fontFamily: 'Jakarta-Bold',
    fontSize: 15,
    marginTop: 2,
  },
  progressSection: {
    paddingVertical: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  progressCountdownText: {
    color: '#B45309',
    fontFamily: 'Jakarta-SemiBold',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  progressReadyText: {
    color: '#047857',
    fontFamily: 'Jakarta-SemiBold',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    height: 52,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  rejectButtonText: {
    color: '#DC2626',
    fontFamily: 'Jakarta-Bold',
    fontSize: 15,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Jakarta-Bold',
    fontSize: 15,
  },
});
