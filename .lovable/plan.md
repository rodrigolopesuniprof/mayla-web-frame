## Diagnóstico

A estrutura atual ainda não segue exatamente o padrão documentado do LunaOS para handoff do widget:

- `POST /formularios/{slug}/respostas` pode abrir conversa e retornar `data.widget.url`, mas precisa de `abrir_conversa: true` e `conexao_id: 1`.
- `POST /conversas` é o endpoint mais direto para abrir uma conversa, registrar a primeira mensagem e receber o `widget.url` quando a conexão é do tipo `site`.
- O código atual chama `POST /contatos` para abrir a conversa, mas a documentação mostra que o retorno com `widget` é garantido no fluxo de `/conversas` e também em `/formularios` quando abre conversa.
- A função atual não envia `conexao_id: 1` nem uma `mensagem` inicial contextualizada para a Maria, então a conversa pode até criar contato, mas não necessariamente ativa o chat/IA nem retorna widget.

## Plano de correção

1. Ajustar o helper LunaOS
   - Adicionar uma função `lunaOpenChatConversation()` apontando para `POST /conversas`.
   - Manter `lunaSubmit()` para o envio dos dados do formulário.
   - Padronizar parsing e logs sem expor o token.

2. Reestruturar `demo-health-submit`
   - Continuar enviando os dados de saúde para o formulário `dados-de-saude`.
   - Incluir `conexao_id: 1` no payload LunaOS.
   - Depois do envio da avaliação, chamar `POST /conversas` com:
     - `nome`
     - `celular`
     - `ddi: "55"`
     - `conexao_id: 1`
     - `assunto: "Teste de saúde Mayla"`
     - `mensagem` inicial contendo o resumo dos dados medidos, para a Maria já receber contexto.
     - tags do demo.
   - Extrair o widget em `data.widget.url`, com fallback para qualquer formato equivalente retornado pela LunaOS.
   - Se o widget não vier, retornar erro estruturado com `chatError`, `conversationId` e diagnóstico seguro para a tela não ficar travada.

3. Ajustar a tela final do `/demo`
   - Manter a tela de carregamento enquanto a avaliação é salva e a conversa é aberta.
   - Só sair do loading quando houver `widgetUrl` ou erro final.
   - Exibir uma opção clara de tentar abrir novamente quando o widget não vier.
   - Evitar tela “travada” silenciosa.

4. Validar com chamada real
   - Depois de implementar, publicar/deployar a função `demo-health-submit`.
   - Testar a função com um payload de medição simulado.
   - Conferir se o retorno inclui `widgetUrl`.
   - Revisar os logs da função se a LunaOS devolver 401/403/422 ou não retornar `widget`.

## Resultado esperado

Depois que o visitante confirma/finaliza a medição:

```text
Binah finaliza teste
  -> app envia dados para demo-health-submit
  -> função salva avaliação no formulário LunaOS
  -> função abre conversa via POST /conversas usando conexão 1
  -> LunaOS retorna data.widget.url
  -> app carrega esse URL no iframe final
  -> Maria inicia conversa já com contexto da avaliação
```

## Observação importante

Se após isso o retorno da LunaOS vier sem `widget`, o problema passa a ser configuração externa: a conexão `1` precisa ser uma conexão do tipo `site`, pois a própria documentação diz que o `widget` só vem quando a conversa é aberta numa conexão desse tipo.