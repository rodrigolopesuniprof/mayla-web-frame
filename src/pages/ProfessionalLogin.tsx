import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Mode = "login" | "signup" | "forgot";

export default function ProfessionalLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast({ title: "Erro de autenticação", variant: "destructive" });
      return;
    }

    const { data: partner } = await supabase
      .from("partners")
      .select("id, active, approval_status")
      .eq("user_id", user.id)
      .maybeSingle();

    setLoading(false);

    if (!partner) {
      toast({
        title: "Cadastro não encontrado",
        description: "Seu e-mail não está vinculado a nenhum parceiro. Faça seu cadastro primeiro.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    if (!partner.active || partner.approval_status !== "approved") {
      toast({
        title: "Cadastro pendente de aprovação",
        description: "Seu cadastro profissional foi recebido e está aguardando aprovação do administrador.",
      });
      await supabase.auth.signOut();
      return;
    }

    navigate("/painel-profissional");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Informe seu nome completo", variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1. Create auth account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/login-profissional`,
      },
    });

    if (signUpError) {
      setLoading(false);
      toast({ title: "Erro ao criar conta", description: signUpError.message, variant: "destructive" });
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setLoading(false);
      toast({ title: "Erro inesperado", variant: "destructive" });
      return;
    }

    // 2. Create partner record linked to the new user
    const { error: partnerError } = await supabase.from("partners").insert({
      name: fullName,
      email,
      partner_type: "doctor" as any,
      user_id: userId,
      active: false,
      approval_status: "pending" as any,
    });

    if (partnerError) {
      setLoading(false);
      toast({ title: "Erro ao criar perfil profissional", description: partnerError.message, variant: "destructive" });
      return;
    }

    setLoading(false);
    toast({
      title: "Cadastro realizado! 🎉",
      description: "Verifique seu e-mail para confirmar a conta. Após confirmação, aguarde a aprovação do administrador.",
    });
    setMode("login");
    setPassword("");
    setFullName("");
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
      toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
      setMode("login");
    }
  };

  const titles: Record<Mode, string> = {
    login: "Acesso Profissional",
    signup: "Cadastro Profissional",
    forgot: "Recuperar senha",
  };

  const subtitles: Record<Mode, string> = {
    login: "Entre com seu e-mail e senha",
    signup: "Crie sua conta para acessar o portal profissional",
    forgot: "Enviaremos um link para redefinir sua senha",
  };

  const handleSubmit = mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgot;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-[400px] mx-auto px-6 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-4">
            🩺
          </div>
          <div className="font-display text-[32px] font-bold text-foreground tracking-tight leading-none">
            mayla<span className="text-accent">.</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[.14em] uppercase mb-4">
            portal profissional
          </div>
          <h1 className="font-display text-xl font-medium text-foreground">
            {titles[mode]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {subtitles[mode]}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. João Silva"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail profissional</Label>
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
              : "Enviar link"
            }
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-6 text-sm">
          {mode === "login" && (
            <>
              <button onClick={() => setMode("forgot")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
                Esqueceu a senha?
              </button>
              <div className="text-xs text-muted-foreground text-center mt-4 bg-secondary rounded-xl p-3">
                <p className="font-medium text-foreground mb-1">Ainda não tem conta?</p>
                <p>Cadastre-se e aguarde a aprovação do administrador para iniciar seus atendimentos.</p>
                <button
                  onClick={() => setMode("signup")}
                  className="mt-2 text-primary font-medium hover:underline bg-transparent border-none cursor-pointer"
                >
                  Criar conta profissional →
                </button>
              </div>
            </>
          )}
          {mode === "signup" && (
            <button onClick={() => setMode("login")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
              ← Já tenho uma conta
            </button>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("login")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
