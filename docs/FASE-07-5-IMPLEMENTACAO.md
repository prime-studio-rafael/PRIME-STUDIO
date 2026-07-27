# Fase 7.5 — Assistente IA para textos de Stories

Estado: **implementada e validada funcionalmente em 27 de julho de 2026; aguardando commit e push**.

## Escopo entregue

- Painel Assistente IA no Story Composer.
- Entrada textual limitada a produto, categoria, preço opcional, objetivo, tom e instrução adicional.
- Uma chamada explícita por clique, sem retry automático, com timeout e cancelamento.
- Validação backend de resposta estruturada com exatamente três sugestões e os campos `calloutText`, `headline`, `subheadline` e `ctaText`.
- Rejeição de limites excedidos, descontos, estoque, frete, prazo e condições comerciais inventadas.
- Aplicação manual da sugestão, atualização imediata do preview e invalidação de render anterior.
- Modelo efetivamente utilizado: `deepseek-v4-flash`, selecionado pela configuração existente da conta.

## Validação funcional controlada

- A chave foi confirmada somente por status seguro e permaneceu no Keychain do macOS.
- O primeiro teste identificou corretamente que `deepseek-chat` não estava disponível para a chave configurada.
- Após correção objetiva para consumir o modelo configurado (`deepseek-v4-flash`), foi feita uma única nova tentativa de conexão, aprovada.
- Foi executada exatamente uma geração real de sugestões, com três sugestões válidas.
- Nenhuma imagem foi enviada ao DeepSeek.
- Nenhuma chamada ao OpenRouter foi realizada.
- O Story temporário foi renderizado em WebP e JPEG, ambos 1080×1920, e baixado pela interface.
- O cenário temporário, a semana e os arquivos derivados foram removidos ao final.

## Correção pontual

Ao excluir uma semana, o estado local de edição podia manter o Story removido. A confirmação de exclusão agora limpa esse estado para evitar preview ou formulário stale.

## Testes de encerramento

- Suíte completa: 353 testes aprovados em 54 arquivos.
- Build de produção: aprovado.
- Testes direcionados da fase: 10 testes aprovados.
- `git diff --check`: aprovado.

Nenhum commit ou push foi realizado nesta etapa.
