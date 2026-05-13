## Diagnóstico

O link `https://saude.saudecomvc.com.br/assinar/mayla?ref=7C2A1621` está caindo no 404 da própria aplicação, não em erro HTTP do servidor.

O código atual já possui a rota correta no preview:

```text
/assinar/:slug -> Subscribe
```

Mas o JavaScript carregado no domínio de produção `saude.saudecomvc.com.br` ainda não contém a rota `assinar`, indicando que o domínio publicado está com uma versão antiga do frontend.

## Plano de correção

1. **Garantir compatibilidade da rota de assinatura**
   - Manter `/assinar/:slug` como rota principal da página de assinatura.
   - Adicionar uma rota alternativa segura, se necessário, para evitar quebra de links já gerados.

2. **Ajustar a geração do link de afiliado**
   - Confirmar que o botão “Copiar” gera sempre links no domínio de produção configurado.
   - Manter o formato:

```text
https://saude.saudecomvc.com.br/assinar/{slug-da-empresa}?ref={codigo-afiliado}
```

3. **Melhorar o comportamento quando a empresa não é encontrada**
   - Em vez de ficar em “Carregando...” indefinidamente, exibir uma mensagem clara quando o slug da empresa não existir ou não tiver planos ativos.

4. **Validação final**
   - Testar no preview a rota `/assinar/mayla?ref=7C2A1621`.
   - Após implementação, será necessário publicar/atualizar o frontend para que o domínio `saude.saudecomvc.com.br` receba a rota nova.

## Observação importante

A causa principal aparente é publicação desatualizada: o domínio de produção está servindo um bundle antigo que não tem a rota `/assinar`. Depois da correção, clique em **Publish / Update** para atualizar o frontend publicado.