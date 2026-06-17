
## Objetivo

O Shen.ai retorna 30+ indicadores por medição. Vamos:
1. **Persistir** o resultado completo de cada medição.
2. **Mostrar tudo** no painel do admin da empresa (visão por colaborador).
3. **Permitir ao super admin** (painel global) escolher quais indicadores aparecem para o usuário final.

---

## 1. Banco de dados (1 migration)

### a) Catálogo global de indicadores
`public.vitals_indicators_catalog`
- `key` (text PK) — ex: `heart_rate_bpm`, `hrv_sdnn_ms`, `breathing_rate_bpm`, `spo2_percent`, `systolic_blood_pressure_mmhg`, `diastolic_blood_pressure_mmhg`, `stress_index`, `cardiac_workload`, `vascular_age`, `hemoglobin_g_dl`, `hemoglobin_a1c_percent`, `parasympathetic_activity`, `mean_rri_ms`, `rmssd_ms`, `lf_hf_ratio`, `pns_index`, `sns_index`, etc.
- `label` (pt-BR), `unit`, `category` (cardiac / respiratory / hrv / metabolic / stress / risk), `description`, `default_visible_to_user` (bool), `sort_order`, `active`.
- Seed inicial com todos os indicadores do Shen.ai SDK (`MeasurementResults`).

### b) Override por instância (super admin global)
`public.user_visible_indicators` (global, sem `company_id`)
- `indicator_key` (FK), `visible_to_user` (bool), `updated_at`, `updated_by`.
- Decide quais indicadores aparecem para o usuário final em TODAS as empresas (regra única do super admin, conforme pedido).
- Se vazio para um indicador → usa `default_visible_to_user` do catálogo.

> Observação: como o pedido é "super admin escolhe o que aparece para o usuário", a configuração é **global**, não por empresa. Admin do cliente sempre vê tudo.

### c) Reuso de `special_measurements`
- A coluna `measurement_data jsonb` já existe — vamos gravar o objeto completo retornado por `getMeasurementResults()` do Shen.ai com `source = 'shenai'`.
- Sem alteração de schema aqui.

GRANT + RLS:
- `vitals_indicators_catalog`: SELECT para `authenticated`/`anon`; ALL para `service_role`. Escrita apenas para `admin` (super admin).
- `user_visible_indicators`: SELECT para `authenticated`; escrita apenas `admin`.

---

## 2. Captura completa (Shen.ai)

Em `src/hooks/useVitalsMeasurement.ts` (branch Shen.ai):
- Ao finalizar, chamar `shenai.getMeasurementResults()` e gravar o objeto inteiro em `special_measurements.measurement_data` (`source: 'shenai'`).
- Mapear um subconjunto para `health_measurements` (campos colunares existentes: HR, HRV, SpO2, BP, RR, stress) para manter compatibilidade com Home/Report atuais.

---

## 3. Painel do admin cliente — visão completa

Nova aba/seção em `src/components/admin/AdminUsers.tsx` (detalhe do colaborador): **"Medições completas"**.
- Lista as últimas medições de `special_measurements` do usuário.
- Ao expandir, renderiza um grid usando `vitals_indicators_catalog` × `measurement_data`:
  - Agrupado por `category`.
  - Mostra rótulo, valor, unidade.
  - Mostra TODOS os indicadores presentes no payload (sem filtro).
- Exportar CSV (botão simples).

Componente novo: `src/components/admin/UserVitalsFullPanel.tsx`.

---

## 4. Painel super admin — escolher o que o usuário vê

Nova página: `src/components/admin/AdminVitalsVisibility.tsx` (rota dentro do AdminDashboard global).
- Lista todos os indicadores do catálogo agrupados por categoria.
- Toggle "Visível para o usuário final" por indicador (escreve em `user_visible_indicators`).
- Indica visual quais vêm de Shen.ai/Binah/ambos.
- Botões: "Restaurar padrão" e "Mostrar todos / ocultar todos".

---

## 5. UI do usuário final — respeitar visibilidade

Onde hoje exibimos vitals (HomeTab card, HealthReport, BinahCapture pós-medição):
- Criar hook `useVisibleIndicators()` que carrega catálogo + overrides e expõe `isVisible(key)` + lista ordenada.
- `HealthReport.tsx`: nova seção "Indicadores avançados" listando apenas chaves marcadas como visíveis e presentes no último `special_measurements.measurement_data`.
- Card pós-medição Shen.ai mostra apenas indicadores visíveis.

---

## 6. Tipos e integração

- Adicionar `src/types/shenai-indicators.ts` com a lista canônica (espelha o seed do catálogo).
- Atualizar `useVitalsMeasurement.ts` para extrair o payload bruto Shen.ai.

---

## Arquivos a criar / editar

**Criar**
- `supabase/migrations/<timestamp>_vitals_indicator_catalog.sql`
- `src/types/shenai-indicators.ts`
- `src/hooks/useVisibleIndicators.ts`
- `src/components/admin/UserVitalsFullPanel.tsx`
- `src/components/admin/AdminVitalsVisibility.tsx`

**Editar**
- `src/hooks/useVitalsMeasurement.ts` — gravar payload completo Shen.ai.
- `src/components/admin/AdminUsers.tsx` — embutir `UserVitalsFullPanel`.
- `src/components/admin/AdminDashboard.tsx` — rota/aba "Indicadores".
- `src/components/report/HealthReport.tsx` — seção "Indicadores avançados" filtrada.
- `src/components/mayla/BinahCapture.tsx` — exibir só indicadores visíveis no resumo pós-medição.

---

## Pontos de confirmação

- Visibilidade do usuário é **global** (decisão do super admin vale para todas as empresas). Se preferir por empresa, ajustamos o modelo.
- Admin do cliente vê **sempre tudo**, sem filtro.
