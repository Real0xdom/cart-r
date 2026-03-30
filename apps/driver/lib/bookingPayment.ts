import type { Booking } from "./bookings";

const WALLET_PAYMENT_METHODS = [
  "wallet",
  "partial_wallet",
  "wallet_plus_online",
  "wallet_plus_cash",
] as const;

export function usesWalletFunds(booking: Pick<Booking, "payment_method"> | null | undefined): boolean {
  return WALLET_PAYMENT_METHODS.includes((booking?.payment_method || "") as (typeof WALLET_PAYMENT_METHODS)[number]);
}

export function getWalletAdjustmentDue(booking: Partial<Booking> | null | undefined): number {
  if (!booking || !usesWalletFunds(booking as Pick<Booking, "payment_method">)) {
    return 0;
  }

  if (booking.payment_method === "wallet_plus_cash") {
    return 0;
  }

  const total = Number(booking.total_fare || 0);
  const quoted = Number(booking.quoted_total_fare ?? booking.total_fare ?? 0);
  return Math.max(total - quoted, 0);
}

export function getOutstandingCustomerAmount(booking: Partial<Booking> | null | undefined): number {
  if (!booking) {
    return 0;
  }

  const walletAdjustmentDue = getWalletAdjustmentDue(booking);
  if (walletAdjustmentDue > 0) {
    return walletAdjustmentDue;
  }

  if (booking.payment_status === "paid") {
    return 0;
  }

  if (booking.payment_status === "partial_paid") {
    return Math.max(
      Number(booking.total_fare || 0) - Number(booking.wallet_amount_used || 0),
      0
    );
  }

  return Number(booking.total_fare || 0);
}
