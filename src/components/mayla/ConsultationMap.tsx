import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type L from "leaflet";

interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  display_lat?: number;
  display_lng?: number;
}

interface Props {
  center: [number, number];
  userPos: [number, number];
  userIcon: L.DivIcon;
  doctors: Doctor[];
  mapSelectedId: string | null;
  createDoctorIcon: (selected: boolean) => L.DivIcon;
  onPinClick: (id: string) => void;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 13); }, [center]);
  return null;
}

export default function ConsultationMap({ center, userPos, userIcon, doctors, mapSelectedId, createDoctorIcon, onPinClick }: Props) {
  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <RecenterMap center={center} />
      <Marker position={userPos} icon={userIcon}><Popup>Você</Popup></Marker>
      {doctors.filter((d) => d.display_lat && d.display_lng).map((d) => (
        <Marker
          key={d.id}
          position={[d.display_lat!, d.display_lng!]}
          icon={createDoctorIcon(mapSelectedId === d.id)}
          eventHandlers={{ click: () => onPinClick(d.id) }}
        >
          <Popup><strong>{d.name}</strong><br />{d.specialty}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
