# Fase 7.8 — Arquitetura dos Layouts Premium

Estado: **implementada e validada; encerrada no commit conjunto com a Fase 7.9, aguardando push explícito**.

## Objetivo

Substituir regras de composição dispersas por um catálogo visual único, permitindo que Preview React/CSS e renderer Sharp usem as mesmas regiões, paletas, limites e comportamento de logo.

## Catálogo compartilhado

`shared/storyLayoutSpec.js` é a fonte de verdade dos cinco layouts oficiais:

| Layout | Característica |
| --- | --- |
| Premium | Produto, preço e CTA equilibrados. |
| Luxury | Fundo escuro, marca e preço em destaque. |
| Minimal | Imagem predominante e marca discreta. |
| Offer | Oferta com alto contraste. |
| Editorial | Composição vertical narrativa. |

Cada item concentra paleta, regiões de imagem/texto/logo/CTA/handle, limites de texto, miniatura vetorial, comportamento de imagem e escolha automática de logo. `product-highlight` legado normaliza para `premium`; Stories sem layout usam Premium.

## Comportamento e compatibilidade

- O seletor do Composer exibe cards visuais com miniaturas, nome e descrição.
- Alterar layout atualiza apenas a prévia local e invalida derivados anteriores; renderizar continua uma ação explícita.
- Sharp recebe as regiões e a paleta do mesmo catálogo usado pelo React/CSS, preservando imagem com `contain` e sem deformação.
- WebP interno e JPEG para Buffer continuam em 1080×1920, derivados da mesma composição.
- Nenhum novo campo persistido foi criado; compatibilidade de Stories antigos é tratada na leitura.

## Validação

- catálogo, Composer, preview, Marketing Service, texto e renderer: validação direcionada aprovada;
- inspeção visual desktop, tablet e mobile aprovada para os cinco layouts;
- suíte completa: **56 arquivos e 398 testes aprovados**;
- build de produção Vite, `git diff --check` e links locais: **aprovados**;
- nenhuma chamada ao OpenRouter, DeepSeek ou consumo de créditos externos.
