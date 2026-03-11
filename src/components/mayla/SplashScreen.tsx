import { useEffect } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { CompanyLogo } from "./MaylaIcons";
import { COMPANY_CONFIG } from "@/lib/mayla-config";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { company } = useCompany();

  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  const companyName = company?.name ?? COMPANY_CONFIG.nome;
  const programName = company?.wellbeing_program_name ?? COMPANY_CONFIG.programa;
  const logoUrl = company?.logo_url;

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-background">
      <div
        className="absolute animate-morph"
        style={{
          top: -80, right: -80, width: 240, height: 240,
          background: "radial-gradient(circle, hsl(var(--mayla-rose-lt)), hsl(var(--mayla-peach)))",
          borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
          opacity: 0.18,
        }}
      />
      <div
        className="absolute animate-morph"
        style={{
          bottom: -60, left: -60, width: 200, height: 200,
          background: "radial-gradient(circle, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
          borderRadius: "40% 60% 45% 55% / 60% 40% 60% 40%",
          opacity: 0.1,
          animationDuration: "7s",
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: 100, right: 20, width: 120, height: 120,
          background: "hsl(var(--mayla-sand))",
          borderRadius: "50%", opacity: 0.6,
          animation: "morph 11s ease-in-out infinite alternate",
        }}
      />

      <div className="animate-splash-logo flex flex-col items-center gap-3.5 mb-8">
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            width: 76, height: 76, borderRadius: 22,
            background: logoUrl ? "transparent" : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
            boxShadow: logoUrl ? "0 12px 40px rgba(0,0,0,.15)" : "0 12px 40px rgba(26,92,138,.25), 0 4px 12px rgba(26,92,138,.15)",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-full h-full object-cover" />
          ) : (
            <CompanyLogo size={48} white />
          )}
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-foreground">{companyName}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{programName}</div>
        </div>
      </div>

      <div className="w-10 h-[1.5px] bg-secondary mb-8 animate-splash-sub" />

      <div className="animate-splash-sub text-center">
        <div className="font-display text-[52px] font-bold text-foreground tracking-tight leading-none">
          mayla<span className="text-accent">.</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2 tracking-[.14em] uppercase">
          bem-estar corporativo
        </div>
      </div>

      <div className="absolute bottom-[52px] flex gap-[7px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-secondary animate-blink"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </div>
    </div>
  );
}
