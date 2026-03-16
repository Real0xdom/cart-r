const OlaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '';

export interface StaticMapOptions {
  style?: string;
  lat: number;
  lon: number;
  zoom: number;
  width: number;
  height: number;
  format?: 'png' | 'jpg';
  markers?: Array<{
    lnglat: string;
    color: string;
    scale?: number;
    offset?: string;
  }>;
  path?: {
    linePath: string;
    width?: number;
    stroke?: string;
  };
}

export async function generateStaticMap(options: StaticMapOptions): Promise<string> {
  const {
    style = 'default-light-standard',
    lat,
    lon,
    zoom,
    width,
    height,
    format = 'png',
    markers = [],
    path,
  } = options;

  const baseUrl = `https://api.olamaps.io/tiles/v1/styles/${style}/static/${lon},${lat},${zoom}/${width}x${height}.${format}`;

  const params = new URLSearchParams();

  if (markers.length > 0) {
    markers.forEach((marker, index) => {
      let markerStr = `${marker.lnglat}|${marker.color}`;
      if (marker.scale) markerStr += `|scale:${marker.scale}`;
      if (marker.offset) markerStr += `|${marker.offset}`;
      params.append(`marker`, markerStr);
    });
  }

  if (path) {
    let pathStr = path.linePath;
    if (path.width) pathStr += `|width:${path.width}`;
    if (path.stroke) pathStr += `|stroke:${path.stroke}`;
    params.append('path', pathStr);
  }

  params.append('api_key', OlaMapsApiKey);

  const url = `${baseUrl}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Static map API error: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function getStaticMapUrl(options: StaticMapOptions): string {
  const {
    style = 'default-light-standard',
    lat,
    lon,
    zoom,
    width,
    height,
    format = 'png',
    markers = [],
    path,
  } = options;

  const baseUrl = `https://api.olamaps.io/tiles/v1/styles/${style}/static/${lon},${lat},${zoom}/${width}x${height}.${format}`;

  const params = new URLSearchParams({ api_key: OlaMapsApiKey });

  if (markers.length > 0) {
    markers.forEach((marker) => {
      let markerStr = `${marker.lnglat}|${marker.color}`;
      if (marker.scale) markerStr += `|scale:${marker.scale}`;
      if (marker.offset) markerStr += `|${marker.offset}`;
      params.append(`marker`, markerStr);
    });
  }

  if (path) {
    let pathStr = path.linePath;
    if (path.width) pathStr += `|width:${path.width}`;
    if (path.stroke) pathStr += `|stroke:${path.stroke}`;
    params.append('path', pathStr);
  }

  return `${baseUrl}?${params.toString()}`;
}

// Convenience functions for common use cases
export async function generateRideStaticMap(ride: {
  pickup_lat: number;
  pickup_lon: number;
  drop_lat: number;
  drop_lon: number;
  driver_lat?: number;
  driver_lon?: number;
}): Promise<string> {
  const centerLat = (ride.pickup_lat + ride.drop_lat) / 2;
  const centerLon = (ride.pickup_lon + ride.drop_lon) / 2;
  const zoom = 14;

  const markers = [
    { lnglat: `${ride.pickup_lon},${ride.pickup_lat}`, color: 'green' },
    { lnglat: `${ride.drop_lon},${ride.drop_lat}`, color: 'red' },
  ];

  if (ride.driver_lat && ride.driver_lon) {
    markers.push({ lnglat: `${ride.driver_lon},${ride.driver_lat}`, color: 'blue', scale: 1.2 });
  }

  // Simple path from pickup to drop
  const path = {
    linePath: `${ride.pickup_lon},${ride.pickup_lat}|${ride.drop_lon},${ride.drop_lat}`,
    width: 6,
    stroke: '#0286FF',
  };

  return generateStaticMap({
    lat: centerLat,
    lon: centerLon,
    zoom,
    width: 400,
    height: 300,
    markers,
    path,
  });
}
</xai:function_call >

<xai:function_call name="create_file">
<parameter name="absolute_path">TODO.md
