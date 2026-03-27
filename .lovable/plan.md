

# Plano: Fase 1 — Migrar para servidor Jitsi próprio com room_token UUID

## Resumo
Migrar de `meet.jit.si` para `teleconsulta.saudecomvc.com.br`, usando um `room_token` UUID único e imprevisível por consulta. Sem JWT nesta fase.

## 1. Migração SQL

Adicionar coluna `room_token` à tabela `consultations`:

```sql
ALTER TABLE consultations 
ADD COLUMN room_token uuid DEFAULT gen_random_uuid() NOT NULL;
```

Registros existentes receberão UUID automaticamente pelo `DEFAULT`.

## 2. Editar `JitsiConsultationScreen.tsx`

- Adicionar `roomToken` à interface `ConsultationInfo`
- Trocar domínio de `meet.jit.si` para `teleconsulta.saudecomvc.com.br`
- Trocar `roomName` de `mayla-consulta-${consultation.id}` para `mayla-${consultation.roomToken}`

## 3. Passar `roomToken` em todos os pontos de chamada

### `ConsultationFlow.tsx`
- Ao criar consulta (insert), buscar `room_token` no retorno (`select("id, room_token")`)
- Passar `roomToken` ao montar `JitsiConsultationScreen`

### `OnDemandFlow.tsx`
- Ao criar consulta, buscar `room_token` no retorno
- Armazenar em state e passar ao `JitsiConsultationScreen`

### `WaitingQueue.tsx` (profissional)
- Incluir `room_token` na query de busca
- Passar no callback `onStartCall`

### `TodayConsultations.tsx` (profissional)
- Incluir `room_token` na query
- Passar no callback `onStartCall`

### `ProfessionalDashboard.tsx`
- Adicionar `roomToken` à interface `activeCall`
- Passar ao `JitsiConsultationScreen`

### `MaylaApp.tsx`
- Garantir que `activeVideoCall` inclua `roomToken`

## Arquivos modificados

| Ação | Arquivo |
|------|---------|
| Migração SQL | Adicionar `room_token` em `consultations` |
| Editar | `src/components/mayla/JitsiConsultationScreen.tsx` |
| Editar | `src/components/mayla/ConsultationFlow.tsx` |
| Editar | `src/components/mayla/OnDemandFlow.tsx` |
| Editar | `src/components/professional/WaitingQueue.tsx` |
| Editar | `src/components/professional/TodayConsultations.tsx` |
| Editar | `src/pages/ProfessionalDashboard.tsx` |
| Editar | `src/components/mayla/MaylaApp.tsx` |

