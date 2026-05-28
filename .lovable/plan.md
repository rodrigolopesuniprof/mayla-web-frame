## Objetivo

1. Trocar o ícone do Lovable que aparece ao lado do link na pré-visualização do WhatsApp (favicon).
2. Permitir editar, dentro do painel administrativo, a imagem de banner que aparece no preview de link (og:image / twitter:image).

## Contexto técnico

Os dois itens estão controlados por tags estáticas em `index.html`:

```text
<link rel="icon" type="image/png" href="/favicon.png">
<meta property="og:image"      content="https://storage.googleapis.com/.../Mayla-Insta-Jun_03.webp">
<meta name="twitter:image"     content="https://storage.googleapis.com/.../Mayla-Insta-Jun_03.webp">
```

Como o WhatsApp/Telegram lê o HTML estático no scrape, o caminho mais robusto é manter URLs fixas (em `index.html`) apontando para arquivos públicos no storage do Cloud que o admin possa sobrescrever pelo painel — assim o admin troca a arte sem novo deploy.

## Mudanças

### 1. Favicon (ícone ao lado do link)
- Substituir `public/favicon.png` (e `public/favicon.ico`) pelo novo ícone da Mayla Empresas (uso o logo atual da Mayla — não o do Lovable).
- Adicionar `<link rel="apple-touch-icon" href="/favicon.png">` no `index.html` para cobrir iOS/WhatsApp em alguns casos.

### 2. Edição do banner social (og:image) pelo super admin
- Criar bucket público `app-branding` no Cloud (se não existir) com policy de leitura pública e escrita só por super admin.
- Fixar a URL pública do banner em `index.html`:
  - `og:image` e `twitter:image` apontando para `https://<projeto>.supabase.co/storage/v1/object/public/app-branding/social-banner.jpg`.
- Adicionar no painel super admin (em `src/components/admin/AdminCompanySettings.tsx` ou numa nova aba "Branding global" do `AdminDashboard`) uma seção "Imagem de compartilhamento (WhatsApp/redes sociais)":
  - Upload de arquivo `.jpg/.png`.
  - Sobe sempre para `app-branding/social-banner.jpg` (upsert), garantindo URL estável.
  - Mostra preview da imagem atual + dica recomendando 1200x630.
  - Botão equivalente para favicon: faz upload em `app-branding/favicon.png` — e `index.html` passa a apontar `<link rel="icon" href="https://.../app-branding/favicon.png">`.
- Aviso na UI: cache do WhatsApp pode demorar; oferecer link para o "WhatsApp Link Preview Debugger" não é viável, mas explicamos que a atualização pode levar algumas horas.

### 3. Texto do preview
- Como bônus mínimo: corrigir o `og:description` "App de saúde inteligente para o empresas" → "App de saúde inteligente para empresas" (opcional, confirmo antes de aplicar se preferir manter).

## Arquivos afetados

- `index.html` — trocar URLs de `favicon`, `og:image`, `twitter:image`; adicionar `apple-touch-icon`.
- `public/favicon.png` / `public/favicon.ico` — substituir pela arte da Mayla.
- `supabase/migrations/<novo>.sql` — criar bucket `app-branding` + policies (public read, super admin write).
- `src/components/admin/AdminCompanySettings.tsx` (ou nova `AdminBrandingGlobal.tsx` referenciada em `AdminDashboard.tsx`) — UI para upload do banner social e do favicon global.

## Perguntas antes de implementar

1. A edição do banner deve ser **global** (uma única arte para todos os domínios/empresas, já que `saude.saudecomvc.com.br` é único) ou **por empresa** (cada empresa com seu og:image)? Como o domínio é compartilhado, recomendo **global** — confirma?
2. Posso usar o logo atual da empresa Mayla como novo favicon, ou você quer enviar um arquivo específico?