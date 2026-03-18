

# Plano: Corrigir questionário aparecendo repetidamente (regra 180 dias)

## Problemas identificados

1. **Re-execução do useEffect**: O `useEffect` em `MaylaApp.tsx` depende de `[user]`. Cada vez que o token de autenticação é renovado, o objeto `user` muda de referência, o efeito re-executa, e pode mandar o usuário de volta ao splash/onboarding/survey — mesmo que já tenha respondido.

2. **Sem guarda contra múltiplas execuções**: Uma vez que `setPhase("splash")` é chamado, o splash auto-avança para onboarding em 2.6s, e o onboarding leva direto ao survey — sem nenhuma verificação intermediária se o survey já foi respondido.

3. **Race condition**: Se a query ao profiles falha ou demora, o `else` na linha 66 manda para splash.

## Solução

### Em `MaylaApp.tsx`:
- Usar `user?.id` como dependência em vez de `user` (evita re-execução por mudança de referência)
- Adicionar flag `hasChecked` para executar a lógica apenas uma vez
- Tratar o caso de erro/null na query (se profile é null e user existe, ir para splash apenas na primeira vez)
- Na transição onboarding → survey, re-verificar o perfil no banco antes de mostrar o survey

### Em `HealthSurvey.tsx`:
- O código já salva `health_survey_completed: true` e `health_survey_completed_at` corretamente (linhas 265-266 e 728-729). Sem alteração necessária.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/mayla/MaylaApp.tsx` — corrigir dependência do useEffect, adicionar guard, re-verificar perfil antes de mostrar survey |

