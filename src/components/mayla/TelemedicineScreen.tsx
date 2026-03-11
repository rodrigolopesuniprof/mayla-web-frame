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
          <span className="font-display text-base font-medium text-foreground">Telemedicina</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <span className="text-4xl mb-3 block">📹</span>
            <p className="text-sm text-muted-foreground">
              Telemedicina ainda não está disponível para o seu município.
            </p>
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
