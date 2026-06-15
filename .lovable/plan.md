## Objetivo

Corrigir a recusa "0 tentativas / Falha" do Pagar.me (anti-fraude bloqueia por falta de dados mínimos) adicionando endereço de cobrança ao cadastro, com **auto-preenchimento via CEP (ViaCEP)**, e expor a mensagem real do erro em vez do genérico "non-2xx status code".

## Mudanças

### 1. Schema — migração
Novas colunas para guardar o endereço de cobrança (auditoria, suporte, reemissão):

- **`subscriptions`**: `billing_zip_code`, `billing_street`, `billing_number`, `billing_complement`, `billing_neighborhood`, `billing_city`, `billing_state`, `billing_country` (default `"BR"`), `customer_phone`.
- **`pending_signups`** (fluxo PIX): mesmos campos — para a conta criada pelo webhook ter endereço.

Todas opcionais por compatibilidade com registros antigos.

### 2. Frontend — auto-preenchimento por CEP (ViaCEP)

Criar `src/lib/viacep.ts`:
```ts
export async function lookupCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;
  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}
```

UX no `Subscribe.tsx`:
- Campo **CEP** com máscara `00000-000`. No `onBlur` (ou ao completar 8 dígitos), chama `lookupCep` e **auto-preenche** Rua, Bairro, Cidade, UF — campos preenchidos ficam habilitados para edição manual.
- Spinner pequeno no campo CEP durante a consulta.
- Se CEP não encontrado: toast "CEP não encontrado, preencha manualmente" e libera os campos.
- Foco automático passa para **Número** após sucesso.

Campos visíveis (todos obrigatórios, exceto Complemento):
CEP → Rua → Número → Complemento → Bairro → Cidade → UF.
Telefone passa a ser **obrigatório** (anti-fraude exige).
Validação com `zod` antes do submit (CEP 8 dígitos, UF 2 letras, telefone com DDD).

### 3. Frontend — tokenização do cartão
No `tokenizeCard()` enviar ao Pagar.me:
- `holder_document` = CPF (sem máscara) — **chave do anti-fraude**.
- `billing_address` completo (line_1, line_2, zip_code, city, state, country `"BR"`).

### 4. Backend — `pagarme-create-subscription`
- Receber `billing_address` + `customer.phone` (obrigatórios para `credit_card`).
- Enviar `address` completo no `POST /customers`.
- Enviar `billing_address` na sub (`card.billing_address`).
- Persistir os novos campos em `subscriptions` (e `pending_signups` no PIX).
- Trocar erros de negócio previsíveis para `HTTP 200 { ok: false, error, message, details? }` — assim o `supabase.functions.invoke` para de engolir a mensagem.
- `console.error` antes de cada retorno de erro.

### 5. Frontend — exibir mensagem real
- Tratar `out.ok === false` e mostrar `out.message` no toast.
- Defesa em profundidade: se vier `FunctionsHttpError`, ler `error.context.json()` para extrair a mensagem real.
- Mensagens específicas: "Cartão recusado pela operadora — verifique os dados ou tente outro cartão".

## Fora de escopo
- Não mexer em webhook, RLS, lógica de afiliado/split.
- Fluxo PIX só ganha os campos novos; resto inalterado.

## Validação

1. Após o deploy: refaz cadastro com cartão real + CEP + endereço completo + telefone.
2. Se ainda recusar, o painel mostrará `tentativas ≥ 1` e o motivo real da adquirente (ex.: "Cartão sem limite"), ou os logs da edge function trarão a resposta exata do Pagar.me.

Posso prosseguir?