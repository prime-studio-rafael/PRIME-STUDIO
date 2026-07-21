# Fase 7 — Marketing Studio V1

Estado: **aprovada tecnicamente como Fase 7.1 — Fundação do Marketing Studio em 21 de julho de 2026; preservada integralmente e ainda sem commit/push**.

## Objetivo

Organizar Resultados aprovados em semanas locais e produzir Stories 9:16 prontos para publicação, sem IA, sem OpenRouter e sem publicação automática.

## Entrega implementada

- view `Marketing Studio` na SPA existente, sem React Router;
- semanas iniciadas obrigatoriamente na segunda-feira, no timezone `America/Sao_Paulo`;
- fontes limitadas a Resultados com `reviewStatus: approved`;
- escolha entre o asset original e a variante com Branding, quando disponível;
- cópia da fonte para a semana, preservando o planejamento mesmo que o Resultado seja removido depois;
- identificação manual por `productLabel` e `productKey` normalizado no backend;
- controles explícitos de dia, horário e ordem, sem drag-and-drop;
- estados da semana `draft` e `approved`; qualquer alteração estrutural retorna a semana para `draft`;
- aprovação permitida somente quando existe ao menos um Story e todos estão renderizados;
- views internas Planejamento, Calendário, Stories e Histórico;
- card de próxima publicação calculado apenas enquanto o aplicativo está aberto;
- download manual do Story final.

## Gerador local 9:16

O renderer usa o `sharp` já instalado no projeto. Não foi adicionada dependência.

- saída WebP, 1080×1920, qualidade 92;
- três layouts fixos: `product-highlight`, `minimal` e `offer`;
- composição determinística de fonte, textos escapados e logo aprovada;
- resize com `fit: contain`, preservando proporção e sem crop;
- fonte e Story final salvos separadamente;
- nova renderização altera somente o derivado;
- falha preserva fonte e planejamento, marca `renderStatus: failed` e não executa retry;
- ausência de logo aprovada bloqueia a renderização com mensagem segura.

## Persistência

```text
storage/marketing/
└── weeks/
    └── <week-id>/
        ├── week.json
        ├── week.json.bak
        └── assets/
            ├── sources/
            └── stories/
```

O repositório é a única porta de acesso ao filesystem. JSON e assets usam escrita temporária + rename. O catálogo mantém nomes internos, nunca caminhos absolutos, Base64 ou binários. A leitura recupera um `week.json` inválido a partir do backup válido.

## API local

- `GET /api/marketing/layouts`
- `GET /api/marketing/sources`
- `GET|POST /api/marketing/weeks`
- `GET|PATCH|DELETE /api/marketing/weeks/:weekId`
- `POST /api/marketing/weeks/:weekId/approve`
- `POST /api/marketing/weeks/:weekId/draft`
- `POST /api/marketing/weeks/:weekId/stories`
- `PATCH|DELETE /api/marketing/weeks/:weekId/stories/:storyId`
- `POST /api/marketing/weeks/:weekId/stories/:storyId/render`
- `GET /api/marketing/weeks/:weekId/stories/:storyId/assets/:kind`

Assets são servidos com MIME, `Content-Length`, `X-Content-Type-Options: nosniff` e identificadores sanitizados.

## Validação executada

- 46 arquivos e 325 testes aprovados;
- build Vite aprovado, com 1.826 módulos transformados;
- teste visual real do módulo em 1440×1000 e 390×844;
- nenhum overflow horizontal nas duas larguras;
- Story real local confirmado como WebP 1080×1920 e exibido com `object-contain`;
- criação, cópia da fonte, renderização e exclusão da semana de validação confirmadas pela interface;
- semana de validação removida ao final, sem resíduo em `storage/marketing/weeks/`;
- nenhuma chamada ao OpenRouter, geração por IA ou crédito consumido.

## Validação final da fundação

O fluxo efetivamente aprovado para a V1 foi validado com três Resultados aprovados e os três layouts. Planejamento manual, calendário, renderização, download, aprovação, retorno automático a rascunho, persistência após reinício, recuperação por backup, segurança de assets e responsividade funcionaram. Duas correções pontuais foram incorporadas durante a validação: a invalidação de um Story agora também limpa dimensões e eventual arquivo derivado anterior, inclusive após falha de nova renderização; campos textuais opcionais `null` são normalizados na interface para evitar avisos do React.

Os critérios operacionais adicionais identificados nessa validação foram posteriormente aprovados como uma extensão separada, a **Fase 7.2 — Inteligência Operacional**. A fundação deste documento não foi descartada nem reescrita. Consulte [FASE-07-2-IMPLEMENTACAO.md](./FASE-07-2-IMPLEMENTACAO.md).

## Fora do escopo mantido

- editor livre, Canvas no frontend, drag-and-drop ou sistema de camadas;
- entidade completa de Produto;
- IA, OpenRouter ou geração de imagem no módulo Marketing;
- integração Meta, Postiz, publicação automática, notificações com o app fechado ou analytics;
- banco, autenticação, nuvem ou sincronização remota.

## Pendência para encerramento

A Fase 7.1 está aprovada tecnicamente. O conjunto da Fase 7 permanece sem commit e push enquanto a Fase 7.2 aguarda validação do usuário.
