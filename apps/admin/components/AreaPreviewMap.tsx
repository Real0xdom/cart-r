'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface AreaPreviewMapProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export default function AreaPreviewMap({ centerLat, centerLng, radiusKm }: AreaPreviewMapProps) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !centerLat || !centerLng) {
    return <div className="w-full h-full bg-gray-100 animate-pulse" />;
  }

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={11}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={false}
      zoomControl={false}
      dragging={false}
      doubleClickZoom={false}
      attributionControl={false}
      className="z-0"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Circle
        center={[centerLat, centerLng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.2, weight: 2 }}
      />
      <Circle
        center={[centerLat, centerLng]}
        radius={80}
        pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 1, weight: 0 }}
      />
    </MapContainer>
  );
}
