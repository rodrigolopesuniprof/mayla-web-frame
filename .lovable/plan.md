

# Plano: Corrigir carregamento de agenda (officeId incorreto)

## Problema

O frontend envia `officeId=1` ao consultar a agenda do médico, mas os escritórios reais da API Meddit têm IDs `195574` ("Linhas de Cuidado") e `195575` ("Qualificação"). A API retorna HTTP 400 porque o office 1 não existe.

## Solução

Buscar a lista de offices da API Meddit e usá-los no fluxo de agendamento.

## Implementação — `ProntuarioConveniado.tsx`

1. Adicionar estado `offices` e carregá-los via `proxyCall("offices")` no `useEffect` inicial (junto com specialities)
2. Ao clicar no médico para ver agenda, iterar sobre os offices disponíveis e buscar o calendar de cada um (ou do primeiro)
3. Remover o fallback `officeId || 1`
4. Exibir o nome do office junto aos slots disponíveis, caso haja mais de um

## Arquivos afetados

- **Editar**: `src/components/mayla/ProntuarioConveniado.tsx` — carregar offices e usar IDs reais na chamada de calendar

