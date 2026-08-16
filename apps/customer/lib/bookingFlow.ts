import { AddonService } from "@/lib/addonUtils";
import { createBookingWithAddons } from "@/lib/bookings";
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

  const addonPayload = addonIds
    .map((addonId) => availableAddons.find((item) => item.id === addonId))
    .filter((addon): addon is AddonService => !!addon?.code)
    .map((addon) => ({
      code: addon.code,
      quantity: 1,
    }));

  const { data, error } = await createBookingWithAddons({
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
  }, addonPayload);

  if (error || !data) {
    return {
      data: null,
      error: error || "Failed to create booking",
    };
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
      ? "Your wallet amount has been placed on hold in escrow for this trip."
      : "Your wallet amount has been placed on hold in escrow, and the remaining balance will need to be settled later.",
  };
}
