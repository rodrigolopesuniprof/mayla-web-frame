## Plano

Corrigir a criação de recipient do Pagar.me ajustando o payload enviado pela função `pagarme-create-affiliate-recipient`.

### O problema

O Pagar.me está recusando o campo `birthdate` porque a função envia a data como `YYYY-MM-DD` (`1985-03-22`), mas a API exige `DD/MM/YYYY` (`22/03/1985`).

### Alterações propostas

1. Criar um helper de normalização de data dentro da função:
   - Aceitar datas já salvas como `YYYY-MM-DD`.
   - Aceitar datas já formatadas como `DD/MM/YYYY`.
   - Retornar sempre `DD/MM/YYYY` para o Pagar.me.

2. Aplicar esse helper em todos os campos de data enviados ao Pagar.me:
   - `birthdate` para pessoa física.
   - `founding_date` para pessoa jurídica.
   - `managing_partners[].birthdate` para sócios/representantes.

3. Melhorar a validação antes da chamada externa:
   - Se for pessoa física e a data estiver ausente ou inválida, retornar erro claro antes de chamar o Pagar.me.
   - Manter o fluxo atual de banco, telefone, endereço e permissões.

4. Fazer um teste rápido da lógica de formatação localmente para garantir que `1985-03-22` vire `22/03/1985`.

### Resultado esperado

Ao clicar em **Criar Recipient**, o payload irá no formato aceito pelo Pagar.me e esse erro específico de `birthdate` deixará de acontecer. Não é necessário webhook para essa criação.