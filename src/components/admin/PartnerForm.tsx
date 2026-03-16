import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export type PartnerType = "doctor" | "clinic" | "gym" | "laboratory" | "pharmacy";
export type ApprovalStatus = "pending" | "approved" | "blocked";

export const MEDICAL_SPECIALTIES = [
  "Clínico Geral", "Cardiologia", "Dermatologia", "Endocrinologia", "Gastroenterologia",
  "Geriatria", "Ginecologia e Obstetrícia", "Hematologia", "Infectologia", "Mastologia",
  "Medicina do Trabalho", "Medicina de Família", "Medicina Esportiva", "Nefrologia",
  "Neurologia", "Nutrição", "Oftalmologia", "Oncologia", "Ortopedia",
  "Otorrinolaringologia", "Pediatria", "Pneumologia", "Proctologia", "Psiquiatria",
  "Reumatologia", "Urologia", "Cirurgia Geral", "Cirurgia Plástica", "Anestesiologia",
  "Fisiatria", "Angiologia", "Alergologia", "Homeopatia", "Acupuntura",
  "Cirurgia Cardiovascular", "Cirurgia Pediátrica", "Medicina Intensiva",
  "Medicina Nuclear", "Patologia", "Radiologia", "Coloproctologia",
  "Genética Médica", "Nutrologia", "Medicina Legal", "Medicina Preventiva",
];

export interface AvailabilitySlot {
  weekday: number;
  start_time: string;
  end_time: string;
  consultation_mode: string;
  is_active: boolean;
  slot_duration_minutes: number;
}

export interface ClinicDoctor {
  name: string;
  crm: string;
  crm_state: string;
  specialty: string;
  consultation_price: number | null;
  availability: AvailabilitySlot[];
}

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
  crm: string;
  crm_state: string;
  specialty: string;
  sub_specialty: string;
  consultation_type: string;
  consultation_price: number | null;
  notification_email: string;
  online_consultation_enabled: boolean;
  specialties_offered: string[] | null;
  booking_link: string;
  service_mode: string;
  wellness_activities: string[] | null;
  is_partner_gym: boolean;
  exam_types: string[] | null;
  collection_methods: string[] | null;
  appointment_only: boolean;
  scheduling_link: string;
  delivery_available: boolean;
  service_notes: string;
  virtual_store_url: string;
  // Extended data for registration flow (not persisted on partners table directly)
  _availability?: AvailabilitySlot[];
  _clinic_doctors?: ClinicDoctor[];
  _clinic_pricing_mode?: "fixed" | "per_doctor";
}

const emptyPartner = (type: PartnerType): PartnerData => ({
  partner_type: type,
  name: "", email: "", phone: "", description: "",
  city: "", state: "ES", full_address: "", zip_code: "",
  latitude: null, longitude: null,
  active: false, approval_status: "pending",
  logo_url: "", opening_hours: {},
  services_offered: [], accepted_payments: [],
  contact_link: "",
  crm: "", crm_state: "", specialty: "", sub_specialty: "",
  consultation_type: "both", consultation_price: null,
  notification_email: "", online_consultation_enabled: false,
  specialties_offered: null, booking_link: "", service_mode: "",
  wellness_activities: null, is_partner_gym: false,
  exam_types: null, collection_methods: null,
  appointment_only: false, scheduling_link: "",
  delivery_available: false, service_notes: "",
  virtual_store_url: "",
  _availability: [],
  _clinic_doctors: [],
  _clinic_pricing_mode: "fixed",
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
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function PartnerForm({ partnerType, initialData, onSubmit, onCancel, loading, hideStatusFields }: Props) {
  const [data, setData] = useState<PartnerData>(() => ({ ...emptyPartner(partnerType), ...initialData }));

  // Raw text state for comma-separated fields (fixes comma input bug)
  const [rawServices, setRawServices] = useState((initialData?.services_offered || []).join(", "));
  const [rawPayments, setRawPayments] = useState((initialData?.accepted_payments || []).join(", "));
  const [rawWellness, setRawWellness] = useState((initialData?.wellness_activities || []).join(", "));
  const [rawExamTypes, setRawExamTypes] = useState((initialData?.exam_types || []).join(", "));
  const [rawCollectionMethods, setRawCollectionMethods] = useState((initialData?.collection_methods || []).join(", "));

  // Specialty "Outro" state
  const [showOtherSpecialty, setShowOtherSpecialty] = useState(() => {
    const s = initialData?.specialty || "";
    return s !== "" && !MEDICAL_SPECIALTIES.includes(s);
  });

  useEffect(() => {
    setData(prev => ({ ...emptyPartner(partnerType), ...initialData, partner_type: partnerType }));
  }, [partnerType, initialData]);

  const set = <K extends keyof PartnerData>(key: K, val: PartnerData[K]) => setData(p => ({ ...p, [key]: val }));

  const parseCSV = (raw: string) => raw.split(",").map(s => s.trim()).filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Parse raw text fields into arrays on submit
    const finalData: PartnerData = {
      ...data,
      services_offered: parseCSV(rawServices),
      accepted_payments: parseCSV(rawPayments),
      wellness_activities: parseCSV(rawWellness).length > 0 ? parseCSV(rawWellness) : null,
      exam_types: parseCSV(rawExamTypes).length > 0 ? parseCSV(rawExamTypes) : null,
      collection_methods: parseCSV(rawCollectionMethods).length > 0 ? parseCSV(rawCollectionMethods) : null,
    };
    onSubmit(finalData);
  };

  // --- Availability helpers ---
  const availability = data._availability || [];
  const addAvailSlot = () => {
    set("_availability", [...availability, { weekday: 1, start_time: "08:00", end_time: "12:00", consultation_mode: "both", is_active: true, slot_duration_minutes: 30 }]);
  };
  const updateAvailSlot = (idx: number, field: keyof AvailabilitySlot, val: unknown) => {
    set("_availability", availability.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };
  const removeAvailSlot = (idx: number) => {
    set("_availability", availability.filter((_, i) => i !== idx));
  };

  // --- Clinic doctors helpers ---
  const clinicDoctors = data._clinic_doctors || [];
  const addClinicDoctor = () => {
    set("_clinic_doctors", [...clinicDoctors, { name: "", crm: "", crm_state: "ES", specialty: "Clínico Geral", consultation_price: null, availability: [] }]);
  };
  const updateClinicDoctor = (idx: number, field: keyof ClinicDoctor, val: unknown) => {
    set("_clinic_doctors", clinicDoctors.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };
  const removeClinicDoctor = (idx: number) => {
    set("_clinic_doctors", clinicDoctors.filter((_, i) => i !== idx));
  };
  const addDoctorAvailSlot = (docIdx: number) => {
    const doc = clinicDoctors[docIdx];
    updateClinicDoctor(docIdx, "availability", [...doc.availability, { weekday: 1, start_time: "08:00", end_time: "12:00", consultation_mode: "both", is_active: true, slot_duration_minutes: 30 }]);
  };
  const updateDoctorAvailSlot = (docIdx: number, slotIdx: number, field: keyof AvailabilitySlot, val: unknown) => {
    const doc = clinicDoctors[docIdx];
    updateClinicDoctor(docIdx, "availability", doc.availability.map((s, i) => i === slotIdx ? { ...s, [field]: val } : s));
  };
  const removeDoctorAvailSlot = (docIdx: number, slotIdx: number) => {
    const doc = clinicDoctors[docIdx];
    updateClinicDoctor(docIdx, "availability", doc.availability.filter((_, i) => i !== slotIdx));
  };

  // --- Clinic specialties multi-select ---
  const clinicSpecialties = data.specialties_offered || [];
  const toggleClinicSpecialty = (spec: string) => {
    if (clinicSpecialties.includes(spec)) {
      set("specialties_offered", clinicSpecialties.filter(s => s !== spec));
    } else {
      set("specialties_offered", [...clinicSpecialties, spec]);
    }
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
          <Input value={rawServices} onChange={e => setRawServices(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Formas de pagamento (separar por vírgula)</Label>
          <Input value={rawPayments} onChange={e => setRawPayments(e.target.value)} />
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
              <Label>Especialidade *</Label>
              <Select
                value={showOtherSpecialty ? "__other__" : data.specialty}
                onValueChange={v => {
                  if (v === "__other__") {
                    setShowOtherSpecialty(true);
                    set("specialty", "");
                  } else {
                    setShowOtherSpecialty(false);
                    set("specialty", v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {MEDICAL_SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="__other__">Outro...</SelectItem>
                </SelectContent>
              </Select>
              {showOtherSpecialty && (
                <Input className="mt-2" placeholder="Digite a especialidade" value={data.specialty} onChange={e => set("specialty", e.target.value)} />
              )}
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

          {/* Inline availability editor */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Disponibilidade semanal</h4>
              <Button type="button" size="sm" variant="outline" onClick={addAvailSlot}>+ Horário</Button>
            </div>
            {availability.length === 0 && <p className="text-xs text-muted-foreground">Nenhum horário cadastrado.</p>}
            {availability.map((slot, idx) => (
              <AvailabilityRow key={idx} slot={slot} idx={idx} onUpdate={updateAvailSlot} onRemove={removeAvailSlot} />
            ))}
          </div>
        </fieldset>
      )}

      {/* Clinic-specific */}
      {partnerType === "clinic" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🏥 Dados da clínica</legend>
          
          {/* Specialties multi-select */}
          <div className="space-y-2">
            <Label>Especialidades oferecidas</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
              {MEDICAL_SPECIALTIES.map(spec => (
                <label key={spec} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={clinicSpecialties.includes(spec)}
                    onCheckedChange={() => toggleClinicSpecialty(spec)}
                  />
                  {spec}
                </label>
              ))}
            </div>
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

          {/* Pricing model */}
          <div className="space-y-2">
            <Label>Modelo de preço</Label>
            <Select value={data._clinic_pricing_mode || "fixed"} onValueChange={v => set("_clinic_pricing_mode", v as "fixed" | "per_doctor")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Valor único para todos</SelectItem>
                <SelectItem value="per_doctor">Valor por médico</SelectItem>
              </SelectContent>
            </Select>
            {data._clinic_pricing_mode === "fixed" && (
              <div className="space-y-1">
                <Label>Preço da consulta (R$)</Label>
                <Input type="number" step="0.01" value={data.consultation_price ?? ""} onChange={e => set("consultation_price", e.target.value ? Number(e.target.value) : null)} />
              </div>
            )}
          </div>

          {/* Clinic doctors section */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Médicos da clínica</h4>
              <Button type="button" size="sm" variant="outline" onClick={addClinicDoctor}>+ Médico</Button>
            </div>
            {clinicDoctors.length === 0 && <p className="text-xs text-muted-foreground">Nenhum médico cadastrado.</p>}
            {clinicDoctors.map((doc, docIdx) => (
              <div key={docIdx} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Médico {docIdx + 1}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeClinicDoctor(docIdx)}>✕</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={doc.name} onChange={e => updateClinicDoctor(docIdx, "name", e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CRM *</Label>
                    <Input value={doc.crm} onChange={e => updateClinicDoctor(docIdx, "crm", e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">UF CRM</Label>
                    <Select value={doc.crm_state} onValueChange={v => updateClinicDoctor(docIdx, "crm_state", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Especialidade</Label>
                    <Select value={doc.specialty} onValueChange={v => updateClinicDoctor(docIdx, "specialty", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEDICAL_SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {data._clinic_pricing_mode === "per_doctor" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input type="number" step="0.01" value={doc.consultation_price ?? ""} onChange={e => updateClinicDoctor(docIdx, "consultation_price", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                  )}
                </div>
                {/* Doctor availability */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Horários</span>
                    <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => addDoctorAvailSlot(docIdx)}>+ Horário</Button>
                  </div>
                  {doc.availability.map((slot, slotIdx) => (
                    <AvailabilityRow
                      key={slotIdx}
                      slot={slot}
                      idx={slotIdx}
                      onUpdate={(i, f, v) => updateDoctorAvailSlot(docIdx, i, f, v)}
                      onRemove={(i) => removeDoctorAvailSlot(docIdx, i)}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {/* Gym-specific */}
      {partnerType === "gym" && (
        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="text-sm font-semibold text-foreground mb-2">🏋️ Dados da academia</legend>
          <div className="space-y-1">
            <Label>Atividades de bem-estar (separar por vírgula)</Label>
            <Input value={rawWellness} onChange={e => setRawWellness(e.target.value)} />
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
            <Input value={rawExamTypes} onChange={e => setRawExamTypes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Métodos de coleta (separar por vírgula)</Label>
            <Input value={rawCollectionMethods} onChange={e => setRawCollectionMethods(e.target.value)} />
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
            <Label>URL da loja virtual</Label>
            <Input value={data.virtual_store_url} onChange={e => set("virtual_store_url", e.target.value)} placeholder="https://loja.farmacia.com.br" />
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
              <Select
                value={data.approval_status}
                onValueChange={v => {
                  const status = v as ApprovalStatus;
                  set("approval_status", status);
                  if (status === "approved") set("active", true);
                  if (status === "blocked") set("active", false);
                }}
              >
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

// --- Reusable availability row ---
function AvailabilityRow({ slot, idx, onUpdate, onRemove, compact }: {
  slot: AvailabilitySlot;
  idx: number;
  onUpdate: (idx: number, field: keyof AvailabilitySlot, val: unknown) => void;
  onRemove: (idx: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`border border-border rounded-lg p-3 flex flex-wrap items-end gap-2 ${compact ? "bg-muted/30" : ""}`}>
      <div className="space-y-1 w-28">
        <Label className="text-xs">Dia</Label>
        <Select value={String(slot.weekday)} onValueChange={v => onUpdate(idx, "weekday", Number(v))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1 w-24">
        <Label className="text-xs">Início</Label>
        <Input className="h-8 text-xs" type="time" value={slot.start_time} onChange={e => onUpdate(idx, "start_time", e.target.value)} />
      </div>
      <div className="space-y-1 w-24">
        <Label className="text-xs">Fim</Label>
        <Input className="h-8 text-xs" type="time" value={slot.end_time} onChange={e => onUpdate(idx, "end_time", e.target.value)} />
      </div>
      <div className="space-y-1 w-28">
        <Label className="text-xs">Modo</Label>
        <Select value={slot.consultation_mode} onValueChange={v => onUpdate(idx, "consultation_mode", v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="presencial">Presencial</SelectItem>
            <SelectItem value="both">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onRemove(idx)}>✕</Button>
    </div>
  );
}
