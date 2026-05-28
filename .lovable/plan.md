## Objetivo

Permitir que o usuário clique em um desafio (em "Desafios") para abrir um box (modal) com a explicação completa: o que é, como participar e como cumprir, além dos detalhes (pontos, período, badge).

## Mudanças

### 1. `src/components/corporate/CampaignsList.tsx`
- Tornar o card inteiro clicável (cursor pointer + onClick) abrindo um `Dialog` com os detalhes do desafio selecionado.
- O botão "Participar" continua funcionando normalmente, mas com `stopPropagation` para não abrir o modal ao clicar nele.
- Adicionar um ícone discreto de "?" / "info" no canto do card para reforçar a affordance de clique.
- No modal mostrar:
  - Emoji + título grande
  - Descrição completa (sem `line-clamp`)
  - Seção **"Como participar"** — texto explicativo (usa `how_to_participate` se existir; senão fallback genérico baseado em categoria/tipo).
  - Seção **"Como cumprir"** / critério de conclusão (usa `completion_criteria` se existir; senão fallback genérico).
  - Pontos, badge, período.
  - Botão "Participar" / status "✅ Participando" dentro do modal também.

### 2. Suporte a textos editáveis pelo admin (opcional, recomendado)
Atualmente `campaigns` só tem `description`. Para suportar textos ricos de "como participar" e "como cumprir":

- **Migration**: adicionar duas colunas opcionais em `public.campaigns`:
  - `how_to_participate text` (nullable)
  - `completion_criteria text` (nullable)
- Atualizar `src/components/admin/AdminCampaigns.tsx` para incluir esses dois campos no formulário de criação/edição (textarea).
- O front (`CampaignsList`) lê esses campos; quando vazios, mostra fallback padrão.

Se preferir manter o escopo só no front por enquanto, posso pular a migration e usar apenas `description` (mostrando-o completo no modal). Vou incluir a migration por padrão para o admin poder editar a explicação.

## Arquivos

- `src/components/corporate/CampaignsList.tsx` — card clicável + Dialog com detalhes
- `src/components/admin/AdminCampaigns.tsx` — novos campos `how_to_participate` e `completion_criteria`
- Migration: `ALTER TABLE public.campaigns ADD COLUMN how_to_participate text, ADD COLUMN completion_criteria text;`

## Fora de escopo
- Não muda lógica de pontuação nem fluxo de participação.
- Não mexe em "Missões" (`MissionsTab`) — só nos cards de "Desafios" (campaigns) que aparecem na imagem.
