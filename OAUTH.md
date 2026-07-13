# Plano de autenticação externa

## Arquitetura proposta

A autenticação deve ocorrer no backend por uma Supabase Edge Function. O navegador nunca deve consultar diretamente a API externa nem receber credenciais administrativas.

Fluxo:

```text
GET /?source=maylaapp&target=desafios&ssid=...
        ↓
Frontend detecta autenticação externa
        ↓
POST /functions/v1/external-auth
        ↓
Valida o ssid na API externa
        ↓
Normaliza e valida o CPF
        ↓
Localiza ou cria auth.users + profiles
        ↓
Gera token de login de uso único
        ↓
Frontend cria a sessão Supabase
        ↓
target=desafios → aba interna "campanhas"
```

Observação: o exemplo contém `souce`, provavelmente um erro de digitação. Recomenda-se padronizar como `source`, podendo aceitar `souce` temporariamente por compatibilidade.

## Plano de implementação

### 1. Definir o contrato com a API externa

Confirmar:

- URL e método para consultar o `ssid`.
- Autenticação da Mayla nessa API.
- Tempo de validade e se o `ssid` é de uso único.
- Campos retornados: CPF, nome, e-mail, data de nascimento, sexo, empresa e identificador externo.
- Respostas para sessão inválida, expirada ou revogada.

O `ssid` precisa ser temporário e preferencialmente de uso único. Como ele chega na query string, pode aparecer em histórico, logs e ferramentas de analytics.

#### Estado do contrato

Confirmado:

- Ambiente de desenvolvimento: `https://dev.saudecomvc.com.br`.
- Endpoint: `GET /api/oauth/patient`.
- Autenticação: Bearer token, armazenado somente como segredo da Edge Function.
- O `ssid` recebido pela aplicação é enviado à API externa no parâmetro de query `uuid`.
- A API espera `Accept: application/json`.
- Timeout da consulta externa: 30 segundos.
- Formato observado do `ssid`: UUID.
- Em produção, o `ssid` deve ser tratado como credencial temporária e preferencialmente de uso único.
- Os `ssid` fornecidos para esta homologação são reutilizáveis; isso foi confirmado em teste remoto bem-sucedido.
- Expiração, consumo e eventual rejeição de reutilização são responsabilidade da API externa; a aplicação não manterá estado local de consumo.
- Campos permitidos da resposta:
  - `id`: identificador externo usado como `external_subject`.
  - `name`: nome completo.
  - `email`: e-mail obrigatório da conta Supabase.
  - `cpf`: CPF obrigatório.
  - `is_active`: usuários inativos devem ser rejeitados.
  - `client_id`: identificador do cliente externo, sujeito ao mapeamento de empresa.
  - `personal_info.date_birth`: data de nascimento, que pode ser nula.
  - `personal_info.gender`: gênero opcional no domínio `M | F`.
  - `personal_info.weight` e `personal_info.height`: peso e altura opcionais.
  - `address_contact.city`, `state`, `zip_code` e `cellphone`: dados opcionais de perfil.
- Todos os demais campos da resposta devem ser ignorados.
- O campo `password`, mesmo quando retornado pela API, deve ser sempre ignorado e nunca pode ser armazenado, registrado ou usado para autenticação.
- O provisionamento externo deve atribuir o papel `employee`.
- O provisionamento externo deve vincular o perfil à empresa com slug `mayla`.
- A empresa `mayla` não exige assinatura paga; usuários provisionados por este fluxo devem passar pelo `AccessGate` sem assinatura.
- A empresa `mayla` e sua configuração `require_paid_subscription = false` foram criadas no projeto remoto pela migration `20260713134000_seed_mayla_company.sql`.

Pendente:

- Obter exemplos anonimizados das respostas de erro.

Segurança:

- Nunca versionar nem registrar o Bearer token.
- Rotacionar qualquer token compartilhado por chat, ticket ou outro canal não destinado a segredos.
- Um `ssid` sem expiração permanece vulnerável enquanto não for consumido. Recomenda-se que o provedor adote uma validade curta, além do uso único.
- Respostas sem um endereço de e-mail válido devem ser rejeitadas antes da criação ou associação de usuário.
- Respostas sem CPF ou com CPF inválido devem ser rejeitadas. O valor deve ser normalizado para 11 dígitos e validado pelos dígitos verificadores.
- Mapear `personal_info.gender` para o perfil como `M` → `male` e `F` → `female`. Um valor não nulo fora desse domínio deve ser rejeitado.

### 2. Criar a Edge Function `external-auth`

Responsabilidades:

- Aceitar somente `POST`.
- Validar `source` por uma lista permitida.
- Validar formato do `ssid`.
- Consultar a API externa com segredo armazenado no Supabase.
- Aplicar timeout e tratar indisponibilidade.
- Validar CPF, incluindo dígitos verificadores.
- Nunca registrar CPF ou `ssid` integralmente nos logs.
- Aplicar rate limiting.
- Restringir CORS aos domínios da aplicação.

A função usará `SUPABASE_SERVICE_ROLE_KEY`, que nunca será exposta ao frontend.

Estado:

- Implementação local criada em `supabase/functions/external-auth/index.ts`.
- Validação e normalização isoladas em `supabase/functions/external-auth/logic.ts`.
- Endpoint configurado com `verify_jwt = false`, pois a autenticação externa ocorre antes da sessão Supabase.
- CORS usa lista explícita de origens; `*` não é aceito.
- Rate limit persistente: 10 tentativas por IP a cada 60 segundos, armazenando somente uma chave com hash e salt.
- Conflitos entre identidade externa, CPF e e-mail são rejeitados sem reassociar contas.
- O e-mail confirmado da conta é sincronizado com o valor validado retornado pelo provedor antes da geração do token.
- Usuários existentes preservam uma empresa já atribuída; `mayla` é aplicada quando o perfil não tem empresa.
- O token retornado é `token_hash`, para troca no frontend com `verifyOtp({ token_hash, type: "email" })`.
- Testes unitários do contrato estão em `src/test/external-auth-logic.test.ts`.
- Função implantada no projeto Supabase `zhcdfpveuwulwnwvvvcm` em 13/07/2026, versão 3 e estado `ACTIVE`.
- Grupos opcionais ausentes (`personal_info` e `address_contact`) são aceitos sem impedir a autenticação.

Segredos necessários:

```text
EXTERNAL_AUTH_API_URL
EXTERNAL_AUTH_API_TOKEN
EXTERNAL_AUTH_ALLOWED_ORIGINS
EXTERNAL_AUTH_RATE_LIMIT_SALT
```

`EXTERNAL_AUTH_API_URL` deve ser uma URL HTTPS completa. `EXTERNAL_AUTH_ALLOWED_ORIGINS` deve conter origens separadas por vírgula, sem caminhos. O salt deve ser um valor aleatório próprio e não deve ser reutilizado como outra credencial.

Estado remoto:

- Os quatro secrets estão configurados no projeto.
- `EXTERNAL_AUTH_ALLOWED_ORIGINS` está restrito a `https://saude.saudecomvc.com.br`.
- O preflight CORS remoto respondeu com HTTP 200 e liberou somente a origem configurada.
- O smoke test remoto sem sessão real respondeu HTTP 400 com `invalid_ssid` e `request_id`, confirmando o contrato sem consumir um `ssid`.
- O teste remoto completo com `ssid` de homologação respondeu HTTP 200, criou a sessão e confirmou perfil, empresa `mayla`, papel `employee`, data de nascimento e sexo.

### 3. Preparar o banco para localizar usuários por CPF

Atualmente `profiles.cpf` é anulável e não possui unicidade garantida. Antes da integração:

- Normalizar CPFs para 11 dígitos.
- Identificar CPFs duplicados já existentes.
- Corrigir duplicidades manualmente.
- Criar índice único parcial para CPF.
- Adicionar validações de formato.

Também se recomenda uma tabela `external_identities`:

```text
source
external_subject
user_id
last_login_at
```

A primeira associação pode ser feita pelo CPF. Nos próximos acessos, deve-se priorizar `source + external_subject`, evitando depender permanentemente de um dado pessoal mutável.

Estado:

- Migration local criada em `supabase/migrations/20260702120000_prepare_external_auth.sql`.
- A migration normaliza CPFs, valida os dígitos verificadores e cria um índice único parcial.
- A implantação aborta com contagens, sem expor CPFs, se ainda houver valores inválidos ou duplicados.
- A tabela `external_identities` fica acessível somente pelo backend com service role.
- Migration aplicada ao projeto Supabase `zhcdfpveuwulwnwvvvcm` em 13/07/2026.

### 4. Resolver ou cadastrar o usuário

Dentro da Edge Function:

1. Procurar a identidade externa.
2. Se ainda não estiver vinculada, procurar `profiles.cpf`.
3. Se o CPF existir:
   - Obter o respectivo `auth.users`.
   - Atualizar somente os campos autorizados pelo contrato.
4. Se não existir:
   - Criar o usuário com `auth.admin.createUser`.
   - Criar ou atualizar o perfil com nome, CPF e demais campos.
   - Definir empresa, papel e direito de acesso.
   - Registrar a identidade externa.
5. Tornar o processo idempotente para duas requisições simultâneas não criarem usuários duplicados.

O projeto já possui um trigger que cria `profiles` durante a criação de `auth.users`, mas ele precisará ser considerado para evitar conflito com o cadastro automático.

### 5. Criar a sessão no navegador

Não deve ser criada uma senha baseada no CPF ou no `ssid`.

A Edge Function pode gerar um token Supabase de uso único para o usuário. O frontend troca esse token por uma sessão usando `verifyOtp`, permitindo que o fluxo continue integrado ao `AuthContext`.

Se já existir uma sessão de outro usuário no navegador, ela deverá ser substituída explicitamente.

Estado:

- Integração local criada em `src/components/ExternalAuthRoute.tsx`.
- Uma sessão anterior é encerrada localmente antes da chamada externa, impedindo fallback silencioso em caso de falha.
- O `token_hash` retornado pela Edge Function é trocado por sessão com `verifyOtp({ token_hash, type: "email" })`.
- A aplicação só é liberada depois que o usuário da nova sessão também estiver refletido no `AuthContext`.

### 6. Adaptar a rota raiz

Hoje a `/` passa diretamente por `ProtectedRoute`, que envia usuários sem sessão para `/login`.

Criar um componente intermediário:

- Com `source` e `ssid`: executar o fluxo externo.
- Sem esses parâmetros: manter o comportamento atual.
- Exibir estados de carregamento e erro.
- Remover `ssid` da barra de endereço com `history.replaceState` assim que for capturado.
- Em falha, não fazer fallback silencioso para outro usuário já autenticado.

Estado:

- A rota `/` agora passa por `ExternalAuthRoute` antes de `ProtectedRoute` e `AccessGate`.
- O `ssid` é removido da URL com `history.replaceState` antes da autenticação começar.
- Sem `source/souce + ssid`, o comportamento anterior da rota é preservado.
- Falhas exibem uma tela própria e, quando disponível, o identificador seguro da requisição para suporte.

### 7. Mapear o `target`

Usar uma lista fechada, nunca um redirecionamento livre:

```ts
const targetMap = {
  desafios: "campanhas",
  inicio: "inicio",
  bemestar: "bemestar",
  servicos: "servicos",
  perfil: "perfil",
};
```

No código atual, a tela visualmente chamada “Desafios” usa o identificador interno `campanhas` em `MaylaApp.tsx`.

O `MaylaApp` deverá receber a aba inicial ou interpretar um estado de navegação validado. Targets desconhecidos devem abrir `inicio`.

Estado:

- Mapeamento fechado implementado em `src/lib/external-auth.ts`.
- `target=desafios` inicia o `MaylaApp` em `campanhas`.
- Targets ausentes ou desconhecidos iniciam em `inicio`.
- A grafia legada `souce` é aceita temporariamente no frontend e normalizada para `source` na chamada à função.

### 8. Tratar as regras de acesso existentes

Mesmo autenticado, o usuário passa pelo `AccessGate`. Portanto, o cadastro automático precisa definir empresa, assinatura ou outra permissão que garanta acesso.

Além disso, `ProfileCompletionGate` bloqueará a interface se data de nascimento ou sexo estiverem ausentes. Esses dados devem vir da API externa ou o preenchimento obrigatório continuará aparecendo antes de “Desafios”.

### 9. Testes

Cobertura mínima:

- CPF existente.
- CPF inexistente e cadastro automático.
- Duas requisições simultâneas para o mesmo CPF.
- CPF duplicado ou inválido.
- `ssid` inválido, expirado e reutilizado.
- API externa indisponível ou lenta.
- `source` não permitido.
- `target=desafios` abrindo `campanhas`.
- Target desconhecido abrindo a página inicial.
- Usuário sem empresa ou direito de acesso.
- Substituição segura de uma sessão anterior.

Estado:

- Há 14 testes unitários para validação do contrato externo e 10 testes para captura da URL e mapeamento de targets.
- Testes de integração com Supabase e com a API externa continuam pendentes.

### 10. Implantação

- Configurar segredos da API externa no Supabase.
- Implantar migration e Edge Function.
- Habilitar inicialmente por feature flag.
- Monitorar sucesso, latência, cadastros e falhas sem armazenar CPF ou `ssid`.
- Depois da estabilização, remover a compatibilidade com `souce`.

## Dependência principal

Antes da implementação, deve ser definido como o usuário recém-criado recebe e-mail, empresa e direito de acesso. Sem isso, ele pode ser autenticado corretamente, mas será bloqueado pelas regras atuais da aplicação.
