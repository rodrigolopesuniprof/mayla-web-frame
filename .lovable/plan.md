

# Plano: Trazer implementação Binah do Mayla 2G_V3 para este projeto

## Situação atual
Este projeto tem uma versão antiga do `BinahCapture.tsx` que carrega o SDK via script tag (`public/binah-sdk/main.js`) e usa simulação como fallback. Faltam:
- O hook `useBinahMonitor.ts` (lifecycle completo do SDK)
- As type declarations `binah-sdk.d.ts`
- Os plugins Vite (`vite-plugin-wasm`, `vite-plugin-top-level-await`)
- O build config para external do SDK
- A UI melhorada com feedback de validade do rosto, modal de informações nos resultados, e modo demo explícito
- O `DEPLOY.md` com instruções de VPS

## O que será feito

### 1. Criar `src/hooks/useBinahMonitor.ts`
Copiar o hook do V3 que encapsula todo o lifecycle do SDK: initialize, createFaceSession, start/stop, demo mode com `crossOriginIsolated` check.

### 2. Criar `src/types/binah-sdk.d.ts`
Copiar as type declarations do `@biosensesignal/web-sdk` para compilação sem o pacote instalado.

### 3. Substituir `src/components/mayla/BinahCapture.tsx`
Substituir pela versão do V3 que usa `useBinahMonitor`, com:
- Feedback visual de validade do rosto (orientação, distância, iluminação)
- Barra de progresso com timer de 60s
- Vitais parciais durante medição
- Modal de informações educativas em cada resultado
- Modo demonstração explícito
- Adaptação: manter prop `companyId` (este projeto usa empresa, não apenas município)

### 4. Atualizar `vite.config.ts`
- Adicionar plugins `vite-plugin-wasm` e `vite-plugin-top-level-await`
- Adicionar `preview.headers` com COOP/COEP
- Adicionar `optimizeDeps.exclude` e `build.rollupOptions.external` para `@biosensesignal/web-sdk`
- Mudar COEP de `require-corp` para `credentialless` no dev server (compatibilidade com iframes)

### 5. Criar `DEPLOY.md`
Instruções de deploy na VPS com nginx, headers COOP/COEP, instalação do SDK `.tgz`, e registro de domínio no dashboard Binah.

### 6. Atualizar memory
Atualizar `.lovable/memory/features/binah-integration.md` com a nova arquitetura.

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/hooks/useBinahMonitor.ts` |
| Criar | `src/types/binah-sdk.d.ts` |
| Substituir | `src/components/mayla/BinahCapture.tsx` |
| Editar | `vite.config.ts` |
| Criar | `DEPLOY.md` |
| Editar | `.lovable/memory/features/binah-integration.md` |

## Nota sobre dependencias
Os pacotes `vite-plugin-wasm` e `vite-plugin-top-level-await` precisam ser instalados. O SDK real (`@biosensesignal/web-sdk`) nao sera instalado no Lovable — ele e carregado dinamicamente em runtime e marcado como external no build.

