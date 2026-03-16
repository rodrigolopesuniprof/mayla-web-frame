import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PartnerType = "doctor" | "clinic" | "gym" | "laboratory" | "pharmacy";
export type ApprovalStatus = "pending" | "approved" | "blocked";

export interface PartnerData {
  id?: string;
  partner_type: PartnerType;
  name: string;
  email: string;
  phone: string;
  description: string;
  city: string;
  state: string;
  full_address: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  approval_status: ApprovalStatus;
  logo_url: string;
  opening_hours: Record<string, string>;
  services_offered: string[];
  accepted_payments: string[];
  contact_link: string;
  // Doctor
  crm: string;
  crm_state: string;
  specialty: string;
  sub_specialty: string;
  consultation_type: string;
  consultation_price: number | null;
  notification_email: string;
  online_consultation_enabled: boolean;
  // Clinic
  specialties_offered: string[] | null;
  booking_link: string;
  service_mode: string;
  // Gym
  wellness_activities: string[] | null;
  is_partner_gym: boolean;
  // Lab
  exam_types: string[] | null;
  collection_methods: string[] | null;
  appointment_only: boolean;
  scheduling_link: string;
  // Pharmacy
  delivery_available: boolean;
  service_notes: string;
}

const emptyPartner = (type: PartnerType): PartnerData => ({
  partner_type: type,
  name: "",
  email: "",
  phone: "",
  description: "",
  city: "",
  state: "ES",
  full_address: "",
  zip_code: "",
  latitude: null,
  longitude: null,
  active: false,
  approval_status: "pending",
  logo_url: "",
  opening_hours: {},
  services_offered: [],
  accepted_payments: [],
  contact_link: "",
  crm: "",
  crm_state: "",
  specialty: "",
  sub_specialty: "",
  consultation_type: "both",
  consultation_price: null,
  notification_email: "",
  online_consultation_enabled: false,
  specialties_offered: null,
  booking_link: "",
  service_mode: "",
  wellness_activities: null,
  is_partner_gym: false,
  exam_types: null,
  collection_methods: null,
  appointment_only: false,
  scheduling_link: "",
  delivery_available: false,
  service_notes: "",
});

interface Props {
  partnerType: PartnerType;
  initialData?: Partial<PartnerData>;
  onSubmit: (data: PartnerData) => void;
  onCancel: () => void;
  loading?: boolean;
  hideStatusFields?: boolean;
}

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function PartnerForm({ partnerType, initialData, onSubmit, onCancel, loading, hideStatusFields }: Props) {
  const [data, setData] = useState<PartnerData>(() => ({ ...emptyPartner(partnerType), ...initialData }));

  useEffect(() => {
    setData(prev => ({ ...emptyPartner(partnerType), ...initialData, partner_type: partnerType }));
  }, [partnerType, initialData]);

  const set = <K extends keyof PartnerData>(key: K, val: PartnerData[K]) => setData(p => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Common fields */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground mb-2">Dados gerais</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={data.name} onChange={e => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={data.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={data.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Link de contato</Label>
            <Input value={data.contact_link} onChange={e => set("contact_link", e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Descrição</Label>
          <Textarea value={data.description} onChange={e => set("description", e.target.value)} rows={3} />
        </div>
      </fieldset>

      {/* Address */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground mb-2">Endereço</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Endereço completo</Label>
            <Input value={data.full_address} onChange={e => set("full_address", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cidade</Label>
            <Input value={data.city} onChange={e => set("city", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={data.state} onValueChange={v => set("state", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>CEP</Label>
            <Input value={data.zip_code} onChange={e => set("zip_code", e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Services & payments */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground mb-2">Serviços e pagamentos</legend>
        <div className="space-y-1">
          <Label>Serviços oferecidos (separar por vírgula)</Label>
          <Input
            value={(data.services_offered || []).join(", ")}
            onChange={e => set("services_offered", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
          />
        </div>
        <div className="space-y-1">
          <Label>Formas de pagamento (separar por vírgula)</Label>
          <Input
            value={(data.accepted_payments || []).join(", ")}
            onChange={e => set("accepted_payments", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
          />
        </div>
      </fieldset>

      {/* Doctor-specific */}
      {partnerType === "doctor" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🩺 Dados do médico</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>CRM *</Label>
              <Input value={data.crm} onChange={e => set("crm", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>UF do CRM</Label>
              <Select value={data.crm_state} onValueChange={v => set("crm_state", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Especialidade</Label>
              <Input value={data.specialty} onChange={e => set("specialty", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sub-especialidade</Label>
              <Input value={data.sub_specialty} onChange={e => set("sub_specialty", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de consulta</Label>
              <Select value={data.consultation_type} onValueChange={v => set("consultation_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Preço da consulta (R$)</Label>
              <Input type="number" step="0.01" value={data.consultation_price ?? ""} onChange={e => set("consultation_price", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email para notificações</Label>
            <Input type="email" value={data.notification_email} onChange={e => set("notification_email", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={data.online_consultation_enabled} onCheckedChange={v => set("online_consultation_enabled", v)} />
            <Label>Consulta online habilitada</Label>
          </div>
        </fieldset>
      )}

      {/* Clinic-specific */}
      {partnerType === "clinic" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🏥 Dados da clínica</legend>
          <div className="space-y-1">
            <Label>Especialidades oferecidas (separar por vírgula)</Label>
            <Input
              value={(data.specialties_offered || []).join(", ")}
              onChange={e => set("specialties_offered", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Link de agendamento</Label>
              <Input value={data.booking_link} onChange={e => set("booking_link", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Modo de atendimento</Label>
              <Select value={data.service_mode} onValueChange={v => set("service_mode", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>
      )}

      {/* Gym-specific */}
      {partnerType === "gym" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🏋️ Dados da academia</legend>
          <div className="space-y-1">
            <Label>Atividades de bem-estar (separar por vírgula)</Label>
            <Input
              value={(data.wellness_activities || []).join(", ")}
              onChange={e => set("wellness_activities", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={data.is_partner_gym} onCheckedChange={v => set("is_partner_gym", v)} />
            <Label>Academia parceira</Label>
          </div>
        </fieldset>
      )}

      {/* Lab-specific */}
      {partnerType === "laboratory" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🔬 Dados do laboratório</legend>
          <div className="space-y-1">
            <Label>Tipos de exames (separar por vírgula)</Label>
            <Input
              value={(data.exam_types || []).join(", ")}
              onChange={e => set("exam_types", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
          </div>
          <div className="space-y-1">
            <Label>Métodos de coleta (separar por vírgula)</Label>
            <Input
              value={(data.collection_methods || []).join(", ")}
              onChange={e => set("collection_methods", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Link de agendamento</Label>
              <Input value={data.scheduling_link} onChange={e => set("scheduling_link", e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={data.appointment_only} onCheckedChange={v => set("appointment_only", v)} />
              <Label>Somente com agendamento</Label>
            </div>
          </div>
        </fieldset>
      )}

      {/* Pharmacy-specific */}
      {partnerType === "pharmacy" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">💊 Dados da farmácia</legend>
          <div className="flex items-center gap-2">
            <Switch checked={data.delivery_available} onCheckedChange={v => set("delivery_available", v)} />
            <Label>Delivery disponível</Label>
          </div>
          <div className="space-y-1">
            <Label>Observações de serviço</Label>
            <Textarea value={data.service_notes} onChange={e => set("service_notes", e.target.value)} rows={2} />
          </div>
        </fieldset>
      )}

      {/* Status fields (hidden for self-registration) */}
      {!hideStatusFields && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">Status</legend>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={data.active} onCheckedChange={v => set("active", v)} />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-1">
              <Label>Aprovação</Label>
              <Select value={data.approval_status} onValueChange={v => set("approval_status", v as ApprovalStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}
