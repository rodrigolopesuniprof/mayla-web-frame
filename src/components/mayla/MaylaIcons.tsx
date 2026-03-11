import { MUNICIPALITY_CONFIG } from "@/lib/mayla-config";
import { useMunicipality } from "@/contexts/MunicipalityContext";

export function MunicipalLogo({ size = 40, white = false }: { size?: number; white?: boolean }) {
  const mainColor = white ? "#fff" : "hsl(var(--mayla-pref))";
  const secondColor = white ? "rgba(255,255,255,.7)" : "hsl(var(--mayla-pref-lt))";

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="6" y="6" width="36" height="36" rx="8" fill={white ? "rgba(255,255,255,.15)" : "#fff"} opacity={white ? 0.18 : 1} />
      <path d="M10 30 Q16 26 22 30 Q28 34 34 30 Q38 27 40 30" stroke={mainColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M10 34 Q16 30 22 34 Q28 38 34 34 Q38 31 40 34" stroke={secondColor} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity={0.7} />
      <circle cx="24" cy="20" r="6" fill={mainColor} />
      <line x1="24" y1="10" x2="24" y2="13" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="27" x2="24" y2="30" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="20" x2="17" y2="20" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="31" y1="20" x2="34" y2="20" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="13" x2="19" y2="15" stroke={mainColor} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29" y1="13" x2="31" y2="15" stroke={mainColor} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandBadge({ height = 36, white = false }: { height?: number; white?: boolean }) {
  const isSmall = height <= 34;
  const { municipality } = useMunicipality();
  const name = municipality?.name ?? MUNICIPALITY_CONFIG.nome;
  const secretaria = municipality?.secretaria ?? MUNICIPALITY_CONFIG.secretaria;
  const logoUrl = municipality?.logo_url;

  return (
    <div className="flex items-center" style={{ gap: isSmall ? 7 : 10 }}>
      <div
        className="flex items-center justify-center shrink-0 overflow-hidden"
        style={{
          width: height,
          height: height,
          borderRadius: height * 0.22,
          background: logoUrl
            ? "transparent"
            : white
              ? "rgba(255,255,255,.12)"
              : "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))",
          boxShadow: white ? "none" : logoUrl ? "0 2px 8px rgba(0,0,0,.1)" : "0 3px 12px rgba(26,92,138,.35)",
        }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <MunicipalLogo size={height * 0.65} white />
        )}
      </div>
      <div>
        <div
          className="font-bold leading-tight"
          style={{
            fontSize: isSmall ? 11 : 12,
            color: white ? "#fff" : undefined,
          }}
        >
          {name}
        </div>
        <div
          className="text-muted-foreground"
          style={{
            fontSize: isSmall ? 9 : 10,
            lineHeight: 1.3,
            marginTop: 1,
            color: white ? "rgba(255,255,255,.6)" : undefined,
          }}
        >
          {secretaria}
        </div>
      </div>
    </div>
  );
}

export function Avatar({ initials = "MA", size = 38 }: { initials?: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center shrink-0 font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-peach)))",
        fontSize: size * 0.38,
        color: "#fff",
      }}
    >
      {initials}
    </div>
  );
}
