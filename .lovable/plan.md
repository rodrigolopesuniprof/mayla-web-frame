# Link de cobrança direto por produto (sem afiliado)

## Comportamento
A página `/assinar/:slug` já aceita `?ref=` para afiliado. Vamos adicionar suporte a `?plan=<plan_id>`:

- Quando `plan` está presente e válido (atribuído e ativo na empresa), o checkout pré-seleciona aquele plano e **oculta** os outros — fluxo direto produto → pagamento.
- Quando `plan` é inválido ou não atribuído à empresa, fallback: mostra a lista normal de planos com um aviso discreto ("plano indisponível").
- Sem `ref`, nenhuma comissão é registrada (já é o comportamento atual).

URL final: `https://saude.saudecomvc.com.br/assinar/{slug-empresa}?plan={plan_id}`

## Onde gerar o link no admin
Aba **Billing → Planos por empresa** (`CompanyPlanAssignments`): em cada plano ativado para uma empresa, adicionar um botão "🔗 Copiar link" que monta a URL acima e copia para a área de transferência. Sem campo extra, sem modal.

Opcional (incluso): pequeno botão "Pré-visualizar" abrindo a URL em nova aba.

## Arquivos
- `src/pages/Subscribe.tsx` — ler `params.get("plan")`, filtrar/forçar a seleção, esconder a grade quando travado, mostrar badge "Plano: X" no topo.
- `src/components/admin/AdminBilling.tsx` — em `CompanyPlanAssignments`, adicionar o botão de copiar link ao lado do checkbox de cada plano ativo.

## Validação
1. No admin, ativar um plano para a Mayla, copiar o link.
2. Abrir a URL em janela anônima → deve mostrar apenas aquele plano e ir direto ao formulário de pagamento.
3. Fluxo PIX/cartão funciona normalmente; assinatura criada **sem `affiliate_id`** (sem split).
4. URL com `plan` inválido → cai no fluxo padrão com aviso.