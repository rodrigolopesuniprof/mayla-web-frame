import { useState } from "react";
import { useMunicipality } from "@/contexts/MunicipalityContext";

export function TelemedicineScreen({ onBack }: { onBack: () => void }) {
  const { municipality } = useMunicipality();
  const url = (municipality as any)?.telemedicine_url;

  if (!url) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
          <button
            onClick={onBack}
            className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
          >
            ← Voltar
          </button>
          <span className="font-display text-base font-medium text-foreground">Consulta Online</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center max-w-xs">
            <span className="text-5xl mb-4 block">👨‍⚕️</span>
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">Em breve: Marketplace de Especialistas</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Conecte-se com médicos e especialistas de saúde para teleconsultas via vídeo, com agendamento integrado e prontuário digital.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["📹 Telechamada", "📋 Prontuário", "💳 Pagamento"].map((item, i) => (
                <span key={i} className="text-[11px] font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="bg-secondary border-none rounded-xl px-3 py-1.5 text-secondary-foreground text-[13px] font-medium cursor-pointer"
        >
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">Telemedicina</span>
      </div>
      <iframe
        src={url}
        className="flex-1 border-none w-full"
        allow="camera;microphone"
        title="Telemedicina"
      />
    </div>
  );
}
