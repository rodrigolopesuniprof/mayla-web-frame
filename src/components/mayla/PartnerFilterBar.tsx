import { useState } from "react";
import {
  CATEGORIES,
  type PartnerType,
  type PartnerFilters,
  type SortMode,
  type ConsultModeFilter,
} from "@/lib/partner-helpers";

interface Props {
  filters: PartnerFilters;
  onChange: (f: PartnerFilters) => void;
  specialties: string[];
  cities: string[];
  resultCount: number;
}

export function PartnerFilterBar({ filters, onChange, specialties, cities, resultCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  const set = (patch: Partial<PartnerFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="shrink-0 border-b border-border bg-background">
      {/* Category pills */}
      <div className="px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => set({ category: c.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-none cursor-pointer whitespace-nowrap transition-colors ${
              filters.category === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {/* Sort + toggle row */}
      <div className="px-4 pb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {([
            { id: "nearest" as SortMode, label: "Mais próximo" },
            { id: "price" as SortMode, label: "Menor preço" },
            { id: "name" as SortMode, label: "A–Z" },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => set({ sort: s.id })}
              className={`text-[11px] px-2.5 py-1 rounded-md border-none cursor-pointer transition-colors ${
                filters.sort === s.id
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground bg-transparent hover:bg-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-primary font-medium bg-transparent border-none cursor-pointer px-1"
        >
          {expanded ? "Menos filtros ▲" : "Mais filtros ▼"}
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* Consultation mode */}
          <div className="flex gap-1.5">
            {([
              { id: "all" as ConsultModeFilter, label: "Todos" },
              { id: "online" as ConsultModeFilter, label: "🟢 Online" },
              { id: "presencial" as ConsultModeFilter, label: "📍 Presencial" },
            ]).map((m) => (
              <button
                key={m.id}
                onClick={() => set({ consultMode: m.id })}
                className={`text-[11px] px-2.5 py-1 rounded-md border-none cursor-pointer transition-colors ${
                  filters.consultMode === m.id
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground bg-transparent hover:bg-secondary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Specialty dropdown */}
          {specialties.length > 0 && (
            <select
              value={filters.specialty}
              onChange={(e) => set({ specialty: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-border bg-card text-foreground"
            >
              <option value="">Todas especialidades</option>
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* City dropdown */}
          {cities.length > 0 && (
            <select
              value={filters.city}
              onChange={(e) => set({ city: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-border bg-card text-foreground"
            >
              <option value="">Todas cidades</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Active filter summary */}
          {(filters.specialty || filters.city || filters.consultMode !== "all") && (
            <button
              onClick={() => set({ specialty: "", city: "", consultMode: "all" })}
              className="text-[10px] text-destructive bg-transparent border-none cursor-pointer underline"
            >
              Limpar filtros avançados
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <div className="px-4 pb-2">
        <span className="text-[10px] text-muted-foreground">
          {resultCount} parceiro{resultCount !== 1 ? "s" : ""} encontrado{resultCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
