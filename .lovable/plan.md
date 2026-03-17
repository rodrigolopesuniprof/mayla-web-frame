

# Plano: Botão "Relatório de saúde" no Perfil

## O que fazer

Adicionar um item "Relatório de saúde" na lista de menu do `ProfileTab.tsx`, posicionado após "Histórico de medições". Ao clicar, navega para `/relatorio` usando `useNavigate`.

## Arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/components/mayla/ProfileTab.tsx` | Adicionar import de `useNavigate`, adicionar botão "📈 Relatório de saúde" na lista do menu (após "medicoes"), com `onClick` que navega para `/relatorio` em vez de abrir subView |

## Detalhe

- O botão terá o mesmo estilo visual dos demais itens do menu (card com emoji + label + seta)
- Em vez de usar o sistema de `subView`, fará `navigate("/relatorio")` pois o relatório já existe como rota independente
- Posição: entre "Histórico de medições" e "Consultas agendadas"

