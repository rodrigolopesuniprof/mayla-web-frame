

# Plano: Corrigir integração com API Meddit

## Problemas encontrados

Comparando o curl fornecido pela equipe Meddit com o que nosso sistema está fazendo, há **3 diferenças críticas**:

### 1. URL da API errada
- **Curl oficial**: `https://api.meddit.net`
- **Configurado no banco**: `http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com` (HTTP, servidor antigo)
- **Fallback no código**: `https://meddit-clinic-appointment.vercel.app` (outro servidor)
- O timeout de 55s acontece porque estamos batendo no servidor errado, que não responde.

### 2. Todos os valores precisam ser strings
- **Curl oficial**: `"professionalId": "1214611"`, `"officeId": "195574"`, `"interval": "30"`
- **Nosso código**: envia como números (`professionalId: 1214611`, `officeId: 195574`, `interval: 30`)

### 3. DEFAULT_BASE desatualizado
- O fallback no código ainda aponta para `https://meddit-clinic-appointment.vercel.app`

## Implementação

### 1. Atualizar a URL no banco de dados
- Atualizar `company_features.config.base_url` de `http://meddit-api-clinic-nv.us-west-2.elasticbeanstalk.com` para `https://api.meddit.net`

### 2. Atualizar DEFAULT_BASE na edge function
- Em `supabase/functions/prontuario-proxy/index.ts`, trocar `DEFAULT_BASE` para `https://api.meddit.net`

### 3. Converter todos os valores para string no frontend
- Em `ConsultationFlow.tsx`, no payload do `register`, usar `String()` em `professionalId`, `officeId`, `patientId` e `interval`

## Arquivos afetados
- `supabase/functions/prontuario-proxy/index.ts` — atualizar DEFAULT_BASE
- `src/components/mayla/ConsultationFlow.tsx` — converter valores para string
- Migration SQL — atualizar `base_url` na tabela `company_features`

## Detalhes técnicos
- A API key (`meddit-atria-2026`) já está correta no banco
- O campo `socialMidia: "mayla"` está OK (a equipe Meddit usou `"whatsapp"` como exemplo, mas `"mayla"` identifica a origem corretamente)

