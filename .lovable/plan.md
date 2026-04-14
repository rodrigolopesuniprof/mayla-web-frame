

# Plano: Corrigir timeout na busca de médicos Meddit

## Problema raiz

A API Meddit `/v1/clinics/professional/search?specialityId=7` está demorando demais (timeout). Testei agora e a chamada foi cancelada por tempo esgotado. Além disso, o fluxo faz **duas chamadas sequenciais** desnecessárias:

1. `proxyCall("specialities")` — para resolver o ID da especialidade (já foi chamada no step anterior)
2. `proxyCall("professionals", { specialityId })` — que está dando timeout

A resposta de `specialities` **já contém os profissionais** com `full_name`, `user_id` e `specialization_id`. Podemos usar esses dados diretamente.

## Solução

### 1. Cachear dados de specialities no SpecialtyStep

O `SpecialtyStep` já chama `proxyCall("specialities")`. Guardar o resultado completo num state (`medditSpecialties`) e passá-lo ao passo `doctors`, evitando a chamada duplicada.

### 2. Usar dados de specialities como lista de médicos Meddit

Em vez de chamar o endpoint `professionals/search` (que está lento/instável), filtrar os profissionais diretamente do array de specialities:
- Filtrar por `specialization_id` correspondente à especialidade selecionada
- Mapear `full_name` → `name`, `user_id` → `meddit_id`

### 3. Fallback com timeout (opcional)

Se quisermos ainda tentar o endpoint `professionals/search` para dados mais ricos (officeId, etc.), adicionar um timeout de 5 segundos com `AbortController` e usar os dados de specialities como fallback.

## Arquivos afetados

- **Editar**: `src/components/mayla/ConsultationFlow.tsx`
  - Adicionar state `medditSpecialtiesCache` para armazenar resposta completa
  - No `SpecialtyStep`, salvar o cache ao carregar
  - No `fetchData` (step doctors), usar o cache em vez de chamar `specialities` novamente
  - Extrair médicos do cache em vez de chamar `professionals/search`, ou usar com timeout + fallback

