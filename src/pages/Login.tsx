import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Mode = "login" | "forgot";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
            {mode === "login" ? "Entrar" : "Recuperar senha"}
          </h1>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="flex flex-col gap-4">
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

          {mode === "login" && (
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
              : "Enviar link"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-6 text-sm">
          {mode === "login" && (
            <button onClick={() => setMode("forgot")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
              Esqueceu a senha?
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
