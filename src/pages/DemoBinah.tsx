import { useState } from "react";
import { BinahCapture } from "@/components/mayla/BinahCapture";

const WHATSAPP_NUMBER = "553197863970";

interface DemoResult {
  heart_rate?: number;
  blood_pressure_sys?: number;
  blood_pressure_dia?: number;
  spo2?: number;
  respiratory_rate?: number;
  hrv_sdnn?: number;
  stress_level?: number;
  hemoglobin?: number;
  hba1c?: number;
  wellness_score?: number;
}

function fmt(n: number | undefined, decimals = 0): string | null {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  return decimals > 0 ? Number(n).toFixed(decimals) : String(Math.round(n));
}

function buildWhatsAppUrl(r: DemoResult): string {
  const parts: string[] = [];
  const fc = fmt(r.heart_rate);
  if (fc) parts.push(`FC ${fc}`);
  const sys = fmt(r.blood_pressure_sys);
  const dia = fmt(r.blood_pressure_dia);
  if (sys && dia) parts.push(`PA ${sys}/${dia}`);
  const spo2 = fmt(r.spo2);
  if (spo2) parts.push(`SPO2 ${spo2}`);
  const fr = fmt(r.respiratory_rate);
  if (fr) parts.push(`FR ${fr}`);
  const stress = fmt(r.stress_level);
  if (stress) parts.push(`Stress ${stress}`);
  const vfc = fmt(r.hrv_sdnn);
  if (vfc) parts.push(`VFC ${vfc}`);
  const wellness = fmt(r.wellness_score);
  if (wellness) parts.push(`Bem-estar ${wellness}`);
  const hemog = fmt(r.hemoglobin, 1);
  if (hemog) parts.push(`Hemog ${hemog}`);
  const hba1c = fmt(r.hba1c, 1);
  if (hba1c) parts.push(`HbA1c ${hba1c}%`);

  const text =
    parts.length > 0
      ? `Olá, gostaria de avaliar meus dados de saúde\n${parts.join(", ")}`
      : `Olá, gostaria de avaliar meus dados de saúde`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export default function DemoBinah() {
  const [key, setKey] = useState(0);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <BinahCapture
          key={key}
          onClose={() => setKey((k) => k + 1)}
          onComplete={() => { /* no-op in demo mode */ }}
          municipalityId={null}
          companyId={null}
          providerOverride="binah"
          displayName="Mayla Saúde · Teste"
          saveButtonLabel="Analisar Medição"
          onSaveOverride={(result) => {
            const url = buildWhatsAppUrl(result as DemoResult);
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        />
      </div>
    </div>
  );
}
