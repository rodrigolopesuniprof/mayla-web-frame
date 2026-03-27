# Deploy na VPS — Mayla com Binah SDK

## Pré-requisitos

- Node.js 18+ e npm
- Nginx (ou outro reverse proxy)
- Arquivo `.tgz` do Binah Web SDK v5.11.4
- Domínio registrado no [dashboard Binah](https://dashboard.binah.ai)

## 1. Clonar e instalar

```bash
git clone <repo-url>
cd mayla-web-frame
npm install
```

## 2. Instalar o Binah SDK

Copie o arquivo `.tgz` do SDK para a raiz do projeto e instale:

```bash
npm install ./biosensesignal-web-sdk-5.11.4.tgz
```

## 3. Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://ymexlslqsdflgkcvwjoz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua-anon-key>
```

## 4. Build

```bash
npm run build
```

Os arquivos estáticos serão gerados em `dist/`.

## 5. Configurar Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name seu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Headers obrigatórios para o Binah SDK (SharedArrayBuffer)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;

    root /var/www/mayla/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|wasm)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Embedder-Policy "require-corp" always;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$host$request_uri;
}
```

## 6. Deploy

```bash
# Copiar build para o diretório do nginx
sudo cp -r dist/* /var/www/mayla/dist/

# Testar configuração e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Registrar domínio no Binah

1. Acesse [dashboard.binah.ai](https://dashboard.binah.ai)
2. Vá em **Applications** → sua aplicação
3. Adicione `seu-dominio.com` na lista de domínios permitidos
4. A chave de licença já está no código: `9FE0E4-F8E4ED-48B396-2CF86D-322751-1B04DE`

## Teste rápido (local)

Para testar o SDK antes de fazer deploy:

```bash
npm run build
npm run preview
```

O `vite preview` já serve com os headers COOP/COEP configurados.

## Solução de problemas

| Problema | Causa | Solução |
|----------|-------|---------|
| `crossOriginIsolated = false` | Headers COOP/COEP ausentes | Verificar configuração nginx |
| `Cannot find module @biosensesignal/web-sdk` | SDK não instalado | `npm install ./biosensesignal-web-sdk-5.11.4.tgz` |
| `License error` | Domínio não registrado | Adicionar domínio no dashboard Binah |
| Demo mode ativado | Ambiente sem SharedArrayBuffer | Normal no Lovable; na VPS, verificar headers |
| Câmera não abre | HTTPS obrigatório para `getUserMedia` | Configurar SSL no nginx |
