## Problema

Hoje a tela de Bem-estar mostra duas entradas de medição que se misturam no código:

1. **"Medir sinais vitais"** → sempre visível, chama `RppgCapture` (rPPG interno via edge function `rppg-proxy`).
2. **"Medir sinais vitais – Função Especial"** → controlada por `company_features.binah_special_measurement`. O mesmo `BinahCapture` roda **Binah** ou **Shen.ai** conforme `config.provider`.

Problemas:
- O segundo bloco mistura dois provedores num único componente → confusão de fluxo e badges errados.
- Aparecem nomes de marcas na UX do usuário (badge "BINAH", "Câmera rPPG"), violando o modelo whitelabel.
- Admin não tem controle granular: não consegue habilitar/desabilitar rPPG separadamente, e o switch Binah↔Shen.ai está embutido na mesma feature.

## Modelo proposto

Três **fontes de medição independentes**, cada uma com sua própria feature flag em `company_features`. O admin liga/desliga cada uma; a Home renderiza **um card por fonte habilitada** (0 a 3 cards). Nenhum nome de marca aparece para o usuário.

| Feature key                | Rótulo whitelabel (UI usuário) | Provedor técnico (oculto) | Pontos | Limite |
| -------------------------- | ------------------------------ | ------------------------- | ------ | ------ |
| `vitals_basic`             | "Medição Básica"               | rPPG interno              | +50    | sem limite |
| `vitals_premium_a`         | "Medição Completa"             | Binah SDK                 | +100   | mensal configurável |
| `vitals_premium_b`         | "Análise Avançada"             | Shen.ai SDK               | +100   | mensal configurável |

Rótulos exatos definidos pelo admin (campo `display_name` por feature), com defaults whitelabel acima. Nomes de marca (Binah/Shen.ai/rPPG) só aparecem no **painel admin** como referência técnica do que está sendo configurado.

## Mudanças

### 1. Banco (`company_features`)

Migration para criar/renomear as três features. A `binah_special_measurement` existente é migrada:
- `provider=binah` → vira `vitals_premium_a` (Binah, mantendo `license_key`, `monthly_limit` etc.).
- `provider=shenai` → vira `vitals_premium_b` (Shen.ai, mantendo `monthly_limit`).
- Cria registro `vitals_basic` (rPPG) habilitado por padrão para todas as empresas (mantém comportamento atual).
- `binah_special_measurement` é mantida temporariamente para rollback, mas o código deixa de lê-la.

Cada nova linha tem `config = { display_name, monthly_limit?, ...specifics }`.

### 2. Admin (`src/components/admin/AdminIntegrations.tsx`)

Substituir o card único "Medição de Sinais Vitais" por três cards independentes na seção Integrações:
- **Medição Básica (rPPG interno)** — toggle on/off + campo `display_name`.
- **Medição Premium A (Binah)** — toggle + `display_name` + `license_key` + `monthly_limit`.
- **Medição Premium B (Shen.ai)** — toggle + `display_name` + `monthly_limit` (chave global `SHENAI_API_KEY`).

Os nomes técnicos (Binah/Shen.ai/rPPG) ficam no admin como ajuda contextual; o `display_name` é o que o usuário verá.

### 3. Hook único de configuração (`src/hooks/useVitalsSources.ts`, novo)

Carrega uma vez as três features da empresa atual e devolve:

```ts
type VitalsSource = {
  id: "basic" | "premium_a" | "premium_b";
  enabled: boolean;
  displayName: string;
  monthlyLimit?: number;
  usedThisMonth?: number;
  pointsReward: number;
};
useVitalsSources(companyId): { sources: VitalsSource[], loading }
```

### 4. Componente unificado (`src/components/mayla/VitalsMeasurementLauncher.tsx`, novo)

Recebe um `VitalsSource` e abre o capture correto:
- `basic` → `RppgCapture`
- `premium_a` → `BinahCapture` com provider forçado `binah`
- `premium_b` → `BinahCapture` com provider forçado `shenai`

Isso elimina a lógica de "ora binah, ora shenai" dentro do BinahCapture — o provider passa a ser **prop explícita**, não mais lookup interno por empresa.

### 5. `BinahCapture` → `PremiumCapture`

- Renomear conceitualmente; aceitar prop `provider: "binah" | "shenai"` e `displayName: string`.
- Remover o badge "BINAH"/"Shen.ai" do header — exibir apenas `displayName` (whitelabel).
- Remover `providerName` do texto "Medição especial via ${providerName}" (salvar só `source: "vitals_premium_a"` ou `"vitals_premium_b"`).
- Hook `useVitalsMeasurement` deixa de buscar `company_features`; provider vem como argumento.

### 6. Home (`WellbeingTab.tsx` e `HealthTab.tsx`)

Trocar os dois blocos hard-coded por:

```tsx
{sources.filter(s => s.enabled).map(s => (
  <VitalsSourceCard key={s.id} source={s} onClick={() => setActive(s)} />
))}
```

Visual: cards mantêm o gradiente atual mas usam `displayName` e descrições genéricas (sem "rPPG", "Binah", "PA, hemoglobina, HRV" pode ficar pois é nome de indicador, não de marca).

### 7. Admin – relatórios e painel de usuário

`UserVitalsFullPanel` hoje mostra badges "Shen.ai"/"Binah". Como esse painel é **interno do admin** (não do paciente), os badges podem ficar — útil para suporte técnico. Confirmar com o usuário se prefere remover também (ver questão abaixo).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — migração das features
- `src/components/admin/AdminIntegrations.tsx` — três cards
- `src/hooks/useVitalsSources.ts` — novo
- `src/hooks/useVitalsMeasurement.ts` — recebe provider via prop, remove lookup
- `src/components/mayla/BinahCapture.tsx` — provider via prop, remover badges de marca
- `src/components/mayla/VitalsMeasurementLauncher.tsx` — novo dispatcher
- `src/components/mayla/WellbeingTab.tsx` e `HealthTab.tsx` — renderizar cards dinâmicos
- `src/components/admin/UserVitalsFullPanel.tsx` — opcional (badges)

## Verificação

- Admin desliga todas as três → Home não mostra nenhum card de medição.
- Admin liga só `vitals_premium_b` → aparece um único card "Análise Avançada", clicar abre Shen.ai SDK, painel da Shen.ai registra consumo.
- Admin liga as três → três cards, cada um abre o capture correto.
- Em nenhum ponto da UX do usuário aparece "Binah", "Shen.ai" ou "rPPG".

## Perguntas em aberto

1. Os badges "Binah"/"Shen.ai" no painel admin de detalhes do usuário (`UserVitalsFullPanel`) devem sumir também, ou ficam por serem internos da equipe?
2. Os rótulos default whitelabel que sugeri ("Medição Básica", "Medição Completa", "Análise Avançada") servem, ou prefere outros nomes?
