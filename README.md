# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## API de Acesso ao Relatório de Saúde (Parceiros)

API para sistemas externos (ex: Meddit) consultarem o relatório de saúde de um paciente vinculado.

### Endpoint

```
GET https://ymexlslqsdflgkcvwjoz.supabase.co/functions/v1/prontuario-verify
```

### Autenticação

| Header | Descrição |
|---|---|
| `x-api-key` | Chave de API fornecida pela equipe Mayla |

### Parâmetros (query string)

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `token` | ✅ | `report_token` do paciente (UUID gerado na vinculação) |
| `professional_id` | ❌ | ID externo do profissional. Quando informado, valida que o token pertence a esse profissional |

### Exemplo de requisição

```bash
curl -X GET \
  "https://ymexlslqsdflgkcvwjoz.supabase.co/functions/v1/prontuario-verify?token=c7291104-e899-4d0d-a5a9-7576b94274e8&professional_id=1214611" \
  -H "x-api-key: SUA_CHAVE_API"
```

### Resposta de sucesso (200)

```json
{
  "authorized": true,
  "professional_id": "1214611",
  "professional_name": "John Carter",
  "report_url": "https://saude.saudecomvc.com.br/relatorio/medico/c7291104-e899-4d0d-a5a9-7576b94274e8?view=embed",
  "user_id": "uuid-do-paciente",
  "profile": {
    "full_name": "Machado de Assis",
    "birth_date": "1839-06-21",
    "biological_sex": "masculino",
    "has_hypertension": false,
    "has_diabetes": false
  },
  "scores": {
    "score_general": 72,
    "score_physiological": 68,
    "score_emotional": 75,
    "score_lifestyle": 70,
    "recommendation_level": 2,
    "period_start": "2026-04-08",
    "period_end": "2026-04-15",
    "generated_at": "2026-04-15T10:00:00Z"
  },
  "alerts": [
    {
      "id": "uuid",
      "metric": "heart_rate",
      "severity": "yellow",
      "description": "Frequência cardíaca elevada nos últimos 3 dias",
      "detail": "Média de 95 bpm (referência: 60-100 bpm)",
      "days_triggered": 3,
      "generated_at": "2026-04-15T10:00:00Z"
    }
  ],
  "measurements": [
    {
      "id": "uuid",
      "measured_at": "2026-04-15T09:30:00Z",
      "measurement_type": "rppg",
      "heart_rate": 78,
      "spo2": 97,
      "blood_pressure_sys": 120,
      "blood_pressure_dia": 80,
      "respiratory_rate": 16,
      "stress_level": 3,
      "hrv": 45,
      "source": "binah"
    }
  ]
}
```

### Usando o relatório via iframe

O campo `report_url` retorna uma URL pronta para ser embutida em um iframe dentro do prontuário:

```html
<iframe
  src="https://saude.saudecomvc.com.br/relatorio/medico/c7291104-e899-4d0d-a5a9-7576b94274e8?view=embed"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

O parâmetro `?view=embed` remove a navegação e os botões de compartilhamento, otimizando para visualização embutida.

### Respostas de erro

| Código | Corpo | Causa |
|---|---|---|
| `401` | `{"authorized": false, "error": "Invalid API key"}` | Chave de API ausente ou inválida |
| `400` | `{"authorized": false, "error": "Token is required"}` | Parâmetro `token` não informado |
| `200` | `{"authorized": false}` | Token não encontrado ou conexão inativa |
| `500` | `{"authorized": false, "error": "Internal error"}` | Erro interno do servidor |

### Fluxo de vinculação

1. O paciente favorita o profissional no app Mayla
2. O sistema gera um `report_token` (UUID) na tabela `prontuario_connections`
3. O sistema externo (Meddit) armazena esse token associado ao paciente
4. A cada consulta, o sistema externo chama este endpoint para obter os dados atualizados
