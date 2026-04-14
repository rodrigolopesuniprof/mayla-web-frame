

# Plano: Corrigir campo `socialMidia` para `"whatsapp"`

## Diagnóstico

O teste no Postman confirmou que a API Meddit exige `"socialMidia": "whatsapp"` no payload do `register`. Nosso código envia `"socialMidia": "mayla"`, que a API não reconhece e causa falha silenciosa ou timeout.

## Implementação

**Arquivo**: `src/components/mayla/ConsultationFlow.tsx` (linha 905)

Trocar:
```typescript
socialMidia: "mayla",
```
Por:
```typescript
socialMidia: "whatsapp",
```

Alteração de uma única linha.

