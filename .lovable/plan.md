# Documentação da Plataforma (para criar Skills no Claude)

Vou gerar um arquivo Markdown único e completo em `/mnt/documents/plataforma-saude-vc.md` consolidando toda a funcionalidade do sistema, baseado na memória do projeto e no código existente. O arquivo será estruturado em seções claras, cada uma adequada para virar uma Skill independente no Claude.

## Estrutura do documento

1. **Visão geral**
   - Plataforma white-label B2B de saúde corporativa (React + Supabase / Lovable Cloud)
   - Mobile-first (max 430px), tema dinâmico por empresa (HSL CSS vars)
   - Domínio produção, fluxo de acesso (colaboradores, admins, profissionais)

2. **Modelo de acesso e autenticação**
   - Cadastro público desabilitado, convites por token de empresa (`/cadastro/:token`)
   - Fallback de usuários sem empresa → MAYLA
   - Hierarquia: super admin global × admin de empresa × profissional × colaborador
   - Auth Supabase (sem auto-confirm), Google OAuth, reset de senha, gate de preenchimento de perfil

3. **Privacidade e RBAC**
   - RH vê apenas dados agregados (`company_health_summary`)
   - `user_roles` + `has_role()` security definer
   - RLS por empresa, storage de logos com políticas públicas/admin

4. **Onboarding e Home do colaborador**
   - Splash → Welcome → Main (sem quiz obrigatório)
   - Tabs: Início, Bem-estar, Campanhas, Serviços, Perfil
   - Cards Home: Score de saúde, Mayla assistente, questionários dinâmicos, revista Saúde com Você

5. **Módulos de Bem-estar**
   - Check-in semanal, programas, campanhas, missões
   - Gamificação: pontos persistentes (RPC `add_points_to_profile`), níveis, ranking
   - Times colaborativos (default "Geral"), missões com QR/foto/auto-relato/check-in/survey
   - Adesão a medicamentos (+100 pts/dia)

6. **Medição de sinais vitais**
   - rPPG via proxy (limite 150 frames, 2000ms delay, retry 2)
   - Binah SDK (adapter `useVitalsMeasurement`), +50/+100 pontos
   - Unificação/deduplicação em `health_measurements`

7. **Consultas e Telemedicina**
   - UI map-first, seleção por especialidade, fluxo "primeiro disponível"
   - Imediato (on-demand) com matching score `(queue*10)+response_time`, fallback Clínico Geral
   - Agendamento híbrido: interno (`appointments`) × externo (Meddit `prontuario-proxy`)
   - Jitsi privado VPS (Fase 1 anônima, prejoin desabilitado), cancelamento estilo Uber
   - Favoritar médico unificado, normalização de especialidades

8. **Integração Meddit (prontuário externo)**
   - Config: `api.meddit.net`, IDs string, datetime naive, WhatsApp socialMidia
   - Cache cliente especialidades/médicos (evita 504), bypass CPF público
   - Encerramento: PUT /finish + PATCH status

9. **Painel Profissional**
   - Filas, hoje, histórico; alertas operacionais áudio/visual
   - Disponibilidade (`always_available` 24/7), auto-cadastro pendente
   - Emissão de documentos clínicos (DocumentSender → email paciente)

10. **Relatórios de saúde**
    - Paciente: dashboard 7 dias com 8 indicadores Binah
    - Profissional: acesso via token UUID 48h, validação `report_token + pid`
    - Modo `?view=embed` para iframe
    - Diretrizes: descritivo, sem diagnóstico/medicação

11. **Marketplace de Saúde**
    - 5 tipos de parceiros (clínicas, laboratórios, academias, farmácias, gerais)
    - Raio 25 km (default) / 200 km (map), coords automáticas via `resolve-maps-url`
    - Precificação: clínica fixa ou por médico
    - Farmácia com `virtual_store_url` (iframe)
    - Cadastro público com `pending/inactive`, CSV import

12. **Painel Admin**
    - Empresas (Razão Social, CNPJ, logo, cores HSL)
    - Parceiros (CRUD, segmentação Médico × Geral, CSV)
    - Campanhas, programas, missões (descrição + link de ação)
    - Toggles granulares de consultas
    - Gestão de credenciais de admin de empresa
    - Convites, usuários, integrações

13. **Pagamentos Pagar.me**
    - Assinaturas multi-tenant, chave por empresa, planos
    - Afiliados com split, 3 formas de acesso
    - Webhooks, cron de renovação PIX

14. **Notificações e e-mails**
    - `notify-appointment`, `process-email-queue`, lembretes
    - Templates de auth

15. **Stack técnico**
    - React 18, Vite 5, Tailwind v3, TS 5
    - Supabase (Lovable Cloud), Edge Functions listadas
    - Versões fixas: React Query 5.62.0, supabase-js 2.49.4, react-leaflet 4.2.1
    - Lovable AI Gateway (modelos disponíveis)

16. **Apêndices**
    - Mapa de tabelas principais e RLS
    - Lista de Edge Functions com propósito
    - Variáveis de ambiente
    - Sugestões de divisão em Skills (uma seção = uma skill)

## Entrega

- Arquivo: `/mnt/documents/plataforma-saude-vc.md`
- Disponibilizado via `<presentation-artifact>` para download
- Estimativa: ~800-1200 linhas

Confirma esse escopo? Posso ajustar nível de detalhe (mais técnico com nomes de tabelas/funções, ou mais funcional/produto) antes de gerar.
