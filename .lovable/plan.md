# Redesign do LeaderboardScreen

Substituir apenas o JSX de apresentação do `src/components/mayla/LeaderboardScreen.tsx`. Lógica de dados, queries Supabase, props (`onBack`), estado (`period`, `rows`, `loading`) e toggle "Este mês / Geral" permanecem idênticos.

## Escopo

- **Arquivo único alterado:** `src/components/mayla/LeaderboardScreen.tsx`
- **Nenhuma outra tela, hook, query ou tipo é tocado.**
- Sem mudanças em `useGamification`, `company_leaderboard`, `MaylaApp`, `HomeTab`.

## Blocos visuais

**1. Header**

- Linha com `← Voltar` à esquerda e título "Ranking" centralizado (mesmo padrão das outras telas Mayla).
- Logo abaixo, toggle pill "Este mês / Geral": ativo usa `bg-primary text-primary-foreground`, inativo `bg-card text-muted-foreground border border-border`. Comportamento atual mantido.

**2. Pódio Top 3** (substitui o bloco atual de barras gradiente)

- Container: `bg-card rounded-2xl shadow-sm p-5` com leve padding interno.
- Ordem visual: 2º | 1º | 3º, com 1º elevado ~8px.
- Avatares circulares com iniciais do `full_name`:
  - 1º: ~64px, fundo `bg-primary text-primary-foreground`
  - 2º e 3º: ~48px, fundo `bg-secondary text-secondary-foreground`
- Medalha (🥇🥈🥉) como badge absoluto no canto superior do avatar.
- Abaixo: primeiro nome truncado (`text-sm font-semibold text-foreground`) e pontos (`text-xs text-muted-foreground`).

**3. Lista (posição 4+)**

- Cada item: `bg-card rounded-xl shadow-sm p-3 flex items-center gap-3`
  - Número da posição: largura fixa `w-6 text-muted-foreground text-sm`
  - Avatar circular ~36px com iniciais, fundo `bg-secondary`
  - Coluna central: nome (`text-sm font-medium text-foreground`) e pontos abaixo (`text-xs text-muted-foreground`)
  - Direita: badge de nível quando `current_level` existir (`bg-accent/15 text-accent rounded-full px-2 py-0.5 text-[10px] font-semibold`)
- Espaçamento `space-y-2`, sem dividers.
- Item do usuário logado: `border-l-[3px] border-primary bg-primary/8`.

**4. Sticky "Você"**

- Mantido quando o usuário está fora do top 3 visível, mesmo conteúdo, repintado com tokens (`border-primary bg-primary/10`).

**5. Estado vazio**

- 🏆 grande centralizado, título "Nenhum resultado ainda" (`text-foreground font-medium`), subtexto "Complete missões e desafios para aparecer no ranking" (`text-sm text-muted-foreground`).

**6. Loading**

- `Skeleton` de `@/components/ui/skeleton`: bloco do pódio (3 colunas com círculos + barras) + 5 linhas de lista.

## Tokens

Apenas tokens semânticos do design system: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `border-border`, `accent`. Nenhum `text-white`, `bg-black` ou hex hardcoded.

## Helper interno

Pequena função `initials(name)` dentro do arquivo para extrair 1–2 iniciais do `full_name` (sem nova dependência).

## Fora de escopo

- Lógica de ranking, RPC, view `company_leaderboard`.
- Outras telas, navegação, props de `MaylaApp`.
- Animações além das já existentes (`animate-fade-up`).  
  
Execute o redesign do LeaderboardScreen conforme o plano levantado, 
  com dois ajustes:
  - Substituir bg-primary/8 por bg-primary/10 em todos os lugares
  - Substituir bg-accent/15 por bg-accent/10 no badge de nível
  Todo o resto exatamente como especificado no plano.