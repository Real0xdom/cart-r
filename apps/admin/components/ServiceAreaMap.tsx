'use client';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix for default marker icon in Next.js
// We use a simple circle marker or rely on CSS, but this fix ensures standard markers work if needed
// However, since we might not have the icon files in public, let's use a workaround or just Circle
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

// Only run on client
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
}

interface ServiceAreaMapProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  onCenterChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
  className?: string;
}

function ClickHandler({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ServiceAreaMap({ 
  centerLat, 
  centerLng, 
  radiusKm, 
  onCenterChange, 
  interactive = true,
  className = "w-full h-full"
}: ServiceAreaMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return <div className={`${className} bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-gray-400`}>Loading Map...</div>;

  const validCenter = centerLat && centerLng ? [centerLat, centerLng] as [number, number] : [20.5937, 78.9629] as [number, number]; // Default to India center
  const zoom = centerLat && centerLng ? 11 : 4;

  return (
    <MapContainer 
      center={validCenter} 
      zoom={zoom} 
      className={`rounded-xl z-0 ${className}`}
      scrollWheelZoom={interactive}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Show the service area circle */}
      {centerLat && centerLng && (
        <Circle 
          center={[centerLat, centerLng]}
          radius={(radiusKm || 0) * 1000} // Convert km to meters
          pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.2, weight: 2 }}
        />
      )}

      {/* Show a small marker for the center */}
       {centerLat && centerLng && (
        <Circle 
          center={[centerLat, centerLng]}
          radius={50} // 50 meters center point
          pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
        />
      )}

      {interactive && onCenterChange && <ClickHandler onCenterChange={onCenterChange} />}
    </MapContainer>
  );
}
