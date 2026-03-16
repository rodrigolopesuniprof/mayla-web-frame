

## Plano: Corrigir visibilidade de times e campanhas para usuário José (Uniprof)

### Diagnóstico

Após investigação detalhada no banco de dados e no código:

1. **Dados existem corretamente** — José tem `company_id` apontando para Uniprof, a função `get_user_company_id()` retorna o ID correto, e existem 2 times, 13 campanhas e 5 programas criados para Uniprof.

2. **RLS está correto** — As políticas permitem que usuários autenticados vejam dados da sua empresa.

3. **Problema real: José está preso na tela de onboarding/splash** — O replay da sessão mostra a tela "Começar agora", o que significa que o app nunca chega à aba principal onde times e campanhas são exibidos. Apesar do banco mostrar `health_survey_completed: true`, a lógica atual no `MaylaApp.tsx` exige que AMBOS `health_survey_completed` E `health_survey_completed_at` sejam truthy. Se por qualquer razão o select retornar null (ex: timing de carregamento), o app cai no `else` → splash.

### Correções

**1. MaylaApp.tsx — tornar a lógica de verificação mais resiliente**

O problema é que a condição na linha 43 exige tanto `health_survey_completed` quanto `health_survey_completed_at`. Se o campo `health_survey_completed_at` estiver null (perfis que completaram antes da migração e o backfill falhou), o app manda para splash mesmo com survey completado.

Corrigir para:
- Se `health_survey_completed = true` → ir para `main` (independente de `health_survey_completed_at`)
- Só verificar expiração de 6 meses se `health_survey_completed_at` existir
- Tratar o caso onde `health_survey_completed_at` é null mas `health_survey_completed` é true (legado)

**2. Adicionar log de debug temporário (opcional)**

Para investigação futura, adicionar um `console.log` com o resultado da query de perfil para confirmar o que o app está recebendo.

### Arquivo modificado
- `src/components/mayla/MaylaApp.tsx` — lógica de verificação do survey (linhas 41-58)

### Lógica proposta

```typescript
.then(({ data }) => {
  const profile = data as any;
  if (profile?.health_survey_completed) {
    // Check 6-month expiration only if we have a timestamp
    if (profile.health_survey_completed_at) {
      const completedAt = new Date(profile.health_survey_completed_at);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (completedAt > sixMonthsAgo) {
        setPhase("main");
        return;
      }
      // Expired
      supabase.from("profiles").update({ health_survey_completed: false }).eq("user_id", user.id).then(() => setPhase("splash"));
      return;
    }
    // Legacy: completed but no timestamp — go to main, set timestamp now
    supabase.from("profiles").update({ health_survey_completed_at: new Date().toISOString() }).eq("user_id", user.id);
    setPhase("main");
  } else {
    setPhase("splash");
  }
});
```

