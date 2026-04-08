

# Plano: Seção "Integrações" unificada (Plug & Play)

## Resumo

Criar uma nova seção **"Integrações"** (🔌) no menu lateral do `AdminCompanyDetail`, centralizando Binah, Prontuário Conveniado (Meddit) e futuras integrações num único painel. Remover os toggles soltos do `AdminCompanySettings`.

## O que muda

### 1. Nova seção no sidebar — `AdminCompanyDetail.tsx`

- Adicionar `"integracoes"` ao tipo `Section` e ao array `SECTIONS` com emoji 🔌 e label "Integrações"
- Renderizar novo componente `AdminIntegrations` quando ativo

### 2. Novo componente — `AdminIntegrations.tsx`

Interface unificada com cards para cada integração disponível:

```text
┌─────────────────────────────────────────────────┐
│ 🔌 Integrações                                  │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🔬 Medição de Sinais Vitais                  │ │
│ │ [Switch ON/OFF]                               │ │
│ │ Limite mensal: [3] /mês                       │ │
│ │ Status: Ativo ✅                              │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🏥 Prontuário Conveniado                     │ │
│ │ [Switch ON/OFF]                               │ │
│ │ Provedor: [Meddit ▾]                          │ │
│ │ URL Base: [_______]                           │ │
│ │ API Key: [•••••••]                            │ │
│ │ [Testar conexão]                              │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [+ Adicionar Integração] (futuro, desabilitado) │
└─────────────────────────────────────────────────┘
```

Cada card:
- Lê/escreve na tabela `company_features` (já existente) usando `feature_key` como identificador
- Campos de configuração específicos salvos no `config` JSONB
- Toggle geral de ativo/inativo
- Para Prontuário: campos de provedor, URL base e API key
- Para Binah: campo de limite mensal

### 3. Limpar `AdminCompanySettings.tsx`

- Remover os componentes `BinahToggle` e `ProntuarioToggle` (linhas 244-311)
- Remover as referências `<BinahToggle>` e `<ProntuarioToggle>` do JSX (linhas 163-164)

### 4. Ajustar `prontuario-proxy` Edge Function

- Ler credenciais do `config` JSONB da `company_features` da empresa do usuário
- Fallback para o secret global `MEDDIT_API_KEY` se não houver config específica

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/admin/AdminIntegrations.tsx` |
| Editar | `src/components/admin/AdminCompanyDetail.tsx` (add seção) |
| Editar | `src/components/admin/AdminCompanySettings.tsx` (remover toggles) |
| Editar | `supabase/functions/prontuario-proxy/index.ts` (ler config da empresa) |

## Ordem de execução

1. Criar `AdminIntegrations.tsx` com cards para Binah e Prontuário
2. Registrar seção "integracoes" no sidebar do `AdminCompanyDetail`
3. Remover toggles do `AdminCompanySettings`
4. Atualizar Edge Function para ler credenciais do config da empresa

