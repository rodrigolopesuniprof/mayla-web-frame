import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const DEFAULT_BINAH_CONFIG = {
  provider_name: "Binah",
  integration_type: "sdk_local" as "sdk_local" | "api_remota",
  license_key: "",
  base_url: "",
  api_key: "",
  monthly_limit: 3,
};

const DEFAULT_PRONTUARIO_CONFIG = {
  provider_name: "Meddit",
  base_url: "",
  api_key: "",
};

export function AdminIntegrations({ companyId }: Props) {
  const [binah, setBinah] = useState<IntegrationConfig>({ enabled: false, config: { ...DEFAULT_BINAH_CONFIG } });
  const [prontuario, setProntuario] = useState<IntegrationConfig>({ enabled: false, config: { ...DEFAULT_PRONTUARIO_CONFIG } });
  const [loading, setLoading] = useState(true);
  const [showBinahKey, setShowBinahKey] = useState(false);
  const [showProntuarioKey, setShowProntuarioKey] = useState(false);
  const [testingBinah, setTestingBinah] = useState(false);
  const [testingProntuario, setTestingProntuario] = useState(false);

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
          setBinah({
            enabled: f.enabled ?? false,
            config: {
              provider_name: cfg.provider_name || "Binah",
              integration_type: cfg.integration_type || "sdk_local",
              license_key: cfg.license_key || "",
              base_url: cfg.base_url || "",
              api_key: cfg.api_key || "",
              monthly_limit: cfg.monthly_limit ?? 3,
            },
          });
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

  // --- Binah handlers ---
  const handleBinahToggle = async (val: boolean) => {
    setBinah(prev => ({ ...prev, enabled: val }));
    const ok = await saveFeature(FEATURE_KEYS.binah, val, binah.config);
    if (!ok) setBinah(prev => ({ ...prev, enabled: !val }));
  };

  const handleBinahSave = async () => {
    const ok = await saveFeature(FEATURE_KEYS.binah, binah.enabled, binah.config);
    if (ok) toast({ title: "Configurações de medição salvas!" });
  };

  const handleTestBinahConnection = async () => {
    const { base_url, api_key } = binah.config;
    if (!base_url || !api_key) {
      toast({ title: "Preencha URL e API Key", variant: "destructive" });
      return;
    }
    setTestingBinah(true);
    try {
      const resp = await fetch(`${base_url}/health`, {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      if (resp.ok) {
        toast({ title: "✅ Conexão bem-sucedida!", description: "A API do provedor respondeu corretamente." });
      } else {
        toast({ title: "❌ Falha na conexão", description: `Status: ${resp.status}`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "❌ Erro de conexão", description: err.message, variant: "destructive" });
    }
    setTestingBinah(false);
  };

  // --- Prontuário handlers ---
  const handleProntuarioToggle = async (val: boolean) => {
    setProntuario(prev => ({ ...prev, enabled: val }));
    const ok = await saveFeature(FEATURE_KEYS.prontuario, val, prontuario.config);
    if (!ok) setProntuario(prev => ({ ...prev, enabled: !val }));
  };

  const handleProntuarioSave = async () => {
    const ok = await saveFeature(FEATURE_KEYS.prontuario, prontuario.enabled, prontuario.config);
    if (ok) toast({ title: "Configurações salvas!" });
  };

  const handleTestProntuarioConnection = async () => {
    const { base_url, api_key } = prontuario.config;
    if (!base_url || !api_key) {
      toast({ title: "Preencha URL e API Key", variant: "destructive" });
      return;
    }
    setTestingProntuario(true);
    try {
      // Save first so the edge function reads fresh credentials
      await handleProntuarioSave();
      const { data: { session } } = await supabase.auth.getSession();
      const projId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projId}.supabase.co/functions/v1/prontuario-proxy?action=test_connection&company_id=${companyId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const result = await resp.json();
      if (result.ok) {
        toast({ title: "✅ Conexão bem-sucedida!", description: "A API respondeu corretamente." });
      } else {
        toast({ title: "❌ Falha na conexão", description: result.error || `Status HTTP: ${result.status}`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "❌ Erro de conexão", description: err.message, variant: "destructive" });
    }
    setTestingProntuario(false);
  };

  if (loading) {
    return <p className="text-muted-foreground py-10 text-center">Carregando integrações...</p>;
  }

  const updateBinahConfig = (key: string, value: any) => {
    setBinah(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
  };

  const updateProntuarioConfig = (key: string, value: any) => {
    setProntuario(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Configure os sistemas que funcionam como plug-and-play com a Mayla Saúde.
      </p>

      {/* Binah / Vitals Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔬</span>
              <div>
                <p className="font-medium text-foreground">Medição de Sinais Vitais</p>
                <p className="text-xs text-muted-foreground">Captura de sinais vitais por câmera (Medição Premium)</p>
              </div>
            </div>
            <Switch checked={binah.enabled} onCheckedChange={handleBinahToggle} />
          </div>

          {binah.enabled && (
            <div className="space-y-3 pl-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Provedor</Label>
                  <Input
                    value={binah.config.provider_name}
                    onChange={e => updateBinahConfig("provider_name", e.target.value)}
                    placeholder="Ex: Binah, Provedor X"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Integração</Label>
                  <Select
                    value={binah.config.integration_type}
                    onValueChange={v => updateBinahConfig("integration_type", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sdk_local">SDK Local (browser)</SelectItem>
                      <SelectItem value="api_remota">API Remota</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {binah.config.integration_type === "sdk_local" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">License Key do SDK</Label>
                  <div className="relative">
                    <Input
                      type={showBinahKey ? "text" : "password"}
                      value={binah.config.license_key}
                      onChange={e => updateBinahConfig("license_key", e.target.value)}
                      placeholder="Chave de licença do SDK"
                      className="h-8 text-sm font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBinahKey(!showBinahKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                    >
                      {showBinahKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {binah.config.integration_type === "api_remota" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL Base da API</Label>
                    <Input
                      value={binah.config.base_url}
                      onChange={e => updateBinahConfig("base_url", e.target.value)}
                      placeholder="https://api.provedor.com"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API Key</Label>
                    <div className="relative">
                      <Input
                        type={showBinahKey ? "text" : "password"}
                        value={binah.config.api_key}
                        onChange={e => updateBinahConfig("api_key", e.target.value)}
                        placeholder="Chave de acesso da API"
                        className="h-8 text-sm font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBinahKey(!showBinahKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                      >
                        {showBinahKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Limite mensal:</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={binah.config.monthly_limit}
                  onChange={e => updateBinahConfig("monthly_limit", parseInt(e.target.value) || 1)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleBinahSave}>Salvar configurações</Button>
                {binah.config.integration_type === "api_remota" && (
                  <Button size="sm" variant="outline" onClick={handleTestBinahConnection} disabled={testingBinah}>
                    <TestTube2 className="w-4 h-4 mr-1" />
                    {testingBinah ? "Testando..." : "Testar conexão"}
                  </Button>
                )}
              </div>
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
                    onChange={e => updateProntuarioConfig("provider_name", e.target.value)}
                    placeholder="Ex: Meddit"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL Base da API</Label>
                  <Input
                    value={prontuario.config.base_url}
                    onChange={e => updateProntuarioConfig("base_url", e.target.value)}
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
                      type={showProntuarioKey ? "text" : "password"}
                      value={prontuario.config.api_key}
                      onChange={e => updateProntuarioConfig("api_key", e.target.value)}
                      placeholder="Chave de acesso da API"
                      className="h-8 text-sm font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProntuarioKey(!showProntuarioKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                    >
                      {showProntuarioKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleProntuarioSave}>Salvar configurações</Button>
                <Button size="sm" variant="outline" onClick={handleTestProntuarioConnection} disabled={testingProntuario}>
                  <TestTube2 className="w-4 h-4 mr-1" />
                  {testingProntuario ? "Testando..." : "Testar conexão"}
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
