Plano de correção para a seção Desafios/Ligas:

1. Corrigir o ranking/membros zerados
- O banco já possui membros nas ligas gerais das empresas testadas: MEDDIT, OFICIAL FARMA e UNIPROF têm membros vinculados.
- O problema está na leitura do frontend: a tela tenta buscar `profiles` como relacionamento direto de `league_members.user_id`, mas esse relacionamento não existe no cache da API, gerando erro 400 e fazendo a lista aparecer vazia.
- Ajustar `useLeagueFeed` para carregar em duas etapas seguras:
  - buscar `league_members` com `user_id` e `papel`;
  - buscar `profiles` separado usando `.in("user_id", memberIds)`;
  - juntar os dados no frontend.
- Isso mantém todos os usuários aparecendo automaticamente na liga geral, sem precisar mexer na regra de aceite das ligas privadas.

2. Preservar a regra de liga geral vs. ligas criadas
- Liga geral da empresa: todos os colaboradores da empresa aparecem automaticamente.
- Ligas criadas por usuários: continuam usando entrada por convite/código/aceite conforme já definido.
- Não farei alteração estrutural no banco para esse ajuste, pois o backfill já está correto.

3. Remover a duplicação visual dos botões
- Em `LeaguesPanel`, hoje a liga geral renderiza dois CTAs iguais: um por `leagueSel` e outro por `isDefaultSelected && defaultLeague`.
- Manter apenas um botão “Abrir MEDDIT → / Abrir OFICIAL → / Abrir UNIPROF →”, usando a regra de nome curto já aplicada.
- O texto “AO VIVO NA MEDDIT” permanece como rótulo do feed, não como botão.

4. Validar o resultado
- Conferir que OFICIAL FARMA e MEDDIT deixam de mostrar “0 membros”.
- Conferir que o ranking/membros aparece mesmo quando ninguém pontuou na semana.
- Conferir que aparece apenas um botão “Abrir [empresa] →” na tela principal de ligas.