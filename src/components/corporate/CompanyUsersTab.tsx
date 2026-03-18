import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Profile {
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
}

interface Props {
  companyId: string;
  primaryColor: string;
}

export function CompanyUsersTab({ companyId, primaryColor }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", cpf: "", phone: "", email: "" });
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, cpf, phone")
      .eq("company_id", companyId)
      .order("full_name");

    const profileList = (data || []) as Profile[];
    setProfiles(profileList);

    if (profileList.length > 0) {
      const { data: emailData } = await supabase.functions.invoke("manage-user", {
        body: { action: "list_emails" },
      });
      if (emailData?.emails) setEmails(emailData.emails);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p: Profile) => {
    setEditingUser(p);
    setEditForm({
      full_name: p.full_name || "",
      cpf: p.cpf || "",
      phone: p.phone || "",
      email: emails[p.user_id] || "",
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    const { error } = await supabase.functions.invoke("manage-user", {
      body: { action: "update", user_id: editingUser.user_id, updates: { full_name: editForm.full_name, cpf: editForm.cpf, phone: editForm.phone } },
    });
    if (error) { toast({ title: "Erro ao atualizar", variant: "destructive" }); return; }

    const currentEmail = emails[editingUser.user_id] || "";
    if (editForm.email && editForm.email !== currentEmail) {
      await supabase.functions.invoke("manage-user", {
        body: { action: "update_email", user_id: editingUser.user_id, updates: { email: editForm.email } },
      });
    }

    toast({ title: "Usuário atualizado!" });
    setEditingUser(null);
    load();
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;
    const { error } = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", user_id: userId },
    });
    if (error) { toast({ title: "Erro ao remover", variant: "destructive" }); }
    else { toast({ title: "Usuário removido" }); load(); }
  };

  const handleResetPassword = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-user", {
      body: { action: "reset_password", user_id: userId },
    });
    if (error || !data?.temporary_password) {
      toast({ title: "Erro ao resetar senha", variant: "destructive" });
    } else {
      toast({ title: "Senha resetada", description: `Senha temporária: ${data.temporary_password}` });
    }
  };

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(q)) || (p.cpf?.includes(q)) || (emails[p.user_id]?.toLowerCase().includes(q));
  });

  if (loading) {
    return <p className="text-muted-foreground text-center py-12">Carregando usuários...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{profiles.length} usuário(s) cadastrado(s)</p>
        <Input
          placeholder="Buscar por nome, CPF ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {profiles.length === 0 ? "Nenhum usuário vinculado." : "Nenhum resultado encontrado."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.user_id} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{p.full_name || "Sem nome"}</div>
                <div className="text-xs text-muted-foreground">
                  {emails[p.user_id] || "..."} {p.cpf && `· CPF: ${p.cpf}`}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => startEdit(p)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => handleResetPassword(p.user_id)} title="Resetar senha">🔑</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(p.user_id)}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingUser} onOpenChange={v => !v && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input value={editForm.cpf} onChange={e => setEditForm({ ...editForm, cpf: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>Salvar</Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
