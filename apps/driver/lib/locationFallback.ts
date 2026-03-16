export const isLocationUnavailableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('current location is unavailable') ||
    normalizedMessage.includes('location services') ||
    normalizedMessage.includes('gps')
  );
};

export async function getLocationWithFallback<T>(
  getCurrent: () => Promise<T>,
  getLastKnown: () => Promise<T | null>
): Promise<T | null> {
  try {
    return await getCurrent();
  } catch {
    return await getLastKnown();
  }
}
