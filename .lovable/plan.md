

# Plano: Vincular paciente ao partner correto do profissional logado

## Diagnóstico

Existem dois registros "João Lopes" na tabela `partners`:

| Partner ID | user_id | Observação |
|---|---|---|
| `c5d288e5-fafc-4758-bb54-f409baf60be0` | NULL | Tem a conexão do Machado de Assis |
| `5127cad9-1ebb-4e52-b834-8db2dcba934f` | `430b6c87-...` | É o que o profissional logado usa |

O painel profissional busca o partner por `user_id = auth.uid()`, encontra `5127cad9`. Mas a `prontuario_connection` do Machado de Assis aponta para `c5d288e5`. Resultado: o LinkedPatients não mostra nada.

## Solução

Consolidar os dois registros: atualizar a conexão do Machado de Assis para apontar para o partner correto (`5127cad9`), que é o que tem `user_id` vinculado e é usado pelo painel. Opcionalmente desativar o partner duplicado sem `user_id`.

## Mudanças (dados, não schema)

1. **UPDATE** `prontuario_connections` SET `internal_partner_id = '5127cad9-1ebb-4e52-b834-8db2dcba934f'` WHERE `id = '63092987-f87e-4ceb-b7aa-a773d046a7d4'`
2. **UPDATE** `partners` SET `active = false` WHERE `id = 'c5d288e5-fafc-4758-bb54-f409baf60be0'` (desativar o duplicado sem user_id)

Após isso, quando o João Lopes logado acessar o painel, o `LinkedPatients` buscará `prontuario_connections` com `internal_partner_id = 5127cad9` e encontrará o Machado de Assis.

## Arquivos afetados
- Nenhum arquivo de código precisa mudar — apenas dados no banco via insert tool (UPDATE)

