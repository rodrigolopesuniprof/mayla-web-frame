

## Plano: Corrigir RLS de wellbeing_programs para admin

### Problema
A tabela `wellbeing_programs` não tem policy para o role `admin`. Só tem policies para `company_admin`, `wellbeing_manager` e `employees`. O insert falha silenciosamente por RLS.

### Correção

#### 1. Migration: Adicionar policy de admin
```sql
CREATE POLICY "Admins can manage wellbeing programs"
ON public.wellbeing_programs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

#### 2. AdminPrograms.tsx: Verificar erros no save
Adicionar checagem de `error` no retorno do insert/update para mostrar toast de erro ao invés de sucesso silencioso.

### Arquivos
- Migration SQL — nova policy
- `src/components/admin/AdminPrograms.tsx` — error handling no save

