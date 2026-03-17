import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PartnerForm, type PartnerData, type PartnerType } from "./PartnerForm";
import { PartnerLocationsEditor } from "./PartnerLocationsEditor";
import { DoctorAvailabilityEditor } from "./DoctorAvailabilityEditor";
import { PartnerCsvImport } from "./PartnerCsvImport";
import { buildPrimaryPartnerLocation } from "@/lib/partner-location-utils";

const TABS: { id: PartnerType; label: string; emoji: string }[] = [
  { id: "doctor", label: "Médicos", emoji: "🩺" },
  { id: "clinic", label: "Clínicas", emoji: "🏥" },
  { id: "gym", label: "Academias", emoji: "🏋️" },
  { id: "laboratory", label: "Laboratórios", emoji: "🔬" },
  { id: "pharmacy", label: "Farmácias", emoji: "💊" },
];

const APPROVAL_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  blocked: "bg-red-100 text-red-800",
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  blocked: "Bloqueado",
};

export function AdminPartners() {
  const [activeType, setActiveType] = useState<PartnerType>("doctor");
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<any | null>(null);
  const [detailPartner, setDetailPartner] = useState<any | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPartners();
  }, [activeType]);

  const loadPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("partners")
      .select("*")
      .eq("partner_type", activeType)
      .order("created_at", { ascending: false });
    setPartners(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: PartnerData) => {
    setSaving(true);
    const { id, google_maps_url, _availability, _clinic_doctors, _clinic_pricing_mode, ...rest } = formData;
    const payload = {
      ...rest,
      services_offered: rest.services_offered?.length ? rest.services_offered : [],
      accepted_payments: rest.accepted_payments?.length ? rest.accepted_payments : [],
    } as any;

    if (editPartner?.id) {
      const { error } = await supabase.from("partners").update(payload).eq("id", editPartner.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        const mainLocation = buildPrimaryPartnerLocation(editPartner.id, {
          name: formData.name,
          full_address: formData.full_address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          latitude: formData.latitude,
          longitude: formData.longitude,
          _google_maps_url: google_maps_url,
        });
        const { data: existingMain } = await supabase
          .from("partner_locations")
          .select("id")
          .eq("partner_id", editPartner.id)
          .eq("is_main", true)
          .maybeSingle();

        if (existingMain?.id) {
          await supabase.from("partner_locations").update(mainLocation as any).eq("id", existingMain.id);
        } else {
          await supabase.from("partner_locations").insert(mainLocation as any);
        }
        toast({ title: "Parceiro atualizado" });
      }
    } else {
      const { data: createdPartner, error } = await supabase.from("partners").insert(payload).select("id").single();
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      } else if (createdPartner?.id) {
        await supabase.from("partner_locations").insert(
          buildPrimaryPartnerLocation(createdPartner.id, {
            name: formData.name,
            full_address: formData.full_address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            latitude: formData.latitude,
            longitude: formData.longitude,
            _google_maps_url: google_maps_url,
          }) as any
        );
        toast({ title: "Parceiro criado" });
      }
    }
    setSaving(false);
    setFormOpen(false);
    setEditPartner(null);
    loadPartners();
  };

  const quickAction = async (id: string, field: string, value: unknown) => {
    const patch: Record<string, unknown> =
      field === "approval_status"
        ? {
            approval_status: value as "pending" | "approved" | "blocked",
            ...((value as string) === "approved" ? { active: true } : {}),
            ...((value as string) === "blocked" ? { active: false } : {}),
          }
        : { [field]: value };

    await supabase.from("partners").update(patch as any).eq("id", id);
    toast({ title: "Atualizado" });
    loadPartners();
  };

  const openCreate = () => {
    setEditPartner(null);
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setEditPartner(p);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl text-foreground">Parceiros</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Marketplace de saúde e bem-estar
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border-none cursor-pointer whitespace-nowrap ${
              activeType === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{partners.length} {TABS.find(t => t.id === activeType)?.label?.toLowerCase()}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>📥 Importar CSV</Button>
          <Button size="sm" onClick={openCreate}>+ Novo</Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : partners.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 p-10 text-center">
          <div className="text-5xl mb-3">{TABS.find(t => t.id === activeType)?.emoji}</div>
          <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado nesta categoria.</p>
          <Button className="mt-4" size="sm" onClick={openCreate}>Cadastrar primeiro</Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {activeType === "doctor" && <TableHead>CRM</TableHead>}
                {activeType === "doctor" && <TableHead>Especialidade</TableHead>}
                <TableHead>Cidade</TableHead>
                <TableHead>Aprovação</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  {activeType === "doctor" && <TableCell className="text-xs">{p.crm} {p.crm_state && `/ ${p.crm_state}`}</TableCell>}
                  {activeType === "doctor" && <TableCell className="text-xs">{p.specialty || "—"}</TableCell>}
                  <TableCell className="text-xs">{p.city || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${APPROVAL_COLORS[p.approval_status]}`}>
                      {APPROVAL_LABELS[p.approval_status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                      {p.active ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setDetailPartner(p)}>👁</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>✏️</Button>
                      {p.approval_status !== "approved" && (
                        <Button variant="ghost" size="sm" onClick={() => quickAction(p.id, "approval_status", "approved")}>✅</Button>
                      )}
                      {p.approval_status !== "blocked" && (
                        <Button variant="ghost" size="sm" onClick={() => quickAction(p.id, "approval_status", "blocked")}>🚫</Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => quickAction(p.id, "active", !p.active)}
                      >
                        {p.active ? "⏸" : "▶️"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) { setFormOpen(false); setEditPartner(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editPartner ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
          </DialogHeader>
          <PartnerForm
            partnerType={activeType}
            initialData={editPartner || undefined}
            onSubmit={handleSave}
            onCancel={() => { setFormOpen(false); setEditPartner(null); }}
            loading={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailPartner} onOpenChange={v => { if (!v) setDetailPartner(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes: {detailPartner?.name}</DialogTitle>
          </DialogHeader>
          {detailPartner && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> {detailPartner.email || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {detailPartner.phone || "—"}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {detailPartner.city || "—"}</div>
                <div><span className="text-muted-foreground">Estado:</span> {detailPartner.state || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {detailPartner.full_address || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> {detailPartner.description || "—"}</div>
                {activeType === "doctor" && (
                  <>
                    <div><span className="text-muted-foreground">CRM:</span> {detailPartner.crm} / {detailPartner.crm_state}</div>
                    <div><span className="text-muted-foreground">Especialidade:</span> {detailPartner.specialty || "—"}</div>
                    <div><span className="text-muted-foreground">Consulta:</span> {detailPartner.consultation_type}</div>
                    <div><span className="text-muted-foreground">Preço:</span> {detailPartner.consultation_price ? `R$ ${detailPartner.consultation_price}` : "—"}</div>
                  </>
                )}
              </div>

              <PartnerLocationsEditor partnerId={detailPartner.id} />
              {(activeType === "doctor" || activeType === "clinic") && (
                <DoctorAvailabilityEditor partnerId={detailPartner.id} partnerType={activeType} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar CSV — {TABS.find(t => t.id === activeType)?.label}</DialogTitle>
          </DialogHeader>
          <PartnerCsvImport partnerType={activeType} onDone={() => { setCsvOpen(false); loadPartners(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
