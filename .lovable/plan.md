

## Plano: Corrigir rPPG e HealthTab na versão B2B

### Problemas identificados

1. **HealthTab não está renderizado** — O componente `HealthTab` (que contém o rPPG) não é exibido em nenhuma aba do `MaylaApp`. O botão "Medir" na Home navega para `bemestar` (WellbeingTab), que NÃO contém rPPG.

2. **HealthTab usa `useMunicipality`** — Importa o contexto antigo B2G em vez de `useCompany`.

3. **Perfil não é criado** — Todas as queries ao `profiles` retornam 0 rows. O trigger `handle_new_user` aparentemente não executou para esse usuário (provavelmente criado antes do trigger existir). Isso impede o CompanyContext de funcionar.

### Correções

#### 1. Integrar HealthTab/rPPG no WellbeingTab
- Adicionar o botão de medição rPPG e o componente `RppgCapture` diretamente no `WellbeingTab`, já que é a aba que o botão "Medir" da Home aponta.
- Incluir: CTA de medição rPPG, exibição da última medição, gráfico de tendência BPM, e histórico — tudo que estava no HealthTab.

#### 2. Substituir `useMunicipality` por `useCompany`
- Em `HealthTab.tsx` (e em qualquer referência que permanecer), trocar para `useCompany` do `CompanyContext`.

#### 3. Corrigir CompanyContext para não quebrar com perfil inexistente  
- Usar `.maybeSingle()` em vez de `.single()` nas queries ao profiles no `CompanyContext.tsx` para evitar erros 406 quando o perfil ainda não existe.
- Tentar obter o `company_id` do `user_metadata` como fallback quando o perfil não existe.

#### 4. Criar migration para perfil retroativo
- Criar uma migration com uma função que insere perfil para usuários que já existem mas não têm perfil (usando `ON CONFLICT DO NOTHING`).

### Arquivos a modificar
- `src/components/mayla/WellbeingTab.tsx` — Adicionar rPPG capture + medições + CTA
- `src/contexts/CompanyContext.tsx` — Trocar `.single()` por `.maybeSingle()`, fallback para user_metadata
- Migration SQL — Backfill profiles para usuários existentes

### Detalhes técnicos
- O `CompanyContext` faz 2 queries com `.single()` que retornam 406 quando não há perfil → trocar para `.maybeSingle()`
- O `company_id` está disponível em `user.user_metadata.company_id` como fallback
- O `WellbeingTab` já tem `useCompany` importado, então adicionar rPPG lá é natural

