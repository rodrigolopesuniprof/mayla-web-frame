## Mudança

Trocar a base do link de cadastro gerado no painel admin: em vez de apontar para a edge function `invite-preview`, apontar direto para `https://saude.saudecomvc.com.br/cadastro/<token>`.

## Arquivos

1. **`src/components/admin/InviteLinkPanel.tsx`**
   - Substituir a constante `INVITE_BASE` por `"https://saude.saudecomvc.com.br/cadastro"`.
   - O link copiado, exibido e o QR Code passam a ser `https://saude.saudecomvc.com.br/cadastro/<token>`.

2. **`src/components/admin/AdminCompanies.tsx`**
   - Se houver geração de link na lista de empresas usando a mesma base da edge function, alinhar para o mesmo domínio `https://saude.saudecomvc.com.br/cadastro/<token>`.

## Observações

- Não mexer no `.env`, no `supabase/config.toml` nem na edge function `invite-preview` (ela continua existindo caso seja necessária no futuro, mas não será mais usada para gerar o link compartilhado).
- O fluxo de cadastro em `/cadastro/:token` já está implementado em `CompanySignup.tsx`, então o link novo cai direto na tela correta no domínio de produção.
- Resultado: ao copiar/compartilhar, o usuário vê o domínio oficial `saude.saudecomvc.com.br` e o preview do link no WhatsApp passa a usar os metadados do `index.html` do app publicado.
