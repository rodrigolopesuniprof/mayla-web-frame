

# Plano: Botão "Favoritar Médico" na tela de detalhe do parceiro interno

## Contexto

Hoje o botão de favoritar só existe no `ProntuarioConveniado` (médicos Meddit). O backend (`prontuario-proxy` action `favorite` com `source_type=mayla_partner`) já está pronto. Falta apenas adicionar o botão na tela `PartnerDetail`, que é onde o usuário vê os detalhes de médicos/clínicas do marketplace interno.

## Implementação

### 1. Atualizar `PartnerDetail.tsx`

- Adicionar botão ❤️ "Favoritar médico" para parceiros do tipo `doctor` (ou `clinic`)
- Ao clicar, chamar a edge function `prontuario-proxy?action=favorite` com `source_type: "mayla_partner"` e `internal_partner_id: partner.id`
- Mostrar estado de carregamento e feedback via toast
- Se já estiver favoritado, mostrar botão como "Favoritado ✓" com opção de desfavoritar (`action=unfavorite`)
- Ao montar o componente, consultar `prontuario_connections` para verificar se já existe vínculo ativo com aquele partner

### 2. Verificar vínculo existente

- Query direta no Supabase: `prontuario_connections` filtrado por `user_id`, `external_system=mayla`, `external_professional_id=partner.id`, `active=true`
- Evita necessidade de nova edge function só para checar estado

## Arquivos afetados

- **Editar**: `src/components/mayla/PartnerDetail.tsx` — adicionar lógica de favoritar/desfavoritar com estado visual

## Escopo

- Sem migration (backend já suporta `mayla_partner`)
- Sem alteração na edge function (action `favorite` e `unfavorite` já tratam `source_type=mayla_partner`)
- Botão aparece apenas para `partner_type === "doctor"` ou `"clinic"`

