## Objetivo
Na rota pública `/demo` (usada para embed no site institucional), trocar o botão **"Salvar Medição"** por **"Analisar Medição"** e, em vez de salvar no banco, abrir o WhatsApp (`wa.me/553197863970`) com uma mensagem pré-formatada contendo os resultados da medição.

**Restrição crítica:** nenhuma alteração de comportamento no app Mayla principal. O botão "Salvar Medição" e o fluxo de persistência continuam iguais para todos os outros usos (`HealthTab`, etc.).

## Escopo

### 1. `src/components/mayla/BinahCapture.tsx`
Adicionar duas props opcionais (não-invasivas):
- `saveButtonLabel?: string` — sobrescreve o texto do botão (default: "Salvar Medição").
- `onSaveOverride?: (result: MappedResult) => void | Promise<void>` — quando fornecido, substitui a chamada padrão `saveResult()` no `onClick` do botão principal e desativa a auto-persistência em `special_measurements` / `health_measurements`.

Trocas mínimas:
- No `onClick` do botão (linha ~682): usar `onSaveOverride` se existir, senão `saveResult` (comportamento atual).
- No texto (linha ~690): usar `saveButtonLabel` se existir, senão "Salvar Medição".
- No `useEffect` de auto-save (após `status === "completed"`): pular a persistência quando `onSaveOverride` estiver presente.
- No `handleCancel`: pular o flush quando `onSaveOverride` estiver presente.

Nenhum outro consumidor (HealthTab, WellbeingTab) passa essas props, então o comportamento existente fica idêntico.

### 2. `src/pages/DemoBinah.tsx`
- Passar `saveButtonLabel="Analisar Medição"`.
- Passar `onSaveOverride={(r) => window.open(buildWhatsAppUrl(r), "_blank")}`.
- Helper local `buildWhatsAppUrl(r)` gera:

```
https://wa.me/553197863970?text=<encoded>
```

Formato da mensagem (campos ausentes são omitidos, ex.: se PA não vier, sai só "PA —" ou o campo é pulado — vou pular quando `undefined` para não poluir):

```
Olá, gostaria de avaliar meus dados de saúde
FC 81, PA 129/78, SPO2 98, FR 15, Stress 26, VFC 44, Bem-estar 60, Hemog 14.9, HbA1c 5.4%
```

Mapeamento `MappedResult` → rótulos:
- FC ← `heart_rate`
- PA ← `blood_pressure_sys`/`blood_pressure_dia`
- SPO2 ← `spo2`
- FR ← `respiratory_rate`
- Stress ← `stress_level`
- VFC ← `hrv_sdnn`
- Bem-estar ← `wellness_score`
- Hemog ← `hemoglobin`
- HbA1c ← `hba1c` (com `%`)

## Fora do escopo
- O botão inferior **"Quero entender meu resultado"** aparece do site externo que faz o embed — será removido/ajustado pelo Claude do site, não neste projeto.
- Nenhuma nova rota, tabela, edge function ou migration.
- Nenhuma mudança em `HealthTab`, `WellbeingTab`, ou qualquer outro consumidor de `BinahCapture`.

## Validação
- Abrir `/demo` no preview publicado → botão mostra "Analisar Medição" → clicar abre WhatsApp com a mensagem preenchida.
- Abrir `HealthTab` no app normal → botão continua "Salvar Medição" e ainda persiste no banco.