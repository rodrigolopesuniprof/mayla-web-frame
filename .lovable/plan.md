

## Plano: Tela hierárquica de Programas de Bem-estar

### Resumo
Reescrever `AdminPrograms.tsx` como uma tela única com acordeão hierárquico (Programa → Campanha → Missão), com modais contextuais para criar campanhas e missões inline. Remover as abas separadas "Missões" e "Campanhas" do admin.

### Mudanças

#### 1. `src/pages/Admin.tsx`
- Remover as abas `missoes` e `campanhas` do array `tabs`
- Remover os renders de `AdminMissions` e `AdminCampaigns` do corpo
- Manter os imports caso sejam usados em outro lugar (ou remover)

#### 2. `src/components/admin/AdminPrograms.tsx` — Reescrita completa
A tela passa a ser a única interface para gerenciar Programas, Campanhas e Missões.

**Listagem principal:**
- Header: "Programas de bem-estar" + botão "+ Novo programa"
- Cada programa é um card com Collapsible (chevron para expandir/colapsar)
- Info do card: emoji + título + subtexto ("X campanhas · Y missões · NomeEmpresa") + badges (status, categoria) + botões editar/excluir
- Ao expandir: lista de campanhas do programa
  - Cada campanha é um sub-card com Collapsible
  - Info: emoji + título + datas + contagem de missões + pontos bônus + badges + botões editar/excluir
  - Ao expandir campanha: lista de missões em linhas simples (nome + pontos + frequência + botão excluir)
  - Link "+ Adicionar missão" no final
- Link "+ Adicionar campanha" no final da lista de campanhas

**Dados carregados:**
- Load principal: `wellbeing_programs` + `companies`
- Ao expandir programa: `campaigns` (filtrado por `program_id`) + `campaign_missions` com join em `missions`
- Contadores de campanhas e missões calculados via queries separadas ou carregados sob demanda

**Modal "Editar Programa":**
- Mesmo formulário atual (emoji, título, descrição, empresa, categoria, datas)

**Modal "Nova Campanha":**
- Breadcrumb não-clicável no topo: "Dentro de › 🔥 NomePrograma"
- Campos: Nome, Data início, Data fim, Pontos de bônus
- Nota: "As missões serão adicionadas após salvar a campanha."
- Footer: Cancelar + Salvar campanha
- Ao salvar, faz insert em `campaigns` com `program_id` e `company_id` do programa pai

**Modal "Nova Missão":**
- Breadcrumb completo: "Dentro de › 🔥 NomePrograma › 🏆 NomeCampanha"
- Campos: Nome, Pontos, Frequência (Diária/Semanal/Única), Tag/Categoria
- Ao salvar: insert em `missions` + insert em `campaign_missions` vinculando à campanha

**Exclusões:**
- Excluir programa: `AlertDialog` → delete `wellbeing_programs` (cascade remove `program_missions`)
- Excluir campanha: `AlertDialog` → delete `campaigns` (cascade remove `campaign_missions`)
- Excluir missão da campanha: remove de `campaign_missions` (desvincular, não deleta a missão em si)

#### 3. Sem mudanças no banco de dados
Todas as tabelas e relações já existem (`campaigns.program_id`, `campaign_missions`).

### Arquivos
- `src/pages/Admin.tsx` — remover abas Missões e Campanhas
- `src/components/admin/AdminPrograms.tsx` — reescrita completa com hierarquia acordeão

