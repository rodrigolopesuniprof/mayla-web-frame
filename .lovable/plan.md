
## Objetivo
Ao final do teste em `/demo`, após o envio dos dados de saúde ser confirmado, carregar automaticamente o widget de chat com o agente Maria (LunaOS) dentro do próprio fluxo — sem tela travada, sem redirecionamento externo.

## Diagnóstico
O 502 acontece porque o endpoint `POST /formularios/{slug}/respostas` não aceita `abrir_conversa: true`. A doc do LunaOS só suporta `abrir_conversa` no endpoint `POST /contatos`. Solução: separar em duas chamadas.

## Mudanças

### 1. `supabase/functions/demo-health-submit/index.ts`
- Manter o POST atual em `formularios/dados-de-saude/respostas` com `abrir_conversa: false` (envia a medição e mantém o registro no LunaOS como está hoje).
- Após sucesso, fazer uma segunda chamada `POST /contatos` com:
  - Mesmos dados do lead (nome, telefone, email se houver)
  - `abrir_conversa: true`
  - `agente` / `fluxo` correspondente à Maria (mesmo slug já usado hoje ou configurável)
  - Um campo de contexto/observação com resumo das medições (FC, PA, SpO₂, etc.) para a Maria já ter o histórico
- Extrair `data.widget.url` (ou `conversaId`) da resposta de `/contatos`.
- Retornar `{ success: true, widgetUrl, debug: { formStatus, contatoStatus, contatoBody? } }` ao cliente. Em caso de falha só no `/contatos`, retornar `success: true` do envio de saúde + `widgetUrl: null` e um `error` explicativo (não derrubar o fluxo).
- Logar corpo completo do upstream quando `widget.url` não vier, para diagnóstico futuro.

### 2. `src/pages/DemoBinah.tsx`
- Depois do envio bem-sucedido, mostrar tela de confirmação curta ("Avaliação concluída, abrindo conversa com a Maria…") e então montar o `<iframe>` com `widgetUrl`.
- Se `widgetUrl` vier `null`, mostrar mensagem clara com botão "Tentar novamente" que refaz apenas a chamada `/contatos` (novo endpoint leve na mesma edge function via `?action=open-chat`, ou uma segunda edge function `demo-chat-open`).
- Garantir que a cada novo teste uma sessão nova é criada (não reaproveitar `widgetUrl` de execução anterior — já é o comportamento, apenas confirmar).

### 3. (Opcional) Nova edge function `demo-chat-open`
Somente se preferirmos isolar o retry do chat. Recebe `{ leadId | nome, telefone }` e chama `/contatos` com `abrir_conversa: true`. Torna o retry independente do reenvio dos dados de saúde.

## Fora do escopo
- Não altera captura Binah nem `demo-lead-submit`.
- Não muda UI do lead form nem do disclaimer.

## Perguntas rápidas antes de codar
1. Qual slug/identificador de agente ou fluxo devo usar em `/contatos` para abrir a Maria? (mesmo `dados-de-saude`? outro?)
2. Quer o botão de retry manual caso o widget não abra, ou tenta abrir sozinho 1x e mostra erro?
