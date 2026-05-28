## Contexto

Duas telas diferentes têm "perguntas":

1. **Admin → Gamificação → Autoavaliação** (`AdminSelfAssessment`) — questionário configurável de 8 perguntas (vale +200 pts). **Já existe e é editável.**
2. **App do colaborador → Perfil → "Auto avaliação"** (`ProfileTab`, mostrado no print) — campos clínicos fixos (Peso, Altura, Hipertensão, Diabetes, Família, Endereço, etc.) com colunas tipadas em `profile_health_data`. **Hoje não é editável pelo admin.**

O print é a tela #2.

## Bug do teclado (causa)

Em `src/components/mayla/ProfileTab.tsx`, `InfoRow` e `ToggleField` estão declarados **dentro** da função `HealthSection` (linhas 287 e 294). A cada tecla, o `setForm` re-renderiza o pai; como `InfoRow` é redefinido a cada render, React cria um **componente novo** com a mesma assinatura, desmonta o `<Input>` antigo e monta um novo — o foco é perdido e o teclado fecha no Android.

## O que vou fazer

### 1. Corrigir o teclado (frontend puro)

- Mover `InfoRow` e `ToggleField` para **fora** do componente `HealthSection` (módulo-level), recebendo `editing`, `editField`, `value` por props.
- Garantir que cada `<Input numérico>` use `inputMode="decimal"` / `"numeric"` e `key` estável.
- Resultado: a instância do `<input>` é preservada entre keystrokes, foco se mantém, teclado para de fechar.

### 2. Tornar o "Perfil de Saúde" admin-editável

Como as colunas (`peso`, `has_hypertension`, etc.) são tipadas, o admin **não cria/remove perguntas**, mas controla **visibilidade, rótulo e ordem** de cada campo já existente.

**Banco** — nova tabela `clinical_profile_field_config`:

```text
- company_id (uuid, nullable → fallback global)
- field_key (text)  ex: 'peso', 'has_hypertension', 'lives_with_infant'
- label (text)
- section ('saude' | 'endereco' | 'familia')
- sort_order (int)
- visible (boolean)
- UNIQUE (company_id, field_key)
```

RLS: leitura para `authenticated`; escrita só para `admin`/`company_admin` da empresa. GRANT + policies completas.

Seed: inserir uma linha global (`company_id = NULL`) para cada um dos ~16 campos atuais, com os rótulos hoje hardcoded.

Função `get_effective_clinical_fields(_company_id uuid)` análoga a `get_effective_levels`: retorna config da empresa se existir, senão a global.

**Admin UI** — nova aba **"Perfil de Saúde"** dentro de `AdminGamification` (próximo a "Autoavaliação"):
- Lista os campos agrupados por seção.
- Para cada um: switch de visível, input de rótulo, drag/ordem.
- Botão "Personalizar para empresa" (clona o global) — mesmo padrão de `AdminSelfAssessment`.

**App do colaborador** — `ProfileTab` passa a:
- Carregar config via `get_effective_clinical_fields(companyId)`.
- Renderizar dinamicamente: pula campos com `visible = false`, usa `label` do admin, respeita `sort_order`.
- Mantém o mapeamento `field_key → editor` (toggle, número, select) no frontend, já que cada campo tem widget específico.

### 3. Fora de escopo (não vou mexer)

- Tags por resposta (descartado pelo usuário).
- Adicionar/remover colunas no schema clínico — só visibilidade/rótulo.
- A Autoavaliação configurável (`AdminSelfAssessment`) já existe e não precisa de mudança.

## Arquivos afetados

- `src/components/mayla/ProfileTab.tsx` — extrair `InfoRow`/`ToggleField`, render dinâmico.
- `src/components/admin/AdminClinicalProfileFields.tsx` — **novo**.
- `src/components/admin/AdminGamification.tsx` — adicionar aba.
- `supabase/migrations/<timestamp>_clinical_profile_field_config.sql` — tabela + GRANT + RLS + função + seed.
- `src/integrations/supabase/types.ts` — regenerado automaticamente.

## Validação

- Abrir Perfil no mobile, editar Peso/Altura → teclado não fecha mais entre dígitos.
- No admin: desligar "Bolsa Família" → some no app do colaborador da mesma empresa.
- Renomear "Hipertensão" para "Pressão alta" → reflete no app.
