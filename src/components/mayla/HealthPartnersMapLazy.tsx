import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Partner } from "@/lib/partner-helpers";
import { createPartnerIcon, userLocationIcon } from "@/lib/partner-helpers";

interface Props {
  center: [number, number];
  userPos: [number, number];
  partners: Partner[];
  selectedId: string | null;
  onPinClick: (id: string) => void;
}

export default function HealthPartnersMapContent({ center, userPos, partners, selectedId, onPinClick }: Props) {
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
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    L.marker(userPos, { icon: userLocationIcon }).bindPopup("Você está aqui").addTo(markers);

    partners
      .filter((partner) => typeof partner.display_lat === "number" && typeof partner.display_lng === "number")
      .forEach((partner) => {
        const marker = L.marker([partner.display_lat!, partner.display_lng!], {
          icon: createPartnerIcon(partner.partner_type, selectedId === partner.id),
        });

        const distanceLabel = partner.distance != null
          ? `<br />📏 ${partner.distance < 1 ? `${Math.round(partner.distance * 1000)} m` : `${partner.distance.toFixed(1)} km`}`
          : "";

        marker.bindPopup(`<div class=\"text-xs\"><strong>${partner.name}</strong><br />${partner.specialty || partner.partner_type}${distanceLabel}</div>`);
        marker.on("click", () => onPinClick(partner.id));
        marker.addTo(markers);
      });
  }, [onPinClick, partners, selectedId, userPos]);

  return <div ref={containerRef} className="h-full w-full" />;
}
