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

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Force recalculation after render
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

  // Pan to new center
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, 13);
    mapRef.current.invalidateSize();
  }, [center]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    L.marker(userPos, { icon: userLocationIcon }).bindPopup("Você está aqui").addTo(markers);

    partners
      .filter((p) => typeof p.display_lat === "number" && typeof p.display_lng === "number")
      .forEach((partner) => {
        const marker = L.marker([partner.display_lat!, partner.display_lng!], {
          icon: createPartnerIcon(partner.partner_type, selectedId === partner.id),
        });

        const distLabel = partner.distance != null
          ? `<br />📏 ${partner.distance < 1 ? `${Math.round(partner.distance * 1000)} m` : `${partner.distance.toFixed(1)} km`}`
          : "";

        marker.bindPopup(`<div style="font-size:12px"><strong>${partner.name}</strong><br />${partner.specialty || partner.partner_type}${distLabel}</div>`);
        marker.on("click", () => onPinClick(partner.id));
        marker.addTo(markers);
      });

    // Fit bounds if we have partners
    if (partners.length > 0) {
      const lats = [userPos[0], ...partners.filter(p => p.display_lat).map(p => p.display_lat!)];
      const lngs = [userPos[1], ...partners.filter(p => p.display_lng).map(p => p.display_lng!)];
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [onPinClick, partners, selectedId, userPos]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%", minHeight: "220px" }} />;
}
