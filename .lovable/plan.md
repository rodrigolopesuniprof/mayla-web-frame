<final-text>Resposta objetiva

- Sim: hoje a tentativa de registro está sendo disparada do lado do app.
- O fluxo atual em `src/components/mayla/ConsultationFlow.tsx` faz:
  1. salva a consulta localmente em `appointments`
  2. para médico `source === "meddit"`, chama `proxyCall("patient")`
  3. depois chama `proxyCall("register", ..., "POST", body)`
- A edge function `supabase/functions/prontuario-proxy/index.ts` recebe `action=register` e encaminha para `/v1/appointments/register`.
- Os logs confirmam isso: houve payload de `register` com `professionalId`, `officeId`, `patientId`, `startAt`, `interval` e `mode`.
- O problema atual não é “não dispara”; o problema é que a chamada externa está expirando com timeout antes de confirmar no sistema parceiro.

Diagnóstico do teste atual

- A busca de horários/agenda do parceiro está sendo chamada via `action=calendar` e houve respostas `200` para os escritórios do John Carter.
- O que está falhando é o POST final de registro da consulta no sistema parceiro: o proxy aborta após 25s e devolve `Timeout ao conectar com sistema parceiro`.
- Hoje a UI ainda mostra sucesso porque o agendamento local acontece antes da confirmação externa.

Plano

1. Ajustar o feedback do agendamento Meddit
- Em `ConsultationFlow.tsx`, para médicos Meddit, só mostrar sucesso completo quando o `register` retornar sucesso.
- Se salvar localmente mas falhar no parceiro, mostrar estado claro de “agendado localmente, não sincronizado com o parceiro”.

2. Persistir o resultado da sincronização
- Registrar no agendamento local um marcador de sincronização com o parceiro (sucesso/erro/pendente), para não perder o histórico do que aconteceu.
- Isso evita falso positivo e facilita nova tentativa sem depender de memória ou console.

3. Melhorar a observabilidade do proxy
- Em `prontuario-proxy/index.ts`, padronizar logs e resposta de erro do `register` com:
  - status upstream
  - tempo da chamada
  - trecho curto da resposta do parceiro
- Assim fica claro se foi timeout real, rejeição do payload ou erro do serviço externo.

4. Adicionar retry seguro para sincronização
- Criar uma nova tentativa de envio para consultas Meddit que falharam por timeout, sem duplicar o agendamento local.
- O retry deve reutilizar o mesmo payload confirmado do slot escolhido.

5. Validar ponta a ponta
- Repetir com John Carter e conferir:
  - `calendar` carregando normalmente
  - `register` sendo enviado com payload correto
  - UI mostrando sucesso apenas se houver confirmação externa
  - consulta aparecendo no painel Meddit; se não aparecer, ficando marcada como “não sincronizada” para retry

Arquivos afetados

- `src/components/mayla/ConsultationFlow.tsx`
- `supabase/functions/prontuario-proxy/index.ts`

Detalhes técnicos

- O disparo já existe e está correto no frontend.
- A evidência mais forte é o log do proxy com payload de `register`.
- O bug restante é de confiabilidade/feedback da integração externa, não de ausência da chamada.</final-text>