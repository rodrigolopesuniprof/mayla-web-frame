

# Plano: Migrar teleconsulta para servidor Jitsi próprio com salas seguras

## Situação atual
- O sistema usa `meet.jit.si` (servidor público) como domínio Jitsi
- O nome da sala é `mayla-consulta-{consultation_id}` — previsível e fixo (coluna gerada no banco)
- Qualquer pessoa que adivinhe o nome da sala pode entrar

## Solução

### 1. Gerar token único por consulta (banco de dados)

Criar uma nova coluna `room_token` na tabela `consultations` com um UUID aleatório gerado automaticamente. Esse token será usado no nome da sala em vez do ID da consulta.

```sql
ALTER TABLE consultations 
ADD COLUMN room_token uuid DEFAULT gen_random_uuid() NOT NULL;

-- Preencher registros existentes
UPDATE consultations SET room_token = gen_random_uuid() WHERE room_token IS NULL;
```

O nome da sala passará a ser: `mayla-{room_token}` — único, imprevisível e usado uma única vez por consulta.

### 2. Apontar para o servidor próprio (`JitsiConsultationScreen.tsx`)

Trocar o domínio de `meet.jit.si` para `teleconsulta.saudecomvc.com.br` e usar `room_token` no nome da sala:

```typescript
// Antes
domain="meet.jit.si"
roomName={`mayla-consulta-${consultation.id}`}

// Depois
domain="teleconsulta.saudecomvc.com.br"
roomName={`mayla-${consultation.roomToken}`}
```

### 3. Passar `roomToken` nos fluxos existentes

Atualizar a interface `ConsultationInfo` para incluir `roomToken` e garantir que todos os pontos que criam/abrem a tela de consulta passem esse dado:
- `ConsultationFlow.tsx` / `OnDemandFlow.tsx` — ao montar `JitsiConsultationScreen`
- `WaitingRoom.tsx` → `onEnterCall`
- `WaitingQueue.tsx` / `TodayConsultations.tsx` (profissional) — ao chamar `onStartCall`
- `ProfessionalDashboard.tsx` — ao abrir `JitsiConsultationScreen`

### 4. Proteger o servidor Jitsi (configuração no servidor VPS)

No arquivo `/etc/prosody/conf.avail/teleconsulta.saudecomvc.com.br.cfg.lua` do servidor Jitsi, configurar autenticação para impedir uso externo:

```text
VirtualHost "teleconsulta.saudecomvc.com.br"
    authentication = "token"           -- JWT authentication
    app_id = "mayla"
    app_secret = "SUA_CHAVE_SECRETA"   -- segredo compartilhado
    allow_empty_token = false
```

E gerar um JWT no app (via edge function) para cada consulta, passando-o ao `JitsiMeeting` via `jwt` prop. Isso garante que apenas usuários autenticados no sistema Mayla consigam entrar nas salas.

### 5. Edge function para gerar JWT do Jitsi

Criar `supabase/functions/jitsi-token/index.ts` que:
- Valida que o usuário autenticado é participante da consulta (paciente ou profissional)
- Gera um JWT com `app_id`, `app_secret`, `room` e `exp` (curta duração, ex: 2h)
- Retorna o token para o frontend usar na prop `jwt` do `JitsiMeeting`

### 6. Uso no frontend

```typescript
// Antes de abrir a sala, buscar o JWT
const { data } = await supabase.functions.invoke("jitsi-token", {
  body: { consultationId: consultation.id }
});

// Passar ao JitsiMeeting
<JitsiMeeting
  domain="teleconsulta.saudecomvc.com.br"
  roomName={`mayla-${consultation.roomToken}`}
  jwt={data.token}
  ...
/>
```

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração SQL | Adicionar coluna `room_token` em `consultations` |
| Criar | `supabase/functions/jitsi-token/index.ts` — gerar JWT |
| Editar | `src/components/mayla/JitsiConsultationScreen.tsx` — domínio + roomToken + JWT |
| Editar | Fluxos que passam dados para JitsiConsultationScreen (ConsultationFlow, OnDemandFlow, ProfessionalDashboard, WaitingQueue, TodayConsultations) |

## Pré-requisito do servidor
- Configurar autenticação JWT no Prosody do servidor Jitsi
- Definir o `app_secret` como secret na edge function

