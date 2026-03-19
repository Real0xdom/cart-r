import { addAddonToBooking, AddonService } from "@/lib/addonUtils";
import { createBooking } from "@/lib/bookings";
import { payWithWallet } from "@/lib/walletPayment";
import type {
  Booking,
  ReceiverDetails,
  ReviewBookingPaymentMethod,
  SelectedVehicle,
} from "@/types/type";

interface CreateBookingWithPaymentParams {
  customerId: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  vehicle: SelectedVehicle;
  receiverDetails: ReceiverDetails;
  goodsDescription: string;
  paymentMethod: ReviewBookingPaymentMethod;
  addonIds?: string[];
  availableAddons?: AddonService[];
}

interface CreateBookingWithPaymentResult {
  data: Booking | null;
  error: string | null;
  paymentWarning?: string | null;
  newWalletBalance?: number;
}

export async function createBookingWithPayment(
  params: CreateBookingWithPaymentParams
): Promise<CreateBookingWithPaymentResult> {
  const {
    customerId,
    originAddress,
    originLatitude,
    originLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
    vehicle,
    receiverDetails,
    goodsDescription,
    paymentMethod,
    addonIds = [],
    availableAddons = [],
  } = params;

  const { data, error } = await createBooking({
    customerId,
    originAddress,
    originLatitude,
    originLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
    vehicle,
    receiverDetails,
    goodsDescription,
    tipAmount: 0,
  });

  if (error || !data) {
    return {
      data: null,
      error: error || "Failed to create booking",
    };
  }

  for (const addonId of addonIds) {
    const addon = availableAddons.find((item) => item.id === addonId);
    if (!addon?.code) {
      continue;
    }

    const addonResult = await addAddonToBooking(data.id, addon.code);
    if (addonResult.error) {
      return {
        data,
        error: null,
        paymentWarning:
          addonResult.error ||
          "Some add-ons could not be attached, but your booking was created successfully.",
      };
    }
  }

  if (paymentMethod === "cash") {
    return { data, error: null };
  }

  const walletResult = await payWithWallet(
    data.id,
    customerId,
    paymentMethod === "wallet"
  );

  if (!walletResult.success) {
    return {
      data,
      error: null,
      paymentWarning:
        walletResult.error ||
        "Wallet payment could not be completed. Your booking was created and will be collected in cash.",
    };
  }

  return {
    data,
    error: null,
    newWalletBalance: walletResult.new_wallet_balance,
    paymentWarning: walletResult.fully_paid
      ? null
      : "Wallet amount was reserved, and the balance will need to be settled later.",
  };
}
