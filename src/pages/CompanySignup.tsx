import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface CompanyInfo {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
}

export default function CompanySignup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }

    const validate = async () => {
      const { data: tokenData } = await supabase
        .from("company_invite_tokens")
        .select("company_id, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (!tokenData) { setInvalid(true); setLoading(false); return; }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        setInvalid(true); setLoading(false); return;
      }

      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, logo_url, primary_color, background_color")
        .eq("id", tokenData.company_id)
        .single();

      if (!companyData) { setInvalid(true); setLoading(false); return; }

      setCompany(companyData as CompanyInfo);
      setLoading(false);
    };
    validate();
  }, [token]);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    const rawCpf = cpf.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe os 11 dígitos do CPF.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, cpf: rawCpf, company_id: company.id },
        emailRedirectTo: window.location.origin,
      },
    });
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
      navigate("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Validando link...</p>
      </div>
    );
  }

  if (invalid || !company) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center px-6">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Link inválido ou expirado</h1>
          <p className="text-muted-foreground mb-6">
            O link de cadastro não é válido. Solicite um novo link ao administrador da sua empresa.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")}>Ir para login</Button>
        </div>
      </div>
    );
  }

  const primaryHsl = company.primary_color;
  const bgHsl = company.background_color;

  return (
    <div className="flex items-center justify-center min-h-screen p-4" style={{ backgroundColor: `hsl(${bgHsl})` }}>
      <div className="w-full max-w-[400px] mx-auto">
        <div className="flex flex-col items-center mb-8">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="h-16 mb-4 object-contain" />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: `hsl(${primaryHsl})` }}
            >
              {company.name.charAt(0)}
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-foreground">{company.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie sua conta para acessar o programa de bem-estar</p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Maria Aparecida" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" required maxLength={14} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>
          <Button type="submit" disabled={saving} className="w-full mt-2" style={{ backgroundColor: `hsl(${primaryHsl})` }}>
            {saving ? "Cadastrando..." : "Criar conta"}
          </Button>
        </form>

        <div className="text-center mt-6">
          <button onClick={() => navigate("/login")} className="text-sm text-primary hover:underline bg-transparent border-none cursor-pointer">
            Já tem conta? Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
