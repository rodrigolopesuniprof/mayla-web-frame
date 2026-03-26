

# Plano: Corrigir 404 na VPS (Hostinger)

## Problema

Em uma VPS, o servidor web (Nginx ou Apache) não sabe que deve redirecionar todas as rotas para o `index.html` da SPA React. Quando o usuário acessa `/admin/painel` diretamente, o servidor procura um arquivo físico e retorna 404.

## Solução

Depende do servidor web instalado na VPS. São duas opções:

### Opção A — Nginx (mais comum em VPS)

Editar o arquivo de configuração do site (geralmente `/etc/nginx/sites-available/default` ou similar):

```text
server {
    listen 80;
    server_name saude.saudecomvc.com.br;
    root /var/www/html;   # pasta onde está o dist/
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Depois: `sudo nginx -t && sudo systemctl reload nginx`

### Opção B — Apache

Criar o arquivo `.htaccess` dentro da pasta `dist/` (ou usar o `public/.htaccess` que será copiado no build):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

E garantir que `AllowOverride All` está habilitado no VirtualHost do Apache.

## O que criar no projeto

Criar `public/.htaccess` para que o Vite inclua no build automaticamente (cobre o caso Apache). Para Nginx, a configuração é feita diretamente no servidor.

## Passos

1. Criar `public/.htaccess` no projeto
2. Fazer novo build (`npm run build`)
3. Enviar o conteúdo de `dist/` para a VPS
4. Configurar o servidor web (Nginx ou Apache) conforme acima
5. Recarregar o servidor: `sudo systemctl reload nginx` ou `sudo systemctl reload apache2`

| Ação | Arquivo |
|------|---------|
| Criar | `public/.htaccess` |

