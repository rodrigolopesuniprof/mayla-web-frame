## Módulo de Ligas — reformular hub e telas

Refazer o hub de "Desafios" e as telas de liga seguindo o conceito Mayla: **Liga Mayla = ranking geral**, ligas privadas são recortes do mesmo placar. Backend já pronto (`mayla_ranking`, `league_ranking`, `user_xp`, view `league_prize_eligible`, tabela `referral_rewards`) — o front apenas consome.

### 1. Hub Desafios (`CampanhasTab.tsx`)
- Remover o card "Ranking" (a Liga Mayla já é o ranking geral).
- Substituir o topo por uma **faixa de estado da semana** (posição atual do usuário na Liga Mayla + `pontos_semana / meta`), lida via `mayla_ranking` + `get_effective_goals`.
- Manter o card "Minhas Missões" e Wellbeing/Campanhas abaixo.
- Ao entrar na sub-view de ligas, abrir direto o novo hub de ligas (sem passar por Ranking).

### 2. Hub de Ligas (`LeaguesPanel.tsx`) — "Minhas ligas"
Layout novo:
- **Banner de recompensa** (topo): "Convide e ganhe R$10 por adesão · Top 3 ganham prêmios toda semana".
- **Card fixo Liga Mayla** (sempre primeiro, mesmo sem ligas privadas):
  - Ícone troféu, nome "Liga Mayla", sub "Geral · N participantes".
  - Pill de posição do usuário + barra `pontos_semana / meta` + "Nível X" (via `user_xp` + `get_effective_levels`).
  - Clicar abre o detalhe da Liga Mayla (mesma tela 5.2, mas modo "geral").
- **Cards das ligas privadas** do usuário: logo, nome, "Privada · N participantes", pill de posição, barra de meta. Aviso "Faltam X membros para desbloquear prêmios Mayla" quando `league_prize_eligible.membros < 10`.
- **Ligas públicas** da empresa (não participadas) mantidas em seção separada abaixo.
- **Rodapé fixo:** botão primário "Criar liga" (desabilitado + tooltip se já existe 1 ativa) + botão secundário "Entrar por código" (abre dialog com input do `invite_code`). Linha fina: "Você pode criar 1 liga · participar de quantas quiser".

### 3. Detalhe da Liga (`LeagueDetailPanel.tsx`)
Reorganizar em **3 abas** (Tabs shadcn): Ranking / Desafios / Membros.
- **Header:** marca, nome, N participantes, **data de criação**, badge "Prêmio Mayla ativo" ou "Faltam X para desbloquear" (via `league_prize_eligible`).
- **Ranking:** top 3 destacado (âmbar sutil) + lista com posição, avatar, nome, `pontos_semana`, Nível. Fonte: `league_ranking` (ou `mayla_ranking` no modo Liga Mayla).
- **Desafios:** listar `league_challenges` da semana (título, meta, prêmio). Read-only.
- **Membros:** avatar, nome, papel. Ações de gestão (expulsar, promover coadmin, arquivar) movidas para tela **Gerir** acessível por botão "Gerir" no header quando dono/coadmin.
- Manter caixa "Atividades que pontuam" no modo edição (dono).
- Botão "Sair da liga" (não-dono) e "Convidar" (abre tela 5.4).
- Selo de recompensa de convite (pendente/carência/elegível/pago) lendo `referral_rewards` do usuário logado quando dono/coadmin.

### 4. Criar Liga
- Manter dialog atual, mas adicionar **upload de logo/marca** (`storage.company-logos` ou novo bucket `league-logos` — usar `company-logos` se aceitar path por liga).
- Após criar, mostrar `invite_code` e link compartilhável (`PROD_URL/liga/<code>?ref=<affiliate>`).
- Bloquear com toast se já houver 1 liga ativa criada pelo usuário (checagem no client + trigger no banco continua guarda final).

### 5. Convidar (nova sub-view/modal)
- Exibir link + QR (usar `qrcode.react`, já presente ou instalar).
- Campo de contato (telefone/e-mail) com **checkbox de consentimento LGPD** antes de habilitar "Enviar convite" → cria `league_invites` com `affiliate_code` do dono.
- Tabela de convites enviados com status (enviado/cadastrado/assinou) via `league_invites` + join com `referral_rewards`.
- Selo "R$10 quando o convidado assinar e passar a carência" com estado real.

### 6. Gerir Liga (dono/coadmin) — sub-view
- Lista de membros com Expulsar (`delete` em `league_members`).
- **Promover coadmin** (só dono, usa update de `papel`).
- **Arquivar liga** (só dono, confirmação).
- Editar marca/logo e atividades que pontuam.

### 7. Gamificação visível
- Barra `pontos_semana / meta` no card da liga e no hub Desafios.
- Streak (dias ativos na semana) via consulta simples em `points_ledger`.
- Toast "Você subiu para 2º na {liga}" ao detectar mudança de posição entre cargas.
- Selo de recompensa de convite com os 4 estados de `referral_rewards.status`.
- Separação visual: **Nível** (vitalício, `user_xp`) vs **Pontos da semana** (zera).

### 8. Design tokens
- Não introduzir cores hard-coded. Se faltar tom âmbar/dourado sutil para top 3, adicionar variáveis `--gold`, `--gold-foreground` em `index.css` e mapear no `tailwind.config.ts`. Reutilizar `--primary` (azul-marinho), `--accent`, `--muted` do tema atual. Botões/labels em sentence case.

### 9. Fora do escopo
- Motor de comissão de afiliado (`referral_rewards` só é lido).
- Envio real de convites por SMS/e-mail (front cria o `league_invites`; entrega fica para edge function futura — deixamos o hook pronto).
- Escrita em `points_ledger` a partir de missões de liga (missão de liga dá badge, não ponto).

### Arquivos afetados
- `src/components/mayla/CampanhasTab.tsx` — faixa de estado, remover card Ranking.
- `src/components/mayla/leagues/LeaguesPanel.tsx` — reescrita do hub (Liga Mayla fixa, banner, entrar por código).
- `src/components/mayla/leagues/LeagueDetailPanel.tsx` — tabs, header com data/badge de prêmio.
- Novos: `LeagueManagePanel.tsx`, `LeagueInvitePanel.tsx`, `LeagueMaylaVirtualId.ts` (helper para modo Liga Mayla).
- `src/lib/mayla-config.ts` (se precisar constante do id virtual da Liga Mayla).
- `src/index.css` + `tailwind.config.ts` — token opcional `--gold`.
- Possível migration leve: garantir índice/consulta eficiente para `league_challenges` por semana, se ainda não existir. Sem alterações de RLS.

### Não vou mexer
- `LeagueJoin.tsx` (já captura `?ref=` e roteia para hub).
- Backend RPCs/tabelas — já correspondem ao contrato.
- Motor de afiliado/comissão.