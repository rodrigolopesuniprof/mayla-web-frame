## Mudanças

### `src/lib/first-steps.ts`
Adicionar suporte a marcação manual por passo + dismiss permanente:
- Novas chaves: `manual:profile`, `manual:assessment`, `manual:rppg`, `manual:campaigns`, `manual:ranking`, `dismissed`.
- Reaproveita `markFirstStep` / `hasFirstStep` (mesmo padrão `localStorage` + evento `first-steps-refresh`).

### `src/components/mayla/FirstStepsCard.tsx`
1. Cada passo passa a ter uma `manualKey`. O passo é considerado concluído se: (estado real OU flag automática anterior) **OU** flag manual.
2. Em cada `<li>` pendente, exibir um botão à direita "Já fiz ✓" que chama `markFirstStep(user.id, manualKey)` e dispara o refresh.
3. Quando `completedCount === STEPS.length`:
   - Mostrar `toast` com `🎉 Parabéns! Você completou os primeiros passos.` (usar `@/hooks/use-toast` que já existe no projeto).
   - Marcar `dismissed` no localStorage.
   - Esconder o card permanentemente (já existe `return null`, mas agora respeita também `dismissed` flag para não voltar caso algum dado mude).
4. Animação simples de celebração: usar `animate-fade-up` (já existente) num overlay de confete leve com emojis 🎉✨ por ~1.5s antes de esconder (sem deps novas — apenas um `div` absoluto com opacity transition).

Sem mudanças em banco, sem nova dependência.

## Fora de escopo
- Pontuação real ao marcar manualmente (manual é só visual).
- Sincronização cross-device (fica em localStorage).

## Arquivos tocados
- `src/lib/first-steps.ts`
- `src/components/mayla/FirstStepsCard.tsx`
