## Diagnóstico

Hoje, `company_invite_tokens` tem `expires_at` nullable e **não tem contador de uso**. Em produção todos os tokens estão com `expires_at = NULL` (não expiram por tempo) e nada no código os apaga após signup. O motivo aparente do problema:

- `AdminCompanyDetail.tsx` usa `.maybeSingle()` numa query que pode retornar **várias linhas** (algumas empresas já têm 4–6 tokens duplicados na base). Quando isso acontece, o Supabase retorna erro/`null`, a UI exibe "sem link" e o admin clica em "regenerar" — que **apaga todos** os tokens da empresa e cria um novo. Resultado prático: links antigos param de funcionar e parece que "expirou após 1 uso".

Além disso, não há QR code nem controle de limite/prazo configurável.

## Objetivo

1. Link de convite com **uso ilimitado por padrão**, opcionalmente com:
   - `expires_at` (prazo de validade)
   - `max_uses` (limite total de cadastros concluídos)
2. Contar cada cadastro concluído via link (auditoria + enforcement do `max_uses`).
3. Botão para exibir/baixar **QR code** do link.
4. Eliminar a duplicação de tokens e a falsa sensação de expiração.

## Mudanças no banco

Migration:

- `company_invite_tokens`:
  - adicionar `max_uses int null` (null = ilimitado)
  - adicionar `uses_count int not null default 0`
  - adicionar `active boolean not null default true`
  - índice único parcial: 1 token ativo por empresa (`unique (company_id) where active`)
  - back-fill: marcar como `active = true` apenas o mais recente de cada empresa; demais ficam `active = false` (links antigos continuam válidos para validação histórica, mas só o ativo aparece na UI)
- `profiles`: adicionar `signed_up_via_token uuid null references company_invite_tokens(id)` para auditoria
- Função `register_via_invite_token(_token text)`: SECURITY DEFINER, chamada pelo client logo após o `auth.signUp` confirmado. Ela:
  - valida `active`, `expires_at > now()`, `max_uses is null or uses_count < max_uses`
  - incrementa `uses_count`
  - grava `profiles.signed_up_via_token`
  - retorna `{ ok, reason }`

## Mudanças no backend / fluxo

- `CompanySignup.tsx`:
  - validação inicial passa a checar `active`, `expires_at`, `uses_count < max_uses`
  - após `auth.signUp` bem sucedido, chama `register_via_invite_token(token)` via RPC
  - mensagens de erro distintas para "expirado", "limite atingido", "desativado"

## UI Admin (`AdminCompanySettings.tsx`)

Adicionar painel "Link de cadastro":

- Mostra a URL atual + botão **Copiar**
- Botão **Mostrar QR code** → abre dialog com QR (lib `qrcode.react`) e botão "Baixar PNG"
- Campos editáveis:
  - **Validade** (date picker, opcional — vazio = sem prazo)
  - **Limite de cadastros** (input number, opcional — vazio = ilimitado)
- Indicadores: `uses_count / max_uses` e status (Ativo / Expirado / Limite atingido)
- Botão **Gerar novo link** (desativa o atual, cria um novo) — com confirmação clara: "links anteriores deixarão de aceitar novos cadastros"

Ajustes em `AdminCompanies.tsx` e `AdminCompanyDetail.tsx`: trocar `.maybeSingle()` por `.eq("active", true).maybeSingle()` para nunca mais quebrar com múltiplos tokens.

## Dependências

- `qrcode.react` (leve, ~3 KB) para renderizar e exportar PNG do QR.

## Arquivos afetados

- `supabase/migrations/...` (novo)
- `src/pages/CompanySignup.tsx`
- `src/components/admin/AdminCompanySettings.tsx`
- `src/components/admin/AdminCompanies.tsx`
- `src/components/admin/AdminCompanyDetail.tsx`
- `package.json` (qrcode.react)
- `mem://auth/cadastro-por-token-empresa` (atualizar regra)

## O que **não** muda

- Trigger automática que cria token na criação da empresa (continua igual, agora com `active=true` por padrão).
- Rota `/cadastro/:token` e UX do formulário público.
