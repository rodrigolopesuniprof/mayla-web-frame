## Problema

O WhatsApp gera o preview do link buscando `og:image`, `og:title` e `og:description` do HTML retornado pela URL. Hoje o link `/cadastro/:token` aponta direto para o app React (`.lovable.app` ou produção), que serve um `index.html` estático com meta tags genéricas — e o WhatsApp **não executa JavaScript**, então não dá pra trocar isso via React/Helmet.

Para mostrar logo + nome + cor da empresa convidante, o link precisa passar por um endpoint server-side que devolva HTML com meta tags específicas por token.

## Solução

Criar uma edge function `invite-preview` que serve como porta de entrada do convite:

- **Crawler social** (User-Agent: WhatsApp, facebookexternalhit, Twitterbot, LinkedInBot, Slackbot, Telegram, Discord) → devolve HTML mínimo com `og:image` = logo da empresa, `og:title` = "Você foi convidado para a Mayla por {Empresa}", `og:description` = "Sua empresa contratou um benefício de saúde digital. Cadastre-se em 1 minuto."
- **Navegador real** → responde com `302 redirect` para `/cadastro/:token` no domínio do app (preview ou produção).

A URL compartilhada passa a ser a URL pública da edge function:
```
https://ymexlslqsdflgkcvwjoz.supabase.co/functions/v1/invite-preview/:token
```

Essa URL funciona igual em preview e produção, e o WhatsApp só faz cache por URL — então cada token tem cache próprio e o preview reflete a empresa correta.

## Mudanças

### 1. Edge function `supabase/functions/invite-preview/index.ts`
- GET `/invite-preview/:token`
- Detecta crawler por User-Agent
- Crawler: query em `company_invite_tokens` → `companies` (name, logo_url, primary_color) usando service role. Renderiza HTML com `<meta og:*>` apontando para `logo_url`. Fallback: banner padrão Mayla se sem logo.
- Browser: `Response.redirect('https://saude.saudecomvc.com.br/cadastro/' + token, 302)` (configurável via query `?preview=1` para apontar para o domínio preview .lovable.app durante testes).
- `verify_jwt = false` em `supabase/config.toml` (precisa ser público).

### 2. Componente que gera o link de convite
Atualizar onde quer que o admin copia/compartilha o link (provavelmente em `AdminCompanies` ou similar — confirmar na fase de build) para gerar a URL da edge function em vez de `/cadastro/:token` direto.

### 3. Banner padrão de fallback
Subir um `social-banner.jpg` (1200×630) no bucket `app-branding` — hoje retorna 400. Usado quando a empresa não tem logo cadastrado ou para links sem token. A interface de upload do admin (`AdminBranding`) já existe.

## Notas

- O WhatsApp **cacheia preview por URL agressivamente** (dias). Cada token é uma URL única, então convites novos sempre puxam preview fresco. Convites antigos já compartilhados continuarão com o preview antigo até o cache expirar.
- O domínio preview `.lovable.app` continua mostrando favicon do Lovable na aba do navegador — isso é controlado pela Lovable e não tem como remover sem publicar em domínio próprio. Após publicar em `saude.saudecomvc.com.br`, o favicon configurado em `app-branding/favicon.png` aparece.
- Logos das empresas estão em `company-logos` bucket (já público).
