# Fase 7.9 — Estilos Visuais

Estado: **implementada e validada tecnicamente; aguardando encerramento Git separado**.

## Objetivo

Adicionar uma camada leve de orquestração no Story Composer sem criar regras paralelas de renderização, nova fonte de verdade ou campos persistidos adicionais no Story.

## Catálogo compartilhado

`shared/storyVisualStyleSpec.js` contém cinco estilos estáticos e valida, no carregamento e em teste, todas as referências existentes de layout, tipografia, modo e tamanho de logo:

| Estilo | Layout | Tipografia | Logo | Tamanho |
| --- | --- | --- | --- | --- |
| PRIME Store | `premium` | `premium` | `primary` | `medium` |
| Luxury | `luxury` | `elegante` | `white` | `small` |
| Minimal | `minimal` | `moderno` | `primary` | `small` |
| Offer | `offer` | `impacto` | `white` | `medium` |
| Editorial | `editorial` | `elegante` | `primary` | `small` |

Cada item inclui somente `id`, nome, descrição, `recommendedFor` informativo e uma combinação dos quatro campos existentes. O catálogo não replica geometria, paletas, fontes, posições ou regras de logo.

## Comportamento

- Ao clicar em um card, o Composer aplica os quatro campos simultaneamente e atualiza a prévia local.
- Não existe renderização automática; um arquivo final anterior é marcado como desatualizado até salvar e gerar novamente.
- Os controles individuais continuam editáveis. A combinação atual é comparada ao catálogo: correspondência exata mostra o estilo oficial; qualquer diferença mostra **Personalizado**.
- `recommendedFor` é somente metadado visual. Não é persistido, não chega ao renderer e não aciona IA.
- Não existe `visualStyleId` em `week.json` ou no Story. Assim, Stories antigos permanecem compatíveis sem migração ou regravação.

## Paridade e segurança

O Estilo Visual não entra no Sharp. Ele apenas preenche `storyTemplateId`, `typographyPreset`, `logoMode` e `logoSize`; React/CSS e Sharp já consomem esses mesmos contratos compartilhados. A regra existente de logo branca manual foi preservada: um estilo que escolhe `white` bloqueia a renderização se a variante não estiver aprovada, sem fallback silencioso.

## Validação técnica

- catálogo, Composer, Marketing Service, compatibilidade e renderer: **61 testes direcionados aprovados**;
- os cinco estilos renderizam WebP e JPEG de 1080×1920 pelos campos persistidos existentes;
- `visualStyleId` é descartado se recebido e nunca é persistido;
- nenhuma chamada ao OpenRouter ou DeepSeek e zero créditos externos;
- suíte completa: **56 arquivos e 398 testes aprovados**;
- build de produção Vite: **aprovado**;
- `git diff --check` e validação de links locais: **aprovados**.
