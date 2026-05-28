Criar um motor de pontuação centralizado por empresa, com regras gerenciáveis no admin, prêmios e um painel público compartilhável. Substitui as pontuações hardcoded por uma chamada única que respeita caps de frequência e validade.

## 1. Backend — schema novo (por empresa)

Tabela `**point_rules**` (uma linha por evento que dá pontos):

- `company_id`, `event_key` (avatar_dicebear, rppg_measurement, vitals_measurement, weekly_checkin, mission_complete, daily_challenge, esf_link, support_team_link, survey_complete, medication_adherence)
- `label`, `description`, `emoji`
- `points` (int), `active` (bool)
- `cap_per_day`, `cap_per_week`, `cap_per_month`, `cap_lifetime` (todos nullable = sem limite)
- `valid_from`, `valid_until` (nullable = permanente)
- Unique em `(company_id, event_key)`
- Seed inicial: ao criar empresa, popular com defaults razoáveis a partir dos valores atuais (avatar 150, rppg 50, vitals 100, esf 500, etc.)

Tabela `**rewards**` (prêmios):

- `company_id`, `title`, `description`, `image_url`
- `cost_points` (opcional, se for resgate por pontos)
- `min_level` (opcional)
- `stock` (nullable = ilimitado)
- `active`, `valid_from`, `valid_until`

Tabela `**reward_grants**` (entregas manuais a usuário):

- `company_id`, `reward_id`, `user_id`, `granted_by`, `granted_at`
- `notified_email_at`, `notified_whatsapp_at`
- `note` (texto livre)

Tabela `**public_dashboard_tokens**`:

- `company_id`, `token` (uuid), `active`, `expires_at` (nullable), `created_by`
- Usada na rota pública `/painel/:token`.

Função `**award_event(_user_id, _event_key, _source_id, _description)**` (SECURITY DEFINER):

1. Lê regra de `point_rules` por `(company_id, event_key)`.
2. Valida `active`, `valid_from`, `valid_until`.
3. Conta lançamentos no `points_ledger` por janela (day/week/month/lifetime, com `source = _event_key`); se excedeu cap, retorna `{ok:false, reason:'cap_reached', cap, used}`.
4. Caso contrário chama `award_points(...)` com `source = _event_key`.
5. Retorna `{ok:true, points, new_total, awarded_at}`.

Função `**get_public_dashboard(_token)**` (SECURITY DEFINER, callable por anon): retorna JSON com ranking top 50, ranking de times, lista de prêmios ativos + últimos `reward_grants`, e progresso da meta semanal/mensal (via `company_point_goals` já existente).

## 2. Refatorar call sites para usar `award_event`

Substituir as chamadas atuais por `supabase.rpc('award_event', {...})`:

- `AvatarCustomizerButton.tsx` → `event_key = 'avatar_dicebear'` (remove o `add_points_to_profile` + `avatar_points_awarded` controlado por cap_lifetime=1)
- `BinahCapture.tsx` → `vitals_measurement`
- `RppgCapture.tsx` → `rppg_measurement`
- `MissionsTab` / triggers de missão → `mission_complete`
- `WellbeingCheckin` → `weekly_checkin`
- Adesão a medicamentos → `medication_adherence`
- ESF/Support team link triggers continuam, mas passam a respeitar `point_rules` (ajusta os triggers existentes para chamar `award_event`).

O cap antigo `avatar_points_awarded` vira redundante; mantemos a coluna por compatibilidade mas a fonte da verdade passa a ser o ledger.

## 3. Admin UI

Nova seção na sidebar de `AdminCompanyDetail` chamada **"Gamificação"** com 4 abas internas:

- **Regras de pontuação** (`AdminPointRules.tsx`): lista todos os eventos, edita pontos, caps (dia/semana/mês/lifetime), validade, ativo/inativo. Botão "Restaurar padrões".
- **Níveis** (`AdminLevels.tsx` — já existe como componente isolado, agora integrado): edição dos `levels` da empresa (nome, emoji, min_points, bonus). Permanece sem avatar (conforme decisão).
- **Prêmios** (`AdminRewards.tsx`): CRUD de `rewards` + lista de `reward_grants` com botões **Notificar por email** (abre `mailto:` pré-preenchido) e **WhatsApp** (abre `https://wa.me/<phone>?text=...`), gravando timestamp nas colunas `notified_*_at`. Botão "Entregar prêmio para usuário X".
- **Painel público** (`AdminPublicDashboard.tsx`): gera/revoga `public_dashboard_tokens`, mostra URL `https://<host>/painel/<token>`, botão copiar e QR.

## 4. Painel público

Rota nova `/painel/:token` (componente `PublicLeaderboardPage.tsx`):

- Chama `get_public_dashboard(token)` (sem auth).
- Renderiza: logo da empresa, barra de meta semanal/mensal, top 50 colaboradores com avatar+nome+pontos+nível, ranking de times, grade de prêmios ativos e mural "Últimos ganhadores".
- Layout responsivo, próprio para projeção em TV ou compartilhamento.

## 5. Toasts e UX

Quando `award_event` retornar `cap_reached`, o toast no app diz "Você já bateu o limite desta semana para esta ação" em vez de "+150 pts". UI passa a refletir o que está configurado (ex.: card do rPPG lê os pontos do `point_rules` via hook `usePointRule('rppg_measurement')` em vez de hardcoded "+50 pts").

## 6. Memória do projeto

Atualizar `mem://funcionalidades/gamificacao-pontuacao-persistente` para refletir o novo motor (`award_event` + `point_rules`).  
  
Ajustes em relação ao plano:

1. Função award_event: adicionar parâmetro opcional 

   *company*id UUID DEFAULT NULL — se NULL, deriva de [profiles.company](http://profiles.company)_id 

   como descrito; se informado, usa diretamente. Isso permite chamadas 

   fora do contexto de auth.

2. Função get_public_dashboard: no JSON de retorno do ranking, 

   usar primeiro nome + inicial do sobrenome 

   (ex: "Maria S.") em vez de full_name completo, 

   para preservar privacidade dos colaboradores no painel público.

Todo o resto exatamente como especificado no plano.

## Detalhes técnicos

- Todas as tabelas em `public` com `GRANT` apropriado, RLS por empresa (`get_user_company_id`), e admin de empresa (`is_company_admin`) com escrita.
- `points_ledger.source` passa a usar `event_key` exato; já temos `'avatar_dicebear'`, `'daily_challenge'` etc. — alinhamos os demais.
- Janelas: dia = data BRT, semana = ISO `date_trunc('week', ...)` em BRT, mês = `date_trunc('month', ...)` em BRT.
- Sem alteração no fluxo de billing, Meddit, rPPG infra, auth ou Jitsi.
- Sem envio automático de email/whatsapp (manual via mailto/wa.me por enquanto, conforme decisão).