import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RideRequestCard from '@/components/RideRequestCard';
import type { Booking } from '@/lib/bookings';
import { checkDriverWalletEligibility, getDriverWalletRechargeNavigationTarget } from '@/lib/wallet';

const COUNTDOWN_SECONDS = 10;

interface RideRequestModalProps {
  visible: boolean;
  bookingId: string;
  request: Booking;
  driverId?: string;
  onAccept: () => void;
  onReject: () => void;
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `Rs ${Math.round(value)}` : 'Fare pending';
}

function formatDistance(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} km` : '-- km';
}

function formatDuration(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `~${Math.round(value)} min` : '-- min';
}

export default function RideRequestModal({
  visible,
  bookingId,
  request,
  driverId,
  onAccept,
  onReject,
}: RideRequestModalProps) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);
  const snapPoints = useMemo(() => ['78%'], []);
  const statsLabel = `${formatCurrency(request.total_fare)} • ${formatDistance(request.estimated_distance)} • ${formatDuration(request.estimated_duration)}`;

  useEffect(() => {
    if (!visible) {
      setCountdown(COUNTDOWN_SECONDS);
      setButtonsEnabled(false);
      progress.stopAnimation();
      progress.setValue(0);
      bottomSheetRef.current?.close();
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

    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });

    return () => {
      clearInterval(countdownTimer);
      progress.stopAnimation();
    };
  }, [progress, visible]);

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

      if (!eligibility.canAcceptRides) {
        Alert.alert(
          'Cannot Accept Ride',
          `Your wallet balance is Rs ${eligibility.currentBalance.toFixed(2)}.\n\nRecharge Rs ${(eligibility.requiredRecharge || 0).toFixed(0)} to accept new ride requests again.`,
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
    <View style={styles.overlay} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.5}
            pressBehavior="none"
          />
        )}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
          accessibilityRole="alert"
        >
          <View style={styles.header}>
            <Text style={styles.headerText}>New ride request</Text>
            <Text style={styles.subHeaderText} numberOfLines={1}>
              {statsLabel}
            </Text>
          </View>

          <RideRequestCard
            key={bookingId}
            request={request}
            onAccept={() => {}}
            onReject={() => {}}
            showActions={false}
          />

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
              {buttonsEnabled ? 'You can now accept or reject this ride' : `Buttons unlock in ${countdown}s`}
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
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  sheetBackground: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: '#CBD5E1',
    width: 48,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subHeaderText: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  progressSection: {
    marginTop: 12,
    marginBottom: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  progressCountdownText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    color: '#B45309',
    fontWeight: '700',
  },
  progressReadyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    color: '#047857',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    height: 54,
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
    opacity: 0.88,
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
