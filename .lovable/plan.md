

# Plano: Enviar agendamento para API Meddit

## Problema

O `handleConfirm` apenas insere na tabela local `appointments`. Para médicos Meddit (com `source === "meddit"`), não há chamada ao endpoint `proxyCall("register")`, então o agendamento nunca chega ao painel Meddit.

## Solução

### `ConsultationFlow.tsx` — `handleConfirm`

Após o insert local na tabela `appointments`, verificar se `selectedDoctor.source === "meddit"`:

1. **Buscar patientId**: Chamar `proxyCall("patient")` que retorna os dados do paciente pelo CPF. Extrair o `patientId` da resposta.

2. **Chamar register**: Enviar `proxyCall("register", {}, "POST", body)` com o payload:
   - `professionalId`: `selectedDoctor.meddit_id`
   - `officeId`: `selectedDoctor.meddit_office_id`
   - `patientId`: ID retornado pela busca de paciente
   - `startAt`: data/hora selecionada no formato `"YYYY-MM-DD HH:mm:ss"`
   - `mode`: `"online"` ou `"presencial"` conforme `consultMode`
   - `interval`: intervalo do slot selecionado (vem dos dados do calendar)
   - `socialMidia`: `"mayla"`

3. **Tratamento de erro**: Se a chamada falhar, o agendamento local já foi salvo — exibir toast de aviso informando que a reserva local foi criada mas o envio ao sistema externo falhou.

### `prontuario-proxy/index.ts` — Mover `register` para early-exit

Atualmente `register` está no switch após a validação de CPF, o que está correto pois precisa do CPF para buscar o paciente. Porém o body já vem pronto do frontend com o `patientId`, então podemos mover `register` para o bloco de early-exit (antes da validação de CPF), simplificando o fluxo.

## Arquivos afetados

- **Editar**: `src/components/mayla/ConsultationFlow.tsx` — adicionar lógica Meddit no `handleConfirm`
- **Editar**: `supabase/functions/prontuario-proxy/index.ts` — mover `register` para early-exit (sem exigir CPF)
- **Deploy**: edge function `prontuario-proxy`

