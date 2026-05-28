## Causa raiz

### 1. Popup de onboarding volta mesmo "completo"
`PointsOnboardingTour` decide se mostra com base em `profiles.points_tour_completed` (banco) e tem timer de **5 min** que reabre se `points_tour_completed = false`. O `FirstStepsCard` (botões "Já fiz ✓") só grava no `localStorage`, nunca atualiza o banco. Conclusão: card desaparece, popup continua reabrindo.

### 2. Endereço/CEP/Cidade não editáveis no Perfil
Em `src/components/mayla/ProfileTab.tsx` linhas 395–397, os três `<InfoRow>` (`cep`, `endereco`, `cidade`) são renderizados **sem a prop `editField`**. O `InfoRow` cai no fallback de texto quando `editField` está ausente, mesmo com `editing=true`. Os demais campos (peso, altura, sexo etc.) passam `editField` e funcionam.

## Correções

### A. `src/components/mayla/FirstStepsCard.tsx`
No `useEffect` que dispara a celebração (quando `allDone`), além de marcar `dismissed` no localStorage e exibir o toast, fazer:
```ts
await supabase.from("profiles")
  .update({ points_tour_completed: true, points_tour_dismissed_at: null })
  .eq("user_id", user.id);
```
Isso silencia o `PointsOnboardingTour` permanentemente.

### B. `src/components/mayla/ProfileTab.tsx`
Adicionar `editField` para os 3 InfoRows de endereço:

- **CEP** — `<Input maxLength={9}>` ligado a `form.cep`, com formatação simples `12345-678`.
- **Endereço (linha)** — três `<Input>` empilhados no `editField`: `endereco` (rua), `numero`, `complemento`, `bairro`, todos ligados a `form.*`.
- **Cidade** — dois inputs: `cidade` e `estado` (UF, maxLength=2 uppercase).

A função `save()` já inclui esses campos no `payload` (linha 281: `endereco: form.endereco` está presente — confirmar que os demais também são gravados; se faltar algum, completar o update).

Sem mudanças em banco, sem nova dependência.

## Fora de escopo
- Autocompletar CEP via ViaCEP (já existe no `HealthSurvey`, mas adicionar aqui seria expansão).
- Mexer no `PointsOnboardingTour` em si.

## Arquivos tocados
- `src/components/mayla/FirstStepsCard.tsx`
- `src/components/mayla/ProfileTab.tsx`
