

# Plano: Assistente Digital de Saúde (Gemini) + Magazine de Saúde

Implementação em **3 fases**, na ordem solicitada: UX → integração Gemini → persistência/avaliação no banco.

---

## Fase 1 — UX (HomeTab)

### 1.1 Novo card "Assistente Digital de Saúde" na HomeTab
Inserido logo após o card "Saúde hoje", antes do "Meu Time":
- Ícone (✨ ou 🤖), título "Assistente Mayla", subtítulo dinâmico ("Tire dúvidas sobre seus dados de saúde")
- Toque abre tela full-screen `HealthAssistantChat`

### 1.2 Tela `HealthAssistantChat.tsx` (nova)
- Header com botão voltar + título + disclaimer ("Não substitui consulta médica")
- Lista de mensagens (usuário/assistente) com **markdown** via `react-markdown`
- Streaming token-a-token (SSE)
- Sugestões iniciais clicáveis: "Como está minha pressão?", "Explique meu score", "Dicas de bem-estar"
- Input fixo no rodapé + botão enviar
- Botão 👍 / 👎 em cada resposta do assistente (feedback)

### 1.3 Novo card "Saúde & Bem-estar" (Magazine) na HomeTab
Card abaixo do assistente:
- Carrossel horizontal de até 5 artigos com capa, título e tag
- Toque abre `HealthMagazineArticle` (visualizador de artigo em markdown)
- Fonte: tabela `health_articles` (criada nesta fase, conteúdo manual; personalização por características fica para fase futura conforme solicitado)

---

## Fase 2 — Integração com Gemini (Lovable AI Gateway)

### 2.1 Edge function `health-assistant-chat`
- Recebe `{ messages, conversationId? }` do cliente
- Valida JWT, identifica `user_id`
- Carrega **dados anonimizados** do paciente: idade, sexo, condições crônicas, último `health_scores`, últimas 3 `health_measurements`, alertas ativos — **sem nome, CPF, e-mail**
- Monta system prompt (baseado em `relatorio-saude-mayla.md`): tom acolhedor PT-BR, descritivo, sem diagnóstico/prescrição, sugerir consulta quando crítico
- Chama `https://ai.gateway.lovable.dev/v1/chat/completions` com `google/gemini-3-flash-preview`, `stream: true`
- Retorna SSE direto ao cliente
- Trata 429 (rate limit) e 402 (créditos) com toasts amigáveis

### 2.2 Prompt e contexto
- System prompt fixo no backend (não no cliente)
- Contexto de saúde injetado a cada requisição como mensagem `system` adicional
- Instruções explícitas: **"Você é um assistente educacional. Nunca diagnostique nem prescreva. Sempre que valores estiverem fora da faixa normal, recomende avaliação por profissional de saúde."**

---

## Fase 3 — Persistência, registro e avaliação (ML-ready)

### 3.1 Novas tabelas

**`assistant_conversations`**
- `id` uuid PK, `user_id` uuid, `company_id` uuid, `started_at`, `last_message_at`, `message_count` int, `topic_tags` text[], `health_context_snapshot` jsonb (dados anonimizados enviados no início)

**`assistant_messages`**
- `id` uuid PK, `conversation_id` FK, `role` ('user'|'assistant'|'system'), `content` text, `tokens_in` int, `tokens_out` int, `model` text, `latency_ms` int, `created_at`

**`assistant_feedback`**
- `id` uuid PK, `message_id` FK, `user_id`, `rating` ('up'|'down'), `comment` text nullable, `created_at`
- Usado para **fine-tuning / RLHF futuro**

**`assistant_safety_flags`** (auditoria)
- `id`, `message_id`, `flag_type` ('diagnosis_attempt'|'prescription_attempt'|'critical_indicator'|'escalate_to_doctor'), `details` jsonb, `created_at`
- Edge function detecta padrões e flag automaticamente para revisão

**`health_articles`** (magazine)
- `id`, `slug`, `title`, `cover_image_url`, `excerpt`, `content_markdown`, `tags` text[], `target_conditions` text[] (hipertensão, diabetes — usado na fase futura), `published_at`, `is_active`
- RLS: leitura pública para autenticados, escrita só admin

**`health_article_views`** (telemetria para ML)
- `id`, `user_id`, `article_id`, `viewed_at`, `read_duration_seconds`, `completed` bool

### 3.2 RLS
- Conversas/mensagens/feedback: usuário lê/insere apenas as próprias; admins globais e da empresa podem ler agregados
- Artigos: SELECT público para autenticados; INSERT/UPDATE só admin
- Safety flags: insert pelo edge function (service role), select só admin

### 3.3 Estrutura de avaliação (para enriquecer ML)
Cada mensagem do assistente captura:
- **Métricas técnicas**: latência, tokens, modelo
- **Feedback explícito**: 👍/👎 + comentário opcional
- **Sinais implícitos**: a conversa continuou? usuário reformulou? clicou em sugestão de consulta?
- **Contexto clínico no momento**: snapshot anonimizado dos scores/vitais

Isso permite no futuro:
- Treinar classificador de qualidade de resposta
- Identificar padrões de dúvidas por perfil de saúde
- Recomendar artigos da magazine baseado em conversas anteriores

### 3.4 Painel admin (incluso nesta fase)
Nova aba `AdminAssistantInsights` em `/admin/painel`:
- Total de conversas / mensagens / usuários ativos (período)
- Taxa 👍 vs 👎
- Top tópicos (tags)
- Lista de safety flags pendentes para revisão
- Gestão de artigos da magazine (CRUD)

---

## Arquivos afetados

**Novos**
- `src/components/mayla/HealthAssistantChat.tsx`
- `src/components/mayla/HealthMagazineCarousel.tsx`
- `src/components/mayla/HealthMagazineArticle.tsx`
- `src/components/admin/AdminAssistantInsights.tsx`
- `src/components/admin/AdminMagazine.tsx`
- `supabase/functions/health-assistant-chat/index.ts`
- Migração SQL: 5 tabelas + RLS + índices

**Modificados**
- `src/components/mayla/HomeTab.tsx` — 2 novos cards (Assistente + Magazine)
- `src/components/mayla/MaylaApp.tsx` — rotas internas para chat e artigo
- `src/pages/Admin.tsx` — abas Insights + Magazine
- `package.json` — adicionar `react-markdown`

---

## Decisões técnicas chave
- **Anonimização**: nome/CPF/e-mail nunca enviados ao Gemini; só dados clínicos + demográficos agregados
- **Streaming**: SSE token-a-token (padrão Lovable AI Gateway)
- **Modelo**: `google/gemini-3-flash-preview` (rápido, custo baixo, multimodal)
- **Fase futura (não nesta entrega)**: recomendação personalizada de artigos por características do paciente

