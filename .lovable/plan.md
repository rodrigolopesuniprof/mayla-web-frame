

# Plano: Corrigir carregamento de especialidades no Prontuário Conveniado

## Problema

A API Meddit retorna `{ "result": [...] }` mas o frontend espera um array direto. Além disso, o endpoint `/v1/clinics/specialities` retorna profissionais com suas especializações, não uma lista de especialidades pura. O frontend precisa extrair as especialidades únicas dessa resposta.

Há também um bloqueio: o fluxo regular da edge function exige CPF no perfil (linha 105), o que impede até a listagem de especialidades se o usuário não tiver CPF cadastrado.

## O que a API retorna

```json
{
  "result": [
    { "full_name": "John Carter", "specialization_id": 7, "specialization_name": "Clínica Geral", "user_id": 1214611 },
    { "full_name": "Luiz Fernando", "specialization_id": 7, "specialization_name": "Clínica Geral", "user_id": 1000 },
    { "full_name": "Israel Santiago", "specialization_id": 223, "specialization_name": "Enfermagem", "user_id": 1181618 }
  ]
}
```

## Correções

### 1. `ProntuarioConveniado.tsx` — parsing da resposta

- Em `loadSpecialities`: extrair `data.result` (se existir) e depois deduplificar por `specialization_id` para montar a lista de especialidades únicas
- Em `searchProfessionals`: extrair `data.result` e mapear os campos (`user_id` → `id`, `full_name` → `name`, `specialization_name` → `speciality`)
- Em `loadCalendar` e `loadPatientId`: também tratar `data.result` quando presente

### 2. `prontuario-proxy/index.ts` — permitir `specialities` sem CPF

- Mover a action `specialities` para antes da verificação de CPF (similar ao `test_connection`), pois listar especialidades não requer identificação do paciente

## Arquivos afetados

- **Editar**: `src/components/mayla/ProntuarioConveniado.tsx` — ajustar parsing em todas as funções de carregamento
- **Editar**: `supabase/functions/prontuario-proxy/index.ts` — permitir `specialities` sem CPF

