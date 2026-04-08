
Plano: corrigir o erro "Feature não habilitada para esta empresa" no teste do Prontuário

Resumo
- O erro atual é interno, não aponta para necessidade de VPS.
- A chamada já chega ao backend, mas o backend valida a feature pela empresa do admin logado antes de considerar a empresa que está aberta na tela.
- Também há um segundo risco: a URL salva está com `/docs/`, e isso pode quebrar as chamadas reais da API depois.

Implementação
1. Refatorar `supabase/functions/prontuario-proxy/index.ts`
   - Ler `action` e `company_id` logo no início.
   - Para `test_connection`, usar a empresa alvo recebida da tela admin.
   - Permitir esse override apenas para usuário com role `admin`.
   - Não exigir CPF nem `enabled=true` no `test_connection`; nesse caso o objetivo é só validar credenciais/URL.
   - Centralizar a normalização da `base_url` para remover `/docs` e barras finais.
   - Reaproveitar essa normalização em todas as ações (`specialities`, `professionals`, etc.), para o fluxo real não quebrar depois.
   - Padronizar a resposta de erro com `status`, `error` e trecho do body retornado pelo provedor.

2. Ajustar `src/components/admin/AdminIntegrations.tsx`
   - Fazer o save antes do teste de forma silenciosa e abortar se o save falhar.
   - Continuar enviando o `companyId` da empresa aberta no admin.
   - Exibir no toast a mensagem real retornada pelo backend/provedor, em vez de erro genérico.
   - Normalizar a URL também no save para evitar persistir `/docs/`.

Validação
- Testar no `/admin/painel` com um admin vinculado a outra empresa.
- Confirmar que o teste deixa de retornar 403 indevido.
- Confirmar que uma URL salva com `/docs/` passa a funcionar.
- Confirmar que o fluxo do usuário final continua usando a empresa do próprio usuário, sem abrir brecha de segurança.

Arquivos
- `supabase/functions/prontuario-proxy/index.ts`
- `src/components/admin/AdminIntegrations.tsx`

Impacto
- Sem migration.
- Sem VPS.
- Depois desse ajuste, qualquer erro remanescente no teste já tende a ser erro real da integração do fornecedor (ex.: chave inválida, endpoint incorreto, whitelist), e não mais da nossa lógica interna.
