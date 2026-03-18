import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Key, Trash2, Copy, Eye, EyeOff } from "lucide-react";

interface Props {
  companyId: string;
}

export function CompanyAdminManager({ companyId }: Props) {
  const [existingAdmin, setExistingAdmin] = useState<{ user_id: string; email: string; full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form for creating new admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const loadAdmin = async () => {
    setLoading(true);
    try {
      // Find profiles with company_id that have company_admin role
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("company_id", companyId);

      if (!profiles?.length) { setExistingAdmin(null); setLoading(false); return; }

      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "company_admin")
        .in("user_id", userIds);

      if (!roles?.length) { setExistingAdmin(null); setLoading(false); return; }

      const adminUserId = roles[0].user_id;
      const adminProfile = profiles.find(p => p.user_id === adminUserId);

      // Get email via edge function
      const { data: session } = await supabase.auth.getSession();
      const { data: emailData } = await supabase.functions.invoke("manage-user", {
        body: { action: "list_emails" },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });

      const adminEmail = emailData?.emails?.[adminUserId] || "—";
      setExistingAdmin({ user_id: adminUserId, email: adminEmail, full_name: adminProfile?.full_name || "" });
    } catch {
      setExistingAdmin(null);
    }
    setLoading(false);
  };

  useEffect(() => { loadAdmin(); }, [companyId]);

  const handleCreate = async () => {
    if (!email || !password) {
      toast({ title: "Preencha e-mail e senha", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "create_company_admin", email, password, company_id: companyId, full_name: fullName },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Admin criado com sucesso!" });
      setTempPassword(password);
      setEmail("");
      setPassword("");
      setFullName("");
      await loadAdmin();
    } catch (err: any) {
      toast({ title: "Erro ao criar admin", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!existingAdmin) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "reset_password", user_id: existingAdmin.user_id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setTempPassword(data.temporary_password);
      setShowPassword(true);
      toast({ title: "Senha resetada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!existingAdmin || !confirm("Remover o administrador desta empresa? O usuário será excluído.")) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", user_id: existingAdmin.user_id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Admin removido" });
      setExistingAdmin(null);
      setTempPassword(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">👤 Administrador da Empresa</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Carregando...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">👤 Administrador da Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {existingAdmin ? (
          <>
            <div className="bg-secondary rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{existingAdmin.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{existingAdmin.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(existingAdmin.email, "E-mail")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {tempPassword && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">🔑 Senha temporária</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded flex-1">
                    {showPassword ? tempPassword : "••••••••••"}
                  </code>
                  <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(tempPassword, "Senha")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleResetPassword}>
                <Key className="h-3.5 w-3.5 mr-1" /> Resetar senha
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover admin
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Nenhum administrador vinculado. Crie um para dar acesso ao painel da empresa.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Maria Silva" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com" required />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Senha *</Label>
                <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="SenhaSegura@2024" required />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} size="sm">
              <UserPlus className="h-3.5 w-3.5 mr-1" /> {creating ? "Criando..." : "Criar administrador"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
