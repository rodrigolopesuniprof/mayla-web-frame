## Diagnóstico

Testei o link `https://maps.app.goo.gl/FVggLpcYVkHgCZeR9` direto na edge function `resolve-maps-url` e ele retorna corretamente:
- `latitude: -23.6907646, longitude: -46.6241459` (Diadema-SP, Rua Graciosa)

Ou seja, **o resolver funciona**. O problema é outro, em duas camadas:

### Problema 1 — Coordenadas não foram salvas no banco

Consultando `partner_locations` para os 3 parceiros "Oficial Farma":

| Parceiro | google_maps_url | latitude | longitude |
|---|---|---|---|
| Oficial Farma - Graciosa | ✅ salvo | ❌ NULL | ❌ NULL |
| Oficial Farma - Vila América | (vazio) | ❌ NULL | ❌ NULL |
| Oficial Farma - Figueiras | (vazio) | ❌ NULL | ❌ NULL |

A linha "Graciosa" tem o link salvo mas as coordenadas estão nulas — provavelmente o registro foi criado antes do resolver estar deployado, ou pelo formulário principal (`PartnerForm`) numa versão anterior do fluxo. O atual `PartnerLocationsEditor.saveRow` já chama o resolver, mas ele só roda quando você clica em **Salvar** dentro do card de "Locais de atendimento" — não automaticamente em registros antigos.

### Problema 2 — Filtro de raio descarta parceiros distantes

`HealthPartnersMap` filtra parceiros a no máximo **50 km** do usuário. Se você estiver em ES (centro padrão `-20.31, -40.31`) e o parceiro está em Diadema-SP, mesmo com coordenadas corretas o pin nunca aparece (distância ~850 km).

## Plano

### 1. Backfill imediato (migration)
Criar migration que chama nada no banco, apenas como marco — e em seguida rodar um script via edge function ou direto que percorre `partner_locations` onde `google_maps_url IS NOT NULL` e `latitude IS NULL`, chama o resolver, e atualiza as linhas. Faço isso server-side via uma nova edge function `backfill-partner-coords` (uma chamada manual, sem RLS issues) — assim consigo resolver os 3 registros existentes.

### 2. Resolver automaticamente no `PartnerLocationsEditor` ao **digitar/colar** o link
Hoje só roda no clique "Salvar". Vou adicionar: ao sair do campo (`onBlur`) do input do Google Maps, se o link mudou e ainda não há coordenadas, chamar o resolver e mostrar feedback ("📍 Coordenadas extraídas: lat, lng"). Continua exigindo "Salvar" para persistir, mas o usuário enxerga imediatamente se deu certo.

### 3. Botão "🔄 Atualizar coordenadas a partir do link" em cada local
Para registros antigos: um botão pequeno ao lado do input que força nova resolução, útil quando o link foi trocado.

### 4. Ampliar e tornar configurável o raio de busca
- Mudar `DEFAULT_RADIUS_KM` de 10 → 25 km
- Mudar o raio fixo de `HealthPartnersMap` (50 km) → 200 km
- Manter já existente o filtro por cidade na UI, então não há risco de "spam"

Esse é o ponto que mais provavelmente está te confundindo no teste: mesmo se as coordenadas estivessem certas no banco, o parceiro de Diadema **não apareceria** num mapa centrado em ES por causa do raio.

## Detalhes técnicos

- Nova edge function `backfill-partner-coords` (verify_jwt = false, protegida por header `x-admin-token` opcional ou apenas sem autenticação dado que é admin-only e idempotente). Faz: `SELECT id, google_maps_url FROM partner_locations WHERE latitude IS NULL AND google_maps_url IS NOT NULL`, chama `resolve-maps-url` para cada um, faz `UPDATE` com as coordenadas e também sincroniza `partners.latitude/longitude` quando `is_main = true`.
- `PartnerLocationsEditor`: novo handler `handleMapsUrlBlur(idx)` que chama `resolveGoogleMapsUrl` e atualiza state local com as coords (sem persistir até "Salvar").
- `partner-helpers.ts`: `DEFAULT_RADIUS_KM = 25`.
- `HealthPartnersMap.tsx` (linha 88): trocar `50` por `200`.

## Pergunta antes de implementar

Você confirma que quer **ampliar o raio** para 200 km (assim parceiros em outros estados aparecem)? Ou prefere manter restrito a ~50 km e considerar que parceiros distantes simplesmente não devem aparecer no mapa do colaborador?