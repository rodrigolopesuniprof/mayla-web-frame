
# Reorganização: Billing por empresa

Hoje o Billing é uma aba global do Admin com listagens cruzando todas as empresas. Vamos movê-lo para dentro de cada empresa, mantendo 100% das funcionalidades atuais — só muda a organização e o escopo dos dados exibidos.

## Nova estrutura de navegação

```
Admin
├── 📊 Dashboard
├── 🏢 Empresas
│   └── [Empresa X]
│       ├── 🏢 Dados da Conta
│       ├── 👥 Usuários
│       ├── 📋 Pesquisas
│       ├── 🌿 Programas
│       ├── 🩺 Serviços Médicos
│       ├── 🏪 Serviços Gerais
│       ├── 🔌 Integrações
│       ├── 📢 Notificações
│       ├── 📰 Magazine
│       └── 💳 Billing            ← NOVO
│            ├── 🔑 Credenciais Pagar.me
│            ├── 📦 Planos
│            ├── 🔗 Links de cobrança
│            ├── 🤝 Afiliados
│            └── 📋 Assinaturas
├── 👩‍⚕️ Assistente
└── 📰 Magazine Global
```

A aba global "💳 Billing" do topo do Admin é **removida**.

## Comportamento por seção (escopo = empresa atual)

- **Credenciais**: já é 1 registro por empresa em `company_payment_credentials`. Apenas pré-seleciona a empresa atual e remove o seletor.
- **Planos**: cada empresa tem seu próprio catálogo. CRUD lista/edita só os planos daquela empresa.
- **Links de cobrança**: substitui a aba "Planos por empresa". Mostra os planos ativos da empresa com botão "🔗 Copiar link" (`/assinar/{slug}?plan={id}`) e "↗ Pré-visualizar".
- **Afiliados**: lista, edita, KYC e link de afiliado filtrados por `company_id` da empresa atual. Criar afiliado já vem amarrado àquela empresa.
- **Assinaturas**: lista filtrada por `company_id` da empresa, com nome do comprador, plano, método (cartão/PIX) e afiliado — igual hoje, só restringido.

Nada muda em Subscribe.tsx, AffiliatePortal, edge functions de Pagar.me, webhook, splits ou cron. O fluxo do cliente final continua idêntico.

## Mudança no schema

`subscription_plans` hoje é global (sem `company_id`). Para autonomia real por empresa:

- Adicionar coluna `company_id uuid` (nullable, FK lógica para `companies`).
- Backfill: para cada linha existente, copiar o `company_id` do primeiro `company_plan_assignments.active = true` associado; planos sem nenhuma atribuição ficam com `company_id = null` (planos legados/globais — invisíveis na nova UI por empresa, mas preservados para não quebrar assinaturas existentes).
- Índice em `(company_id, active)`.
- RLS: super admin gerencia tudo (já existe); leitura pública passa a permitir `company_id IS NULL OR company_id = <qualquer>` (mantém compat com Subscribe.tsx, que continua usando `company_plan_assignments`).
- Ao criar/editar plano dentro da empresa, gravar `company_id = empresaAtual` e fazer upsert automático em `company_plan_assignments` (mantém Subscribe.tsx funcionando sem alterações).

Não mexemos em `affiliates`, `subscriptions`, `affiliate_commissions`, `company_payment_credentials` — todos já têm `company_id`.

## Arquivos a editar

- **`src/pages/Admin.tsx`** — remover a aba "💳 Billing" e o import de `AdminBilling`.
- **`src/components/admin/AdminCompanyDetail.tsx`** — adicionar a seção `billing` ao `SECTIONS` e renderizar `<AdminBilling companyId={company.id} />`.
- **`src/components/admin/AdminBilling.tsx`** — aceitar `companyId`, repassar para os subcomponentes; renomear "Planos por empresa" → "Links de cobrança" e mostrar só os planos da empresa atual.
- **`src/components/admin/AdminBillingCredentials.tsx`** — receber `companyId`, carregar/salvar só o registro daquela empresa, sem seletor.
- **`src/components/admin/AdminBillingPlans.tsx`** — receber `companyId`, filtrar `subscription_plans` por essa coluna, gravar `company_id` no insert e fazer upsert em `company_plan_assignments`.
- **`src/components/admin/AdminBillingAffiliates.tsx`** — receber `companyId`, filtrar listagem, fixar `company_id` ao criar/editar, restringir o seletor de empresa do link.
- **Migration** — `ALTER TABLE subscription_plans ADD COLUMN company_id uuid;` + backfill + índice.

## Validação

1. Abrir empresa Mayla → 💳 Billing → todas as 5 sub-abas carregam só dados da Mayla.
2. Criar um plano dentro de outra empresa não aparece para a Mayla.
3. Copiar link de cobrança → checkout abre travado naquele plano (sem `ref` = sem afiliado).
4. Criar afiliado dentro da empresa, copiar link `?ref=...`, comprar → assinatura aparece em Mayla → Billing → Assinaturas com nome do comprador, método, afiliado.
5. Webhook, cron PIX, AffiliatePortal, MySubscription, Subscribe.tsx continuam funcionando sem alterações.
