
Plano: corrigir o envio real do agendamento para a Meddit

Diagnóstico confirmado
- A integração já está tentando registrar a consulta na Meddit.
- A busca do paciente por CPF está funcionando: `action=patient` respondeu 200 com `user_id`.
- O bloqueio atual está no `action=register`: a requisição saiu com `officeId: 1` e retornou `504 Gateway Time-out`.
- Antes disso, o app carregou os escritórios reais do médico (`195574` e `195575`) e a agenda por escritório. Então o problema não é “não disparar”, e sim perder o escritório correto na hora de confirmar.
- Hoje o calendário Meddit é reduzido para `date -> [times]`, sem guardar `officeId`, `officeName` e `interval`. No confirm, o código cai em fallback (`officeId: 1`, `interval: 30`), o que torna o payload incorreto/incompleto.

Implementação
1. Corrigir a estrutura da agenda Meddit em `src/components/mayla/ConsultationFlow.tsx`
   - Trocar o calendário simplificado por uma estrutura com metadados por slot.
   - Cada slot precisa carregar: `date`, `time`, `officeId`, `officeName` e `interval`.
   - Ao buscar vários escritórios, preservar a origem de cada horário em vez de juntar só os textos dos horários.

2. Corrigir a seleção do horário
   - Quando o usuário clicar em um horário Meddit, salvar também o slot Meddit completo selecionado.
   - Se houver o mesmo horário em mais de um escritório, mostrar o nome do escritório no botão/lista para evitar ambiguidade.

3. Corrigir o payload enviado para a Meddit
   - No `handleConfirm`, para médicos `source === "meddit"`, usar o `officeId` e o `interval` do slot realmente escolhido.
   - Remover o fallback `officeId: 1`.
   - Se o slot Meddit não tiver metadados suficientes, bloquear o envio externo e pedir nova seleção do horário.

4. Endurecer a edge function `supabase/functions/prontuario-proxy/index.ts`
   - Validar no `register` os campos obrigatórios: `professionalId`, `officeId`, `patientId`, `startAt` e `interval`.
   - Adicionar timeout controlado no fetch para a API externa e devolver erro JSON claro, em vez de deixar estourar num `504` genérico.
   - Adicionar logs seguros do registro (payload sem segredos, status upstream e trecho curto da resposta) para confirmar rapidamente qualquer recusa da Meddit.

5. Validar ponta a ponta
   - Repetir o fluxo com John Carter.
   - Conferir no Network que o `register` sai com o `officeId` real do slot escolhido, não `1`.
   - Confirmar resposta 200/201 do proxy.
   - Confirmar no painel Meddit que a consulta apareceu.
   - Ajustar o feedback do usuário: sucesso completo só quando o registro externo for aceito; se falhar, mostrar aviso claro de sincronização.

Arquivos afetados
- `src/components/mayla/ConsultationFlow.tsx`
- `supabase/functions/prontuario-proxy/index.ts`

Detalhes técnicos
- O CPF válido não é mais o gargalo.
- O problema principal está no frontend perder o contexto do slot/escritório antes do `register`.
- Não deve exigir migration no banco; é correção de fluxo e integração.
