

# Plano: Unificar relatório — médico vê o mesmo template do paciente

## Problema

O componente `LinkedPatients` (painel profissional) carrega `ProfessionalReport` — um template clínico antigo com layout diferente. O usuário quer que o médico veja **exatamente** o mesmo relatório que o paciente vê em `/relatorio` (`HealthReport`).

## Solução

### 1. `HealthReport.tsx` — aceitar `userIdOverride` prop

Atualmente o componente usa `user.id` (do `useAuth`) em todas as queries. Vou adicionar:

```tsx
interface HealthReportProps {
  userIdOverride?: string;  // quando informado, carrega dados deste paciente
  embedMode?: boolean;      // esconde botões de compartilhar/navegar
  onBack?: () => void;      // botão voltar (para uso embutido)
}
```

- Se `userIdOverride` está presente, usa esse ID em vez de `user.id` para todas as queries (profiles, scores, alerts, measurements)
- Se `embedMode`, esconde o botão "Compartilhar" e o banner de "primeira medição"
- Se `onBack`, mostra botão "Voltar" no topo

### 2. `LinkedPatients.tsx` — usar `HealthReport` em vez de `ProfessionalReport`

Trocar o import de `ProfessionalReport` por `HealthReport`, passando:
- `userIdOverride={connection.user_id}` (o paciente vinculado)
- `embedMode={true}`
- `onBack={() => setViewingToken(null)}`

O `report-access` edge function não será mais chamado pelo frontend neste fluxo — o profissional já tem permissão via RLS para ler os dados do paciente vinculado (policy criada na última migração).

### 3. Ajuste RLS

A policy de `profiles` já existe. Preciso verificar se as tabelas `health_scores`, `health_alerts`, `health_measurements` e `special_measurements` também permitem leitura pelo profissional vinculado. Se não, criar policies equivalentes.

## Arquivos afetados
- `src/components/report/HealthReport.tsx` — adicionar props `userIdOverride`, `embedMode`, `onBack`
- `src/components/professional/LinkedPatients.tsx` — trocar `ProfessionalReport` por `HealthReport`
- Nova migração SQL — RLS policies para health_scores, health_alerts, health_measurements, special_measurements (se necessário)

