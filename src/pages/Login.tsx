import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Mode = "login" | "signup" | "forgot";

interface CompanyOption {
  id: string;
  name: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [cpf, setCpf] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  useEffect(() => {
    const loadCompanies = async () => {
      // Load from both companies and municipalities for backward compat
      const [companiesRes, munisRes] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("municipalities").select("id, name").order("name"),
      ]);
      const all: CompanyOption[] = [];
      if (companiesRes.data) all.push(...companiesRes.data);
      if (munisRes.data) {
        munisRes.data.forEach((m) => {
          if (!all.find((c) => c.id === m.id)) all.push(m);
        });
      }
      all.sort((a, b) => a.name.localeCompare(b.name));
      setCompanies(all);
    };
    loadCompanies();

    // Check if came from company/city landing link
    const savedCompanyId = localStorage.getItem("selected_company_id");
    const savedMuniId = localStorage.getItem("selected_municipality_id");
    if (savedCompanyId) {
      setCompanyId(savedCompanyId);
      setMode("signup");
    } else if (savedMuniId) {
      setCompanyId(savedMuniId);
      setMode("signup");
    }
  }, []);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      localStorage.removeItem("selected_company_id");
      localStorage.removeItem("selected_company_name");
      localStorage.removeItem("selected_municipality_id");
      localStorage.removeItem("selected_municipality_name");
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe os 11 dígitos do CPF.", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Selecione sua empresa", description: "Escolha a empresa onde você trabalha.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, cpf: rawCpf, company_id: companyId },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      localStorage.removeItem("selected_company_id");
      localStorage.removeItem("selected_company_name");
      localStorage.removeItem("selected_municipality_id");
      localStorage.removeItem("selected_municipality_name");
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
      setMode("login");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setMode("login");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-[400px] mx-auto px-6 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="text-center mb-4">
            <div className="font-display text-[42px] font-bold text-foreground tracking-tight leading-none">
              mayla<span className="text-accent">.</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[.14em] uppercase">
              bem-estar corporativo
            </div>
          </div>
          <h1 className="font-display text-2xl font-medium text-foreground">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h1>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot} className="flex flex-col gap-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Maria Aparecida"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  maxLength={14}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <select
                  id="company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecione sua empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading
              ? "Aguarde..."
              : mode === "login"
              ? "Entrar"
              : mode === "signup"
              ? "Criar conta"
              : "Enviar link"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-6 text-sm">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("forgot")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
                Esqueceu a senha?
              </button>
              <button onClick={() => setMode("signup")} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                Não tem conta? <span className="text-primary font-medium">Cadastre-se</span>
              </button>
            </>
          )}
          {mode !== "login" && (
            <button onClick={() => setMode("login")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
