import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Plug, TestTube2 } from "lucide-react";

interface Props {
  companyId: string;
}

interface IntegrationConfig {
  enabled: boolean;
  config: Record<string, any>;
}

const FEATURE_KEYS = {
  binah: "binah_special_measurement",
  prontuario: "prontuario_conveniado",
} as const;

export function AdminIntegrations({ companyId }: Props) {
  const [binah, setBinah] = useState<IntegrationConfig>({ enabled: false, config: { monthly_limit: 3 } });
  const [prontuario, setProntuario] = useState<IntegrationConfig>({ enabled: false, config: { provider_name: "Meddit", base_url: "", api_key: "" } });
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const loadFeatures = useCallback(async () => {
    const { data } = await supabase
      .from("company_features")
      .select("feature_key, enabled, config")
      .eq("company_id", companyId)
      .in("feature_key", [FEATURE_KEYS.binah, FEATURE_KEYS.prontuario]);

    if (data) {
      for (const f of data) {
        const cfg = (f.config as Record<string, any>) || {};
        if (f.feature_key === FEATURE_KEYS.binah) {
          setBinah({ enabled: f.enabled ?? false, config: { monthly_limit: cfg.monthly_limit ?? 3 } });
        }
        if (f.feature_key === FEATURE_KEYS.prontuario) {
          setProntuario({
            enabled: f.enabled ?? false,
            config: {
              provider_name: cfg.provider_name || "Meddit",
              base_url: cfg.base_url || "",
              api_key: cfg.api_key || "",
            },
          });
        }
      }
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { loadFeatures(); }, [loadFeatures]);

  const saveFeature = async (featureKey: string, enabled: boolean, config: Record<string, any>) => {
    const { error } = await supabase.from("company_features").upsert(
      { company_id: companyId, feature_key: featureKey, enabled, config },
      { onConflict: "company_id,feature_key" }
    );
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleBinahToggle = async (val: boolean) => {
    setBinah(prev => ({ ...prev, enabled: val }));
    const ok = await saveFeature(FEATURE_KEYS.binah, val, binah.config);
    if (!ok) setBinah(prev => ({ ...prev, enabled: !val }));
  };

  const handleBinahLimitSave = async () => {
    const ok = await saveFeature(FEATURE_KEYS.binah, binah.enabled, binah.config);
    if (ok) toast({ title: "Limite atualizado!" });
  };

  const handleProntuarioToggle = async (val: boolean) => {
    setProntuario(prev => ({ ...prev, enabled: val }));
    const ok = await saveFeature(FEATURE_KEYS.prontuario, val, prontuario.config);
    if (!ok) setProntuario(prev => ({ ...prev, enabled: !val }));
  };

  const handleProntuarioSave = async () => {
    const ok = await saveFeature(FEATURE_KEYS.prontuario, prontuario.enabled, prontuario.config);
    if (ok) toast({ title: "Configurações salvas!" });
  };

  const handleTestConnection = async () => {
    const { base_url, api_key } = prontuario.config;
    if (!base_url || !api_key) {
      toast({ title: "Preencha URL e API Key", variant: "destructive" });
      return;
    }
    setTestingConnection(true);
    try {
      const resp = await fetch(`${base_url}/v1/clinics/specialities`, {
        headers: { Authorization: api_key },
      });
      if (resp.ok) {
        toast({ title: "✅ Conexão bem-sucedida!", description: "A API respondeu corretamente." });
      } else {
        toast({ title: "❌ Falha na conexão", description: `Status: ${resp.status}`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "❌ Erro de conexão", description: err.message, variant: "destructive" });
    }
    setTestingConnection(false);
  };

  if (loading) {
    return <p className="text-muted-foreground py-10 text-center">Carregando integrações...</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Configure os sistemas que funcionam como plug-and-play com a Mayla Saúde.
      </p>

      {/* Binah Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔬</span>
              <div>
                <p className="font-medium text-foreground">Medição de Sinais Vitais</p>
                <p className="text-xs text-muted-foreground">Captura de sinais vitais por câmera (rPPG)</p>
              </div>
            </div>
            <Switch checked={binah.enabled} onCheckedChange={handleBinahToggle} />
          </div>

          {binah.enabled && (
            <div className="flex items-center gap-3 pl-10">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Limite mensal:</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={binah.config.monthly_limit}
                onChange={e => setBinah(prev => ({ ...prev, config: { ...prev.config, monthly_limit: parseInt(e.target.value) || 1 } }))}
                className="w-20 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">/mês</span>
              <Button size="sm" variant="outline" className="h-8" onClick={handleBinahLimitSave}>Salvar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prontuário Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏥</span>
              <div>
                <p className="font-medium text-foreground">Prontuário Conveniado</p>
                <p className="text-xs text-muted-foreground">Agendamento e compartilhamento de dados com clínicas parceiras</p>
              </div>
            </div>
            <Switch checked={prontuario.enabled} onCheckedChange={handleProntuarioToggle} />
          </div>

          {prontuario.enabled && (
            <div className="space-y-3 pl-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Provedor</Label>
                  <Input
                    value={prontuario.config.provider_name}
                    onChange={e => setProntuario(prev => ({ ...prev, config: { ...prev.config, provider_name: e.target.value } }))}
                    placeholder="Ex: Meddit"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL Base da API</Label>
                  <Input
                    value={prontuario.config.base_url}
                    onChange={e => setProntuario(prev => ({ ...prev, config: { ...prev.config, base_url: e.target.value } }))}
                    placeholder="http://api.exemplo.com"
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">API Key</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={prontuario.config.api_key}
                      onChange={e => setProntuario(prev => ({ ...prev, config: { ...prev.config, api_key: e.target.value } }))}
                      placeholder="Chave de acesso da API"
                      className="h-8 text-sm font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleProntuarioSave}>Salvar configurações</Button>
                <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testingConnection}>
                  <TestTube2 className="w-4 h-4 mr-1" />
                  {testingConnection ? "Testando..." : "Testar conexão"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future placeholder */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground/50 pl-1">
        <Plug className="w-4 h-4" />
        <span>Novas integrações serão adicionadas aqui conforme disponíveis.</span>
      </div>
    </div>
  );
}
