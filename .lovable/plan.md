

# Plano: Documentação da API no README

Adicionar uma seção de documentação da API ao `README.md` para parceiros externos (Meddit) acessarem o relatório de saúde do paciente via a edge function `prontuario-verify`.

## Conteúdo da documentação

- **Endpoint**: `GET /functions/v1/prontuario-verify`
- **Autenticação**: Header `x-api-key` com a chave fornecida
- **Parâmetros**: `token` (report_token do paciente), `professional_id` (opcional)
- **Resposta**: JSON com `authorized`, `profile`, `scores`, `alerts`, `measurements`, `report_url`
- **Exemplo real**: Usando o token do paciente Machado de Assis (`c7291104-e899-4d0d-a5a9-7576b94274e8`) e `professional_id=1214611` (John Carter)
- **Códigos de erro**: 401, 400, 404 implícito

## Arquivo afetado
- `README.md` — adicionar seção "API de Acesso ao Relatório de Saúde (Parceiros)" após o conteúdo existente

