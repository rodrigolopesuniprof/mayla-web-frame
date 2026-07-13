## Objetivo
Trocar o iframe estático do chat Mayla (URL fixa `LUNA_CHAT_URL`) por um widget dinâmico do LunaOS, cuja URL vem do próprio retorno do endpoint de respostas do formulário. Cada finalização de teste gera uma nova sessão.

## Mudanças

### 1. `supabase/functions/demo-health-submit/index.ts`
- Após o `lunaSubmit("dados-de-saude", body)` bem-sucedido, fazer `JSON.parse(text)` e extrair `data.widget.url` (e opcionalmente `data.widget.sessao` / `expira_em` para debug).
- Retornar no JSON de sucesso: `{ ok: true, widgetUrl, expiresAt }`.
- Se o upstream responder 200 mas sem `data.widget.url`, cair num fallback controlado: `{ ok: true, widgetUrl: null }` e logar warning (a UI decide o que fazer).

### 2. `supabase/functions/_shared/luna.ts`
- Sem mudança funcional. Continua igual (o parse do JSON acontece no handler específico).

### 3. `src/pages/DemoBinah.tsx`
- Remover a constante `LUNA_CHAT_URL`.
- Guardar `widgetUrl` em state (`useState<string | null>`).
- Em `sendHealth`, ler `data.widgetUrl` do retorno da edge function e salvar antes de mudar `phase` para `"chat"`.
- No render da fase `"chat"`:
  - Se `widgetUrl` existir → iframe com `src={widgetUrl}` (mesmo layout atual `demo-chat-iframe`).
  - Se `widgetUrl` for `null` (falha) → tela curta de "não foi possível abrir o chat agora" com o botão "Fazer novo teste".
- No `restart()`, limpar `widgetUrl` para garantir sessão nova no próximo teste (o widget é recriado porque o `key={captureKey}` já força remount da captura, e o iframe só renderiza depois de novo `sendHealth`).

### 4. Estilos
- Nada a mudar em `src/pages/demo.css`. O container `.demo-chat-scope` + `.demo-chat-iframe` continua servindo — a única diferença é o `src` dinâmico.

## Detalhes técnicos

- Formato do retorno do LunaOS (confirmado pelo usuário):
  ```
  { success, data: { resposta, conversa_id, widget: { sessao, url, expira_em } }, errors }
  ```
  Só `data.widget.url` é obrigatório para o front. Nada mais precisa vazar ao cliente.
- Não persistimos `sessao` nem `expira_em` no banco — cada teste gera uma sessão nova sob demanda, exatamente como o exemplo do LunaOS.
- Fluxo do usuário permanece igual: Lead → Medição → Envio → Chat. Só o chat passa a ser identificado/sessão nova por teste.
- Fluxo do `demo-lead-submit` **não muda** (o widget só é aberto no final, após os dados de saúde).

## Fora de escopo
- Não mexer no `BinahCapture`, no `DemoLeadForm`, nem no schema `public.demo_leads`.
- Não adicionar reabertura do widget por link/token — sessão viva só na aba atual, conforme o padrão do exemplo.