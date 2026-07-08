## Objetivo
Substituir a aba "Desafios" atual pela nova tela de Ligas.

## Mudanças

1. **`src/components/mayla/MaylaApp.tsx`**
   - No roteamento da aba `desafios` (ou equivalente do BottomNav), renderizar direto o `LeaguesPanel` (com suporte a abrir `LeagueDetailPanel` via `onOpen`), no lugar do componente atual (`CampanhasTab` / `MissionsTab` / o que estiver hoje).
   - Manter o rótulo "Desafios" e o ícone atuais no BottomNav — só troca o conteúdo.

2. **Arquivar a tela antiga**
   - Não deletar o arquivo (`CampanhasTab.tsx` ou o que estava sendo usado). Apenas remover a importação/uso em `MaylaApp.tsx` para que fique fora do bundle ativo, preservando o código caso queira restaurar.

3. **Sem mudanças de backend, tokens, ou no módulo Ligas** — a `LeaguesPanel` continua idêntica à recém-construída.

## Observação
Confirmo antes de tocar em qualquer coisa: a aba "Desafios" hoje mostra "Minhas missões / Minhas ligas / Programas de Bem-estar" (screenshot). Ao clicar em Desafios você quer ir **direto** ao hub de Ligas novo (sem esse menu intermediário), certo? Se sim, sigo com o plano acima.
