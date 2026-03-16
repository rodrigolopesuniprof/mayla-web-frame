

## Plano: 4 Ajustes no App do Usuário

### 1. Times Colaborativos no HomeTab e ProfileTab

**HomeTab.tsx** -- Adicionar card "Meu Time" logo abaixo do Health Score Card:
- Buscar time do usuário via `team_members` JOIN `collaborative_teams`
- Mostrar nome do time, emoji, posição no ranking
- Botão "Criar time" ou "Entrar em um time" caso não tenha time (exceto Geral)
- Dialog inline para criar time (nome + emoji) ou listar times disponíveis para entrar

**ProfileTab.tsx** -- Adicionar item "👥 Meu Time" na lista de menu (entre "Consultas agendadas" e "Medicamentos"):
- SubView `meutime` que mostra: time atual, membros, ranking, opção de sair/criar/trocar time

### 2. Binah como "Avaliação de Saúde Especial"

O CTA da Binah já existe em `WellbeingTab.tsx` e `HealthTab.tsx` com label "Medição Especial", mas só aparece se `binahEnabled` for true (depende de `company_features`).

**Ajustes:**
- Renomear de "Medição Especial" para **"Avaliação de Saúde Especial"** em ambos WellbeingTab e HealthTab
- Adicionar CTA também no **HomeTab** (abaixo do card rPPG existente), com mesma lógica de verificação `binahEnabled`
- O CTA deve aparecer sempre que a feature esteja habilitada para a empresa

### 3. Unificar Telemedicina + Agendamento em um único botão

**HomeTab.tsx** -- Substituir os 2 cards (Telemedicina / Agendar Consulta) por **1 único botão "Consultas"**:
- Ao clicar, abre um Dialog/Sheet com 3 opções:
  1. **📹 Consulta Online** -- abre TelemedicineScreen (ou placeholder de especialistas)
  2. **🏥 Consulta Presencial** -- abre AppointmentBooking
  3. **📋 Histórico de Consultas** -- mostra lista de consultas agendadas do usuário

**MaylaApp.tsx** -- Manter os states `showTelemedicine` e `showAppointment`, mas agora controlados pelo Dialog do HomeTab. Adicionar state `showConsultHistory` para o histórico.

### 4. Placeholder de Especialistas na opção de Consulta Online

Quando o usuário clicar em "Consulta Online" no novo dialog unificado:
- Se a empresa tem `telemedicine_url`, mostrar iframe (como hoje)
- Senão, mostrar placeholder "Em breve: Marketplace de Especialistas" com descrição do conceito (telechamada Jitsi, cadastro médico) -- similar ao AdminSpecialties placeholder

### Arquivos modificados
- `src/components/mayla/HomeTab.tsx` -- card Meu Time, CTA Binah, botão único Consultas com Dialog
- `src/components/mayla/ProfileTab.tsx` -- adicionar subView "meutime"
- `src/components/mayla/WellbeingTab.tsx` -- renomear label Binah
- `src/components/mayla/HealthTab.tsx` -- renomear label Binah
- `src/components/mayla/MaylaApp.tsx` -- ajustar props (remover onOpenTelemedicine/onOpenAppointment separados, usar callbacks do dialog)
- `src/components/mayla/TelemedicineScreen.tsx` -- adicionar fallback placeholder de especialistas

### Fluxo do botão unificado "Consultas"

```text
[HomeTab: Botão "Consultas 🩺"]
         │
         ▼
  ┌─────────────────────┐
  │  Dialog "Serviços"  │
  │                     │
  │ 📹 Consulta Online  │ → TelemedicineScreen / Placeholder Especialistas
  │ 🏥 Consulta Presenc.│ → AppointmentBooking
  │ 📋 Histórico        │ → Lista de consultas do usuário
  └─────────────────────┘
```

