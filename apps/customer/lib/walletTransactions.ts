export interface WalletTransactionLike {
  payment_order_id?: string | null;
  description?: string | null;
}

function normalizeOrderId(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function normalizeDescription(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function isDriverWalletTrackingTransaction(transaction: WalletTransactionLike) {
  const orderId = normalizeOrderId(transaction.payment_order_id);
  const description = normalizeDescription(transaction.description);

  return orderId.startsWith("DRIVERWALLET_") || description.includes("driver wallet top-up");
}

export function isCustomerWalletTopupTransaction(transaction: WalletTransactionLike) {
  const orderId = normalizeOrderId(transaction.payment_order_id);
  const description = normalizeDescription(transaction.description);

  if (orderId.startsWith("DRIVERWALLET_")) {
    return false;
  }

  return orderId.startsWith("WALLET_") || description.includes("wallet top-up");
}

export function filterCustomerWalletHistory<T extends WalletTransactionLike>(transactions: T[]) {
  return transactions.filter((transaction) => !isDriverWalletTrackingTransaction(transaction));
}
