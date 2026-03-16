import { useState } from "react";
import { TopBar } from "./TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type Partner,
  MARKER_EMOJIS,
  TYPE_LABELS,
  formatDistance,
} from "@/lib/partner-helpers";

interface Props {
  partner: Partner;
  onBack: () => void;
}

export function PartnerDetail({ partner: p, onBack }: Props) {
  const [showStore, setShowStore] = useState(false);

  const hours = p.opening_hours && typeof p.opening_hours === "object" && !Array.isArray(p.opening_hours)
    ? Object.entries(p.opening_hours as Record<string, string>)
    : null;

  const virtualStoreUrl = (p as any).virtual_store_url as string | undefined;

  if (showStore && virtualStoreUrl) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Loja Virtual" onBack={() => setShowStore(false)} />
        <iframe src={virtualStoreUrl} className="flex-1 w-full border-0" allow="payment" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar title={p.name} onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {p.logo_url ? (
          <img src={p.logo_url} alt={p.name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-32 bg-secondary flex items-center justify-center">
            <span className="text-5xl">{MARKER_EMOJIS[p.partner_type]}</span>
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{TYPE_LABELS[p.partner_type]}</Badge>
            {p.specialty && <Badge variant="outline">{p.specialty}</Badge>}
            {p.online_consultation_enabled && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Online</Badge>
            )}
          </div>

          <h2 className="font-display text-xl font-bold text-foreground leading-tight">{p.name}</h2>

          {p.crm && <p className="text-xs text-muted-foreground">CRM: {p.crm}/{p.crm_state}</p>}
          {p.description && <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>}

          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
            {p.full_address && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">📍</span>
                <span className="text-sm text-foreground leading-snug">{p.full_address}</span>
              </div>
            )}
            {p.city && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">🏙️</span>
                <span className="text-sm text-foreground">{p.city} – {p.state}</span>
              </div>
            )}
            {p.phone && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">📞</span>
                <span className="text-sm text-foreground">{p.phone}</span>
              </div>
            )}
            {p.email && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">✉️</span>
                <span className="text-sm text-foreground">{p.email}</span>
              </div>
            )}
            {p.consultation_price != null && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">💰</span>
                <span className="text-sm font-semibold text-foreground">R$ {p.consultation_price.toFixed(2)}</span>
              </div>
            )}
            {p.distance != null && p.distance < Infinity && (
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">📏</span>
                <span className="text-sm text-muted-foreground">{formatDistance(p.distance)}</span>
              </div>
            )}
          </div>

          {hours && hours.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Horários</h4>
              <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                {hours.map(([day, time]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{day}</span>
                    <span className="text-foreground font-medium">{time || "Fechado"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.services_offered && (p.services_offered as string[]).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Serviços</h4>
              <div className="flex flex-wrap gap-1.5">
                {(p.services_offered as string[]).map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[11px]">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1 pb-4">
            {virtualStoreUrl && (
              <Button className="w-full" variant="default" onClick={() => setShowStore(true)}>
                🛒 Loja Virtual
              </Button>
            )}
            {p.contact_link && (
              <Button className="w-full" onClick={() => window.open(p.contact_link!, "_blank")}>
                📞 Entrar em contato
              </Button>
            )}
            {p.phone && !p.contact_link && (
              <Button className="w-full" onClick={() => window.open(`tel:${p.phone}`, "_self")}>
                📞 Ligar
              </Button>
            )}
            {(p.booking_link || p.scheduling_link) && (
              <Button variant="outline" className="w-full" onClick={() => window.open(p.booking_link || p.scheduling_link!, "_blank")}>
                📅 Agendar
              </Button>
            )}
            {p.display_lat && p.display_lng && (
              <Button variant="outline" className="w-full" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.display_lat},${p.display_lng}`, "_blank")}>
                🗺️ Abrir rota
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
