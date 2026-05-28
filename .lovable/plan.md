**Tarefa**: Adicionar dois campos à tabela `public.profiles` via migration.

**Alterações na tabela `profiles`**:
- `avatar_type` (TEXT, NOT NULL, DEFAULT 'initials') — tipo de avatar do usuário: iniciais geradas no frontend, URL DiceBear automática no cadastro, ou URL Ready Player Me do iframe.
- `avatar_points_awarded` (BOOLEAN, NOT NULL, DEFAULT false) — flag para evitar crédito duplo de pontos ao trocar avatar.

**Notas**:
- Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (não recriar a tabela).
- CHECK constraint em `avatar_type` restringindo aos valores válidos.
- Nenhuma nova RLS necessária (profiles já possui RLS por usuário).
- Nenhuma outra tabela é alterada.