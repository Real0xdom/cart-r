'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface MapPickerProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
}

// Component to handle map clicks
function ClickHandler({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to fly to a new center when it changes
function MapFlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 1 });
    }
  }, [lat, lng]);
  return null;
}

export default function MapPicker({ centerLat, centerLng, radiusKm, onCenterChange }: MapPickerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  if (!isClient) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-gray-400 text-sm">
        Loading map...
      </div>
    );
  }

  // Default to center of India if no location set
  const defaultCenter: [number, number] = [20.5937, 78.9629];
  const center: [number, number] = (centerLat && centerLng) ? [centerLat, centerLng] : defaultCenter;
  const zoom = (centerLat && centerLng) ? 11 : 4;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Service area circle */}
      {centerLat && centerLng && (
        <>
          {/* Outer fill */}
          <Circle
            center={[centerLat, centerLng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#f97316',
              fillColor: '#f97316',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '6 4',
            }}
          />
          {/* Center dot */}
          <Circle
            center={[centerLat, centerLng]}
            radius={80}
            pathOptions={{
              color: '#f97316',
              fillColor: '#f97316',
              fillOpacity: 1,
              weight: 0,
            }}
          />
        </>
      )}

      <ClickHandler onCenterChange={onCenterChange} />
      {centerLat && centerLng && <MapFlyTo lat={centerLat} lng={centerLng} />}
    </MapContainer>
  );
}
