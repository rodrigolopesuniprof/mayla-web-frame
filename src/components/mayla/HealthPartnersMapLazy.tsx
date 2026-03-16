import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { Partner } from "@/lib/partner-helpers";
import { createPartnerIcon, userLocationIcon } from "@/lib/partner-helpers";

interface Props {
  center: [number, number];
  userPos: [number, number];
  partners: Partner[];
  selectedId: string | null;
  onPinClick: (id: string) => void;
}

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom]);
  return null;
}

export default function HealthPartnersMapContent({ center, userPos, partners, selectedId, onPinClick }: Props) {
  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <RecenterMap center={center} zoom={13} />
      <Marker position={userPos} icon={userLocationIcon}>
        <Popup>Você está aqui</Popup>
      </Marker>
      {partners.map((p) => (
        <Marker
          key={p.id}
          position={[p.display_lat!, p.display_lng!]}
          icon={createPartnerIcon(p.partner_type, selectedId === p.id)}
          eventHandlers={{ click: () => onPinClick(p.id) }}
        >
          <Popup>
            <div className="text-xs">
              <strong>{p.name}</strong><br />
              {p.specialty || p.partner_type}
              {p.distance != null && <><br />📏 {p.distance < 1 ? `${Math.round(p.distance * 1000)} m` : `${p.distance.toFixed(1)} km`}</>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
