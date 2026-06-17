## Objetivo

Unificar a interface da **Medição Básica de Sinais Vitais (rPPG)** com o layout já consolidado da **Análise Completa (Binah / Shen.ai)**, mantendo a mesma estrutura visual em todas as fases (consentimento, câmera, medição, resultado, erro).

Hoje os dois fluxos têm telas bem diferentes:
- `RppgCapture` (Básica): vídeo em fullscreen com overlay escuro, oval rosa, header próprio.
- `BinahCapture` (Avançada): header padrão com X + título + avatar, vídeo embutido como cartão arredondado, barra de progresso `Progress`, badge "Rosto detectado", grid de resultados com `HelpCircle`, botão único "Salvar Medição".

## O que vai mudar (apenas frontend)

Reescrita do arquivo `src/components/mayla/RppgCapture.tsx` para espelhar o layout do `BinahCapture`, preservando 100% da lógica atual de captura (getUserMedia 320×240, 6 fps, 20s, base64, `rppg-proxy`, pontos, toasts).

### Nova estrutura visual (idêntica à do Binah)

1. **Container fullscreen** `fixed inset-0 z-50 flex flex-col bg-background`.
2. **Header** com botão `✕` + título "Medição de Sinais Vitais" (ou `displayName` quando fornecido) — mesmo padrão do Binah.
3. **Tela de consentimento (`consent`)**:
   - Ícone grande (❤️) centralizado.
   - Título "Medir Sinais Vitais".
   - Texto descritivo curto.
   - Grid `grid-cols-3` com badges: ❤️ FC, 🫁 Resp, 😰 Estresse, 💧 SpO2 (mesmo estilo `bg-secondary rounded-xl`).
   - Linha de metadados: "Duração: ~20 segundos · ganhe +50 pontos".
   - Botão primário com gradiente `mayla-rose → mayla-rose-lt` (mantém identidade da medição básica).
4. **Fase câmera/medição (`capturing`)**:
   - Vídeo como cartão `w-full max-h-[300px] object-cover rounded-2xl mx-auto px-4` (igual ao Binah), espelhado horizontalmente.
   - Badge verde "📷 Capturando vídeo" no estilo do badge "Rosto detectado".
   - Barra `<Progress />` do shadcn com "Medindo sinais vitais… {elapsed}s / 20s".
   - Linha pequena "{n} frames capturados".
   - Botão "Cancelar" fixo no rodapé (mesmo padrão do Binah).
5. **Processando (`processing`)**:
   - Mesmo layout do "Carregando análise…" do Binah: ícone pulsante + texto + `Progress` indeterminada animada.
6. **Resultado (`result`)**:
   - Cabeçalho "✅ Resultados da Medição" idêntico ao Binah.
   - Grid `grid-cols-2` de cartões `bg-secondary rounded-2xl p-3.5` com emoji + label + valor + unidade.
   - Inclui ícone `HelpCircle` em cada card, abrindo o mesmo modal inferior do Binah com explicações (FC, Resp, Estresse, SpO2).
   - Botão "Salvar Medição" com gradiente `mayla-pref → mayla-teal` (mesmo do Binah). Como hoje o `RppgCapture` não persiste (o `WellbeingTab`/`HealthTab` cuida do `onComplete`), o botão apenas chama `onComplete()` + `onClose()` mantendo o comportamento atual; nada de lógica nova de persistência.
7. **Erro (`error`)**:
   - Mesma tela do Binah: ⚠️ + "Medição não concluída" + mensagem + botão "Tentar novamente".

### Detalhes técnicos

- Importar `Progress`, `HelpCircle`, `X` (lucide-react), como no Binah.
- Reaproveitar exatamente os mesmos tokens/cores/sombras/gradientes do `BinahCapture` para garantir paridade visual.
- Manter as refs (`videoRef`, `canvasRef`, `streamRef`, intervals) e toda a lógica de `startCapture` / `processFrames` / `cleanup` inalteradas — só muda o JSX e classes.
- Manter props públicas (`onClose`, `onComplete`) inalteradas — `WellbeingTab.tsx` e `HealthTab.tsx` não precisam mudar.
- Remover os subcomponentes antigos (`ConsentScreen`, `CapturingOverlay`, `ProcessingScreen`, `ErrorScreen`, `ResultScreen`, `ResultCard`) — substituídos por blocos inline no mesmo estilo do Binah.

## Fora de escopo

- Não mexer no `BinahCapture.tsx`, `useVitalsMeasurement.ts`, nem em qualquer lógica de captura/proxy/pontos.
- Não alterar `HealthTab.tsx`/`WellbeingTab.tsx`.
- Não consolidar os dois capturadores em um único componente — mantemos `RppgCapture` separado, apenas com o layout unificado.
