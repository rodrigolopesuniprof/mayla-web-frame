

# Plano: Atualizar conexão Meddit (nova URL + header)

## Mudanças detectadas

| Item | Antes | Agora |
|------|-------|-------|
| URL base | `http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com` | `https://meddit-clinic-appointment.vercel.app` |
| Header de auth | `Authorization: <key>` | `x-api-key: <key>` |
| Chave | valor anterior do secret | `meddit-atria-2026` |

## Implementação

### 1. Atualizar `prontuario-proxy/index.ts`

- Alterar `DEFAULT_BASE` para `https://meddit-clinic-appointment.vercel.app`
- Trocar o header `Authorization` por `x-api-key` nas chamadas ao Meddit (em 2 locais: fluxo regular e `test_connection`)
- Manter `Content-Type: application/json`

### 2. Atualizar o secret `MEDDIT_API_KEY`

- Atualizar o valor para `meddit-atria-2026` usando a ferramenta de secrets

### 3. Deploy e teste

- Deploy da edge function
- Testar via `curl_edge_functions` chamando `?action=specialities` (ou `test_connection`) para validar a resposta

## Arquivos afetados

- **Editar**: `supabase/functions/prontuario-proxy/index.ts`
- **Atualizar secret**: `MEDDIT_API_KEY`

