## Correção: abrir o chat LunaOS automaticamente após a medição

Hoje, ao concluir a medição em `/demo`, a tela "Recebemos seus dados!" aparece e o usuário precisa clicar em "Quero entender os meus resultados" para abrir o widget. O comportamento desejado é que essa tela intermediária deixe de existir e o chat da LunaOS entre no lugar automaticamente.

### Mudanças (apenas em `src/pages/DemoBinah.tsx` e `src/pages/demo.css`, sem tocar no app principal)

1. **Remover a tela de sucesso ("done")**
   - Ao terminar o envio dos dados de saúde (`handleHealthSubmit` concluído), pular direto para o estado de chat aberto, sem passar pela tela "Recebemos seus dados!".
   - Remover o botão "💬 Quero entender os meus resultados" e o botão "Fazer novo teste" dessa tela (que deixa de existir).

2. **Novo estado final: `chat`**
   - Substituir `phase: "done"` por `phase: "chat"`.
   - Nessa fase, renderizar apenas:
     - Cabeçalho compacto da marca Mayla.
     - O iframe da LunaOS (`https://mayla.lunaos.com.br/chat/PSMiOg0P9Fik9MnYr8GgK8BN0Gdjm9Vj`) ocupando a tela inteira no mobile e uma área grande centralizada no desktop.
     - Um link discreto "Fazer novo teste" no rodapé, que reinicia o fluxo (volta para o formulário de lead).

3. **CSS**
   - Ajustar `demo.css`: o container do chat vira layout principal da fase (não mais um painel flutuante com botão de fechar), garantindo `100vh`/`100dvh` no mobile e sem sobreposição do widget nativo da LunaOS.
   - Remover estilos do botão de fechar flutuante e do CTA "Quero entender os meus resultados" que não são mais usados.

### Fora de escopo
- Nenhuma alteração no restante do sistema Mayla Web Frame (componentes do app principal, `BinahCapture`, edge functions, rotas fora de `/demo`).
- Nenhuma alteração de payload enviado para a LunaOS.
