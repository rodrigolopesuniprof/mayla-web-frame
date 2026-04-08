

# Plano: Sistema de Compartilhamento Permanente com Médico Favorito

## O que ja existe

O sistema ja tem infraestrutura parcial implementada:

- **Tabela `prontuario_connections`**: armazena vinculos paciente-medico com `report_token` (UUID auto-gerado), `external_system`, `external_professional_id`, `active`
- **Edge Function `prontuario-proxy`**: actions `favorite`, `unfavorite`, `my_connections` ja funcionam
- **Edge Function `prontuario-verify`**: valida token via API key da Meddit e retorna URL do relatorio
- **`ProfessionalReport`**: ja aceita tokens de `report_shares` (temporarios 48h) e de `prontuario_connections` (permanentes)
- **`ProntuarioConveniado`**: ja tem botao de coracao (favoritar) que chama `toggleFavorite`

## O que falta

1. **Suporte a medicos internos (cadastrados no Admin)**: hoje o `favorite` so funciona para medicos Meddit (`external_system: "meddit"`). Precisamos suportar medicos da tabela `partners` com `external_system: "mayla"`.

2. **Tela "Meus Medicos" no app do paciente**: listar medicos favoritados, mostrar link/token, permitir revogar acesso.

3. **Modo embed (`?view=embed`)**: o `ProfessionalReport` ja funciona, mas nao tem modo compacto para iframe.

4. **Notificacao ao medico via Meddit API**: quando o paciente favorita, enviar o link do relatorio para a Meddit (quando SSL estiver pronto).

## Implementacao

### 1. Migration: ampliar `prontuario_connections`

- Adicionar coluna `source_type` (enum: `meddit`, `mayla_partner`, `manual`) com default `meddit` para compatibilidade
- Adicionar coluna `internal_partner_id` (uuid nullable, referencia `partners.id`) para medicos internos
- Garantir constraint unique flexivel: `(user_id, external_system, external_professional_id)`

### 2. Tela "Meus Medicos Favoritos"

Novo componente `src/components/mayla/FavoriteDoctors.tsx`:
- Lista medicos favoritados (de `prontuario_connections` ativas)
- Mostra nome, clinica, sistema de origem (Meddit / Mayla)
- Botao "Copiar link" que gera a URL `saude.saudecomvc.com.br/relatorio/medico/{report_token}`
- Botao "Revogar acesso" que chama `unfavorite`
- Acessivel via aba Saude ou Perfil

### 3. Favoritar medico interno (partners)

Atualizar `prontuario-proxy` action `favorite`:
- Aceitar campo `source_type` e `internal_partner_id`
- Quando `source_type=mayla_partner`, buscar dados do partner na tabela `partners`
- Gerar `report_token` da mesma forma

### 4. Modo embed no ProfessionalReport

- Ler query param `?view=embed`
- Quando ativo: ocultar topbar, rodape e navegacao, deixando apenas o conteudo clinico
- Facilita iframe dentro do prontuario Meddit

### 5. Integracao com HealthReport

- No relatorio do paciente (`HealthReport`), na secao "Compartilhar com medico", adicionar link para "Meus Medicos" ou botao direto de favoritar
- Manter o botao existente de share temporario (48h) como alternativa rapida

### 6. Notificacao futura para Meddit (pos-SSL)

- Preparar no `prontuario-proxy` action `favorite` uma chamada opcional a API Meddit para informar o link
- Ativar quando SSL estiver configurado

## Arquivos afetados

- **Nova migration**: adicionar `source_type`, `internal_partner_id` em `prontuario_connections`
- **Novo**: `src/components/mayla/FavoriteDoctors.tsx`
- **Editar**: `supabase/functions/prontuario-proxy/index.ts` (suportar medicos internos)
- **Editar**: `src/components/report/ProfessionalReport.tsx` (modo embed)
- **Editar**: `src/components/mayla/HealthTab.tsx` ou `ProfileTab.tsx` (link para Meus Medicos)
- **Editar**: `src/components/report/HealthReport.tsx` (link para favoritos)

## Seguranca

- Tokens de acesso permanente so sao validos enquanto `active=true`
- Paciente pode revogar a qualquer momento
- `ProfessionalReport` ja valida token contra ambas as tabelas
- RLS em `prontuario_connections` restringe acesso ao proprio usuario e admins
- Modo embed nao exige login, validacao e feita pelo token

