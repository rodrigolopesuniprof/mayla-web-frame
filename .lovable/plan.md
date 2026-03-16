

## Plano: Limpar HomeTab e melhorar UX das Campanhas

### Problemas identificados

1. **"Conecte-se à sua equipe"** — card redundante no HomeTab (linhas 267-276)
2. **Missões nas campanhas sem ação** — `WellbeingPrograms` mostra missões read-only, sem botão para completar
3. **HomeTab muito longo** — muitos cards empilhados (score, time, consultas, ESF, rPPG, binah, alertas)
4. **Dados deletados ainda aparecem** — campanhas/programas usam `eq("active", true)` mas não forçam refresh; além disso, `CampaignsList` filtra por `ends_at >= hoje` mas programas deletados (marcados como `active: false`) podem ter cache local

### Correções

**1. Remover card "Conecte-se à sua equipe" do HomeTab**
- Deletar linhas 267-276 (`{!hasEsf && ...}`)
- Remover `hasEsf` state e a prop `onOpenEsfLink` se não for usada em outro lugar

**2. Adicionar botões de ação nas missões dentro de WellbeingPrograms**
- Quando o usuário expande Programa → Campanha → Missão, cada missão hoje é apenas texto
- Adicionar integração com `user_missions`: buscar status das missões do usuário e mostrar botão "Completar" ou badge "✅ Feita" ao lado de cada missão
- Usar a mesma lógica de `handleAction` do `MissionsTab` (self_report, qr_code, photo_proof)

**3. Simplificar HomeTab**
- Remover o card ESF (item 1)
- Condensar: manter Score+Pontos, Time, Consultas e rPPG. Remover o card Binah separado (já acessível via aba Bem-estar)
- Resultado: ~4 cards em vez de ~7

**4. Forçar dados frescos nas campanhas**
- Em `WellbeingPrograms` e `CampaignsList`, limpar cache ao montar (já fazem fetch no mount, mas o cache de campanhas/missões dentro do accordion persiste entre navegações)
- Resetar `programCampaigns` e `campaignMissions` quando `companyId` muda
- Garantir que queries filtram corretamente por `active = true`

### Arquivos a modificar
- `src/components/mayla/HomeTab.tsx` — remover ESF card e Binah card
- `src/components/corporate/WellbeingPrograms.tsx` — adicionar status de missões do usuário e botões de ação; resetar cache no mount
- `src/components/corporate/CampaignsList.tsx` — resetar state no mount

