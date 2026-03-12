

## Plano: Vínculo manual + filtro automático de missões por programa

### Resumo
Implementar dois mecanismos complementares:
1. **Admin**: Ao editar um programa, exibir uma seção "Missões do Programa" onde o admin pode buscar e vincular missões existentes (usando a tabela `program_missions` que já existe).
2. **App do colaborador**: Na `ProgramsTab`, ao clicar em um programa, expandir para mostrar as missões vinculadas. Adicionalmente, sugerir missões automaticamente por categoria quando não há vínculos manuais.

### Alterações

#### 1. `AdminPrograms.tsx` — Seção de missões no dialog de edição
- Quando `editing` não é null, exibir abaixo do formulário uma seção "Missões vinculadas"
- Carregar missões já vinculadas via `program_missions` JOIN `missions`
- Carregar todas as missões ativas para um select/autocomplete de adição
- Botão "Adicionar" insere em `program_missions` (program_id, mission_id, sort_order)
- Botão "Remover" deleta da `program_missions`
- Sugestão automática: destacar missões cuja `tag` corresponde à `category` do programa (ex: tag "sono" ↔ category "sleep_improvement")

#### 2. `WellbeingPrograms.tsx` — Expandir programa para ver missões
- Tornar cada card de programa clicável/expansível (accordion ou toggle)
- Ao expandir, buscar `program_missions` → `missions` para aquele `program_id`
- Exibir lista de missões com emoji, título, pontos
- Se não houver missões vinculadas manualmente, fazer fallback: buscar missões ativas cuja `tag` corresponda à `category` do programa (mapeamento: `burnout_prevention` → tags como "saude_mental", `sleep_improvement` → "sono", `stress_reduction` → "estresse", `physical_activity` → "exercicio")

#### 3. RLS — `program_missions` já tem policies adequadas
- Employees podem SELECT via programas ativos da empresa
- Admins/wellbeing managers podem ALL
- Nenhuma migration necessária, a tabela `program_missions` já existe com as colunas `id`, `program_id`, `mission_id`, `sort_order`

#### 4. Mapeamento categoria → tags (constante compartilhada)
Criar um mapeamento reutilizável:
```text
burnout_prevention → ["saude_mental", "burnout"]
sleep_improvement  → ["sono", "sleep"]
stress_reduction   → ["estresse", "stress"]
physical_activity  → ["exercicio", "atividade_fisica"]
general            → [] (mostra todas)
```

### Arquivos a modificar
- `src/components/admin/AdminPrograms.tsx` — Adicionar seção de gerenciamento de missões no dialog
- `src/components/corporate/WellbeingPrograms.tsx` — Cards expansíveis com missões vinculadas + fallback por categoria

### Fluxo do admin
1. Cria programa com categoria "Melhoria do Sono"
2. Abre o programa para editar
3. Vê seção "Missões do Programa" com lista de missões já vinculadas
4. Vê sugestões destacadas (missões com tag "sono")
5. Clica "Adicionar" para vincular

### Fluxo do colaborador
1. Abre aba "Programas"
2. Vê cards dos programas ativos
3. Clica em um programa → expande mostrando missões vinculadas
4. Se nenhuma missão manual → mostra missões filtradas por categoria automaticamente

