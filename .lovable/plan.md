

# Plano: Enviar encerramento da consulta para a API Meddit

## Diagnóstico

O payload enviado ao Meddit está correto (`startAt=08:30, interval=30`). Porém, o Meddit pode calcular a duração pelo momento de "encerramento" — e nosso sistema **nunca envia** um sinal de finalização para a API Meddit. Resultado: a consulta fica "aberta" até algum timeout automático do lado deles.

## Solução

### 1. Investigar endpoint de encerramento na API Meddit
Verificar se a API Meddit tem um endpoint como `PUT /v1/appointments/{id}/finish` ou `PATCH /v1/appointments/{id}/status`. Se existir, precisamos chamá-lo quando a consulta é finalizada.

### 2. Guardar o ID Meddit da consulta
**Arquivo**: `src/components/mayla/ConsultationFlow.tsx`
- O resultado do `register` retorna um ID de consulta do Meddit (ex: `appointment_id` ou similar no body da resposta)
- Salvar esse ID no campo `notes` ou em um novo campo da tabela `appointments` (ex: `external_appointment_id`) para referência futura

### 3. Enviar encerramento ao finalizar
**Arquivo**: `src/components/mayla/JitsiConsultationScreen.tsx`
- Na função `handleLeave`, após atualizar o status local para `completed`, verificar se a consulta tem um `external_appointment_id` (Meddit)
- Se sim, chamar `prontuario-proxy?action=finish` com o ID externo

**Arquivo**: `supabase/functions/prontuario-proxy/index.ts`
- Adicionar action `finish` que chama o endpoint de encerramento da API Meddit

### 4. Alternativa se não houver endpoint de encerramento
Se a API Meddit não tiver endpoint de finalização, o problema é exclusivamente do lado deles e precisamos reportar. Nesse caso, podemos apenas documentar.

## Próximo passo recomendado
Antes de implementar, precisamos confirmar com a documentação ou equipe do Meddit se existe um endpoint de encerramento de consulta. Você tem acesso à documentação da API deles para verificar?

## Arquivos potencialmente afetados
- `src/components/mayla/ConsultationFlow.tsx` — salvar external ID
- `src/components/mayla/JitsiConsultationScreen.tsx` — enviar finish
- `supabase/functions/prontuario-proxy/index.ts` — nova action `finish`
- Migração DB (se necessário campo `external_appointment_id`)

