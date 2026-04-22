

# Plano: Magazine por Empresa + Canal Global Mayla

## Diagnóstico
1. O componente `AdminMagazine.tsx` existe, mas **não está conectado em nenhuma tela** do admin — por isso você não acha.
2. A tabela `health_articles` é **100% global** (sem `company_id`) — todo artigo cadastrado aparece para todos os usuários.
3. Sua decisão correta: cada empresa precisa do seu próprio canal, com a opção de um canal "Mayla Saúde" global que envia para todas.

---

## 1. Banco de dados — adicionar escopo por empresa

Migração que adiciona à tabela `health_articles`:

| Coluna | Tipo | Descrição |
|---|---|---|
| `company_id` | `uuid` nullable, FK → `companies(id)` | Quando preenchido, artigo só aparece para essa empresa. **NULL** = canal global Mayla Saúde (todas as empresas) |
| `is_global` | `boolean` default `false` | Flag explícita só para super admin marcar como global (segurança extra além de `company_id IS NULL`) |

**RLS atualizada**:
- **Leitura**: usuário vê artigos onde `company_id = profile.company_id` **OU** `is_global = true AND company_id IS NULL`
- **Escrita**:
  - Super admin: pode criar/editar artigos globais (`is_global=true`) e de qualquer empresa
  - Company admin: só pode CRUD em artigos da própria empresa (`company_id = sua_empresa`); **não pode** marcar `is_global`

---

## 2. Admin — onde a Magazine vai aparecer

### Dentro de cada Empresa (`AdminCompanyDetail.tsx`)
Nova seção na sidebar: **"📰 Magazine"** (entre "Notificações" e "Programas de Saúde"). Reutiliza o componente `AdminMagazine` adaptado para receber `companyId` como prop. Lista, cria e edita só artigos daquela empresa.

### Canal global Mayla Saúde (no nível raiz do Admin)
Nova aba ao lado de **Dashboard / Empresas / Assistente**: **"📰 Magazine Global"**. Permite ao super admin publicar artigos com `is_global=true` e `company_id=null`, que aparecem automaticamente para todos os colaboradores de todas as empresas.

### Adaptação em `AdminMagazine.tsx`
- Aceita prop opcional `companyId?: string`:
  - Se presente → filtra `eq("company_id", companyId)` e força esse `company_id` no insert
  - Se ausente → modo global, filtra `is_global=true` e força `is_global=true, company_id=null` no insert
- Badge visual no card do artigo: "🏢 Empresa" ou "🌐 Global Mayla"

---

## 3. Frontend — leitura no app do colaborador

`HealthMagazineCarousel.tsx` passa a consultar:
```ts
.or(`company_id.eq.${userCompanyId},and(is_global.eq.true,company_id.is.null)`)
```
Carregando o `company_id` do perfil via `useAuth`/`profiles`. Artigos da própria empresa **e** globais Mayla aparecem misturados, ordenados por `sort_order` + `published_at`.

Pequeno indicador no card global: pill "Mayla Saúde" para diferenciar do conteúdo da empresa, se desejado.

---

## 4. Resumo dos arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Adiciona `company_id` + `is_global` em `health_articles`; nova RLS de leitura/escrita |
| `src/components/admin/AdminCompanyDetail.tsx` | Nova seção "📰 Magazine" na sidebar; renderiza `<AdminMagazine companyId={...} />` |
| `src/pages/Admin.tsx` | Nova aba "📰 Magazine Global" (super admin) renderiza `<AdminMagazine />` sem `companyId` |
| `src/components/admin/AdminMagazine.tsx` | Aceita `companyId` opcional; filtra/insere com escopo correto; badge global vs empresa |
| `src/components/mayla/HealthMagazineCarousel.tsx` | Query passa a filtrar por `company_id` do usuário + globais |

## Validação
1. Super admin acessa **Admin → Magazine Global** e cria artigo "Outubro Rosa" → aparece para colaboradores de **todas** as empresas
2. Super admin entra em **Empresas → MEDDIT → Magazine** e cria artigo "Comunicado MEDDIT" → aparece **apenas** para colaboradores da MEDDIT
3. Colaborador da MEDDIT vê os 2 artigos no carrossel; colaborador de outra empresa vê só o global
4. Company admin não consegue criar/editar artigos globais nem de outras empresas (bloqueado por RLS)

