## Problema

A tela de "Medição de Sinais Vitais" (rPPG simplificado) está falhando com "Não foi possível acessar a câmera. Verifique as permissões." Esse erro é genérico — qualquer falha em `navigator.mediaDevices.getUserMedia` cai no mesmo catch, sem distinguir a causa real.

## Causas prováveis identificadas em `src/components/mayla/RppgCapture.tsx`

1. **Contexto inseguro / iframe sem permissão** (causa mais provável no preview Lovable)
   - `getUserMedia` só funciona em HTTPS ou `localhost`. A URL `*.lovable.app` é HTTPS, mas a página é carregada dentro de um iframe do editor Lovable, e o iframe pai **precisa** do atributo `allow="camera; microphone"` para liberar a câmera no filho. Sem isso, o navegador retorna `NotAllowedError` mesmo antes de pedir permissão.
   - Em produção (`saude.saudecomvc.com.br`), se a app for embedada em outro iframe (ex.: portal corporativo), o mesmo bloqueio acontece.

2. **Permissão negada pelo navegador no Android**
   - Permissão de câmera previamente negada para o domínio fica "lembrada"; o `getUserMedia` lança `NotAllowedError` instantaneamente, sem reabrir o prompt.

3. **Câmera ocupada por outro app**
   - WhatsApp/Câmera/Meet abertos no Android seguram o sensor → `NotReadableError`.

4. **Constraints inválidas para o dispositivo**
   - Pedimos `width: 320, height: 240` como constraint estrita. Em alguns Androids/navegadores isso falha com `OverconstrainedError`. O ideal é usar `{ ideal: 320 }`.

5. **Mensagem de erro mascara a causa real**
   - O catch atual ignora `err.name`, então o usuário (e nós) não conseguimos diagnosticar. Hoje qualquer falha vira "Verifique as permissões".

6. **Possível conflito com Binah já ter aberto a câmera**
   - Se o usuário tentou Binah antes na mesma sessão e o stream não foi liberado, a câmera fica presa.

## Plano de correção

### 1. Diagnóstico granular no `RppgCapture`
Tratar `err.name` no catch de `startCapture` e exibir mensagem específica:
- `NotAllowedError` / `SecurityError` → "Permissão de câmera negada. Toque no cadeado da barra de endereço → Permissões → Câmera → Permitir, e recarregue."
- `NotFoundError` / `OverconstrainedError` → "Nenhuma câmera compatível encontrada. Tentando com configuração padrão…" e tentar fallback sem `width/height`.
- `NotReadableError` → "Câmera está sendo usada por outro app. Feche WhatsApp/Câmera/Meet e tente novamente."
- `TypeError` (sem `mediaDevices`) → "Seu navegador/contexto não suporta câmera (precisa de HTTPS)."
- Qualquer outro → mostrar `err.name + err.message` para diagnóstico.

### 2. Detectar contexto inseguro / iframe antes de pedir
Antes de chamar `getUserMedia`:
- Se `!window.isSecureContext` → mensagem explícita de HTTPS obrigatório.
- Se `!navigator.mediaDevices?.getUserMedia` → API indisponível (provável iframe sem `allow="camera"`).
- Se `window.self !== window.top` → avisar que está em iframe e que o site pai precisa permitir câmera.

### 3. Relaxar constraints
Trocar `width: FRAME_WIDTH, height: FRAME_HEIGHT` por `width: { ideal: 320 }, height: { ideal: 240 }` para evitar `OverconstrainedError`.

### 4. Garantir liberação prévia de streams
No início de `startCapture`, fechar qualquer `streamRef.current` remanescente antes de pedir um novo, evitando conflito com Binah ou tentativa anterior.

### 5. Logs no console
Adicionar `console.error("[rPPG] getUserMedia failed:", err.name, err.message)` para que, se o problema persistir, possamos ler os logs do navegador.

## Arquivos afetados

- `src/components/mayla/RppgCapture.tsx` — única alteração; isolada na função `startCapture` e no estado de erro.

## Fora de escopo

- Não mexer no `useBinahMonitor` nem em `BinahCapture` (Binah é outro fluxo).
- Não alterar a edge `rppg-proxy` — o problema é client-side, antes de chamar o backend.
