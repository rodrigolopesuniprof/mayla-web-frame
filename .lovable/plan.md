

# Plano: Corrigir carregamento de médicos Meddit no fluxo de consulta

## Problema raiz

Testei a API Meddit (`prontuario-proxy?action=specialities`) e encontrei **dois bugs**:

1. **Parsing errado da resposta**: A API retorna `{ result: [...] }`, mas o código espera um array direto (`Array.isArray(data)` retorna `false`). Além disso, os campos são `specialization_id` / `specialization_name`, não `id` / `name`.

2. **Nomes não casam**: A API retorna **"Clínica Geral"**, mas a lista hardcoded tem **"Clínico Geral"**. O match case-insensitive falha porque são palavras diferentes, então o `medditId` nunca é anexado à especialidade hardcoded.

Resultado: `medditSpecialtyId` fica `null` → condição `if (loadExternal && user && medditSpecialtyId)` falha → médicos Meddit nunca são buscados.

## Correções em `ConsultationFlow.tsx`

### SpecialtyStep — corrigir parsing
- Mudar `Array.isArray(data)` para `Array.isArray(data?.result || data)`
- Mapear `specialization_id` → `id` e `specialization_name` → `name`

### SpecialtyStep — melhorar matching de nomes
- Usar normalização mais agressiva para merge (remover acentos, comparar raiz): `"Clínica Geral"` e `"Clínico Geral"` devem ser tratados como mesma especialidade
- Quando houver match parcial, anexar o `medditId` à entrada existente

### fetchData — não depender exclusivamente de `medditSpecialtyId`
- Se `medditSpecialtyId` é `null` mas `loadExternal` é `true`, tentar buscar o ID da especialidade Meddit pela lista de specialties já carregada (match por nome normalizado)
- Isso garante que mesmo se o usuário selecionar uma especialidade hardcoded que existe no Meddit, os médicos externos serão carregados

## Arquivos afetados

- **Editar**: `src/components/mayla/ConsultationFlow.tsx` — corrigir parsing da resposta da API, normalizar nomes para merge, e ajustar lógica de busca de profissionais externos

