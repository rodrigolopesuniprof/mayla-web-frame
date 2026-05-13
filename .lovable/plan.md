# Coleta de data de nascimento e sexo

Objetivo: garantir que todo usuário que vá agendar uma consulta (interna ou via Meddit) tenha `birthdate` e `sex` preenchidos, sem aumentar o atrito do checkout.

## Decisões aprovadas
- **Quando**: lazy, no momento do 1º agendamento.
- **Obrigatoriedade**: sempre obrigatórios (bloqueia o agendamento até preencher).
- **Sexo**: binário `M` / `F` (compatível com Meddit).
- **Usuários existentes**: one-time modal no próximo login até preencherem.

## Mudanças

### 1. Banco (`profiles`)
- Adicionar colunas `birthdate date` e `sex text` (nullable, sem default).
- Constraint: `sex in ('M','F')` quando não-nulo.
- Sem migração de dados — campos ficam vazios até o usuário preencher.

### 2. Componente `ProfileCompletionGate`
Novo componente bloqueante (modal não-fechável) que:
- Renderiza se `profile.birthdate is null OR profile.sex is null`.
- Form com 2 campos: input `date` (com validação de idade ≥ 0 e ≤ 120) + radio `Masculino/Feminino`.
- Botão "Salvar e continuar" → `update profiles` → fecha modal.
- Sem botão "Pular".

### 3. Pontos de injeção do gate
- **`MaylaApp.tsx`** (one-time no próximo login): renderiza o gate no boot, após carregar o profile. Cobre o backfill dos usuários existentes.
- **Como `MaylaApp` já é a porta de entrada do app**, o gate no agendamento vira redundante — qualquer fluxo de consulta já passou pelo gate. Mantém código simples.

### 4. Envio para Meddit
- `prontuario-proxy` (e/ou local de criação de paciente Meddit) passa a ler `birthdate` e `sex` do `profiles` e enviar no payload.
- Se por algum motivo vierem nulos (defesa em profundidade), retorna erro claro em vez de chamar Meddit com dado inválido.

### 5. Checkout (`Subscribe.tsx`)
- **Sem mudança.** Conforme decidido, checkout fica enxuto.

## Detalhes técnicos

**Migration:**
```sql
alter table public.profiles
  add column birthdate date,
  add column sex text check (sex in ('M','F'));
```

**Fluxo do gate:**
```text
Login → MaylaApp monta → carrega profile
  ├─ birthdate & sex preenchidos? → app normal
  └─ algum nulo? → modal bloqueante → salva → app normal
```

**Payload Meddit:** `birthdate` formatado como `YYYY-MM-DD` (naive, conforme padrão Meddit já documentado em memória).

## Não incluso (fora de escopo)
- Edição posterior dos campos no perfil (pode entrar como follow-up no `ProfileTab`).
- Telefone, endereço ou outros campos Meddit (só os 2 pedidos).
- Validação de idade mínima legal para agendamento.

## Arquivos afetados
- `supabase/migrations/...` (nova)
- `src/components/mayla/ProfileCompletionGate.tsx` (novo)
- `src/components/mayla/MaylaApp.tsx` (montar gate)
- `supabase/functions/prontuario-proxy/index.ts` (incluir birthdate/sex no payload Meddit)
- `mem://integracoes/meddit-payload-registro` (atualizar nota)
