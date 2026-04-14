

# Plano: Corrigir timeout ao buscar profissionais por especialidade

## Problema

Ao selecionar uma especialidade (ex: "Clínica Geral"), o frontend chama `?action=professionals&specialityId=7` que faz proxy para `/v1/clinics/professional/search`. Esse endpoint da API Meddit retorna **504 Gateway Timeout**.

## Solução

A chamada `?action=specialities` já retorna **todos os profissionais com suas especializações**. Em vez de fazer uma segunda chamada que dá timeout, podemos reutilizar esses dados no frontend, filtrando por `specialization_id` no lado do cliente.

## Implementação

### `src/components/mayla/ProntuarioConveniado.tsx`

1. Guardar a lista completa de profissionais retornada pela API de specialities em um novo estado (`allProfessionals`)
2. Na função `searchProfessionals`, em vez de chamar `proxyCall("professionals", ...)`, filtrar `allProfessionals` pelo `specialization_id` selecionado
3. Se o filtro retornar vazio (ex: dados parciais), fazer fallback para a chamada API com timeout de 10s e retry
4. Aplicar filtro por `searchTerm` (nome) localmente também

## Arquivos afetados

- **Editar**: `src/components/mayla/ProntuarioConveniado.tsx` — reutilizar dados da resposta de specialities para popular profissionais sem chamada extra

