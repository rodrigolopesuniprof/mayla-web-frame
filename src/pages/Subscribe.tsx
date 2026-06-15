import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { lookupCep, formatCep } from "@/lib/viacep";

interface Plan {
  id: string; name: string; description: string | null;
  price_cents: number; billing_interval: "monthly" | "yearly";
  payment_methods: string[];
  effective_price_cents: number;
}

declare global {
  interface Window { PagarMe?: any; }
}

export default function Subscribe() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const referralCode = params.get("ref") ?? undefined;
  const lockedPlanId = params.get("plan") ?? undefined;

  const [company, setCompany] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<"credit_card" | "pix">("credit_card");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string; expires_at: string } | null>(null);

  // Dados pessoais
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");

  // Endereço de cobrança (obrigatório para cartão — anti-fraude)
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const numberInputRef = useRef<HTMLInputElement | null>(null);

  // Cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExp, setCardExp] = useState(""); // MM/YY
  const [cardCvv, setCardCvv] = useState("");

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("companies").select("*").eq("slug", slug!).maybeSingle();
      if (!c) { setNotFound(true); return; }
      setCompany(c);
      const { data: assigns } = await supabase
        .from("company_plan_assignments")
        .select("custom_price_cents, plan:subscription_plans!inner(*)")
        .eq("company_id", c.id).eq("active", true);
      const enriched: Plan[] = (assigns ?? []).map((a: any) => ({
        ...a.plan,
        effective_price_cents: a.custom_price_cents ?? a.plan.price_cents,
      })).filter((p) => p.active);
      setPlans(enriched);
      if (lockedPlanId) {
        const found = enriched.find((p) => p.id === lockedPlanId);
        if (found) setSelected(found);
      }
    })();
  }, [slug, lockedPlanId]);

  async function handleCepLookup(value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    const result = await lookupCep(clean);
    setCepLoading(false);
    if (!result) {
      toast({ title: "CEP não encontrado", description: "Preencha o endereço manualmente.", variant: "destructive" });
      return;
    }
    setStreet(result.street);
    setNeighborhood(result.neighborhood);
    setCity(result.city);
    setState(result.state);
    // foca em "número" se houver algo a preencher
    setTimeout(() => numberInputRef.current?.focus(), 50);
  }

  async function tokenizeCard(): Promise<string> {
    const [mm, yy] = cardExp.split("/").map((s) => s.trim());
    const pubKeyRes = await supabase.functions.invoke("pagarme-public-key", { body: { company_id: company.id } });
    const pk = (pubKeyRes.data as any)?.public_key;
    if (!pk) throw new Error("Public key não configurada");

    const cleanCpf = document.replace(/\D/g, "");
    const cleanZip = zipCode.replace(/\D/g, "");

    const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${pk}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "card",
        card: {
          number: cardNumber.replace(/\s/g, ""),
          holder_name: cardHolder,
          holder_document: cleanCpf, // chave do anti-fraude
          exp_month: Number(mm),
          exp_year: Number("20" + yy),
          cvv: cardCvv,
          billing_address: {
            line_1: `${number}, ${street}, ${neighborhood}`,
            line_2: complement || "",
            zip_code: cleanZip,
            city,
            state,
            country: "BR",
          },
        },
      }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message ?? "Falha ao tokenizar cartão");
    return out.id;
  }

  function validateForm(): string | null {
    if (!name.trim()) return "Informe seu nome completo.";
    if (!email.trim() || !email.includes("@")) return "Email inválido.";
    if (!password || password.length < 6) return "Senha deve ter ao menos 6 caracteres.";
    if (document.replace(/\D/g, "").length !== 11) return "CPF inválido.";
    if (phone.replace(/\D/g, "").length < 10) return "Telefone inválido (com DDD).";

    if (method === "credit_card") {
      if (zipCode.replace(/\D/g, "").length !== 8) return "CEP inválido.";
      if (!street.trim()) return "Informe a rua.";
      if (!number.trim()) return "Informe o número.";
      if (!neighborhood.trim()) return "Informe o bairro.";
      if (!city.trim()) return "Informe a cidade.";
      if (state.length !== 2) return "Informe a UF (2 letras).";
      if (!cardNumber.replace(/\s/g, "")) return "Informe o número do cartão.";
      if (!cardHolder.trim()) return "Informe o nome no cartão.";
      if (!/^\d{2}\/\d{2}$/.test(cardExp)) return "Validade inválida (MM/AA).";
      if (cardCvv.length < 3) return "CVV inválido.";
    }
    return null;
  }

  async function submit() {
    if (!selected) return;
    const validationError = validateForm();
    if (validationError) {
      toast({ title: "Verifique os dados", description: validationError, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let card_token: string | undefined;
      if (method === "credit_card") {
        card_token = await tokenizeCard();
      }

      const billing_address = method === "credit_card" ? {
        zip_code: zipCode.replace(/\D/g, ""),
        street,
        number,
        complement: complement || undefined,
        neighborhood,
        city,
        state,
        country: "BR",
      } : undefined;

      const { data, error } = await supabase.functions.invoke("pagarme-create-subscription", {
        body: {
          company_id: company.id,
          plan_id: selected.id,
          payment_method: method,
          customer: { name, email, document, phone },
          billing_address,
          card_token,
          referral_code: referralCode,
          password,
        },
      });

      let out: any = (data as any) ?? {};

      // Defesa em profundidade: se SDK lançou erro HTTP, tentar extrair body real
      if (error && (error as any).context) {
        try {
          const ctx = (error as any).context;
          if (typeof ctx.json === "function") out = await ctx.json();
          else if (typeof ctx.text === "function") {
            const t = await ctx.text();
            try { out = JSON.parse(t); } catch { out = { message: t }; }
          }
        } catch { /* mantém out vazio */ }
      }

      if (out?.ok === false || out?.error || (error && !out?.message)) {
        const msg = out?.message
          ?? (out?.error === "payment_failed" ? "Cartão recusado pela operadora." : null)
          ?? error?.message
          ?? "Falha ao processar pagamento";
        throw new Error(msg);
      }

      if (out?.pix) {
        setPixData(out.pix);
        toast({
          title: "PIX gerado!",
          description: out.pending
            ? "Pague para criar sua conta automaticamente."
            : "Escaneie ou copie o código.",
        });
      } else {
        toast({ title: "Pagamento aprovado!", description: "Sua conta está ativa. Faça login para continuar." });
        setTimeout(() => { window.location.href = "/login"; }, 1500);
      }
    } catch (e: any) {
      toast({ title: "Erro no pagamento", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-2xl mb-2">Empresa não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          Verifique o link recebido. O slug <code className="bg-muted px-1 rounded">{slug}</code> não corresponde a nenhuma empresa cadastrada.
        </p>
      </div>
    </div>
  );
  if (!company) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-md mx-auto px-4">
        <h1 className="font-display text-3xl text-center mb-2">{company.name}</h1>
        <p className="text-center text-sm text-muted-foreground mb-6">Assine a plataforma</p>

        {!selected ? (
          <div className="space-y-3">
            {plans.map((p) => (
              <Card key={p.id} className="cursor-pointer hover:border-primary" onClick={() => setSelected(p)}>
                <CardContent className="p-4">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-2xl font-display text-primary mt-1">
                    R$ {(p.effective_price_cents / 100).toFixed(2)}
                    <span className="text-sm text-muted-foreground"> / {p.billing_interval === "monthly" ? "mês" : "ano"}</span>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-2">{p.description}</p>}
                </CardContent>
              </Card>
            ))}
            {plans.length === 0 && <p className="text-center text-muted-foreground">Nenhum plano disponível.</p>}
          </div>
        ) : pixData ? (
          <Card><CardContent className="p-6 text-center space-y-3">
            <h2 className="font-display text-xl">Pague com PIX</h2>
            {pixData.qr_code_url && <img src={pixData.qr_code_url} alt="QR PIX" className="mx-auto w-56 h-56" />}
            <div>
              <Label className="text-xs">PIX copia e cola</Label>
              <textarea readOnly value={pixData.qr_code} className="w-full text-xs p-2 border rounded mt-1 bg-muted h-24" />
              <Button size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(pixData.qr_code)}>Copiar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Após o pagamento, sua conta será ativada automaticamente.</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-4 space-y-3">
            <div className="bg-secondary rounded-lg p-3 text-sm">
              <div className="font-medium">{selected.name}</div>
              <div className="text-primary">R$ {(selected.effective_price_cents / 100).toFixed(2)} / {selected.billing_interval === "monthly" ? "mês" : "ano"}</div>
              {!lockedPlanId && <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground underline mt-1 bg-transparent border-none cursor-pointer">trocar plano</button>}
            </div>

            <div><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Senha (mín 6)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><Label>CPF</Label><Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="000.000.000-00" /></div>
            <div><Label>Celular</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 91234-5678" /></div>

            <div className="flex gap-2 pt-2">
              {selected.payment_methods.includes("credit_card") && (
                <Button type="button" variant={method === "credit_card" ? "default" : "outline"} size="sm" onClick={() => setMethod("credit_card")}>Cartão</Button>
              )}
              {selected.payment_methods.includes("pix") && (
                <Button type="button" variant={method === "pix" ? "default" : "outline"} size="sm" onClick={() => setMethod("pix")}>PIX</Button>
              )}
            </div>

            {method === "credit_card" && (
              <>
                <div className="pt-3 border-t mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Endereço de cobrança</p>
                  <div>
                    <Label>CEP</Label>
                    <div className="relative">
                      <Input
                        value={zipCode}
                        onChange={(e) => {
                          const v = formatCep(e.target.value);
                          setZipCode(v);
                          if (v.replace(/\D/g, "").length === 8) handleCepLookup(v);
                        }}
                        onBlur={(e) => handleCepLookup(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {cepLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="col-span-2"><Label>Rua</Label><Input value={street} onChange={(e) => setStreet(e.target.value)} /></div>
                    <div><Label>Número</Label><Input ref={numberInputRef} value={number} onChange={(e) => setNumber(e.target.value)} /></div>
                  </div>
                  <div className="mt-2"><Label>Complemento</Label><Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="opcional" /></div>
                  <div className="mt-2"><Label>Bairro</Label><Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} /></div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="col-span-2"><Label>Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                    <div><Label>UF</Label><Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></div>
                  </div>
                </div>

                <div className="pt-3 border-t mt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Dados do cartão</p>
                  <div><Label>Número do cartão</Label><Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} /></div>
                  <div><Label>Nome no cartão</Label><Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Validade (MM/AA)</Label><Input value={cardExp} onChange={(e) => setCardExp(e.target.value)} placeholder="12/28" /></div>
                    <div><Label>CVV</Label><Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} /></div>
                  </div>
                </div>
              </>
            )}

            <Button onClick={submit} disabled={loading} className="w-full mt-3">
              {loading ? "Processando..." : method === "credit_card" ? "Assinar" : "Gerar PIX"}
            </Button>
            {referralCode && <p className="text-xs text-center text-muted-foreground">Indicação: {referralCode}</p>}
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
