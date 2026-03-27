

# Plano: Remover indicações de demonstração e diagnosticar SDK na VPS

## Diagnóstico
Na VPS, o modo demo está ativando por um de dois motivos:
1. Headers COOP/COEP não configurados no Nginx → `crossOriginIsolated === false`
2. SDK `@biosensesignal/web-sdk` não instalado via `.tgz` → import falha

## O que será feito

### 1. Remover UI de demonstração do `BinahCapture.tsx`
- Remover badge "DEMONSTRAÇÃO" (linha 259) — mostrar sempre "BINAH"
- Remover caixa amarela de aviso "Modo demonstração" na tela de consentimento (linhas 289-293)
- Remover texto "🎭 Modo demonstração — analisando..." durante medição (linhas 347-351)
- Remover aviso "⚠️ Valores simulados" nos resultados (linhas 405-409)
- Botão: sempre mostrar "Iniciar Medição Especial" (linha 318)
- Manter `source: isDemoMode ? "binah_demo" : "binah"` no banco para rastreabilidade interna

### 2. Adicionar log de diagnóstico no `useBinahMonitor.ts`
- Adicionar `console.warn` detalhado quando entra em demo mode, indicando o motivo exato (headers ausentes vs SDK não encontrado)
- Isso ajuda a diagnosticar na VPS sem expor nada ao usuário

### 3. Verificação do Nginx (ação manual)
Confirmar no servidor que o Nginx tem estes headers:
```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```
E que o SDK foi instalado: `npm install ./biosensesignal-web-sdk-5.11.4.tgz`

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/mayla/BinahCapture.tsx` — remover todas as mensagens visuais de demo |
| Editar | `src/hooks/useBinahMonitor.ts` — melhorar logs de diagnóstico |

