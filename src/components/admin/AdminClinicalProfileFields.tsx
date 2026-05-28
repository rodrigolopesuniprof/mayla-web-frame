import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Field {
  id?: string;
  company_id: string | null;
  field_key: string;
  label: string;
  section: "saude" | "endereco" | "familia";
  sort_order: number;
  visible: boolean;
}

const SECTION_LABEL: Record<string, string> = {
  saude: "Saúde",
  endereco: "Endereço",
  familia: "Família",
};

interface Props { companyId: string }

export function AdminClinicalProfileFields({ companyId }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: own } = await supabase
      .from("clinical_profile_field_config" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("section")
      .order("sort_order");
    let list = (own as any[]) || [];
    if (list.length > 0) {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      const { data: glob } = await supabase
        .from("clinical_profile_field_config" as any)
        .select("*")
        .is("company_id", null)
        .order("section")
        .order("sort_order");
      list = (glob as any[]) || [];
    }
    setFields(list as Field[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const cloneToCompany = async () => {
    if (!confirm("Copiar a configuração padrão para esta empresa? Você poderá editá-la.")) return;
    const rows = fields.map((f) => ({
      company_id: companyId,
      field_key: f.field_key,
      label: f.label,
      section: f.section,
      sort_order: f.sort_order,
      visible: f.visible,
    }));
    const { error } = await supabase.from("clinical_profile_field_config" as any).insert(rows as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Configuração personalizada criada" }); load(); }
  };

  const updateLocal = (idx: number, patch: Partial<Field>) => {
    setFields((arr) => arr.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const saveAll = async () => {
    if (!isCustom) return;
    setSaving(true);
    for (const f of fields) {
      if (!f.id) continue;
      const { error } = await supabase
        .from("clinical_profile_field_config" as any)
        .update({ label: f.label, visible: f.visible, sort_order: f.sort_order })
        .eq("id", f.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast({ title: "Configuração salva" });
    load();
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  const grouped = (["saude", "endereco", "familia"] as const).map((sec) => ({
    section: sec,
    items: fields.filter((f) => f.section === sec),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Controle quais campos clínicos aparecem no Perfil do colaborador, com rótulos personalizados.
        </p>
        {!isCustom ? (
          <Button size="sm" onClick={cloneToCompany}>Personalizar para empresa</Button>
        ) : (
          <Button size="sm" onClick={saveAll} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        )}
      </div>

      {!isCustom && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          Esta empresa está usando a configuração padrão. Clique em "Personalizar" para editar.
        </div>
      )}

      {grouped.map(({ section, items }) => (
        <Card key={section}>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              {SECTION_LABEL[section]}
            </h3>
            {items.map((f) => {
              const idx = fields.findIndex((x) => x.field_key === f.field_key && x.section === f.section);
              return (
                <div key={f.field_key} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Input
                    className="h-8 w-14 text-xs"
                    type="number"
                    value={f.sort_order}
                    disabled={!isCustom}
                    onChange={(e) => updateLocal(idx, { sort_order: Number(e.target.value) || 0 })}
                  />
                  <Input
                    className="h-8 flex-1 text-sm"
                    value={f.label}
                    disabled={!isCustom}
                    onChange={(e) => updateLocal(idx, { label: e.target.value })}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground w-32 truncate" title={f.field_key}>
                    {f.field_key}
                  </span>
                  <Switch
                    checked={f.visible}
                    disabled={!isCustom}
                    onCheckedChange={(v) => updateLocal(idx, { visible: v })}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
