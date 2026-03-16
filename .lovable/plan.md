

## Plano: Ajustes e Melhorias (5 itens)

### 1. Times Colaborativos (substituir Equipes de Saúde)

**Banco de dados** -- nova tabela:
```sql
CREATE TABLE collaborative_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text DEFAULT '🏃',
  created_by uuid NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES collaborative_teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```
RLS: authenticated users can read teams da sua empresa; members can join/leave; creators can edit/delete.

Trigger: ao criar empresa, gerar time "Geral" com `is_default = true`. Usuários sem time ficam automaticamente no time Geral.

**Admin (`AdminSupportTeams.tsx`)** -- reescrever como "Times Colaborativos":
- Listar times por empresa (select empresa no topo)
- Mostrar: nome, emoji, qtd membros, pontuação total (soma dos pontos dos membros)
- Admin pode criar/excluir times

**App (`MissionsTab.tsx` ou nova seção em HomeTab):**
- Ranking: Empresa > Time > Membros
- Card "Meu Time" no HomeTab mostrando time atual + posição no ranking
- Opção de criar time ou entrar em time existente (via código/convite)

### 2. Remover "Locais" do Admin

- `Admin.tsx`: remover tab `locais` do array e o render de `AdminLocations`
- Remover import de `AdminLocations`
- Manter o arquivo `AdminLocations.tsx` (usado no 2G)

### 3. Especialidades → Preparar para Marketplace de Especialistas (futuro)

- Renomear tab "Especialidades" para "Especialistas" no admin
- Reescrever `AdminSpecialties.tsx` com placeholder: "Em breve: Marketplace de Especialistas" com descrição do conceito (telechamada Jitsi, cadastro médico, agendamento)
- Não implementar o fluxo completo agora (pagamento, Jitsi, etc. vem num segundo momento)

### 4. Agendamentos → Dashboard de Relatório

- Reescrever `AdminAppointments.tsx` como dashboard read-only:
  - Filtro por empresa
  - Tabela: data, horário, empresa, especialidade, profissional (dados podem ser anonimizados)
  - Contadores: total de consultas, por empresa, por especialidade
- Remover formulários de criação de agendamento

### 5. Integração Binah Web SDK

O repo está público e contém o SDK `@biosensesignal/web-sdk` v5.11.4-1 com dist compilado.

**Instalação:** Adicionar como dependência via GitHub tarball ou copiar os arquivos `dist/` para `public/binah-sdk/` e carregar via importmap/script dinâmico. A abordagem mais viável no Lovable é:
- Copiar `dist/main.js`, `dist/a.js`, `dist/a.wasm.gz`, `dist/a.worker.js` e subpastas necessárias para `public/binah-sdk/`
- Carregar via `<script>` dinâmico ou importação dinâmica

**`BinahCapture.tsx`** -- reescrever com SDK real:
1. `initialize({ licenseKey })` usando a API key já salva
2. `createFaceSession({ input: videoElement, cameraDeviceId, processingTime: 60, onVitalSign, onFinalResults, onError })`
3. `session.start()` ao iniciar medição
4. Callbacks `onVitalSign` atualizam UI em tempo real (FC, SpO2, etc.)
5. `onFinalResults` recebe `VitalSignsResults` com todos os sinais vitais
6. Salvar no banco `special_measurements`

**Sinais vitais disponíveis:** pulseRate, oxygenSaturation, respirationRate, sdnn, stressLevel, bloodPressure, hemoglobin, hemoglobinA1c, wellnessLevel, cardiacWorkload, prq, e mais.

**Nota importante:** O SDK usa WASM (`a.wasm.gz`) e Web Workers (`a.worker.js`). Precisaremos configurar headers COOP/COEP no Vite ou servir os assets corretamente. Isso pode requerer ajustes no `vite.config.ts`.

### Arquivos modificados
- `src/pages/Admin.tsx` -- remover tab Locais, renomear Especialidades
- `src/components/admin/AdminSupportTeams.tsx` -- reescrever como Times Colaborativos
- `src/components/admin/AdminSpecialties.tsx` -- placeholder Marketplace
- `src/components/admin/AdminAppointments.tsx` -- dashboard relatório
- `src/components/mayla/BinahCapture.tsx` -- integração SDK real
- `src/components/mayla/HomeTab.tsx` -- card "Meu Time"
- `public/binah-sdk/` -- assets do SDK
- Migration SQL para `collaborative_teams` e `team_members`

### Ordem de execução
1. Migration DB (times colaborativos)
2. Remover Locais + renomear Especialidades (rápido)
3. Reescrever AdminSupportTeams (times)
4. Reescrever AdminAppointments (relatório)
5. AdminSpecialties placeholder
6. Integrar Binah SDK no BinahCapture

