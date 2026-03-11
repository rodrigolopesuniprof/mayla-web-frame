import { useState } from "react";
import { CompanyLogo } from "./MaylaIcons";
import { useCompany } from "@/contexts/CompanyContext";
import { COMPANY_CONFIG } from "@/lib/mayla-config";

function Visual({ type, logoUrl }: { type: "company" | "heart"; logoUrl?: string | null }) {
  if (type === "company") {
    return (
      <div className="relative" style={{ width: 180, height: 180 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 40% 40%, hsl(var(--mayla-sand)), hsl(var(--mayla-cream)))" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{
              width: 88, height: 88, borderRadius: 24,
              background: logoUrl ? "transparent" : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
              boxShadow: "0 16px 48px rgba(26,92,138,.3)",
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <CompanyLogo size={56} white />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 40% 40%, #FEE8E6, hsl(var(--mayla-cream)))" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center text-[40px] animate-heartbeat"
          style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            boxShadow: "0 16px 48px rgba(232,87,74,.3)",
          }}
        >
          ❤️
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid rgba(232,87,74,${0.25 / i})`,
            transform: `scale(${1 + i * 0.18})`,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const { company } = useCompany();
  const companyName = company?.name ?? COMPANY_CONFIG.nome;
  const logoUrl = company?.logo_url;

  const slides = [
    {
      tag: `${companyName} cuida de você`,
      title: ["Bem-estar", "na palma da", "sua mão"],
      sub: `O app para facilitar seu acesso aos programas de saúde e bem-estar da sua empresa.`,
      visual: "company" as const,
    },
    {
      tag: "Tecnologia que cuida",
      title: ["Meça seus sinais", "vitais em", "30 segundos"],
      sub: "rPPG pela câmera — frequência cardíaca, respiração e nível de estresse sem sair de casa.",
      visual: "heart" as const,
    },
  ];

  const slide = slides[step];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onDone();
    }
  };

  return (
    <div key={step} className="animate-fade-up flex-1 flex flex-col bg-background relative overflow-hidden">
      <div
        className="absolute animate-morph"
        style={{
          top: -60, right: -60, width: 200, height: 200,
          background: "radial-gradient(circle, hsl(var(--mayla-rose-lt)), hsl(var(--mayla-peach)))",
          borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
          opacity: 0.15,
        }}
      />

      {step < slides.length - 1 && (
        <button
          onClick={onDone}
          className="absolute top-[22px] right-[22px] z-10 bg-secondary border-none rounded-full px-3.5 py-1.5 text-muted-foreground text-[11px] font-medium cursor-pointer"
        >
          Pular
        </button>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-7">
        <Visual type={slide.visual} logoUrl={logoUrl} />
        <div className="text-center w-full">
          <div className="text-[10px] text-muted-foreground tracking-[.16em] uppercase mb-3">
            {slide.tag}
          </div>
          <div className="font-display text-[32px] font-medium text-foreground leading-[1.25] mb-4">
            {slide.title.map((line, i) => (
              <span key={i}>
                {i === 1 ? <em className="italic text-accent">{line}</em> : line}
                <br />
              </span>
            ))}
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed max-w-[270px] mx-auto">
            {slide.sub}
          </div>
        </div>
      </div>

      <div className="px-7 pb-10 pt-5 flex flex-col items-center gap-[18px]">
        <div className="flex gap-[7px]">
          {slides.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                background: i === step ? "hsl(var(--mayla-rose))" : "hsl(var(--mayla-sand))",
                width: i === step ? 24 : 6,
              }}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-[18px] border-none cursor-pointer font-body text-[15px] font-semibold text-accent-foreground"
          style={{
            background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            boxShadow: "0 8px 28px rgba(232,87,74,.3)",
          }}
        >
          {step < slides.length - 1 ? "Continuar →" : "Começar agora"}
        </button>
      </div>
    </div>
  );
}
