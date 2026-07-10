
## Objetivo

Substituir o envio via WhatsApp da rota `/demo` por integração direta com o CRM LunaOS, num fluxo isolado do restante do Mayla. A **Tela 1** (nova) segue o design da landing `maylasaude.com.br`: fundo azul-noite, tipografia serifada no headline, banner de aviso âmbar e CTA verde-menta em pílula (referência: screenshot enviado).

## Fluxo final

```text
Tela 1 (NOVA)                 Tela 2 (existe)          Tela 3 (existe)      Tela 4 (ajustada)
"Teste a tecnologia          Disclaimer +              Câmera medindo       Resultados +
em 60 segundos"       →      botão "Iniciar      →     (BinahCapture)   →   "Enviar dados e
[Nome] [WhatsApp]            medição" centrado                              finalizar teste"
[Iniciar teste →]                                                          ↓ automático
POST form                                                                   POST form
"site-mayla-saude-                                                          "dados-de-saude"
teste-de-saude"                                                             no CRM
no CRM                                                                      ↓
                                                                            Tela 5: obrigado
```

## Design tokens da Tela 1 (isolados em `/demo`, não afetam o app)

Extraídos da landing `maylasaude.com.br` + screenshot de referência:

- Fundo `#0C1A27` (`--demo-bg`), superfície `#132434`, borda sutil `rgba(255,255,255,0.08)`
- Verde-menta `#2FCB94` (`--demo-accent`) para CTA e ícone
- Âmbar `#F5A623` (`--demo-warn`) para o banner de "Ambiente de teste"
- Tipografia: **Playfair Display** (headline) + **Inter** (corpo) via Google Fonts, escopadas na página `/demo`
- CTA em **pílula** (`rounded-full`), altura 56 px, verde `#2FCB94` sobre texto branco, com ícone 📷 antes do label
- Layout mobile-first, largura máxima 430 px centralizada, header com marca "Mayla." e botão `X` (que reinicia o fluxo)
- Banner de aviso com ícone triângulo âmbar, borda 1px `rgba(245,166,35,0.35)`, fundo `rgba(245,166,35,0.08)`
- Inputs escuros `#132434`, label branca 12 px semibold acima, placeholder cinza-claro
- Copy fixo: título "Teste a tecnologia em 60 segundos" · subtítulo "Antes de começar, nos diga quem é você — enviamos as dicas do seu resultado pelo WhatsApp." · rodapé sob o CTA "Grátis · sem compromisso · leva 1 minuto"

Tudo isso vive em CSS escopado por classe raiz `.demo-scope` (arquivo `src/pages/demo.css`) — nada é injetado nos tokens globais do Mayla.

## Integração LunaOS

- Base URL: `https://mayla.lunaos.com.br/api/v1`
- Auth: `Authorization: Bearer luna_mrBNb…` guardado como secret backend **`LUNA_API_TOKEN`** (nunca no cliente)
- Endpoint: `POST /formularios/{slug}/respostas` (ability `formularios:write`)
- Slugs usados:
  - `site-mayla-saude-teste-de-saude` — `seu_nome`, `whats_app`
  - `dados-de-saude` — `f_c`, `p_a`, `s_p_o2`, `f_r`, `s_t_r_e_s_s`, `v_f_c`, `b_e_m-_e_s_t_a_r`, `h_e_m_o_g`, `h_b_a1_c`
- Body enviado: `{ nome, celular, ddi:"55", abrir_conversa:true, campos:{…} }` — `abrir_conversa:true` dispara a jornada de agente que aciona o WhatsApp no LunaOS.

## Backend (Lovable Cloud)

Duas edge functions públicas (`verify_jwt=false`, CORS, Zod, rate-limit leve por IP), sem tocar em nenhuma tabela do Mayla:

1. **`supabase/functions/demo-lead-submit`** — recebe `{ nome, whatsapp }`, normaliza celular (só dígitos, remove DDI 55 se enviado), `POST` no slug `site-mayla-saude-teste-de-saude`. Retorna `{ ok:true }`.
2. **`supabase/functions/demo-health-submit`** — recebe `{ nome, whatsapp, medicao:{…} }`, formata (inteiros para FC/PA/SPO2/FR/Stress/VFC/Bem-estar, 1 casa em Hemog/HbA1c, PA como `"129/78"`), `POST` no slug `dados-de-saude`. Retorna `{ ok:true }`. Erros do LunaOS (401/422) são logados e devolvidos com mensagem amigável.

Secret a solicitar via `add_secret`: **`LUNA_API_TOKEN`**.

## Frontend

Tudo confinado a `src/pages/DemoBinah.tsx` + 2 arquivos novos, **sem tocar** em `MaylaApp`, `HomeTab`, tabelas, gamificação etc.

- `src/pages/demo.css` — tokens visuais escopados em `.demo-scope` + import das fontes Playfair Display + Inter.
- `src/pages/DemoLeadForm.tsx` — Tela 1 replicando o mock:
  - header com "Mayla." + botão `X` (`onCancel`)
  - ícone estetoscópio em círculo (SVG inline, cor `--demo-accent`)
  - headline serifada em 2 linhas + subtítulo
  - banner âmbar "Ambiente de teste. O resultado é uma demonstração e **não possui o mesmo grau de acurácia** do sistema efetivamente utilizado no ambiente oficial da Mayla."
  - inputs "Seu nome" / "Seu WhatsApp" (máscara `(11) 99999-9999`) com validação
  - CTA verde-pílula "📷 Iniciar teste →"
  - microcopy "Grátis · sem compromisso · leva 1 minuto"
- `DemoBinah.tsx` vira máquina de 3 estados: `"lead" → "measure" → "done"`.
  - `"lead"`: renderiza `DemoLeadForm`; ao submeter chama `demo-lead-submit`; sucesso → guarda `{nome, whatsapp}` e vai para `"measure"`.
  - `"measure"`: renderiza `BinahCapture` já existente com novas props opcionais:
    - `saveButtonLabel="Enviar dados e finalizar teste"`
    - `hidePointsHint` para remover o texto "+100 pontos" só em `/demo`
    - `ctaCentered` para centralizar o botão inicial "Iniciar medição"
    - `onSaveOverride={(result) => demo-health-submit(...)}` — remove o envio para WhatsApp.
  - `"done"`: card simples "✅ Recebemos seus dados! Em instantes entraremos em contato pelo WhatsApp" + botão "Fazer novo teste" (volta para `"lead"`).

Props adicionadas a `BinahCapture` são **opcionais e retrocompatíveis** — o fluxo autenticado no app continua idêntico.

## Validação e segurança

- Zod nas 2 functions (400 em payload inválido).
- `whatsapp`: só dígitos, rejeita `<10` ou `>15`.
- Token nunca sai do backend.
- Rate limit leve por IP nas duas functions.
- Sem gravação no Supabase — o LunaOS é a fonte de verdade.

## O que **não** muda

- `MaylaApp`, `HomeTab`, `WellbeingTab`, `BinahCapture` em uso autenticado, `special_measurements`, gamificação, tokens globais de tema.
- URL pública `https://mayla-web-frame.lovable.app/demo` permanece.

## Passos de implementação

1. Solicitar secret `LUNA_API_TOKEN` (mensagem separada com `add_secret`).
2. Criar `demo-lead-submit` e `demo-health-submit` (deploy automático).
3. Ajustar `BinahCapture` com props `saveButtonLabel`, `hidePointsHint`, `ctaCentered`, `onSaveOverride` (todas opcionais).
4. Criar `demo.css` + `DemoLeadForm.tsx` seguindo o mock (fundo `#0C1A27`, verde `#2FCB94`, serif Playfair).
5. Reescrever `DemoBinah.tsx` com a máquina de 3 estados.
6. Testar `/demo` end-to-end no preview publicado.
