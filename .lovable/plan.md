## Objetivo

No diálogo "Personalize seu avatar", substituir o botão **Aleatório** por um navegador de variações com **seta esquerda, indicador "X / 24" e seta direita**, percorrendo uma lista fixa de sementes em loop.

## O que muda

1. **Lista fixa de sementes** (em `src/lib/avatar.ts`)
  - Adicionar `AVATAR_PRESET_SEEDS`: array de 24 strings curtas (`"alex"`, `"sky"`, `"mia"`, `"leo"`, …).
  - Mesmas 24 sementes aplicadas a qualquer estilo escolhido → o usuário consegue comparar "a mesma pessoa" entre estilos diferentes.
  - Helper `nextPresetSeed(current, direction)` que devolve a próxima/anterior semente, em loop.
2. **AvatarCustomizerButton** (`src/components/mayla/AvatarCustomizerButton.tsx`)
  - Remover o botão `Aleatório` + import de `RefreshCw`.
  - Abaixo do preview circular, mostrar uma linha horizontal:
    ```
    [◀]   3 / 24   [▶]
    ```
    - Setas: botões `variant="ghost" size="icon"` com `ChevronLeft` / `ChevronRight` (lucide-react).
    - Contador: `text-xs text-muted-foreground tabular-nums`.
  - Estado novo `presetIndex` (0–23). Ao abrir o diálogo:
    - Se a `avatar_seed` salva estiver na lista → começa nesse índice.
    - Senão (semente customizada ou inexistente) → começa em 0 e exibe "—" no contador.
  - Clicar ◀ ou ▶:
    - Atualiza `presetIndex` em loop (módulo 24).
    - Atualiza `seed` = `AVATAR_PRESET_SEEDS[novoIndex]`.
    - Preview e thumbs do seletor de estilos re-renderizam automaticamente.
  - Editar manualmente o campo "Semente (personalizar)":
    - Continua funcionando (`onChange` do `Input`).
    - Se a string digitada não bate com nenhuma da lista, o contador mostra `—` (semente livre).
3. **Comportamento ao salvar** — sem mudança
  - Mesmo fluxo atual: gera `dataUri` com `(style, seed)`, grava em `profiles` (`avatar_url`, `avatar_type='dicebear'`, `avatar_style`, `avatar_seed`), credita 150 pts na primeira vez, toast, fecha modal.

[RETIRAR A INFORMAÇÃO "SEMENTE". ISSO PARA O USUÁRIO PODE CONFUNDIR

## O que NÃO muda

- Lista de 9 estilos (adventurer, avataaars, bottts, lorelei, micah, notionists, openPeeps, personas, thumbs).
- Campo "Semente (personalizar)" — fica visível abaixo das setas, como hoje.
- Migration / colunas da tabela `profiles`.
- Componente `Avatar` e como o avatar é exibido em outras telas.
- Fluxo de pontos, toasts, invalidação de estado local.

## Layout final do diálogo (mobile, 390 px)

```
        Personalize seu avatar             [×]

              ╭──────────╮
              │   ◉◉     │   ← preview circular
              ╰──────────╯
        [ ◀ ]   3 / 24   [ ▶ ]

  Estilo
  ┌─────────┬─────────┬─────────┐
  │Aventura │Avataaars│ Robôs   │
  ├─────────┼─────────┼─────────┤
  │ Lorelei │  Micah  │ Notion  │
  ├─────────┼─────────┼─────────┤
  │OpenPeeps│Personas │Polegares│
  └─────────┴─────────┴─────────┘

  Semente (personalizar)
  ┌───────────────────────────────┐
  │ alex                          │
  └───────────────────────────────┘

       [ Cancelar ]   [ Salvar avatar ]
```

## Arquivos tocados

- `src/lib/avatar.ts` — adicionar `AVATAR_PRESET_SEEDS` e `nextPresetSeed()`.
- `src/components/mayla/AvatarCustomizerButton.tsx` — trocar bloco "Aleatório" pelo navegador ◀ N/24 ▶.