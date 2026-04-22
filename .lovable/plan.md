

# Plano: Mayla maior no FAB e no chat do Assistente

Refinamentos visuais sobre o plano anterior já aprovado (enfermeira animada + input no FAB). Esta revisão **substitui** a parte de tamanhos e adiciona presença da Mayla no header do chat.

## 1. FAB levemente maior

`src/components/mayla/MaylaFloatingButton.tsx`
- `FAB_SIZE`: **56 → 76px** (era 68 no plano anterior; agora 76 conforme pedido)
- Mantém fundo branco com sombra suave; o GIF circular ocupa 100% do botão
- Badge contador e pulse vermelho permanecem proporcionais
- Reajustar `clampToContainer` para usar o novo `FAB_SIZE` (já depende da constante, então só atualizar o valor)

## 2. Mayla grande no header do chat do Assistente

`src/components/mayla/HealthAssistantChat.tsx`
- No topo da tela do chat, adicionar header dedicado com:
  - **GIF da Mayla (`mayla-saudacao.gif`)** posicionado no **canto superior direito**, tamanho **96×96px**, circular, com leve sombra
  - À esquerda do GIF: título "Mayla Assistente" + subtítulo "Sua enfermeira virtual" + botão voltar (←) acima
  - Layout: `flex justify-between items-start` no header sticky
- O GIF fica visível durante toda a conversa (não desaparece ao rolar) — header `sticky top-0` com fundo branco/blur
- Quando a IA está "digitando" (loading), trocar para `mayla-aviso.gif` por feedback visual; volta para `saudacao` quando termina

## 3. Mantém o restante do plano anterior

Sem mudanças em:
- Assets (`mayla-saudacao.gif`, `mayla-aviso.gif`) já planejados
- Diálogo do FAB com input + handoff para o chat com `initialMessage`
- SplashScreen com GIF de saudação
- `MaylaApp.tsx` orquestrando `assistantInitialMessage`

## Arquivos afetados (consolidado)

| Arquivo | Mudança |
|---|---|
| `src/assets/mayla-saudacao.gif` | Novo |
| `src/assets/mayla-aviso.gif` | Novo |
| `src/components/mayla/MaylaFloatingButton.tsx` | FAB 76px com GIF dinâmico + diálogo com input |
| `src/components/mayla/HealthAssistantChat.tsx` | Header sticky com Mayla 96px no canto superior direito + alterna GIF durante loading; aceita `initialMessage` |
| `src/components/mayla/MaylaApp.tsx` | Passa `initialMessage` ao chat e callback ao FAB |
| `src/components/mayla/SplashScreen.tsx` | GIF de saudação na abertura |

## Validação
1. FAB visivelmente maior (76px) dentro do container do celular, ainda arrastável e dentro dos limites
2. Ao abrir o chat da Mayla, GIF grande (96px) aparece fixo no canto superior direito durante toda a conversa
3. Enquanto a IA responde, o GIF muda para o de "aviso" (gesto) e volta ao normal quando termina
4. Digitar mensagem no FAB → abre chat já com a mensagem enviada e Mayla grande no header
