import { useState } from "react";
import { CompanyLogo } from "./MaylaIcons";
import { useCompany } from "@/contexts/CompanyContext";
import { COMPANY_CONFIG } from "@/lib/mayla-config";

function Visual({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 40% 40%, hsl(var(--mayla-sand)), hsl(var(--mayla-cream)))" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            width: 100, height: 100, borderRadius: 28,
            background: logoUrl ? "transparent" : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
            boxShadow: "0 16px 48px rgba(26,92,138,.3)",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <CompanyLogo size={64} white />
          )}
        </div>
      </div>
    </div>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { company } = useCompany();
  const companyName = company?.name ?? COMPANY_CONFIG.nome;
  const logoUrl = company?.logo_url;

  return (
    <div className="animate-fade-up flex-1 flex flex-col bg-background relative overflow-hidden">
      <div
        className="absolute animate-morph"
        style={{
          top: -60, right: -60, width: 200, height: 200,
          background: "radial-gradient(circle, hsl(var(--mayla-rose-lt)), hsl(var(--mayla-peach)))",
          borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
          opacity: 0.15,
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        <Visual logoUrl={logoUrl} />
        <div className="text-center w-full">
          <div className="text-xs text-muted-foreground tracking-[.16em] uppercase mb-4">
            {companyName} cuida de você
          </div>
          <div className="font-display text-4xl font-medium text-foreground leading-[1.25] mb-5">
            Bem-estar<br />
            <em className="italic text-accent">na palma da</em><br />
            sua mão
          </div>
          <div className="text-base text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
            O app para facilitar seu acesso aos programas de saúde e bem-estar da sua empresa.
          </div>
        </div>
      </div>

      <div className="px-7 pb-10 pt-5 flex flex-col items-center gap-[18px]">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-[18px] border-none cursor-pointer font-body text-base font-semibold text-accent-foreground"
          style={{
            background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            boxShadow: "0 8px 28px rgba(232,87,74,.3)",
          }}
        >
          Começar agora
        </button>
      </div>
    </div>
  );
}
