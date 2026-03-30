export interface PublishedLocationState {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface NextLocationCandidate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: number;
}

const MAX_ACCEPTABLE_ACCURACY_METERS = 15;
const MIN_MOVEMENT_METERS = 10;
const STATIONARY_SPEED_THRESHOLD = 2.5;
const HEARTBEAT_INTERVAL_MS = 15000;

export function isLocationAccurateEnough(accuracy?: number): boolean {
  return accuracy == null || accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS;
}

export function shouldPublishLocation(
  previous: PublishedLocationState | null,
  next: NextLocationCandidate
): boolean {
  if (!isLocationAccurateEnough(next.accuracy)) {
    return false;
  }

  if (!previous) {
    return true;
  }

  const nextTimestamp = next.timestamp ?? Date.now();
  const distanceMeters = haversineDistanceMeters(
    previous.latitude,
    previous.longitude,
    next.latitude,
    next.longitude
  );

  const effectiveAccuracy = Math.max(
    next.accuracy ?? 0,
    previous.accuracy ?? 0,
    MIN_MOVEMENT_METERS
  );

  const isMoving = (next.speed ?? 0) >= STATIONARY_SPEED_THRESHOLD;
  const hasStrongDirectionalSignal = next.heading != null && next.accuracy != null && next.accuracy <= 10;
  const isMeaningfulMove = distanceMeters >= effectiveAccuracy;
  const isHeartbeatDue = nextTimestamp - previous.timestamp >= HEARTBEAT_INTERVAL_MS;

  if (!isMoving && !isMeaningfulMove) {
    return isHeartbeatDue && hasStrongDirectionalSignal;
  }

  return true;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
