

## Plano: Adicionar botão Editar nas missões do painel admin

### Problema
As missões dentro de Programa > Campanha só têm botão de excluir. Não é possível editar título, pontos, frequência ou tipo de validação de uma missão existente.

### Correção

**Arquivo: `src/components/admin/AdminPrograms.tsx`**

1. **Adicionar estado `editingMission`** para rastrear a missão sendo editada (incluindo `mission_id` real, não o `campaign_mission_id`)

2. **Criar função `openEditMission`** que preenche o `missionForm` com os dados da missão existente e abre o modal

3. **Modificar `saveMission`** para detectar se está editando (update no `missions` table pelo `mission_id`) ou criando

4. **Adicionar botão Pencil** na linha de cada missão (ao lado do botão de lixeira, linha ~403)

5. **Atualizar o título do modal** de "Nova Missão" para "Editar Missão" quando editando

### Detalhes
- Estado: `const [editingMission, setEditingMission] = useState<CampaignMission | null>(null)`
- `openEditMission(m)`: preenche `missionForm` com dados de `m`, seta `editingMission`, abre `showMissionForm`
- `saveMission`: se `editingMission`, faz `supabase.from("missions").update(payload).eq("id", editingMission.mission_id)` e recarrega missões da campanha
- Botão Pencil no template, ao lado do Trash2, com `onClick` que chama `openEditMission`

