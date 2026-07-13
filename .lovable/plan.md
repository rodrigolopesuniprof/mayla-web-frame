## Diagnóstico
O log da edge (`[demo-health-submit] upstream ok but no widget.url in payload`) confirma que a LunaOS aceitou os dados mas não devolveu o objeto `widget`. Isso acontece porque o POST é enviado com `abrir_conversa: false`. Sem esse flag, a LunaOS não instancia a sessão do widget e o front trava na tela de fallback.

## Objetivo
No mesmo POST que envia os dados de saúde (`dados-de-saude`), pedir para a LunaOS abrir a conversa com a Maria, capturar `data.widget.url` e montar o iframe dinâmico no front.

## Mudanças

### 1. `supabase/functions/demo-health-submit/index.ts`
- Alterar o payload enviado para a LunaOS:
  - `abrir_conversa: true` (era `false`).
  - Manter `tags`, `nome`, `celular`, `ddi: "55"`, `campos` (FC, PA, SpO₂ etc.) como já estão — Maria recebe a conversa com todos os dados do contato preenchidos.
- Já retornamos `widgetUrl` no JSON de sucesso; nenhuma mudança adicional no retorno.
- Se por qualquer motivo `data.widget.url` ainda vier ausente (formulário sem agente vinculado no LunaOS), continuar retornando `widgetUrl: null` e logar o body completo para diagnóstico.

### 2. `supabase/functions/demo-lead-submit/index.ts`
- Nenhuma mudança. Continua `abrir_conversa: false` — o lead inicial só registra o contato; a conversa é aberta apenas no final, após o teste.

### 3. Front (`src/pages/DemoBinah.tsx`)
- Nenhuma mudança. O código já lê `widgetUrl` do retorno e monta o iframe dinâmico com essa URL.

## Verificação
1. Fazer o fluxo completo em `/demo` (nome → whatsapp → medição → enviar).
2. Conferir logs da edge `demo-health-submit`: não deve mais aparecer o warning "no widget.url in payload".
3. Confirmar que o iframe abre a URL `https://mayla.lunaos.com.br/chat/…/?sessao=…` (sessão nova a cada teste) e que a Maria responde já sabendo o nome e os dados enviados.
4. Se ainda vier sem widget, o log agora vai imprimir o body upstream — sinal de que o formulário `dados-de-saude` no LunaOS precisa ter um agente vinculado (configuração do lado deles).

## Fora de escopo
- Não mexer no formulário de lead inicial.
- Não persistir sessão/expira_em no banco.
- Nenhuma mudança de UI/estilos.