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
Normaliza e valida os dados recebidos
        ↓
Localiza auth.users pelo e-mail
        ↓
Gera token de login de uso único
        ↓
Frontend cria a sessão Supabase
        ↓
target=desafios → aba interna "campanhas"
```

Se não existir uma conta cadastrada com o e-mail retornado pela API externa, a
Edge Function responde `email_not_registered` e o frontend redireciona para
`/login`. Este fluxo não cria usuários, perfis, papéis ou vínculos.

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
- O fluxo externo não provisiona contas nem altera perfis.
- A conta localizada deve ter sido previamente cadastrada com os papéis, empresa e
  permissões necessários para passar pelo `AccessGate`.
- A empresa `mayla` e sua configuração `require_paid_subscription = false` foram criadas no projeto remoto pela migration `20260713134000_seed_mayla_company.sql`.

Pendente:

- Obter exemplos anonimizados das respostas de erro.

Segurança:

- Nunca versionar nem registrar o Bearer token.
- Rotacionar qualquer token compartilhado por chat, ticket ou outro canal não destinado a segredos.
- Um `ssid` sem expiração permanece vulnerável enquanto não for consumido. Recomenda-se que o provedor adote uma validade curta, além do uso único.
- Respostas sem um endereço de e-mail válido devem ser rejeitadas antes da busca do usuário.
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
- A conta é localizada exclusivamente pelo e-mail normalizado retornado pelo provedor.
- Um e-mail sem conta cadastrada resulta em `email_not_registered` (HTTP 404).
- O fluxo não cria nem atualiza conta, perfil, papel, empresa ou identidade externa.
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
- Antes desta alteração, um teste remoto completo com `ssid` de homologação respondeu HTTP 200 e confirmou o fluxo implantado naquela versão. A nova busca estrita por e-mail ainda precisa de smoke test após a implantação.

### 3. Suporte de banco para localizar usuários por e-mail

O lookup atual usa a função backend-only
`public.get_auth_user_id_by_email(text)`, que consulta `auth.users` de modo
case-insensitive e pode ser executada somente pela `service_role`.

Estado histórico:

- Migration local criada em `supabase/migrations/20260702120000_prepare_external_auth.sql`.
- A migration também contém estruturas de CPF e identidade externa criadas para o fluxo anterior; elas não participam da resolução atual.
- Migration aplicada ao projeto Supabase `zhcdfpveuwulwnwvvvcm` em 13/07/2026.

### 4. Localizar o usuário cadastrado

Dentro da Edge Function:

1. Normalizar e validar o e-mail recebido da API externa.
2. Procurar `auth.users` por esse e-mail, sem diferenciar maiúsculas de minúsculas.
3. Se a conta existir, gerar o token de login para seu `user_id`.
4. Se a conta não existir, responder `email_not_registered` sem criar ou alterar dados.

### 5. Criar a sessão no navegador

Não deve ser criada uma senha baseada no CPF ou no `ssid`.

A Edge Function pode gerar um token Supabase de uso único para o usuário. O frontend troca esse token por uma sessão usando `verifyOtp`, permitindo que o fluxo continue integrado ao `AuthContext`.

Se já existir uma sessão de outro usuário no navegador, ela deverá ser substituída explicitamente.

Estado:

- Integração local criada em `src/components/ExternalAuthRoute.tsx`.
- Uma sessão anterior é encerrada localmente antes da chamada externa, impedindo fallback silencioso em caso de falha.
- O `token_hash` retornado pela Edge Function é trocado por sessão com `verifyOtp({ token_hash, type: "email" })`.
- A aplicação só é liberada depois que o usuário da nova sessão também estiver refletido no `AuthContext`.
- A resposta `email_not_registered` redireciona imediatamente para `/login`.

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
- Sem `source + ssid`, o comportamento anterior da rota é preservado.
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
- O parâmetro de origem aceito pelo frontend é `source`.

### 8. Tratar as regras de acesso existentes

Mesmo autenticado, o usuário passa pelo `AccessGate`. Como este fluxo não
provisiona nem atualiza dados, a conta previamente cadastrada precisa ter
empresa, assinatura ou outra permissão que garanta acesso.

Além disso, `ProfileCompletionGate` bloqueará a interface se data de nascimento
ou sexo estiverem ausentes no perfil já cadastrado.

### 9. Testes

Cobertura mínima:

- E-mail cadastrado.
- E-mail não cadastrado redirecionando para `/login`.
- CPF inválido na resposta externa.
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

## Dependência principal

O cadastro da conta, do perfil e das permissões ocorre fora deste fluxo. O e-mail
em `auth.users` deve corresponder ao e-mail retornado pela API externa.
