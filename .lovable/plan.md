

## Plano: Botões de exclusão + Hierarquia Programa → Campanha → Missão

### Parte 1: Botões de Delete em todas as seções admin

Adicionar um botão de exclusão (ícone lixeira vermelha) com confirmação (AlertDialog) nos seguintes componentes:

| Componente | Tabela | Observação |
|---|---|---|
| `AdminMissions.tsx` | `missions` | Delete direto |
| `AdminCampaigns.tsx` | `campaigns` | Deleta `campaign_participants` em cascata (FK) |
| `AdminPrograms.tsx` | `wellbeing_programs` | Deleta `program_missions` em cascata |
| `AdminUsers.tsx` | Chama edge function `manage-user` | Já tem AlertDialog, verificar se já tem delete |
| `AdminNotifications.tsx` | `notifications` | Delete direto |
| `AdminSupportTeams.tsx` | `esf_teams` | Delete direto |

Para cada componente:
- Adicionar botão `Trash2` no card da lista (ao lado do botão Ativar/Desativar)
- Usar `AlertDialog` com confirmação "Tem certeza que deseja excluir?"
- Chamar `supabase.from("tabela").delete().eq("id", id)` com tratamento de erro
- `e.stopPropagation()` para não abrir o dialog de edição

### Parte 2: Hierarquia Programa → Campanha → Missão

Conforme a imagem, a estrutura hierárquica desejada é:
```text
Programa
  └── Campanha
        └── Missões
```

Atualmente:
- `campaigns` tem `company_id` mas **não tem** `program_id`
- `program_missions` vincula missões diretamente a programas
- Não existe vínculo campanha → missão nem programa → campanha

#### Mudanças no banco de dados:

**Migration 1**: Adicionar `program_id` na tabela `campaigns` (nullable, FK para `wellbeing_programs`)
```sql
ALTER TABLE public.campaigns ADD COLUMN program_id uuid REFERENCES public.wellbeing_programs(id) ON DELETE SET NULL;
```

**Migration 2**: Criar tabela `campaign_missions` (junção campanha → missão)
```sql
CREATE TABLE public.campaign_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, mission_id)
);
ALTER TABLE public.campaign_missions ENABLE ROW LEVEL SECURITY;
-- Admin policy
CREATE POLICY "Admins can manage campaign missions" ON public.campaign_missions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Employee can view
CREATE POLICY "Employees can view campaign missions" ON public.campaign_missions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.active = true AND c.company_id = get_user_company_id(auth.uid())));
-- Wellbeing/company admin can manage
CREATE POLICY "Managers can manage campaign missions" ON public.campaign_missions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.company_id = get_user_company_id(auth.uid()) AND (is_wellbeing_manager(auth.uid()) OR is_company_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.company_id = get_user_company_id(auth.uid()) AND (is_wellbeing_manager(auth.uid()) OR is_company_admin(auth.uid()))));
```

#### Mudanças no código:

**`AdminCampaigns.tsx`**:
- Adicionar campo `program_id` no formulário (select de programas filtrados pela mesma empresa)
- Adicionar seção "Missões da Campanha" no dialog de edição (mesmo padrão do AdminPrograms)
- Vincular/desvincular missões via `campaign_missions`

**`AdminPrograms.tsx`**:
- Exibir campanhas vinculadas ao programa (filtrar por `campaigns.program_id`)
- Manter o vínculo direto de missões ao programa como fallback

**`WellbeingPrograms.tsx`** (app do colaborador):
- Ao expandir um programa, mostrar suas campanhas
- Ao expandir uma campanha, mostrar suas missões

### Arquivos a modificar
- Migration SQL (2 statements)
- `src/components/admin/AdminMissions.tsx` — botão delete
- `src/components/admin/AdminCampaigns.tsx` — botão delete + campo program_id + seção missões
- `src/components/admin/AdminPrograms.tsx` — botão delete + exibir campanhas vinculadas
- `src/components/admin/AdminNotifications.tsx` — botão delete
- `src/components/admin/AdminSupportTeams.tsx` — botão delete
- `src/components/admin/AdminUsers.tsx` — verificar/adicionar botão delete
- `src/components/corporate/WellbeingPrograms.tsx` — hierarquia programa → campanha → missão

