

# Plano: Impedir cliques múltiplos no botão "Salvar Medição"

## Problema
O botão "Salvar Medição" no `BinahCapture.tsx` não tem proteção contra cliques repetidos. Como a operação é assíncrona (insere em 2 tabelas, atualiza pontos, chama edge function), o delay causa múltiplos salvamentos duplicados.

## Solução

**Arquivo**: `src/components/mayla/BinahCapture.tsx`

1. Adicionar um state `saving` (useState boolean)
2. No início de `saveResult`, adicionar guard `if (saving) return;` e setar `setSaving(true)`
3. No final (try/finally), manter `saving = true` após sucesso (o botão fica desabilitado permanentemente para aquela medição)
4. No botão, adicionar `disabled={saving}` e mudar o texto para "Salvando..." enquanto `saving === true`, e "✓ Salvo" após concluído

Alteração de ~10 linhas em um único arquivo.

