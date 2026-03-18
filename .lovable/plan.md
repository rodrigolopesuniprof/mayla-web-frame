

# Plano: Corrigir upload e exibição de logomarca de empresas

## Diagnóstico

O bucket `company-logos` existe no storage, mas **não possui nenhuma política RLS**. Isso significa que:
- O upload falha silenciosamente (sem permissão de INSERT)
- Mesmo se existisse um arquivo, ninguém conseguiria visualizar (sem permissão de SELECT)
- A coluna `logo_url` da UNIPROF está `NULL` no banco — confirma que o upload nunca foi salvo

O bucket `municipality-logos` funciona porque tem políticas configuradas. O `company-logos` foi criado sem replicar essas políticas.

## Correção

Criar as políticas de storage necessárias via migração SQL:

1. **SELECT** — qualquer pessoa pode visualizar logos (bucket é público)
2. **INSERT** — admins podem fazer upload
3. **UPDATE** — admins podem substituir logos (necessário para `upsert: true`)
4. **DELETE** — admins podem remover logos

```sql
-- Permitir visualização pública
CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Admins podem fazer upload
CREATE POLICY "Admins can upload company logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins podem atualizar (upsert)
CREATE POLICY "Admins can update company logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins podem deletar
CREATE POLICY "Admins can delete company logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));
```

## Resultado

Após aplicar a migração, o upload de logomarca funcionará para todas as empresas (UNIPROF e futuras). Basta fazer o upload novamente no painel admin.

| Ação | Arquivo |
|------|---------|
| Migração SQL | Criar políticas RLS no bucket `company-logos` |

Nenhuma alteração de código é necessária — o código de upload já está correto.

