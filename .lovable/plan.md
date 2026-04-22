

# Plano: Mayla Conversacional + Botão Flutuante + Home Limpa

Trabalho dividido em 4 frentes que se complementam.

---

## 1. Respostas mais curtas + ações sugeridas

### Backend: `supabase/functions/health-assistant-chat/index.ts`
Atualizar o `system_prompt` (e o registro em `assistant_prompts`) para instruir:
- **Respostas em até ~300 caracteres** (cerca de 2-3 frases curtas).
- Quando a pergunta for um **tópico estruturado** (ex.: "Como está minha saúde hoje?"), responder em **3 blocos numerados de ~300 caracteres**, separados por linha em branco.
- Após cada resposta, retornar (em JSON dentro de um bloco `[ACTIONS]…[/ACTIONS]` no final do texto) **chips de ação sugeridos**: `consulta`, `medicao`, `dicas`, `relatorio`, `magazine`. O frontend extrai esse bloco e renderiza botões — não aparece como texto.
- Adicionar instrução de **personalização**: se o snapshot do usuário tiver `diabetes=true`, dicas devem priorizar diabetes; `hypertension=true` → hipertensão; senão → dicas gerais.

### Frontend: `src/components/mayla/HealthAssistantChat.tsx`
- Após receber a mensagem completa, **parsear `[ACTIONS]…[/ACTIONS]`**, remover do texto exibido e renderizar chips clicáveis abaixo da bolha do assistente.
- Cada chip recebe `onClick` que chama uma callback `onAction(actionId)` passada pelo `MaylaApp` para navegar:
  - `consulta` → abre tela de consultas online (já existe `onOpenConsultationOnline`)
  - `medicao` → vai para aba `bemestar`
  - `relatorio` → abre `/relatorio` em nova aba
  - `magazine` → vai para a Magazine na Home
  - `dicas` → envia automaticamente "Quero dicas de bem-estar para hoje" como nova mensagem

### Sugestões iniciais (tela vazia do chat)
Substituir o array `SUGGESTIONS` atual por **4 opções fixas**:
1. "Como está minha saúde hoje?" *(pede 3 blocos + link relatório)*
2. "Quero dicas de bem-estar para hoje" *(personalizado por condição)*
3. "Quais as novidades para hoje" *(retorna chip `magazine`)*
4. "Quero conhecer o aplicativo" *(prompt instrui Gemini a responder em 4 blocos de ~300 chars sobre Bem-estar, Campanhas, Serviços e Perfil)*

---

## 2. Botão flutuante arrastável (Mayla Floating Action)

### Novo componente: `src/components/mayla/MaylaFloatingButton.tsx`
- Pequeno botão circular (56px) com avatar da Mayla, posição inicial **canto inferior direito** (acima do BottomNav).
- **Arrastável** via `pointermove` (touch + mouse). Posição persistida em `localStorage` (`mayla_fab_position`).
- **Pulso vermelho** (CSS keyframe) quando há aviso pendente.
- Ao **clicar**: abre um popup centralizado (Dialog) com o aviso atual (título, corpo, emoji, link opcional).
- Suporta **múltiplos avisos em fila** (badge contador se >1).

### Lógica de avisos rotativos
Ao montar, escolhe **1 aviso aleatório** entre estas categorias para a sessão atual:
- "Entrar em um time" (se usuário não tem time → CTA abre o `TeamDialog`)
- "Realizar consulta" (CTA abre consultas)
- "Fazer medição de hoje" (CTA abre Bem-estar)
- "Veja as novidades do dia" (CTA abre Magazine)
- **Notícias reais** da tabela `notifications` (já existente) — se houver não lidas, têm prioridade e somam à fila.

Marca como "vista" em `localStorage` por dia (`mayla_fab_seen_<date>`) para não repetir o mesmo aviso CTA na mesma sessão. Notificações reais usam ID próprio.

### Integração no `MaylaApp.tsx`
Renderizar `<MaylaFloatingButton />` dentro do container do app (overlay sobre todas as telas exceto vídeo-chamada e chat). Recebe callbacks de navegação reusando os handlers já existentes (`setShowOnDemand`, `setActiveTab`, `setShowAssistant` etc.).

---

## 3. Limpeza da HomeTab

Remover da `HomeTab.tsx`:
- ❌ Card "Entrar em um time" (linhas 341-354) → migra para o FAB
- ❌ Card "Realizar Consulta" (linhas 393-405) → migra para o FAB
- ❌ Card "Fazer medição de hoje" rPPG (linhas 408-421) → migra para o FAB
- ❌ Bloco "Informações importantes" / lista de alertas (linhas 428-450) → migra para o FAB
- ❌ Dialog de detalhe do alerta (linhas 452-469) → vira o popup do FAB
- ❌ Dialog de Times (linhas 472-528) → extraído para componente reutilizável (`TeamPickerDialog`) usado pelo FAB

Mantém na Home:
- Header + saudação
- Card de Score de Saúde (com botão Medir)
- Card "Mayla, sua enfermeira digital"
- Card de Pesquisa (se houver)
- **Health Magazine Carousel ampliado** — passa a ocupar mais espaço e vira o destaque visual da Home (ver passo 4)

---

## 4. Magazine com layout interativo destacado

### `src/components/mayla/HealthMagazineCarousel.tsx`
- Aumentar altura dos cards (~220px), bordas arredondadas mais suaves, sombra sutil
- Header da seção: "📰 Mayla Magazine" com link "Ver todas →"
- Cards com **gradiente sobre imagem + título em overlay**, tag de categoria pill no topo
- Snap scrolling horizontal mais fluido (`scroll-snap-type: x mandatory`)
- Animação `hover:scale-[1.02]` e `active:scale-[.98]`

---

## Detalhes técnicos

### Migração SQL (atualizar prompt da Mayla)
```sql
UPDATE public.assistant_prompts
   SET system_prompt = '<novo prompt com regras de 300 chars + [ACTIONS]>'
 WHERE name = 'mayla_default' AND is_active = true;
```

### Extração do bloco ACTIONS (frontend)
```ts
const match = content.match(/\[ACTIONS\](.*?)\[\/ACTIONS\]/s);
const actions = match ? JSON.parse(match[1]) : [];
const cleanText = content.replace(/\[ACTIONS\].*?\[\/ACTIONS\]/s, "").trim();
```

### Drag do FAB (resumo)
```ts
onPointerDown → captura offset
onPointerMove → atualiza translate
onPointerUp → persiste posição em localStorage, snap nas bordas
```

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `supabase/functions/health-assistant-chat/index.ts` | Novo `FALLBACK_PROMPT` com regras de tamanho + ACTIONS |
| `supabase/migrations/<novo>.sql` | Atualiza prompt ativo |
| `src/components/mayla/HealthAssistantChat.tsx` | Novas sugestões, parsing ACTIONS, chips, callback `onAction` |
| `src/components/mayla/MaylaFloatingButton.tsx` | **NOVO** — FAB arrastável com fila de avisos |
| `src/components/mayla/TeamPickerDialog.tsx` | **NOVO** — extraído da HomeTab |
| `src/components/mayla/HomeTab.tsx` | Remove team/consulta/medição/alertas; mantém Score, Mayla, Pesquisa, Magazine |
| `src/components/mayla/HealthMagazineCarousel.tsx` | Layout maior e mais interativo |
| `src/components/mayla/MaylaApp.tsx` | Renderiza FAB + passa `onAction` para o chat |

### Validação
1. Mayla responde "Como está minha pressão?" em ≤300 chars + chip "Ver relatório" abaixo
2. Tela inicial do chat mostra as 4 sugestões pedidas
3. FAB aparece, pode ser arrastado, pisca em vermelho com aviso, abre popup ao clicar
4. Home mostra apenas: Score, Mayla, Pesquisa (se houver), Magazine — sem cards removidos
5. Clique nos chips do chat navega corretamente

