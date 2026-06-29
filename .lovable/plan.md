## Diagnóstico

Cruzei as regras configuradas no Admin (`point_rules`) com os locais do código que disparam pontuação e com o histórico real (`points_ledger`). Encontrei os seguintes pontos onde a ação acontece mas nenhum ponto é creditado:

| Evento | Configurado no Admin? | Ação dispara pontos? | Histórico (ledger) |
|---|---|---|---|
| Medição básica (rPPG) | Sim (50 pts) | Sim | 54 registros OK |
| Medição premium (Shen.ai/Binah) | Sim (100 pts) | Sim | 43 registros OK |
| Cadastro completo | Sim (150 pts) | Sim | 53 registros OK |
| Autoavaliação | Sim (200 pts) | Sim (trigger) | 17 registros OK |
| Pesquisa standalone | Sim (100 pts) | Sim | 5 registros OK |
| Avatar | Sim (150 pts) | Sim | 3 registros OK |
| Missão concluída | Sim | Sim (trigger UPDATE) | 4 registros OK |
| **Check-in semanal (bem-estar)** | Sim (50 pts) | **NÃO — falta chamada** | **0 registros, com 49 check-ins feitos** |
| **Vínculo ESF** | Sim (500 pts) | **Parcial — trigger só em UPDATE** | 0 registros |
| **Vínculo equipe de apoio** | Sim (500 pts) | **Parcial — trigger só em UPDATE** | 0 registros |
| Adesão a medicamento | Sim (100 pts) | Trigger existe, sem dados ainda | 0 registros (sem logs) |
| Desafio do dia | Sim | RPC existe, sem dados ainda | 0 registros (sem conclusões) |

## Correções propostas

### 1. Check-in semanal de bem-estar (bug confirmado)
- Em `WellbeingCheckin.tsx`, após o `insert` em `wellbeing_checkins`, chamar `supabase.rpc("award_event", { _user_id, _event_key: "weekly_checkin" })`.
- A regra já tem `cap_per_week = 1`, então a função impede duplicidade dentro da semana.
- Disparar `points-awarded` event para o toast aparecer ao usuário.

### 2. Vínculo ESF e Equipe de Apoio (latente)
Hoje os triggers `award_esf_link_points` e `award_support_team_link_points` só executam em `UPDATE` (verificam `OLD.esf_team_id IS NULL AND NEW.esf_team_id IS NOT NULL`). Se um usuário entrar já com o time selecionado (signup ou import), nunca recebe os pontos.

- Migração: recriar ambos os triggers para também responder a `INSERT`, tratando `OLD` como `NULL` nesse caminho.

### 3. Backfill de pontos retroativos (check-in semanal)
Existem 49 check-ins históricos sem pontuação. Proposta: rodar um script único que credita 1 evento `weekly_checkin` por usuário/semana já registrada, respeitando o cap semanal. Confirmar antes de executar para não inflar o ranking sem aviso.

### 4. Diagnóstico para o Admin (opcional)
- Adicionar na tela "Regras de pontuação" um pequeno indicador por regra: "Última pontuação concedida em ___ · X eventos no último mês". Ajuda a detectar regressões futuras sem precisar consultar o banco.

## Itens NÃO alterados
- Missões (`mission_complete`), avatar, autoavaliação, perfil completo, pesquisas standalone e medições continuam como estão — funcionam.
- Não vou mudar os valores de pontos (são todos configuráveis pelo Admin).
- Não vou criar novas regras (consulta agendada, favoritar médico, etc.) sem você pedir.

## Pergunta antes de implementar

Quer que eu **execute o backfill** dos 49 check-ins semanais que já foram feitos, ou prefere que a partir de agora os pontos passem a contar apenas para novos check-ins? E se houver alguma outra ação específica que você notou não pontuando (ex.: agendar consulta, favoritar médico, completar campanha, ler matéria), me diga qual para eu incluir no escopo.
