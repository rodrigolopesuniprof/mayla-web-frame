## Diagnóstico

O erro 504 no login/admin indica timeout no backend de autenticação/banco. Pelos sinais já coletados:

- O botão fica em `Verificando...` porque `signInWithPassword` não recebe resposta em tempo útil.
- Logs recentes mostram `504 Processing this request timed out`, `context deadline exceeded` e falhas de conexão do auth com o banco.
- A tela admin e os acessos dos usuários dependem de auth + consultas ao banco + função `manage-user`; por isso tudo que depende de sessão/usuários fica travado junto.

## Plano de ação

1. **Reiniciar o backend Lovable Cloud**
   - Executar um restart controlado para liberar conexões/processos travados.
   - Isso pode derrubar login e consultas por alguns minutos durante a recuperação.

2. **Aguardar recuperação completa**
   - Conferir o status do backend até voltar como saudável.
   - Não mexer no código enquanto o backend estiver instável, para não mascarar o problema real.

3. **Validar os fluxos críticos**
   - Login comum em `/login`.
   - Login admin em `/admin` e carregamento de `/admin/painel`.
   - Listagem/edição de usuários no painel de empresa/admin.
   - Verificar se chamadas de auth, `profiles`, `user_roles` e `manage-user` deixam de retornar 504.

4. **Se o 504 voltar após o restart**
   - Investigar gargalos reais: queries lentas, ausência de índices, RLS pesado, funções lentas e saturação de compute.
   - Se for saturação de infraestrutura, orientar upgrade da instância em **Backend → Advanced settings → Upgrade instance**.

## Aprovação necessária

Confirme para eu executar o restart do backend agora. É a ação correta para este tipo de 504, mas causa uma breve indisponibilidade enquanto o serviço reinicia.