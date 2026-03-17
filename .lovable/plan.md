

# Plano: Aviso de dados indisponíveis + Compartilhamento automático na consulta

## 1. Banner "Dados disponíveis" no Relatório (HealthReport.tsx)

Quando não há dados reais de medição (scores é null, ou seja, nenhum registro em `health_scores`), exibir um banner informativo no topo do relatório (abaixo da topbar, antes do score), com estilo `rpt-empty-banner`:

- Ícone de informação + texto: "Você ainda não possui dados de medição. Use a funcionalidade de medição por câmera ou conecte um relógio de saúde para gerar seu relatório completo."
- Botão "Fazer minha primeira medição" que navega para `/` (tela inicial com acesso à medição)
- Quando `scores` é null, os scores mostrados (75, 82, 58, 70) devem ser substituídos por traços ou um estado visual "sem dados" mais claro

**Arquivo**: `src/components/report/HealthReport.tsx` — adicionar bloco condicional `{!scores && <banner>}`
**Arquivo**: `src/components/report/report.css` — adicionar estilos `.rpt-empty-banner`

## 2. Botão "Compartilhar dados de saúde" na Consulta

Adicionar botão "📋 Compartilhar dados de saúde com equipe médica" em dois pontos:

### a) WaitingRoom.tsx
- Após o card de info do profissional, antes dos botões de ação
- Ao clicar: cria `report_shares` com token, e salva `professional_id` da consulta no registro
- Mostra toast de confirmação: "Dados compartilhados! O profissional poderá visualizar seu relatório de saúde."
- Estado: botão muda para "✅ Dados compartilhados" após ação (desabilitado)

### b) JitsiConsultationScreen.tsx
- No header, abaixo dos badges de status
- Mesma lógica de compartilhamento automático

**Lógica de compartilhamento** (reutilizada):
1. Busca `consultation.professional_id` 
2. Cria registro em `report_shares` com `user_id`, `professional_id`, token UUID, `expires_at` = 48h
3. Exibe toast com confirmação

| Arquivo | Mudança |
|---------|---------|
| `src/components/report/HealthReport.tsx` | Banner quando sem dados |
| `src/components/report/report.css` | Estilos do banner |
| `src/components/mayla/WaitingRoom.tsx` | Botão compartilhar dados |
| `src/components/mayla/JitsiConsultationScreen.tsx` | Botão compartilhar dados |

