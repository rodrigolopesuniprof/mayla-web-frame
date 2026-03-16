import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export default function ConsultationMap({ center, userPos, userIcon, doctors, mapSelectedId, createDoctorIcon, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      markersRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, 13);
    mapRef.current.invalidateSize();
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    L.marker(userPos, { icon: userIcon }).bindPopup("Você").addTo(markers);

    doctors
      .filter((d) => typeof d.display_lat === "number" && typeof d.display_lng === "number")
      .forEach((doctor) => {
        const marker = L.marker([doctor.display_lat!, doctor.display_lng!], {
          icon: createDoctorIcon(mapSelectedId === doctor.id),
        });

        marker.bindPopup(`<div style="font-size:12px"><strong>${doctor.name}</strong><br />${doctor.specialty ?? ""}</div>`);
        marker.on("click", () => onPinClick(doctor.id));
        marker.addTo(markers);
      });
  }, [createDoctorIcon, doctors, mapSelectedId, onPinClick, userIcon, userPos]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%", minHeight: "200px" }} />;
}
