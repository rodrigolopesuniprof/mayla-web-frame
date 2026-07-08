import { useState } from "react";
import { BinahCapture } from "@/components/mayla/BinahCapture";

export default function DemoBinah() {
  const [key, setKey] = useState(0);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <BinahCapture
          key={key}
          onClose={() => setKey((k) => k + 1)}
          onComplete={() => { /* results are shown inside BinahCapture */ }}
          municipalityId={null}
          companyId={null}
          providerOverride="binah"
          displayName="Mayla Saúde · Teste"
        />
      </div>
    </div>
  );
}
