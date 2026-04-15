

# Plano: Corrigir nome do paciente e embutir relatório no painel

## Problemas identificados

### 1. Nome em branco ("Paciente")
O `LinkedPatients` busca o nome do paciente na tabela `profiles` via cliente autenticado do profissional. Mas as policies RLS de `profiles` só permitem que o usuário veja **seu próprio** perfil. O profissional (João Lopes) não tem permissão para ler o perfil do paciente (Machado de Assis) — a query retorna vazio.

**Correção**: Nova RLS policy em `profiles` que permite ao profissional ler nomes de pacientes vinculados via `prontuario_connections`.

### 2. Relatório não carrega (ERR_BLOCKED_BY_RESPONSE)
Dois problemas:
- A edge function `report-access` usa `userClient.auth.getClaims(tokenStr)` — esse método **não existe** no Supabase JS SDK v2. Isso causa erro 401 imediato.
- O `window.open` abre em nova aba, mas o usuário quer o relatório **embutido na mesma tela**.

**Correção**:
- Substituir `getClaims` por `getUser()` na edge function.
- Embutir o `ProfessionalReport` diretamente no painel (inline, sem abrir nova aba), usando o modo embed já existente.

## Mudanças

### 1. Migração: RLS para profissionais lerem nomes de pacientes vinculados
```sql
CREATE POLICY "Professionals can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT pc.user_id FROM prontuario_connections pc
    WHERE pc.active = true
    AND pc.internal_partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  )
);
```

### 2. Edge function `report-access` — corrigir autenticação
- Substituir `getClaims(tokenStr)` por `getUser()` que retorna o user com `id` (sub).

### 3. `LinkedPatients.tsx` — embutir relatório inline
- Ao clicar "Ver relatório", em vez de `window.open`, mostrar o `ProfessionalReport` embutido na mesma tela (com botão "Voltar").
- Usar o modo embed (`?view=embed`) para layout compacto.

## Arquivos afetados
- Nova migração SQL (RLS profiles)
- `supabase/functions/report-access/index.ts` (corrigir getClaims → getUser)
- `src/components/professional/LinkedPatients.tsx` (relatório inline)

