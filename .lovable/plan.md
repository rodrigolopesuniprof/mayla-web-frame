Plano de correção:

1. Sincronizar o estado local com o popup de onboarding
- Quando os 5 primeiros passos forem concluídos no `FirstStepsCard`, além de salvar `points_tour_completed = true` no perfil, disparar também um evento global de atualização.
- Esse evento vai permitir que o popup `PointsOnboardingTour` feche imediatamente e atualize sua referência interna de conclusão, sem esperar recarregar a tela.

2. Blindar o `PointsOnboardingTour`
- Fazer o popup escutar o evento dos primeiros passos.
- Ao receber o evento, recarregar o perfil e, se `points_tour_completed = true`, fechar o popup e impedir o timer de 5 minutos de reabrir.
- Ajustar `loadAndMaybeOpen` para nunca abrir quando o perfil já estiver concluído, inclusive em chamadas forçadas.

3. Evitar reabertura acidental pelo botão “Continuar”
- O botão “Continuar” do card hoje seta `points_tour_completed = false`, o que pode reativar o onboarding mesmo depois de concluído.
- Vou manter o botão apenas enquanto ainda houver pendências; quando tudo estiver concluído, o card some como esperado.

Detalhes técnicos:
- Arquivos previstos: `src/components/mayla/FirstStepsCard.tsx` e `src/components/mayla/PointsOnboardingTour.tsx`.
- Sem alteração de banco de dados.
- Sem mexer em autenticação ou fluxo principal do app.