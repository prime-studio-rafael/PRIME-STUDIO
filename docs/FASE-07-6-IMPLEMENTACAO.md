# Fase 7.6 — Branding Inteligente

Estado: concluída tecnicamente em 27 de julho de 2026; publicação aguardando autorização explícita.

## Escopo entregue

- Branding passou a manter duas variantes independentes de logo PNG: `primary` e `white`.
- Cada variante possui upload, estado pendente, aprovação, remoção, asset e metadata próprios; a aprovação ou substituição de uma nunca altera a outra.
- O Story Composer aceita `logoMode` (`auto`, `primary`, `white`) e `logoSize` (`small`, `medium`, `large`).
- Em `auto`, os layouts claros usam a principal e o layout `offer` usa a branca quando disponível; sem branca, `auto` faz fallback honesto para a principal. A seleção manual `white` sem logo branca bloqueia a renderização com mensagem segura.
- Preview React/CSS e Sharp usam a mesma especificação visual para variante, tamanho, posição fixa e área segura. As opções preservam proporção, sem crop ou deformação.
- A edição de modo ou tamanho invalida WebP/JPEG anteriores; Stories legados leem os dois campos como `auto` e `medium`.

## Persistência e compatibilidade

- A logo principal continua em `logo.png` e a branca em `white.png`; pendências usam arquivos separados e metadata local sem Base64 ou caminhos absolutos.
- `variant=approved` continua apontando para a logo principal, preservando o contrato anterior.
- WebP interno e JPEG 1080×1920 continuam derivados da mesma composição Sharp e são disponibilizados por downloads com MIME, `Content-Length` e `X-Content-Type-Options: nosniff` corretos.

## Validação

- Cenários aprovados: `primary + small`, `primary + large`, `white + medium` e `auto + offer`.
- As duas logos reais coexistiram após reload, sem sobrescrita da principal.
- Suíte final: 54 arquivos e 358 testes aprovados; build de produção e `git diff --check` aprovados.
- Nenhuma chamada ao OpenRouter ou DeepSeek; zero créditos externos.

## Fora do escopo

- Não há slider, posição livre, tipografia adicional, Buffer ou publicação automática.
- A alteração independente em `src/components/layout/Sidebar.jsx` não faz parte desta fase.
