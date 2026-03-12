

## Plano: Validações de Missão no Admin e Auto-completar no App

### Problema atual
- O formulário de criação de missão (em AdminPrograms) **não tem campo de tipo de validação**
- A tabela `missions` já tem a coluna `validation_type` (valores: `self_report`, `photo`, `qr_code`, `automatic`)
- No `MissionsTab`, a auto-completação usa correspondência por **título** (`"Medição rPPG"`, `"Dados Certos"`) — frágil e não escalável

### Mudanças

#### 1. `AdminPrograms.tsx` — Adicionar campo `validation_type` no modal de Nova Missão

Adicionar um Select com as opções:
| Valor | Label | Descrição |
|---|---|---|
| `self_report` | Auto-relato | Usuário marca como feita |
| `qr_code` | QR Code | Escaneia QR de unidade/local |
| `photo_proof` | Foto comprovante | Envia foto para validação |
| `auto_rppg` | Automática: Medição rPPG | Completa ao fazer medição rPPG no dia |
| `auto_survey` | Automática: Questionário de saúde | Completa ao responder o questionário |
| `auto_checkin` | Automática: Check-in de bem-estar | Completa ao fazer check-in semanal |

Incluir o `validation_type` no payload do `saveMission`.

#### 2. `MissionsTab.tsx` — Refatorar auto-completação para usar `validation_type`

Substituir o `AUTO_COMPLETE_CHECKS` baseado em título por um mapa baseado em `validation_type`:
```typescript
const AUTO_CHECKS: Record<string, (ctx) => boolean> = {
  auto_rppg: ({ hasMeasurementToday }) => hasMeasurementToday,
  auto_survey: ({ profile }) => !!profile?.health_survey_completed,
  auto_checkin: ({ hasCheckinThisWeek }) => hasCheckinThisWeek,
};
```

Adicionar query de `wellbeing_checkins` da semana atual para suportar `auto_checkin`.

Atualizar `VALIDATION_LABELS` para incluir os tipos automáticos (exibir "✅ Automática" sem botão de ação para missões automáticas pendentes).

#### 3. Exibir badge de validação na listagem de missões (AdminPrograms)

Na linha de cada missão dentro da campanha, mostrar um badge indicando o tipo de validação (ex: "🤖 Auto: rPPG", "📷 Foto", "📱 QR").

### Sem mudanças no banco
A coluna `validation_type` já existe na tabela `missions`. Os novos valores (`auto_rppg`, `auto_survey`, `auto_checkin`) são strings livres, sem enum no DB.

### Arquivos
- `src/components/admin/AdminPrograms.tsx` — campo validation_type no form + badge na listagem
- `src/components/mayla/MissionsTab.tsx` — refatorar auto-completação por validation_type + UI para missões automáticas

