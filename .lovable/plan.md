## Problema

O painel admin da MAYLA está com **Shen.ai** salvo corretamente em `company_features` (confirmado no banco: `provider=shenai`), mas a tela de Medição Especial continua mostrando o badge **BINAH** e usando o fluxo da Binah.

**Causa raiz:** em `src/components/mayla/HealthTab.tsx` (linha 89), o componente `<BinahCapture>` é instanciado com `companyId={null}` hard-coded. Sem `companyId`, o hook `useVitalsMeasurement` não consegue ler a config da empresa em `company_features` e cai no provider padrão (`"binah"`).

A `WellbeingTab` já passa o `companyId` corretamente — apenas a `HealthTab` (entrada principal de Medição Especial na home) está quebrada.

## Correção

1. Em `src/components/mayla/HealthTab.tsx`:
   - Já existe `const { company, companyId } = useCompany()` no topo do componente (linha 31).
   - Trocar `companyId={null}` por `companyId={companyId ?? null}` na chamada do `<BinahCapture>` (linha 89).

Nenhuma outra alteração necessária — o resto do pipeline (hook, BinahCapture, edge function `shenai-config`) já está pronto para Shen.ai assim que receber o `companyId` correto.

## Verificação

- Abrir Medição Especial pela home (HealthTab) → badge deve mostrar **Shen.ai** em vez de BINAH.
- Console deve registrar `[Shen.ai] Init OK` e a câmera deve abrir via canvas nativo do SDK.
- Painel da Shen.ai deve registrar consumo após a medição.
