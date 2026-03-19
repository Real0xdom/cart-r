export type LatLng = { latitude: number; longitude: number };

type OsrmRouteResponse = {
  routes?: Array<{
    distance: number; // meters
    duration: number; // seconds
    geometry?: {
      coordinates?: Array<[number, number]>; // [lon, lat]
    };
  }>;
};

const OSRM_BASE_URL = "https://router.project-osrm.org";

function toOsrmPair({ latitude, longitude }: LatLng) {
  return `${longitude},${latitude}`;
}

function toLatLngs(coords: Array<[number, number]>): LatLng[] {
  return coords.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
}

export async function fetchOsrmRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<{ coordinates: LatLng[]; distanceKm: number; durationMin: number } | null> {
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${toOsrmPair(origin)};${toOsrmPair(destination)}` +
    `?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = (await res.json()) as OsrmRouteResponse;
  const route = json.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!route || !coords || coords.length === 0) return null;

  return {
    coordinates: toLatLngs(coords),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}

export async function fetchOsrmMetrics(
  origin: LatLng,
  destination: LatLng,
): Promise<{ distanceKm: number; durationMin: number } | null> {
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${toOsrmPair(origin)};${toOsrmPair(destination)}` +
    `?overview=false&steps=false`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = (await res.json()) as OsrmRouteResponse;
  const route = json.routes?.[0];
  if (!route) return null;

  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}
