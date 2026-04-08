

# Plano: Tornar o provedor de Medição Premium "trocável" (Adapter Pattern)

## Resumo

Aplicar ao card "Medição de Sinais Vitais" na seção Integrações a mesma lógica de configuração do Prontuário Conveniado: o admin pode escolher o **provedor** (Binah, ou futuro concorrente), inserir credenciais (API key, URL base) e testar a conexão. O rPPG nativo permanece fixo e inalterado — ele é nosso e não entra nessa lógica.

## Complexidade

**Média-baixa.** A maior parte da infraestrutura já existe (cards de integração, `company_features.config` JSONB, padrão de toggle + credenciais). A mudança principal é:

1. Expandir o card do Binah no `AdminIntegrations` para aceitar campos de provedor (nome, URL, API key) — idêntico ao prontuário
2. Criar uma camada de abstração mínima no hook de medição para que o front-end (BinahCapture) funcione com qualquer provedor que entregue os mesmos sinais vitais

## O que muda

### 1. `AdminIntegrations.tsx` — Expandir card Binah

O card de "Medição de Sinais Vitais" passa a ter:
- **Nome do Provedor** (ex: "Binah", "Provedor X")
- **URL Base** (para provedores que usam API em vez de SDK local)
- **API Key / License Key** (hoje é hardcoded no código)
- **Tipo de integração**: `sdk_local` ou `api_remota` (select)
- **Limite mensal** (já existe)
- **Botão "Testar conexão"** (quando tipo = api_remota)

Estrutura do `config` JSONB:
```json
{
  "provider_name": "Binah",
  "integration_type": "sdk_local",
  "license_key": "9FE0E4-...",
  "base_url": "",
  "api_key": "",
  "monthly_limit": 3
}
```

### 2. `useBinahMonitor.ts` → `useVitalsMeasurement.ts` (renomear + abstrair)

- Ler o `config` do provedor ativo da empresa do usuário
- Se `integration_type === "sdk_local"`: usar fluxo atual do Binah SDK (com a license_key do config em vez de hardcoded)
- Se `integration_type === "api_remota"`: usar uma edge function proxy (similar ao rppg-proxy) que repassa frames para a API do fornecedor
- A interface de retorno (`VitalSigns`, `start`, `stop`, `onResult`) permanece idêntica — o front-end não muda

### 3. `BinahCapture.tsx` — Ajuste mínimo

- Trocar import de `useBinahMonitor` para `useVitalsMeasurement`
- Remover qualquer referência hardcoded a "Binah"
- O resto do componente (UI de consentimento, câmera, progresso, resultados) não muda

### 4. Edge Function `vitals-proxy` (novo, para provedores API)

- Proxy genérico que lê `base_url` e `api_key` do `company_features.config`
- Recebe frames do front-end e repassa para a API do provedor configurado
- Só será usado quando `integration_type === "api_remota"`

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/admin/AdminIntegrations.tsx` (expandir card Binah) |
| Renomear/Refatorar | `src/hooks/useBinahMonitor.ts` → `src/hooks/useVitalsMeasurement.ts` |
| Editar | `src/components/mayla/BinahCapture.tsx` (trocar hook, remover refs Binah) |
| Criar | `supabase/functions/vitals-proxy/index.ts` (proxy genérico para APIs) |
| Editar | `src/components/mayla/WellbeingTab.tsx` (atualizar import se necessário) |

## O que NÃO muda

- **rPPG nativo**: permanece como está, é nosso e fixo
- **UI de captura**: mesma tela para o usuário final, independente do provedor
- **Tabela `company_features`**: mesma estrutura, só muda o conteúdo do `config` JSONB

## Ordem de execução

1. Expandir card Binah no AdminIntegrations com campos de provedor
2. Refatorar hook para `useVitalsMeasurement` com adapter pattern
3. Atualizar BinahCapture para usar novo hook
4. Criar edge function `vitals-proxy` para provedores API

