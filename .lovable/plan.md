

## Plano: Corrigir RLS de campaigns para admin + error handling

### Problema
A tabela `campaigns` só tem policies para `company_admin`, `wellbeing_manager` e `employee`. O role global `admin` não consegue inserir/ler campanhas. O insert falha silenciosamente porque o código não verifica erros.

### Correções

#### 1. Migration: Adicionar policy de admin na tabela `campaigns`
```sql
CREATE POLICY "Admins can manage campaigns"
ON public.campaigns
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

#### 2. `AdminCampaigns.tsx`: Adicionar verificação de erros no save
- Checar `error` no retorno do insert/update
- Exibir `toast.error` com a mensagem do erro ao invés de mostrar sucesso silencioso

### Arquivos
- Migration SQL — nova policy para admin
- `src/components/admin/AdminCampaigns.tsx` — error handling no save

