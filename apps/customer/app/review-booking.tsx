import { useAuth } from "@/contexts/AuthContext";
import { createBookingWithPayment } from "@/lib/bookingFlow";
import CashfreeCheckoutModal from "@/components/CashfreeCheckoutModal";
import { getApplicableAddons, calculateAddonCharges, AddonService } from "@/lib/addonUtils";
import { supabase } from "@/lib/supabase";
import { getActiveVehicleTypes, getVehicleDisplayName, getVehicleImageSource, VehicleType } from "@/lib/vehicleTypes";
import { getWalletBalance } from "@/lib/wallet";
import { useBookingStore, useLocationStore, useRideStore } from "@/store";
import type { ReviewBookingPaymentMethod, SelectedVehicle } from "@/types/type";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const GOODS_TYPES = [
  "Documents",
  "Electronics",
  "Furniture",
  "Food Items",
  "Clothes/Textiles",
  "Others",
] as const;

const MAX_GOODS_DESCRIPTION = 200;

const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

const ReviewBookingPage = () => {
  const params = useLocalSearchParams<{
    vehicle?: string;
    vehicleType?: string;
    baseFare?: string;
    totalFare?: string;
    durationMinutes?: string;
    distanceKm?: string;
    addonIds?: string;
    refreshWallet?: string;
  }>();
  const { user, profile } = useAuth();
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const { selectedVehicle, setSelectedVehicle } = useRideStore();
  const {
    receiverDetails,
    goodsDescription: storedGoodsDescription,
    goodsType: storedGoodsType,
    paymentMethod: storedPaymentMethod,
    selectedAddonIds: storedAddonIds,
    setCurrentBooking,
    setGoodsDescription,
    setGoodsType,
    setPaymentMethod,
    setSelectedAddonIds,
  } = useBookingStore();

  const initialGoodsTypeSelection =
    storedGoodsType && GOODS_TYPES.includes(storedGoodsType as (typeof GOODS_TYPES)[number])
      ? storedGoodsType
      : storedGoodsType
        ? "Others"
        : "";
  const initialOtherGoodsType =
    storedGoodsType && !GOODS_TYPES.includes(storedGoodsType as (typeof GOODS_TYPES)[number])
      ? storedGoodsType
      : "";

  const [goodsDescription, setGoodsDescriptionLocal] = useState(storedGoodsDescription || "");
  const [goodsType, setGoodsTypeLocal] = useState(initialGoodsTypeSelection);
  const [otherGoodsType, setOtherGoodsType] = useState(initialOtherGoodsType);
  const [paymentMethod, setPaymentMethodLocal] = useState<ReviewBookingPaymentMethod | null>(
    storedPaymentMethod || null
  );
  const [walletBalance, setWalletBalanceLocal] = useState(0);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [goodsTypeError, setGoodsTypeError] = useState<string | null>(null);
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const [isTopUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isTopUpLoading, setTopUpLoading] = useState(false);
  const [pendingTopUpOrderId, setPendingTopUpOrderId] = useState<string | null>(null);
  const [showTopUpCheckoutModal, setShowTopUpCheckoutModal] = useState(false);
  const [topUpPaymentSessionId, setTopUpPaymentSessionId] = useState("");
  const [topUpEnvironment, setTopUpEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [topUpStatusVisible, setTopUpStatusVisible] = useState(false);
  const [topUpStatusType, setTopUpStatusType] = useState<"success" | "failure">("success");
  const [topUpStatusMessage, setTopUpStatusMessage] = useState("");
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);
  const [availableAddons, setAvailableAddons] = useState<AddonService[]>([]);

  const parsedVehicle = useMemo(() => {
    if (!params.vehicle) {
      return null;
    }

    try {
      return JSON.parse(params.vehicle) as SelectedVehicle;
    } catch (error) {
      console.error("[REVIEW BOOKING] Failed to parse vehicle params:", error);
      return null;
    }
  }, [params.vehicle]);

  const resolvedVehicle = selectedVehicle || parsedVehicle;
  const routeAddonIds = useMemo(() => {
    if (!params.addonIds) {
      return [];
    }

    try {
      const parsed = JSON.parse(params.addonIds);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch (error) {
      console.error("[REVIEW BOOKING] Failed to parse add-on ids:", error);
      return [];
    }
  }, [params.addonIds]);
  const resolvedAddonIds = storedAddonIds.length > 0 ? storedAddonIds : routeAddonIds;

  useEffect(() => {
    if (!selectedVehicle && parsedVehicle) {
      setSelectedVehicle(parsedVehicle);
    }
  }, [parsedVehicle, selectedVehicle, setSelectedVehicle]);

  useEffect(() => {
    if (!storedAddonIds.length && routeAddonIds.length > 0) {
      setSelectedAddonIds(routeAddonIds);
    }
  }, [routeAddonIds, setSelectedAddonIds, storedAddonIds.length]);

  useEffect(() => {
    if (!userAddress || !destinationAddress) {
      router.replace("/find-ride");
      return;
    }

    if (!receiverDetails) {
      router.replace("/receiver-details");
      return;
    }

    if (!resolvedVehicle) {
      router.replace("/select-vehicle");
    }
  }, [destinationAddress, receiverDetails, resolvedVehicle, userAddress]);

  useEffect(() => {
    const loadVehicleSpecs = async () => {
      const { data } = await getActiveVehicleTypes();
      if (data) {
        setVehicleSpecs(data);
      }
    };

    loadVehicleSpecs();
  }, []);

  useEffect(() => {
    const loadAddons = async () => {
      if (!resolvedVehicle) {
        setAvailableAddons([]);
        return;
      }

      const { data, error } = await getApplicableAddons(resolvedVehicle.vehicle_type);
      if (data && !error) {
        setAvailableAddons(data);
        return;
      }

      console.error("[REVIEW BOOKING] Failed to load add-ons:", error);
      setAvailableAddons([]);
    };

    loadAddons();
  }, [resolvedVehicle]);

  const loadWalletBalance = useCallback(async () => {
    const userId = profile?.id || user?.id;
    if (!userId) {
      setWalletError("Please sign in to continue.");
      setIsLoadingWallet(false);
      return;
    }

    setIsLoadingWallet(true);
    setWalletError(null);

    try {
      const balance = await getWalletBalance(userId);
      setWalletBalanceLocal(balance);
    } catch (error) {
      console.error("[REVIEW BOOKING] Failed to fetch wallet balance:", error);
      setWalletError("We could not load your wallet balance.");
    } finally {
      setIsLoadingWallet(false);
    }
  }, [profile?.id, user?.id]);

  useEffect(() => {
    loadWalletBalance();
  }, [loadWalletBalance, params.refreshWallet]);

  useFocusEffect(
    useCallback(() => {
      loadWalletBalance();
    }, [loadWalletBalance])
  );

  const addonCharge = calculateAddonCharges(resolvedAddonIds, availableAddons);
  const routeTotalFare = params.totalFare ? Number(params.totalFare) : NaN;
  const totalFare =
    Number.isFinite(routeTotalFare) && routeTotalFare > 0
      ? routeTotalFare
      : resolvedVehicle
        ? resolvedVehicle.total_fare + addonCharge
        : 0;

  const baseFare = resolvedVehicle?.base_fare ?? Number(params.baseFare || 0);
  const distanceFare = resolvedVehicle?.distance_fare ?? 0;
  const timeFare = resolvedVehicle?.time_fare ?? 0;
  const durationMinutes = resolvedVehicle?.duration_minutes ?? Number(params.durationMinutes || 0);
  const distanceKm = resolvedVehicle?.distance_km ?? Number(params.distanceKm || 0);
  const taxesAndFees = Math.max(totalFare - (baseFare + distanceFare + timeFare + addonCharge), 0);
  const walletShortfall = Math.max(totalFare - walletBalance, 0);
  const canUseWallet = walletBalance >= totalFare;
  const walletHasSomeBalance = walletBalance > 0;

  const vehicleName = resolvedVehicle
    ? getVehicleDisplayName(resolvedVehicle.vehicle_type, vehicleSpecs)
    : params.vehicleType || "Selected Vehicle";
  const vehicleImage = resolvedVehicle
    ? getVehicleImageSource(
        resolvedVehicle.vehicle_type,
        vehicleSpecs.find((vehicle) => vehicle.vehicle_type === resolvedVehicle.vehicle_type)?.icon_url
      )
    : null;

  const walletSuggestedAmount = Math.max(Math.ceil(walletShortfall), 1);
  const paymentSummaryText =
    paymentMethod === "cash"
      ? "Cash • Pay driver directly"
      : paymentMethod === "wallet"
        ? `Wallet • Balance ${formatCurrency(walletBalance)}`
        : "Select payment method";
  const isConfirmDisabled =
    isCreatingBooking ||
    !paymentMethod ||
    (paymentMethod === "wallet" && !canUseWallet);

  const handleOpenTopUp = () => {
    setTopUpAmount(String(walletSuggestedAmount));
    setTopUpModalVisible(true);
  };

  const handleTopUpSuccess = useCallback(
    async (confirmedAmount?: string | number) => {
      setTopUpModalVisible(false);
      setTopUpLoading(false);
      setPendingTopUpOrderId(null);
      setTopUpAmount("");

      try {
        await loadWalletBalance();
        const finalAmount = confirmedAmount ? parseFloat(confirmedAmount.toString()) : walletSuggestedAmount;
        setTopUpStatusType("success");
        setTopUpStatusMessage(`${formatCurrency(finalAmount)} added to wallet!`);
        setTopUpStatusVisible(true);
      } catch (error) {
        console.error("[REVIEW BOOKING] Error refreshing wallet after top-up:", error);
      }
    },
    [loadWalletBalance, walletSuggestedAmount]
  );

  const verifyTopUpPaymentStatus = useCallback(
    async (orderId: string, forceFail: boolean = false) => {
      try {
        const { data } = await supabase.functions.invoke("verify-payment", {
          body: {
            order_id: orderId,
            force_fail: forceFail,
          },
        });

        if (data?.status === "PAID") {
          await handleTopUpSuccess(data.amount);
        } else if (data?.status === "FAILED" || data?.status === "CANCELLED") {
          setTopUpLoading(false);
          setTopUpStatusType("failure");
          setTopUpStatusMessage(data?.order_status === "CANCELLED" ? "Payment cancelled" : "Payment failed");
          setTopUpStatusVisible(true);
        } else {
          setTopUpLoading(false);
        }
      } catch (error) {
        console.error("[REVIEW BOOKING] Error verifying top-up payment:", error);
        setTopUpLoading(false);
        setTopUpStatusType("failure");
        setTopUpStatusMessage("We could not verify the payment yet. Please try again.");
        setTopUpStatusVisible(true);
      } finally {
        setPendingTopUpOrderId(null);
      }
    },
    [handleTopUpSuccess]
  );

  const startTopUpPayment = useCallback(async () => {
    try {
      const value = parseFloat(topUpAmount);
      if (!value || value <= 0) {
        Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
        return;
      }

      if (isTopUpLoading) {
        return;
      }

      const userId = user?.id;
      if (!userId) {
        Alert.alert("Error", "No user ID found. Please log in again.");
        return;
      }

      setTopUpLoading(true);

      const timestamp = Math.floor(Date.now() / 60000);
      const idempotencyKey = `wallet-${userId}-${value}-${timestamp}`;

      const { data: existingOrder, error: existingOrderError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("amount", value)
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 60000).toISOString())
        .maybeSingle();

      if (existingOrderError) {
        Alert.alert("Database Error", `Failed to check existing transactions: ${existingOrderError.message}`);
        setTopUpLoading(false);
        return;
      }

      if (existingOrder) {
        setTopUpLoading(false);
        Alert.alert(
          "Payment in Progress",
          "You already have a pending payment for this amount. Please complete or wait for the previous transaction to finish."
        );
        return;
      }

      const callbackUrl = __DEV__
        ? "https://docs.cashfree.com/docs/payment-success"
        : "carter://payment-callback";

      const { data, error } = await supabase.functions.invoke("create-payment-order", {
        body: {
          amount: value,
          customer_id: userId,
          customer_phone: profile?.phone || user?.phone || "9999999999",
          customer_name: profile?.name || "Cartr User",
          customer_email: profile?.email || user?.email || "user@cartr.app",
          return_url: callbackUrl,
          idempotency_key: idempotencyKey,
        },
      });

      if (error || !data?.payment_session_id || !data?.order_id) {
        Alert.alert("Payment Error", error?.message || "Payment service returned an invalid response.");
        setTopUpLoading(false);
        return;
      }

      setPendingTopUpOrderId(data.order_id);
      setTopUpPaymentSessionId(data.payment_session_id);
      setTopUpEnvironment((data.environment || "sandbox") as "sandbox" | "production");
      setTopUpModalVisible(false);
      setShowTopUpCheckoutModal(true);
    } catch (error: any) {
      console.error("[REVIEW BOOKING] Top-up error:", error);
      Alert.alert("Error", error?.message || "Failed to start payment");
      setTopUpLoading(false);
      setPendingTopUpOrderId(null);
    }
  }, [isTopUpLoading, profile?.email, profile?.name, profile?.phone, topUpAmount, user?.email, user?.id, user?.phone]);

  const handleConfirmBooking = async () => {
    const trimmedDescription = goodsDescription.trim();
    let hasError = false;

    setGoodsTypeError(null);

    if (!paymentMethod) {
      setPaymentMethodError("Please select a payment method.");
      setIsPaymentExpanded(true);
      hasError = true;
    } else if (paymentMethod === "wallet" && !canUseWallet) {
      setPaymentMethodError("Insufficient wallet balance.");
      setIsPaymentExpanded(true);
      hasError = true;
    } else {
      setPaymentMethodError(null);
    }

    if (hasError || !resolvedVehicle || !receiverDetails) {
      return;
    }

    if (
      userLatitude === null ||
      userLongitude === null ||
      destinationLatitude === null ||
      destinationLongitude === null
    ) {
      Alert.alert("Missing location", "Please confirm your pickup and drop locations again.");
      return;
    }

    const userId = profile?.id || user?.id;
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in again to continue.");
      return;
    }

    if (!paymentMethod) {
      return;
    }

    const selectedPaymentMethod: ReviewBookingPaymentMethod = paymentMethod;

    const finalGoodsType =
      goodsType === "Others" ? otherGoodsType.trim() || "Others" : goodsType || null;

    setGoodsDescription(trimmedDescription);
    setGoodsType(finalGoodsType);
    setPaymentMethod(selectedPaymentMethod);
    setSelectedAddonIds(resolvedAddonIds);
    setIsCreatingBooking(true);

    try {
      const result = await createBookingWithPayment({
        customerId: userId,
        originAddress: userAddress || "",
        originLatitude: userLatitude,
        originLongitude: userLongitude,
        destinationAddress: destinationAddress || "",
        destinationLatitude,
        destinationLongitude,
        vehicle: resolvedVehicle,
        receiverDetails,
        goodsDescription: trimmedDescription,
        paymentMethod: selectedPaymentMethod,
        addonIds: resolvedAddonIds,
        availableAddons,
      });

      if (result.error || !result.data) {
        Alert.alert("Booking failed", result.error || "We couldn't create your booking. Please try again.");
        return;
      }

      if (typeof result.newWalletBalance === "number") {
        setWalletBalanceLocal(result.newWalletBalance);
      }

      setCurrentBooking(result.data);

      if (result.paymentWarning) {
        Alert.alert("Booking created", result.paymentWarning);
      }

      router.replace({
        pathname: "/waiting-for-driver",
        params: { bookingId: result.data.id },
      });
    } catch (error: any) {
      console.error("[REVIEW BOOKING] Booking error:", error);
      Alert.alert("Booking failed", error?.message || "Something went wrong while creating your booking.");
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const renderPaymentOptions = () => {
    if (isLoadingWallet) {
      return (
        <View className="gap-3">
          <View className="h-24 rounded-2xl bg-gray-100" />
          <View className="h-24 rounded-2xl bg-gray-100" />
        </View>
      );
    }

    return (
      <View className="gap-3">
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityState={{ selected: paymentMethod === "cash" }}
          onPress={() => {
            setPaymentMethodLocal("cash");
            setPaymentMethodError(null);
            setIsPaymentExpanded(false);
          }}
          className={`rounded-2xl border p-4 ${
            paymentMethod === "cash" ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
          }`}
        >
          <View className="flex-row items-start">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Feather name="dollar-sign" size={18} color="#166534" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-JakartaBold text-gray-900">Cash</Text>
              <Text className="mt-1 text-sm text-gray-500">Pay driver directly</Text>
            </View>
            <Feather
              name={paymentMethod === "cash" ? "check-circle" : "circle"}
              size={20}
              color={paymentMethod === "cash" ? "#16a34a" : "#94a3b8"}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityState={{ selected: paymentMethod === "wallet" }}
          onPress={() => {
            if (!canUseWallet) {
              return;
            }

            setPaymentMethodLocal("wallet");
            setPaymentMethodError(null);
            setIsPaymentExpanded(false);
          }}
          className={`rounded-2xl border p-4 ${
            paymentMethod === "wallet" && canUseWallet
              ? "border-brand-500 bg-brand-50"
              : "border-gray-200 bg-white"
          }`}
        >
          <View className="flex-row items-start">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Feather name="credit-card" size={18} color="#b45309" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-JakartaBold text-gray-900">Pay with Wallet</Text>
              <Text className="mt-1 text-sm text-gray-500">
                Current balance {formatCurrency(walletBalance)}
              </Text>
              {!canUseWallet ? (
                <Text className="mt-2 text-sm font-JakartaMedium text-red-500">
                  {walletHasSomeBalance
                    ? `Insufficient balance. Add ${formatCurrency(walletShortfall)} to continue.`
                    : "Wallet empty. Add money to use wallet payment."}
                </Text>
              ) : null}
            </View>
            <Feather
              name={paymentMethod === "wallet" && canUseWallet ? "check-circle" : "circle"}
              size={20}
              color={paymentMethod === "wallet" && canUseWallet ? "#16a34a" : "#94a3b8"}
            />
          </View>

          <TouchableOpacity
            onPress={handleOpenTopUp}
            className="mt-3 self-start rounded-full bg-gray-900 px-4 py-2"
          >
            <Text className="font-JakartaSemiBold text-white">+ Add Money</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {walletError ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm font-JakartaMedium text-red-600">{walletError}</Text>
            <TouchableOpacity onPress={loadWalletBalance} className="mt-3 self-start rounded-full bg-white px-4 py-2">
              <Text className="font-JakartaSemiBold text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!canUseWallet && walletHasSomeBalance ? (
          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-JakartaMedium text-amber-700">
              Wallet + cash is not enabled in this build yet, so please top up or choose cash.
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (!resolvedVehicle || !receiverDetails) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View className="border-b border-gray-200 bg-white px-5 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.replace("/select-vehicle")}
              className="h-11 w-11 items-center justify-center rounded-full bg-gray-100"
            >
              <Feather name="arrow-left" size={20} color="#111827" />
            </TouchableOpacity>
            <Text className="ml-4 text-xl font-JakartaBold text-gray-900">Review Booking</Text>
          </View>
        </View>

        <View className="flex-1">
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <Text className="mb-4 text-base font-JakartaBold text-gray-900">Route summary</Text>
            <View className="flex-row">
              <View className="mr-3 items-center">
                <View className="h-3 w-3 rounded-full bg-green-500" />
                <View
                  style={{ height: 42, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1", marginVertical: 6 }}
                />
                <View className="h-3 w-3 rounded-sm bg-red-500" />
              </View>
              <View className="flex-1">
                <View>
                  <Text className="text-xs font-JakartaSemiBold uppercase tracking-wide text-gray-400">Pickup</Text>
                  <Text className="mt-1 text-sm font-JakartaMedium leading-5 text-gray-800">{userAddress}</Text>
                </View>
                <View className="mt-4">
                  <Text className="text-xs font-JakartaSemiBold uppercase tracking-wide text-gray-400">Drop</Text>
                  <Text className="mt-1 text-sm font-JakartaMedium leading-5 text-gray-800">{destinationAddress}</Text>
                </View>
              </View>
            </View>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-gray-50 p-3">
                <Text className="text-xs font-JakartaSemiBold uppercase tracking-wide text-gray-400">Distance</Text>
                <Text className="mt-1 text-sm font-JakartaBold text-gray-900">{distanceKm.toFixed(1)} km</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-gray-50 p-3">
                <Text className="text-xs font-JakartaSemiBold uppercase tracking-wide text-gray-400">ETA</Text>
                <Text className="mt-1 text-sm font-JakartaBold text-gray-900">{Math.round(durationMinutes)} min</Text>
              </View>
            </View>
          </View>

          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-JakartaBold text-gray-900">Receiver details</Text>
              <TouchableOpacity onPress={() => router.push("/receiver-details")}>
                <Text className="font-JakartaSemiBold text-green-700">Edit</Text>
              </TouchableOpacity>
            </View>
            <View className="mt-4 gap-2">
              <View className="flex-row items-center">
                <Feather name="user" size={16} color="#64748b" />
                <Text className="ml-3 text-sm font-JakartaMedium text-gray-800">{receiverDetails.name}</Text>
              </View>
              <View className="flex-row items-center">
                <Feather name="phone" size={16} color="#64748b" />
                <Text className="ml-3 text-sm font-JakartaMedium text-gray-800">{receiverDetails.phone}</Text>
              </View>
            </View>
          </View>

          <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-JakartaBold text-gray-900">Vehicle</Text>
              <TouchableOpacity onPress={() => router.replace("/select-vehicle")}>
                <Text className="font-JakartaSemiBold text-green-700">Change Vehicle</Text>
              </TouchableOpacity>
            </View>
            <View className="mt-4 flex-row items-center">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
                {vehicleImage ? (
                  <Image source={vehicleImage} className="h-12 w-12" resizeMode="contain" />
                ) : (
                  <Feather name="truck" size={28} color="#111827" />
                )}
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-base font-JakartaBold text-gray-900">{vehicleName}</Text>
                <Text className="mt-1 text-sm text-gray-500">{formatCurrency(baseFare)} base fare</Text>
              </View>
              <Text className="text-base font-JakartaBold text-gray-900">{formatCurrency(totalFare)}</Text>
            </View>
          </View>

            <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
              <Text className="text-base font-JakartaBold text-gray-900">
                Goods Description <Text className="text-gray-400">(Optional)</Text>
              </Text>
              <Text className="mt-2 text-sm text-gray-500">
                Let the driver know what you&apos;re sending.
              </Text>

              <View className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <TextInput
                  multiline
                  numberOfLines={4}
                  maxLength={MAX_GOODS_DESCRIPTION}
                  placeholder="e.g., Furniture, Electronics, Documents, Clothes"
                  placeholderTextColor="#94a3b8"
                  value={goodsDescription}
                  editable={!isCreatingBooking}
                  onChangeText={(text) => {
                    setGoodsDescriptionLocal(text.slice(0, MAX_GOODS_DESCRIPTION));
                  }}
                  textAlignVertical="top"
                  className="min-h-[96px] text-sm font-JakartaMedium text-gray-900"
                  accessibilityLabel="Goods Description"
                />
              </View>

              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-sm text-gray-400">Optional notes for the driver</Text>
                <Text className="text-sm text-gray-400">
                  {goodsDescription.length}/{MAX_GOODS_DESCRIPTION}
                </Text>
              </View>

              <Text className="mt-4 text-sm font-JakartaSemiBold text-gray-700">
                Goods type
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {GOODS_TYPES.map((option) => {
                  const selected = goodsType === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        const nextValue = selected ? "" : option;
                        setGoodsTypeLocal(nextValue);
                        setGoodsTypeError(null);
                        if (nextValue !== "Others") {
                          setOtherGoodsType("");
                        }
                      }}
                      className={`rounded-full border px-4 py-2 ${
                        selected ? "border-green-600 bg-green-50" : "border-gray-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-JakartaMedium ${
                          selected ? "text-green-700" : "text-gray-600"
                        }`}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {goodsType === "Others" ? (
                <View className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <TextInput
                    value={otherGoodsType}
                    onChangeText={setOtherGoodsType}
                    editable={!isCreatingBooking}
                    placeholder="Enter goods type"
                    placeholderTextColor="#94a3b8"
                    className="text-sm font-JakartaMedium text-gray-900"
                    accessibilityLabel="Other Goods Type"
                  />
                </View>
              ) : null}

              {goodsTypeError ? (
                <Text className="mt-3 text-sm font-JakartaMedium text-red-500">{goodsTypeError}</Text>
              ) : null}
            </View>

            <View className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <Text className="mb-4 text-base font-JakartaBold text-gray-900">Fare breakdown</Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-500">Base fare</Text>
                <Text className="text-sm font-JakartaMedium text-gray-900">{formatCurrency(baseFare)}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-500">Distance charges</Text>
                <Text className="text-sm font-JakartaMedium text-gray-900">{formatCurrency(distanceFare)}</Text>
              </View>
              {timeFare > 0 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-gray-500">Time charges</Text>
                  <Text className="text-sm font-JakartaMedium text-gray-900">{formatCurrency(timeFare)}</Text>
                </View>
              ) : null}
              {resolvedAddonIds.map((addonId) => {
                const addon = availableAddons.find((item) => item.id === addonId);
                if (!addon) {
                  return null;
                }

                return (
                  <View key={addonId} className="flex-row items-center justify-between">
                    <Text className="text-sm text-gray-500">{addon.name}</Text>
                    <Text className="text-sm font-JakartaMedium text-gray-900">{formatCurrency(addon.price)}</Text>
                  </View>
                );
              })}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-500">GST & fees</Text>
                <Text className="text-sm font-JakartaMedium text-gray-900">{formatCurrency(taxesAndFees)}</Text>
              </View>
            </View>
            <View className="my-4 h-px bg-gray-200" />
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-JakartaBold text-gray-900">Total Amount</Text>
              <Text className="text-xl font-JakartaBold text-green-700">{formatCurrency(totalFare)}</Text>
            </View>
          </View>

          </ScrollView>

          <View className="border-t border-gray-200 bg-white px-5 pb-6 pt-4">
            <View
              className={`mb-3 rounded-2xl border px-4 py-3 ${
                isPaymentExpanded || paymentMethodError
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setIsPaymentExpanded((previous) => !previous)}
                  className="flex-1 flex-row items-center"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <Feather
                      name={paymentMethod === "wallet" ? "credit-card" : "dollar-sign"}
                      size={18}
                      color="#111827"
                    />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-JakartaSemiBold uppercase tracking-wide text-gray-400">
                      Payment method
                    </Text>
                    <Text className="mt-1 text-sm font-JakartaBold text-gray-900">{paymentSummaryText}</Text>
                  </View>
                  <Feather
                    name={isPaymentExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {paymentMethod === "wallet" ? (
                  <TouchableOpacity
                    onPress={handleOpenTopUp}
                    className="ml-3 rounded-full bg-gray-900 px-3 py-2"
                  >
                    <Text className="text-xs font-JakartaSemiBold text-white">+ Add Money</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {isPaymentExpanded ? (
              <View className="mb-3 rounded-2xl bg-white">
                {renderPaymentOptions()}
                {paymentMethodError ? (
                  <Text className="mt-3 text-sm font-JakartaMedium text-red-500">{paymentMethodError}</Text>
                ) : null}
              </View>
            ) : paymentMethodError ? (
              <Text className="mb-3 text-sm font-JakartaMedium text-red-500">{paymentMethodError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleConfirmBooking}
              disabled={isConfirmDisabled}
              className={`rounded-2xl py-4 ${
                isConfirmDisabled ? "bg-gray-300" : "bg-green-600"
              }`}
            >
              <View className="flex-row items-center justify-center">
                {isCreatingBooking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check-circle" size={18} color="#fff" />
                    <Text className="ml-2 text-base font-JakartaBold text-white">Confirm & Book Ride</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={isTopUpModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => !isTopUpLoading && setTopUpModalVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 justify-end bg-black/50"
            activeOpacity={1}
            onPress={() => !isTopUpLoading && setTopUpModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} className="rounded-t-[32px] bg-white p-6">
              <View className="mb-6 flex-row items-center justify-between">
                <View className="w-10" />
                <View className="h-1 w-12 rounded-full bg-gray-300" />
                <TouchableOpacity
                  onPress={() => !isTopUpLoading && setTopUpModalVisible(false)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-gray-50"
                >
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {isTopUpLoading ? (
                <View className="items-center py-10">
                  <ActivityIndicator size="large" color="#F5B800" />
                  <Text className="mt-4 font-JakartaMedium text-gray-600">Opening payment gateway...</Text>
                </View>
              ) : (
                <>
                  <Text className="mb-2 text-center text-xl font-JakartaBold">Add Money to Wallet</Text>
                  <Text className="mb-8 text-center text-sm text-gray-500">
                    Top up your wallet without leaving this booking review.
                  </Text>

                  <View className="mb-8 items-center">
                    <View className="flex-row items-center">
                      <Text className="text-4xl font-JakartaExtraBold">₹ </Text>
                      <TextInput
                        value={topUpAmount}
                        onChangeText={setTopUpAmount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#E2E8F0"
                        className="min-w-[100px] text-4xl font-JakartaExtraBold text-black"
                        style={{ height: 60 }}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={startTopUpPayment}
                    disabled={isTopUpLoading || !topUpAmount || parseFloat(topUpAmount) <= 0}
                    className={`mb-4 items-center justify-center rounded-2xl py-4 ${
                      topUpAmount && parseFloat(topUpAmount) > 0 ? "bg-yellow-500" : "bg-gray-300"
                    }`}
                  >
                    <Text className="text-lg font-JakartaBold text-black">Add Money</Text>
                  </TouchableOpacity>

                  <View className="mb-4 flex-row items-center justify-center">
                    <Feather name="lock" size={12} color="#A0A0A0" />
                    <Text className="ml-1 text-xs text-gray-400">Secured by Cashfree Payments</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={topUpStatusVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTopUpStatusVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 justify-end bg-black/50"
            activeOpacity={1}
            onPress={() => setTopUpStatusVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} className="min-h-[320px] items-center rounded-t-[32px] bg-white p-8">
              <TouchableOpacity
                onPress={() => setTopUpStatusVisible(false)}
                className="absolute right-5 top-5 h-9 w-9 items-center justify-center rounded-full bg-gray-100"
              >
                <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>

              <View className="mb-6 h-1 w-12 rounded-full bg-gray-300" />

              <View
                className={`mb-5 h-20 w-20 items-center justify-center rounded-full ${
                  topUpStatusType === "success" ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <Feather
                  name={topUpStatusType === "success" ? "check" : "x"}
                  size={40}
                  color={topUpStatusType === "success" ? "#10B981" : "#EF4444"}
                />
              </View>

              <Text className="mb-2 text-center text-2xl font-JakartaBold text-gray-900">
                {topUpStatusType === "success" ? "Payment Successful" : "Payment Failed"}
              </Text>

              <Text className="mb-4 px-4 text-center font-JakartaMedium text-gray-500">
                {topUpStatusMessage}
              </Text>

              <TouchableOpacity
                onPress={() => setTopUpStatusVisible(false)}
                className={`mb-4 w-full items-center justify-center rounded-2xl py-4 ${
                  topUpStatusType === "success" ? "bg-yellow-500" : "bg-red-500"
                }`}
              >
                <Text
                  className={`text-lg font-JakartaBold ${
                    topUpStatusType === "success" ? "text-black" : "text-white"
                  }`}
                >
                  {topUpStatusType === "success" ? "Done" : "Try Again"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {showTopUpCheckoutModal ? (
          <CashfreeCheckoutModal
            visible={showTopUpCheckoutModal}
            paymentSessionId={topUpPaymentSessionId}
            orderId={pendingTopUpOrderId || ""}
            environment={topUpEnvironment}
            onSuccess={async (orderId) => {
              setShowTopUpCheckoutModal(false);
              setTopUpLoading(true);
              await verifyTopUpPaymentStatus(orderId);
            }}
            onFailure={async (_error, orderId) => {
              setShowTopUpCheckoutModal(false);
              setTopUpLoading(true);
              await verifyTopUpPaymentStatus(orderId, true);
            }}
            onClose={() => {
              setShowTopUpCheckoutModal(false);
              if (pendingTopUpOrderId) {
                verifyTopUpPaymentStatus(pendingTopUpOrderId);
              }
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ReviewBookingPage;
