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
  email?: string;
}

interface Props {
  companyId: string;
  companyName: string;
  open: boolean;
  onClose: () => void;
}

export function CompanyUsersModal({ companyId, companyName, open, onClose }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", cpf: "", phone: "", email: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, cpf, phone")
      .eq("company_id", companyId)
      .order("full_name");

    const profileList = (data || []) as Profile[];
    setProfiles(profileList);

    // Load emails via edge function
    if (profileList.length > 0) {
      const { data: emailData } = await supabase.functions.invoke("manage-user", {
        body: { action: "list_emails" },
      });
      if (emailData?.emails) setEmails(emailData.emails);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

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
      body: {
        action: "update",
        user_id: editingUser.user_id,
        updates: { full_name: editForm.full_name, cpf: editForm.cpf, phone: editForm.phone },
      },
    });
    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar usuário.", variant: "destructive" });
      return;
    }

    // Update email if changed
    const currentEmail = emails[editingUser.user_id] || "";
    if (editForm.email && editForm.email !== currentEmail) {
      const { error: emailErr } = await supabase.functions.invoke("manage-user", {
        body: { action: "update_email", user_id: editingUser.user_id, updates: { email: editForm.email } },
      });
      if (emailErr) {
        toast({ title: "Erro ao atualizar e-mail", variant: "destructive" });
      }
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
    if (error) {
      toast({ title: "Erro", description: "Falha ao remover.", variant: "destructive" });
    } else {
      toast({ title: "Usuário removido" });
      load();
    }
  };

  const handleResetPassword = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-user", {
      body: { action: "reset_password", user_id: userId },
    });
    if (error || !data?.temporary_password) {
      toast({ title: "Erro ao resetar senha", variant: "destructive" });
    } else {
      toast({ title: "Senha resetada", description: `Nova senha temporária: ${data.temporary_password}` });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>👥 Usuários — {companyName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : profiles.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum usuário vinculado a esta empresa.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">{profiles.length} usuário(s)</p>
            {profiles.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.full_name || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">
                    {emails[p.user_id] || "..."} {p.cpf && `· CPF: ${p.cpf}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => startEdit(p)}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleResetPassword(p.user_id)}>🔑</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p.user_id)}>✕</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit sub-dialog */}
        {editingUser && (
          <div className="border-t border-border pt-4 mt-4 space-y-3">
            <h4 className="font-semibold text-foreground">Editar usuário</h4>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
