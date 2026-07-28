# Fase 8.1B — Dashboard Premium com Dados Reais

Estado: **encerrada tecnicamente em 28 de julho de 2026; publicação remota depende de autorização explícita.**

## Objetivo

Substituir os dados demonstrativos que já possuíam fonte local existente no Dashboard Premium por agregações reais de Resultados e Produção em Lotes, sem criar endpoints, persistência, consultas paralelas ou integrações externas.

## Fontes reutilizadas

- `useResults`, que consome a listagem local de Resultados;
- `useBatches`, que consome a listagem local de Lotes;
- estado já existente de configuração do OpenRouter;
- preferência local `usdToBrlRate`, definida manualmente em Configurações.

Nenhuma rota, serviço, renderer ou contrato de dados foi criado ou alterado nesta fase.

## Agregações reais

- **Imagens geradas, aprovadas e pendentes:** Resultados únicos por ID, filtrados pelo período selecionado e por `reviewStatus`.
- **Tempo médio:** somente durações finitas maiores que zero; sem amostras, o Dashboard mostra `Sem dados suficientes`.
- **IA principal:** modelo mais recorrente no período, com normalização de espaços e capitalização; em empate, ordem determinística. A interface mostra o nome resumido e mantém o identificador técnico no tooltip.
- **Custos:** somente `costUsd` finito e maior ou igual a zero. USD continua sendo a origem; BRL é `USD × cotação manual`, arredondado apenas no resultado final. Sem cotação válida, o Dashboard mostra estado orientativo, sem inventar conversão.
- **Lotes e fila:** estados e itens reais retornados pelo módulo de Produção em Lotes. Estados terminais não entram na fila.
- **Timeline:** até quatro Resultados reais mais recentes, com data relativa e data absoluta disponível nativamente.
- **Insights:** regras determinísticas locais; não usam IA.
- **Saúde:** apenas a configuração real da chave OpenRouter é exibida como configurada ou não configurada. Os demais itens permanecem explicitamente como monitoramento futuro.

## Estados honestos que permanecem

Ainda não existe histórico comparável suficiente para o gráfico de produção, nem fonte real para os donuts, taxa de sucesso consolidada ou monitoramento dos demais serviços. Esses blocos continuam visuais, com textos claros como `Histórico disponível após mais produções`, `Dados demonstrativos`, `Não informado` ou `Monitoramento futuro`; não representam dados reais.

## Interface e compatibilidade

O layout aprovado da Fase 8.1A foi preservado em desktop, tablet e mobile. Não houve redesign, alteração no Story Composer, Branding, Templates, Resultados, Lotes ou pipeline de geração. A navegação continua usando os mesmos hooks, evitando consultas duplicadas.

## Validação

- suíte completa: **59 arquivos / 430 testes aprovados**;
- build de produção: aprovado;
- `git diff --check`: aprovado;
- links locais: aprovados;
- validação visual desktop, tablet e mobile: aprovada;
- OpenRouter: zero chamadas;
- DeepSeek: zero chamadas;
- créditos externos: zero.
