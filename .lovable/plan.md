

# Plano: Corrigir UX do Jitsi — login obrigatório e tela de propaganda

## Problemas identificados

### Problema 1: "Asking to join meeting... no moderators have arrived"
O servidor Jitsi está configurado com autenticação que exige moderadores. Como não estamos usando JWT ainda, o servidor precisa ser configurado para permitir acesso anônimo. Isso é uma **configuração do servidor VPS**, não do frontend.

**Ação no servidor** (`/etc/prosody/conf.avail/teleconsulta.saudecomvc.com.br.cfg.lua`):
```text
VirtualHost "teleconsulta.saudecomvc.com.br"
    authentication = "anonymous"
```

E no `/etc/jitsi/jicofo/jicofo.conf`, garantir que não há lobby obrigatório.

### Problema 2: Tela de propaganda do Jitsi ao encerrar
Após a chamada, o Jitsi exibe uma página promocional (8x8 / "Build your video experience") dentro do iframe. Podemos corrigir no frontend:

**Editar `JitsiConsultationScreen.tsx`:**
- Adicionar `SHOW_PROMOTIONAL_CLOSE_PAGE: false` ao `interfaceConfigOverwrite`
- Adicionar `enableClosePage: false` e `enableFeedbackAnimation: false` ao `configOverwrite`
- No evento `readyToClose`, chamar `onLeave()` imediatamente para que o app volte à tela inicial antes do Jitsi mostrar qualquer coisa

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/mayla/JitsiConsultationScreen.tsx` — adicionar configs para suprimir promo page |
| Config servidor (manual) | Prosody: `authentication = "anonymous"` |

## Nota importante
O problema 1 (tela de login/moderador) **não pode ser resolvido pelo código do app** — é uma configuração do seu servidor Jitsi. Vou te passar os comandos exatos para rodar no VPS após aprovar o plano.

