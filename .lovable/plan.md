# Ajustes no Billing

## 1. Painel Admin → aba "Assinaturas"
Hoje a lista mostra apenas plano, método e datas. Vamos enriquecer:

- Buscar nome e e-mail do comprador via join com `profiles` (por `user_id`).
- Mostrar forma de pagamento de forma clara: 💳 Cartão (com bandeira + final 4 dígitos quando houver) ou 🔶 PIX.
- Adicionar coluna "Empresa" (join com `companies`) e "Afiliado" (join com `affiliates.name` quando houver).
- Filtros simples no topo: por status (active/pending/canceled) e por empresa.

Arquivo: `src/components/admin/AdminBilling.tsx` (componente `SubscriptionsView`).

## 2. Portal do Afiliado (novo)

Rota pública autenticada `/afiliado` onde o afiliado vê suas vendas (somente leitura).

**Acesso**: login normal (Supabase Auth). Liga-se a `affiliates` por e-mail. Adicionar coluna `user_id` em `affiliates` (nullable) e popular automaticamente no primeiro login se o e-mail bater.

**Tela** (`src/pages/AffiliatePortal.tsx`):
- Header: nome, código de indicação, link pronto para copiar (`https://saude.saudecomvc.com.br/assinar/{slug}?ref={code}`), comissão %.
- Cards de resumo: total de assinantes ativos, MRR estimado, comissão acumulada (paga + pendente).
- Tabela de assinaturas indicadas: nome do comprador, empresa/plano, método de pagamento, status, data, valor da comissão.
- Tabela de comissões (`affiliate_commissions`): status (pending/paid), valor, data.

**Segurança (RLS)**: novas policies somente-leitura no `affiliates`, `subscriptions` e `affiliate_commissions` filtrando por `affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())`. Nada de UPDATE/DELETE pelo afiliado.

**Login**: reaproveitar `/login` existente; após autenticar, se o usuário tem registro em `affiliates` (via user_id ou email) e clicou no link do portal, redireciona para `/afiliado`. Adicionar link "Sou afiliado" em algum ponto discreto (ex: rodapé do `/login`).

## Detalhes técnicos

- Migration: `ALTER TABLE affiliates ADD COLUMN user_id uuid REFERENCES auth.users(id)`; trigger ou função `link_affiliate_to_user()` que roda no signin/edge para casar email→user_id.
- Novas RLS policies em `subscriptions` e `affiliate_commissions`: "Affiliate reads own referrals".
- Frontend: criar `src/pages/AffiliatePortal.tsx`, adicionar rota em `src/App.tsx`, proteger com `ProtectedRoute`.
- O afiliado **não** vê CPF nem dados sensíveis — apenas nome (do profile) e e-mail.

## Validação
1. Admin → Billing → Assinaturas: verificar nome do comprador e método visíveis.
2. Logar com Rodrigo (afiliado `7C2A1621`) em `/afiliado`: ver a assinatura de teste recém-criada, valor de comissão e link para copiar.
3. Tentar editar/deletar via console do navegador: deve falhar (RLS).