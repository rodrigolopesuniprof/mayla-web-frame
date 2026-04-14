

# Plano: Corrigir carregamento da agenda do médico

## Problemas identificados

### 1. IDs dos escritórios não são mapeados corretamente
A API retorna `office_id` (ex: `195574`), mas `loadOffices` mapeia `o.id` (que é `undefined`). Resultado: os IDs reais nunca são usados e o fallback `officeId=1` persiste.

### 2. Formato do calendário incompatível
A API retorna um **objeto** com datas como chaves:
```text
{
  "2026-04-17": {
    "extraInfo": ["08:00:00", "08:30:00", ...],
    "interval": 30,
    "number": 8
  },
  "2026-04-20": { ... }
}
```
Mas o código espera um **array** com `day.slots` ou `day.date/day.time` — resultado: nenhum slot é parseado, a lista fica vazia.

### 3. Chamadas sequenciais para 2 offices
O loop chama a API para cada office sequencialmente. Com a API Meddit lenta, isso duplica o tempo de espera.

## Correções em `ProntuarioConveniado.tsx`

### `loadOffices`
- Mapear `o.office_id` (não `o.id`) e `o.officeInfo?.office_name` (não `o.name`)

### `loadCalendar`
- Detectar que o retorno é um objeto (não array)
- Iterar sobre as chaves (datas) e extrair `extraInfo` como lista de horários
- Montar os slots corretamente: `{ date: "2026-04-17", time: "08:00:00", available: true }`
- Usar `Promise.all` para buscar calendários dos 2 offices em paralelo

## Arquivo afetado
- **Editar**: `src/components/mayla/ProntuarioConveniado.tsx`

