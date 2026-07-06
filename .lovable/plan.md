
## Objetivo

Corrigir dois pontos do módulo de Ligas:

1. **Link de convite** está usando `window.location.origin`, que no preview vira `*.lovableproject.com`. Precisa usar o domínio de produção `https://saude.saudecomvc.com.br`.
2. **UX**: Ligas abrem numa rota separada (`/ligas`, `/ligas/:id`), tirando o usuário do fluxo da aba **Desafios**. A ideia original é manter tudo concentrado dentro de "Desafios", como já é feito com "Ranking" e "Minhas Missões".

## Mudanças

### 1. Link de convite com domínio de produção

Em `LeagueDetail.tsx` (função `copyInvite`) e em qualquer outro ponto que gere URL de convite, trocar:

```
`${window.location.origin}/liga/${invite_code}`
```

por uma constante `PROD_URL = "https://saude.saudecomvc.com.br"` já usada no projeto (memória `tecnico/configuracao-dominio-producao`), gerando:

```
`${PROD_URL}/liga/${invite_code}`
```

A rota `/liga/:code` continua existindo em `App.tsx` para receber quem clicar no link.

### 2. Ligas dentro da aba "Desafios"

**Padrão existente**: `CampanhasTab.tsx` já usa `subView` para alternar entre "overview" e "missions" sem sair da aba. Vamos aplicar o mesmo padrão para ligas.

**`CampanhasTab.tsx`**
- Adicionar novos sub-views: `"leagues" | "league-detail"`.
- Adicionar botão "Minhas Ligas" (card no mesmo estilo de "Ranking" / "Minhas Missões"), visível somente se `companies.leagues_enabled = true` (checar via hook/query já usado no `MyLeagueCard`).
- Renderizar componentes internos ao invés de navegar:
  - `subView === "leagues"` → `<LeaguesPanel onOpen={(id) => setSubView({ view:'league-detail', id })} onBack={() => setSubView('overview')} />`
  - `subView === "league-detail"` → `<LeagueDetailPanel leagueId={id} onBack={() => setSubView('leagues')} />`

**Novos componentes (extraídos das páginas atuais, sem `min-h-screen`, sem `nav("/...")`, com `onBack` prop):**
- `src/components/mayla/leagues/LeaguesPanel.tsx` — conteúdo hoje em `pages/Leagues.tsx`.
- `src/components/mayla/leagues/LeagueDetailPanel.tsx` — conteúdo hoje em `pages/LeagueDetail.tsx`.

Ambos usam `TopBar` com título e botão voltar, mantendo o layout mobile da aba.

**`MyLeagueCard.tsx` (HomeTab)**
- Trocar `nav("/ligas")` / `nav("/ligas/:id")` por uma prop `onOpenLeagues: () => void` fornecida pelo `HomeTab`, que muda a aba ativa para "campanhas" e sinaliza abrir sub-view de ligas.
- `MaylaApp` já gerencia `active` tab; adicionar estado inicial de sub-view da aba Desafios ou usar um pequeno event/prop drilling (`campanhasInitialView`).

**Rotas em `App.tsx`**
- Manter `/liga/:code` (LeagueJoin) — é a landing pública do convite; após aceitar, redireciona para `/` (aba Desafios abrindo a liga).
- Remover as rotas `/ligas` e `/ligas/:id` do `App.tsx` (ou deixá-las como fallback opcional). Recomendação: **remover**, pois tudo passa a viver dentro da aba.

**`LeagueJoin.tsx`**
- Após entrar na liga, em vez de `nav("/ligas/:id")`, navegar para `/` e sinalizar (via `sessionStorage` ou query param) que a aba Desafios deve abrir direto no detalhe da liga recém-aceita. O `MaylaApp`/`CampanhasTab` lê esse sinal no mount e limpa.

### 3. Limpeza

- `AdminCompanySettings` continua controlando `leagues_enabled` normalmente.
- Excluir `src/pages/Leagues.tsx` e `src/pages/LeagueDetail.tsx` (substituídos pelos panels), mantendo `LeagueJoin.tsx`.

## Detalhes técnicos

- Nenhuma mudança de schema/DB.
- Constante do domínio: reutilizar o mesmo padrão já existente no projeto (memória) — se não houver constante exportada, criar `src/lib/production-url.ts` com `export const PROD_URL = "https://saude.saudecomvc.com.br";`.
- Sem alteração em RLS/edge functions.

## Arquivos afetados

- Criar: `src/components/mayla/leagues/LeaguesPanel.tsx`, `LeagueDetailPanel.tsx`, `src/lib/production-url.ts`.
- Editar: `src/components/mayla/CampanhasTab.tsx`, `src/components/mayla/MyLeagueCard.tsx`, `src/components/mayla/HomeTab.tsx`, `src/components/mayla/MaylaApp.tsx`, `src/pages/LeagueJoin.tsx`, `src/App.tsx`.
- Excluir: `src/pages/Leagues.tsx`, `src/pages/LeagueDetail.tsx`.
