import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  company_id: string | null;
  level: string;
  points: number;
  health_survey_completed: boolean | null;
  esf_team_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface SupportNote {
  id: string;
  note: string;
  created_at: string;
  admin_user_id: string;
}

interface EngagementData {
  totalMeasurements: number;
  lastMeasurement: string | null;
  missionsCompleted: number;
  missionsPending: number;
  appointmentsCount: number;
}

interface AdminUsersProps {
  companyId?: string;
  companyName?: string;
}

export function AdminUsers({ companyId, companyName }: AdminUsersProps = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>(companyId || "");
  const [loading, setLoading] = useState(true);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addCpf, setAddCpf] = useState("");
  const [addCompanyId, setAddCompanyId] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // CSV
  const [showCsv, setShowCsv] = useState(false);
  const [csvCompanyId, setCsvCompanyId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<any>(null);

  // Edit user
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete user
  const [deleteProfile, setDeleteProfile] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password
  const [resetProfile, setResetProfile] = useState<Profile | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Support notes
  const [noteProfile, setNoteProfile] = useState<Profile | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteHistory, setNoteHistory] = useState<SupportNote[]>([]);
  const [noteLoading, setNoteLoading] = useState(false);

  // Engagement dialog
  const [engageProfile, setEngageProfile] = useState<Profile | null>(null);
  const [engageData, setEngageData] = useState<EngagementData | null>(null);
  const [engageLoading, setEngageLoading] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("profiles").select("*").order("full_name");
    if (filterCompany) query = query.eq("company_id", filterCompany);
    const { data } = await query;
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  }, [filterCompany]);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    if (data) setCompanies(data as Company[]);
  }, []);

  const loadEmails = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke("manage-user", {
        body: { action: "list_emails" },
      });
      if (res.data?.emails) setEmailMap(res.data.emails);
    } catch {}
  }, []);

  useEffect(() => { loadCompanies(); loadEmails(); }, [loadCompanies, loadEmails]);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const email = (emailMap[p.user_id] || "").toLowerCase();
    return (
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.cpf || "").includes(q) ||
      email.includes(q)
    );
  });

  const getCompanyName = (id: string | null) => {
    if (!id) return "—";
    return companies.find((c) => c.id === id)?.name || "—";
  };

  // --- Add user ---
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCompanyId) {
      toast({ title: "Selecione uma empresa", variant: "destructive" });
      return;
    }
    setAddSaving(true);
    try {
      const res = await supabase.functions.invoke("import-users", {
        body: {
          users: [{ name: addName, email: addEmail, cpf: addCpf }],
          company_id: addCompanyId,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.created > 0) {
        toast({ title: "Usuário criado e vinculado!" });
        setAddName(""); setAddEmail(""); setAddCpf("");
        setShowAddForm(false);
        loadProfiles();
      } else {
        toast({ title: "Falha", description: res.data?.details?.[0]?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setAddSaving(false);
  };

  // --- CSV import ---
  const handleCsvImport = async () => {
    if (!csvFile || !csvCompanyId) {
      toast({ title: "Selecione um arquivo CSV e uma empresa", variant: "destructive" });
      return;
    }
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast({ title: "CSV vazio ou sem dados", variant: "destructive" });
        setCsvImporting(false);
        return;
      }
      const header = lines[0].toLowerCase().split(/[;,]/).map((h) => h.trim());
      const nameIdx = header.findIndex((h) => h.includes("nome") || h === "name");
      const emailIdx = header.findIndex((h) => h.includes("email") || h === "e-mail");
      const cpfIdx = header.findIndex((h) => h.includes("cpf"));
      if (emailIdx === -1) {
        toast({ title: "Coluna 'email' não encontrada no CSV", variant: "destructive" });
        setCsvImporting(false);
        return;
      }
      const users = lines.slice(1).map((line) => {
        const cols = line.split(/[;,]/).map((c) => c.trim());
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
          email: cols[emailIdx] || "",
          cpf: cpfIdx >= 0 ? cols[cpfIdx] || "" : "",
        };
      }).filter((u) => u.email);
      if (users.length === 0) {
        toast({ title: "Nenhum usuário válido no CSV", variant: "destructive" });
        setCsvImporting(false);
        return;
      }
      let allResults: any[] = [];
      for (let i = 0; i < users.length; i += 20) {
        const batch = users.slice(i, i + 20);
        const res = await supabase.functions.invoke("import-users", {
          body: { users: batch, company_id: csvCompanyId },
        });
        if (res.data?.details) allResults = allResults.concat(res.data.details);
      }
      const successCount = allResults.filter((r) => r.success).length;
      const failCount = allResults.filter((r) => !r.success).length;
      setCsvResult({ total: allResults.length, created: successCount, failed: failCount, details: allResults });
      toast({ title: `Importação concluída: ${successCount} ok, ${failCount} falhas` });
      loadProfiles();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    }
    setCsvImporting(false);
  };

  // --- Edit user ---
  const openEdit = (p: Profile) => {
    setEditProfile(p);
    setEditName(p.full_name || "");
    setEditEmail(emailMap[p.user_id] || "");
    setEditCpf(p.cpf || "");
    setEditPhone(p.phone || "");
    setEditCompanyId(p.company_id || "");
  };

  const handleEditSave = async () => {
    if (!editProfile) return;
    setEditSaving(true);
    try {
      const res = await supabase.functions.invoke("manage-user", {
        body: {
          action: "update",
          user_id: editProfile.user_id,
          updates: {
            full_name: editName,
            cpf: editCpf,
            phone: editPhone,
            company_id: editCompanyId,
          },
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      const currentEmail = emailMap[editProfile.user_id] || "";
      if (editEmail && editEmail !== currentEmail) {
        const emailRes = await supabase.functions.invoke("manage-user", {
          body: {
            action: "update_email",
            user_id: editProfile.user_id,
            updates: { email: editEmail },
          },
        });
        if (emailRes.error) throw emailRes.error;
        if (emailRes.data?.error) throw new Error(emailRes.data.error);
        setEmailMap((prev) => ({ ...prev, [editProfile.user_id]: editEmail }));
      }

      toast({ title: "Usuário atualizado!" });
      setEditProfile(null);
      loadProfiles();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setEditSaving(false);
  };

  // --- Delete user ---
  const handleDelete = async () => {
    if (!deleteProfile) return;
    setDeleting(true);
    try {
      const res = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", user_id: deleteProfile.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Usuário excluído" });
      setDeleteProfile(null);
      loadProfiles();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  // --- Reset password ---
  const handleResetPassword = async () => {
    if (!resetProfile) return;
    setResetting(true);
    setTempPassword(null);
    try {
      const res = await supabase.functions.invoke("manage-user", {
        body: { action: "reset_password", user_id: resetProfile.user_id },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      setTempPassword(res.data.temporary_password);
      toast({ title: "Senha redefinida com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setResetting(false);
  };

  // --- Support notes ---
  const openNoteDialog = async (p: Profile) => {
    setNoteProfile(p);
    setNoteText("");
    setNoteLoading(true);
    const { data } = await supabase
      .from("support_notes")
      .select("*")
      .eq("user_id", p.user_id)
      .order("created_at", { ascending: false });
    setNoteHistory((data as SupportNote[]) || []);
    setNoteLoading(false);
  };

  const handleSaveNote = async () => {
    if (!noteProfile || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("support_notes").insert({
        user_id: noteProfile.user_id,
        admin_user_id: user.id,
        note: noteText.trim(),
      });
      if (error) throw error;
      toast({ title: "Atendimento registrado!" });
      setNoteText("");
      const { data } = await supabase
        .from("support_notes")
        .select("*")
        .eq("user_id", noteProfile.user_id)
        .order("created_at", { ascending: false });
      setNoteHistory((data as SupportNote[]) || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setNoteSaving(false);
  };

  const openEngagement = async (p: Profile) => {
    setEngageProfile(p);
    setEngageData(null);
    setEngageLoading(true);
    try {
      const [measRes, missionsRes, apptRes] = await Promise.all([
        supabase.from("health_measurements").select("id, measured_at").eq("user_id", p.user_id).order("measured_at", { ascending: false }),
        supabase.from("user_missions").select("id, status").eq("user_id", p.user_id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", p.user_id),
      ]);
      const meas = measRes.data || [];
      const missions = missionsRes.data || [];
      setEngageData({
        totalMeasurements: meas.length,
        lastMeasurement: meas.length > 0 ? meas[0].measured_at : null,
        missionsCompleted: missions.filter(m => m.status === "completed").length,
        missionsPending: missions.filter(m => m.status === "pending").length,
        appointmentsCount: apptRes.count || 0,
      });
    } catch (err) {
      console.error("Engagement load error:", err);
    }
    setEngageLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl text-foreground">Usuários ({profiles.length})</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setShowCsv(false); }}>
            + Cadastrar usuário
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowCsv(!showCsv); setShowAddForm(false); }}>
            📄 Importar CSV
          </Button>
        </div>
      </div>

      {/* Add individual user */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Cadastrar Usuário
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="email@exemplo.com" required />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={addCpf} onChange={(e) => setAddCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <select value={addCompanyId} onChange={(e) => setAddCompanyId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                  <option value="">Selecione...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={addSaving}>{addSaving ? "Criando..." : "Criar e vincular"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* CSV import */}
      {showCsv && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Importar via CSV
              <Button variant="ghost" size="sm" onClick={() => { setShowCsv(false); setCsvResult(null); }}>✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              O CSV deve ter colunas: <strong>nome</strong>, <strong>email</strong>, <strong>cpf</strong> (separados por vírgula ou ponto-e-vírgula).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <select value={csvCompanyId} onChange={(e) => setCsvCompanyId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required>
                  <option value="">Selecione...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Arquivo CSV</Label>
                <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCsvImport} disabled={csvImporting || !csvFile || !csvCompanyId}>
                  {csvImporting ? "Importando..." : "Importar"}
                </Button>
              </div>
            </div>
            {csvResult && (
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-sm font-semibold text-foreground mb-2">
                  Resultado: {csvResult.created} criados, {csvResult.failed} falhas ({csvResult.total} total)
                </p>
                <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                  {csvResult.details?.map((d: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 ${d.success ? "text-foreground" : "text-destructive"}`}>
                      <span>{d.success ? "✅" : "❌"}</span>
                      <span>{d.email}</span>
                      {d.error && <span className="text-muted-foreground">— {d.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input placeholder="Buscar por nome, CPF ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">Todas as empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nome</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">E-mail</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CPF</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Telefone</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Empresa</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Info</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando...</td></tr>
                ) : filteredProfiles.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum usuário encontrado.</td></tr>
                ) : (
                  filteredProfiles.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-3 text-sm text-foreground">{p.full_name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{emailMap[p.user_id] || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{p.cpf || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.phone || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getCompanyName(p.company_id)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{p.level} · {p.points} pts</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(p)}>
                            ✏️ Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEngagement(p)}>
                            📊 Engajamento
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openNoteDialog(p)}>
                            📝 Atendimento
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setResetProfile(p); setTempPassword(null); }}>
                            🔑 Senha
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteProfile(p)}>
                            🗑️ Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editProfile} onOpenChange={(open) => { if (!open) setEditProfile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <select value={editCompanyId} onChange={(e) => setEditCompanyId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sem empresa</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfile(null)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Support Notes Dialog */}
      <Dialog open={!!noteProfile} onOpenChange={(open) => { if (!open) setNoteProfile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atendimento — {noteProfile?.full_name || "Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova observação</Label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Descreva o atendimento realizado..."
                rows={3}
              />
              <Button size="sm" onClick={handleSaveNote} disabled={noteSaving || !noteText.trim()}>
                {noteSaving ? "Salvando..." : "Registrar"}
              </Button>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase">Histórico</Label>
              {noteLoading ? (
                <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
              ) : noteHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">Nenhum registro de atendimento.</p>
              ) : (
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                  {noteHistory.map((n) => (
                    <div key={n.id} className="bg-secondary rounded-lg p-3">
                      <p className="text-sm text-foreground">{n.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProfile} onOpenChange={(open) => { if (!open) setDeleteProfile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteProfile?.full_name || "este usuário"}</strong>? Esta ação não pode ser desfeita. O usuário, perfil e dados associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetProfile} onOpenChange={(open) => { if (!open) { setResetProfile(null); setTempPassword(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          {!tempPassword ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Gerar uma senha provisória para <strong>{resetProfile?.full_name || "este usuário"}</strong>?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                A senha atual será substituída. Copie a nova senha e envie ao usuário.
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setResetProfile(null)}>Cancelar</Button>
                <Button onClick={handleResetPassword} disabled={resetting}>
                  {resetting ? "Gerando..." : "Gerar senha provisória"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-3">Senha provisória gerada com sucesso! Copie e envie ao usuário:</p>
              <div className="flex items-center gap-2 bg-secondary rounded-lg p-3">
                <code className="text-lg font-mono font-bold text-foreground flex-1 select-all">{tempPassword}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast({ title: "Senha copiada!" });
                  }}
                >
                  📋 Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">O usuário deverá trocar a senha no primeiro acesso.</p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => { setResetProfile(null); setTempPassword(null); }}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Engagement Dialog */}
      <Dialog open={!!engageProfile} onOpenChange={(open) => { if (!open) setEngageProfile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>📊 Engajamento — {engageProfile?.full_name || "Usuário"}</DialogTitle>
          </DialogHeader>
          {engageLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando dados...</p>
          ) : engageData && engageProfile ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">🏅</div>
                  <div className="font-display text-xl font-bold text-foreground">{engageProfile.points}</div>
                  <div className="text-[11px] text-muted-foreground">Pontos · {engageProfile.level}</div>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">❤️</div>
                  <div className="font-display text-xl font-bold text-foreground">{engageData.totalMeasurements}</div>
                  <div className="text-[11px] text-muted-foreground">Medições rPPG</div>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">🎯</div>
                  <div className="font-display text-xl font-bold text-foreground">{engageData.missionsCompleted}</div>
                  <div className="text-[11px] text-muted-foreground">Missões completas</div>
                </div>
                <div className="bg-secondary rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="font-display text-xl font-bold text-foreground">{engageData.appointmentsCount}</div>
                  <div className="text-[11px] text-muted-foreground">Consultas agendadas</div>
                </div>
              </div>

              <div className="space-y-2">
                <DetailRow label="Questionário de saúde" value={engageProfile.health_survey_completed ? "✅ Completo" : "❌ Pendente"} />
                <DetailRow label="ESF vinculada" value={engageProfile.esf_team_id ? "✅ Sim" : "❌ Não"} />
                <DetailRow label="Missões pendentes" value={String(engageData.missionsPending)} />
                <DetailRow label="Última medição rPPG" value={engageData.lastMeasurement ? new Date(engageData.lastMeasurement).toLocaleDateString("pt-BR") : "Nenhuma"} />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-lg">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
