
## Objetivo

Na tela final (`phase === "done"`) da rota `/demo`, adicionar um botão **"Quero entender os meus resultados"** que ativa o widget de chat do agente LunaOS. Mudança 100% isolada em `src/pages/DemoBinah.tsx` — nada do app principal Mayla é tocado.

## Comportamento

1. Após o envio dos dados (tela "Recebemos seus dados!"), abaixo do botão "Fazer novo teste" aparece um segundo botão em destaque: **"💬 Quero entender os meus resultados"**.
2. Ao clicar, monta um `<iframe>` fixo no canto inferior direito apontando para `https://mayla.lunaos.com.br/chat/PSMiOg0P9Fik9MnYr8GgK8BN0Gdjm9Vj`, replicando o script fornecido (position fixed, 400px × 650px máx, z-index 9999).
3. O iframe é renderizado via React (não `document.createElement`), com um pequeno botão `×` no topo para fechar. Estado local `chatOpen` controla a montagem.
4. No mobile (largura < 480px), o iframe ocupa 100% da tela. Em desktop, mantém 400×650 no canto inferior direito.
5. O token do widget é público (é o mesmo exposto no `<script>` de embed do LunaOS), então pode ficar hardcoded no client — não é secret.

## Arquivos alterados

- `src/pages/DemoBinah.tsx` — adicionar estado `chatOpen`, botão na tela `done` e componente `<iframe>` condicional.
- `src/pages/demo.css` — adicionar classes `.demo-cta-secondary` (botão outline verde) e `.demo-chat-frame` / `.demo-chat-close` (posicionamento e botão fechar do iframe).

Nenhum outro arquivo é tocado. Sem mudanças em edge functions, backend, `BinahCapture`, ou fluxo de medição.
