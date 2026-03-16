import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PartnerForm, type PartnerData, type PartnerType } from "@/components/admin/PartnerForm";
import maylaLogo from "@/assets/mayla-avatar.png";

const TYPES: { id: PartnerType; label: string; emoji: string; desc: string }[] = [
  { id: "doctor", label: "Médico", emoji: "🩺", desc: "Profissional de saúde" },
  { id: "clinic", label: "Clínica", emoji: "🏥", desc: "Clínica ou consultório" },
  { id: "gym", label: "Academia", emoji: "🏋️", desc: "Academia ou estúdio" },
  { id: "laboratory", label: "Laboratório", emoji: "🔬", desc: "Laboratório de exames" },
  { id: "pharmacy", label: "Farmácia", emoji: "💊", desc: "Farmácia ou drogaria" },
];

export default function PartnerRegistration() {
  const [selectedType, setSelectedType] = useState<PartnerType | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: PartnerData) => {
    setSaving(true);
    try {
      // Extract extended data before inserting
      const { id, _availability, _clinic_doctors, _clinic_pricing_mode, virtual_store_url, ...rest } = data;

      const payload: Record<string, unknown> = {
        ...rest,
        approval_status: "pending" as const,
        active: false,
      };

      // Include virtual_store_url for pharmacies
      if (data.partner_type === "pharmacy" && virtual_store_url) {
        payload.virtual_store_url = virtual_store_url;
      }

      // Insert partner
      const { data: partner, error } = await supabase
        .from("partners")
        .insert(payload as any)
        .select("id")
        .single();

      if (error) throw error;
      const partnerId = partner.id;

      // Insert doctor availability slots
      if (data.partner_type === "doctor" && _availability && _availability.length > 0) {
        const availRows = _availability.map(s => ({
          partner_id: partnerId,
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          consultation_mode: s.consultation_mode,
          is_active: s.is_active,
        }));
        await supabase.from("doctor_availability").insert(availRows);
      }

      // Insert clinic doctors + their availability + links
      if (data.partner_type === "clinic" && _clinic_doctors && _clinic_doctors.length > 0) {
        for (const doc of _clinic_doctors) {
          const docPayload: Record<string, unknown> = {
            partner_type: "doctor" as const,
            name: doc.name,
            crm: doc.crm,
            crm_state: doc.crm_state,
            specialty: doc.specialty,
            consultation_price: _clinic_pricing_mode === "per_doctor" ? doc.consultation_price : data.consultation_price,
            consultation_type: data.service_mode || "both",
            city: data.city,
            state: data.state,
            full_address: data.full_address,
            approval_status: "pending" as const,
            active: false,
          };

          const { data: docRow } = await supabase
            .from("partners")
            .insert(docPayload as any)
            .select("id")
            .single();

          if (docRow) {
            // Link doctor to clinic
            await supabase.from("partner_doctor_links").insert({
              clinic_id: partnerId,
              doctor_id: docRow.id,
            });

            // Doctor availability
            if (doc.availability.length > 0) {
              const docAvailRows = doc.availability.map(s => ({
                partner_id: docRow.id,
                weekday: s.weekday,
                start_time: s.start_time,
                end_time: s.end_time,
                consultation_mode: s.consultation_mode,
                is_active: s.is_active,
              }));
              await supabase.from("doctor_availability").insert(docAvailRows);
            }
          }
        }
      }

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Erro ao enviar cadastro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <img src={maylaLogo} alt="Mayla" className="w-16 h-16 rounded-2xl mx-auto mb-6" />
          <div className="text-5xl mb-4">✅</div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Cadastro recebido!</h1>
          <p className="text-muted-foreground mb-4">
            Sua solicitação foi enviada com sucesso. Nossa equipe irá analisar e entrar em contato em breve.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">⏳ Próximos passos</p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li>Seu cadastro será analisado pela nossa equipe</li>
              <li>Após aprovação, você aparecerá no marketplace e nas consultas</li>
              <li>Você receberá um e-mail quando for aprovado</li>
            </ul>
          </div>
          <Button variant="outline" onClick={() => { setSuccess(false); setSelectedType(null); }}>
            Novo cadastro
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedType) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <img src={maylaLogo} alt="Mayla" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground">Cadastro de Parceiro</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Selecione o tipo de parceiro para iniciar o cadastro
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className="border border-border rounded-xl p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer bg-card"
              >
                <div className="text-3xl mb-2">{t.emoji}</div>
                <div className="font-semibold text-foreground text-sm">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const typeInfo = TYPES.find(t => t.id === selectedType)!;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>← Voltar</Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              {typeInfo.emoji} Cadastro de {typeInfo.label}
            </h1>
            <p className="text-xs text-muted-foreground">Preencha os dados abaixo para solicitar cadastro</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <PartnerForm
            partnerType={selectedType}
            onSubmit={handleSubmit}
            onCancel={() => setSelectedType(null)}
            loading={saving}
            hideStatusFields
          />
        </div>
      </div>
    </div>
  );
}
