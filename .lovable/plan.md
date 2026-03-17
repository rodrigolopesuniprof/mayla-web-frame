

# Plano: Configurar Profissional Disponível 24/7

## Situação Atual

Hoje, o profissional precisa acessar o painel (`/painel-profissional`), fazer login e manualmente ligar os toggles "Online" e "Aceita atendimento imediato". Quando ele fecha o navegador, fica offline. Não existe configuração de disponibilidade permanente.

## Solução

Adicionar um campo `always_available` na tabela `professional_online_status` e expor o controle em **dois lugares**:

### 1. Painel Admin (AdminPartners)
Na tela de edição de parceiros do tipo "Médico", adicionar uma seção **"Teleconsulta"** com:
- Toggle **"Disponível 24/7"** — marca o profissional como sempre online para atendimento on-demand
- Campo **"Tempo estimado de resposta (min)"** — para definir o `estimated_response_minutes`
- Campo **"Máximo de pacientes simultâneos"** — para definir o `max_parallel_waiting`

Ao salvar, o admin cria/atualiza o registro em `professional_online_status` com `online_now = true`, `accepts_on_demand = true`, `always_available = true`.

### 2. Painel Profissional (ProfessionalDashboard)
Mostrar indicador visual quando `always_available = true` (definido pelo admin), e impedir que o profissional desligue o toggle nesse caso (override do admin).

### 3. Migração SQL
```sql
ALTER TABLE public.professional_online_status 
  ADD COLUMN always_available boolean NOT NULL DEFAULT false;
```

### 4. Lógica de Matching (OnDemandFlow)
Sem alteração necessária — profissionais com `always_available = true` já terão `online_now = true` e `accepts_on_demand = true`, então o matching existente já os encontra.

### Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar — adicionar `always_available` |
| `AdminPartners.tsx` | Editar — seção "Teleconsulta" no form de médicos |
| `OnlineStatusToggle.tsx` | Editar — respeitar `always_available` do admin |
| `ProfessionalDashboard.tsx` | Editar — passar `always_available` ao toggle |

