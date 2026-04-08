
Diagnóstico breve

Não, esse erro específico não indica necessidade de VPS nem, até aqui, uma exigência estrutural da Meddit.

O que está acontecendo agora
- O botão "Testar conexão" chama o backend da Mayla, não a Meddit direto do navegador.
- O backend está devolvendo `{"error":"CPF não encontrado no perfil"}`.
- Por isso o front mostra `status undefined`: ele esperava um campo `status`, mas recebeu apenas `error`.

Conclusão prática
- O teste nem chegou na Meddit.
- Então o problema atual é interno da nossa lógica de teste, não de hospedagem.

Raiz do problema
1. A rotina de teste está exigindo CPF do usuário logado, como se fosse um fluxo de paciente.
2. Para "testar conexão" de uma integração administrativa, CPF não deveria ser obrigatório.
3. A rotina também está usando a empresa do perfil do usuário logado para buscar a configuração, quando o admin pode estar editando outra empresa.
4. Além disso, a URL salva no campo parece estar apontando para `/docs/`; isso normalmente é a documentação, não a base real da API.

Sobre a Meddit
A Meddit só precisaria nos passar corretamente:
- a URL base real da API
- o formato de autenticação esperado
- eventual whitelist de IP ou VPN, se eles exigirem isso

Mas, repito: o erro atual não aponta para whitelist, VPS ou infra deles. Ele acontece antes.

Sobre VPS
- Não precisa subir isso numa VPS só para esse caso.
- O backend atual já deveria ser suficiente para testar e consumir essa integração.
- VPS só faria sentido se a Meddit exigisse túnel privado, IP fixo dedicado ou algum middleware específico.

O ajuste certo, quando formos corrigir
- Fazer o "Testar conexão" rodar em modo administrativo, sem exigir CPF
- Fazer o teste usar a empresa que está sendo editada na tela, e não a empresa do usuário logado
- Validar/sanitizar a URL para usar a base da API, não `/docs/`
- Melhorar a mensagem do front para mostrar o erro real em vez de `status undefined`

Em resumo
- Não é, por enquanto, um problema de infraestrutura da Meddit
- Não precisa VPS
- É principalmente um problema de desenho do teste no nosso backend
