

# Ajustes Mobile-First: FAB no container + Conteúdo

## Problema 1: FAB sai do container do celular

O FAB usa `position: fixed` com coordenadas calculadas a partir de `window.innerWidth/Height`. No desktop, isso o joga para o canto da janela do navegador, **fora do "celular" de 430px** centralizado.

### Correção em `MaylaFloatingButton.tsx`
- Trocar `position: fixed` por `position: absolute` ancorado ao container do app (430px).
- Calcular limites de drag com base no **bounding rect do container pai**, não em `window`.
- Adicionar `ref` no `MaylaApp.tsx` no div interno (430px) e passar como prop `containerRef` para o FAB.
- Posição inicial: canto inferior direito do container (não da tela), acima do `BottomNav` (~80px do bottom).
- Ao redimensionar o navegador, recalcular para manter o FAB dentro dos limites do container.

### Correção em `MaylaApp.tsx`
- Criar `useRef<HTMLDivElement>` no div do container 430px.
- Passar `containerRef` para `<MaylaFloatingButton containerRef={containerRef} />`.
- O FAB renderiza **dentro** do container (já está, mas com `fixed` ele escapa visualmente).

---

## Problema 2: Conteúdo vazio (Magazine + Notificações)

### Diagnóstico do banco
- `health_articles`: **0 registros** → carrossel não renderiza (já tem `if (articles.length === 0) return null`).
- `notifications`: 1 registro ("Campanha contra a dengue") → o FAB deveria mostrar, mas está fora da tela.

### Onde criar conteúdo (já existe, só precisa de orientação):
| Conteúdo | Onde gerenciar |
|---|---|
| **Notícias / avisos do FAB** | Painel Admin → Empresa → aba **"Notificações"** (`AdminNotifications`) |
| **Mayla Magazine** (artigos) | Painel Admin → aba **"Magazine"** (`AdminMagazine`) |

### Ajuste de UX para estado vazio
- **HomeTab**: quando não houver artigos, mostrar um card placeholder amigável: *"📰 Em breve, novidades de saúde aqui."* — em vez de simplesmente sumir.
- **FAB**: quando não houver notificações nem CTAs disponíveis para o dia, ainda assim aparecer (sem pulso vermelho) como atalho rápido para a Mayla. Hoje ele só aparece se há itens — vamos sempre mostrar, com badge apenas se houver itens.

---

## Problema 3: Cards informativos visíveis na Home

A Home ficou muito vazia porque tudo migrou para o FAB que está invisível. Vamos:
- **Reintroduzir um card "Avisos & Novidades"** na Home (abaixo do card da Mayla) que mostra a notificação mais recente de forma resumida, com seta para abrir o popup (mesmo conteúdo do FAB). Isso garante visibilidade mesmo se o usuário ignorar o FAB.
- O FAB continua existindo como atalho flutuante, mas a Home não fica mais "só com Score + Mayla".

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/mayla/MaylaFloatingButton.tsx` | `position: absolute` ancorado ao container; cálculo de drag por `containerRef`; sempre visível |
| `src/components/mayla/MaylaApp.tsx` | `useRef` no container 430px; passa `containerRef` ao FAB |
| `src/components/mayla/HomeTab.tsx` | Novo card "Avisos & Novidades" lendo `notifications` (top 1, com modal de detalhe) + placeholder para Magazine vazia |
| `src/components/mayla/HealthMagazineCarousel.tsx` | Renderiza placeholder amigável quando `articles.length === 0` |

## Validação
1. FAB aparece **dentro** do retângulo do celular (canto inferior direito do container 430px), tanto no preview quanto em mobile real.
2. Arrastar o FAB respeita os limites do container (não escapa).
3. Card "Avisos & Novidades" mostra "Campanha contra a dengue" na Home.
4. Carrossel da Magazine mostra placeholder até admin cadastrar artigos.
5. Mensagem clara ao usuário: notícias se cadastram em **Admin → Empresa → Notificações**; artigos em **Admin → Magazine**.

