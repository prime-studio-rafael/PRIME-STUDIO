# PRIME STUDIO — Fase 5: Produção em Lotes

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

Estado: **FASE 5 OFICIALMENTE CONCLUÍDA em 17 de julho de 2026**, validada com lote real e correções de fluxo de revisão aplicadas.

## Arquitetura

`BatchesPage → batchesClient → /api/batches → BatchService → BatchQueue → GenerationExecutor → OpenRouter + LocalResultStorage`.

`GenerationExecutor` é a pipeline única compartilhada com a geração individual: valida imagens, monta `upper-garment-v2`, usa modelo Lite/1K/1:1, realiza uma única chamada, processa a resposta e persiste o resultado/metadata. `GenerationCoordinator` é a única trava global; há no máximo uma geração ativa entre tela individual e lotes, sem retry.

## Persistência e segurança

Cada lote é salvo em `storage/batches/<batch-id>/` com `batch.json`, `batch.json.bak`, snapshot do template e roupas em `items/<item-id>/`. Escritas usam arquivo temporário + rename; o backup recupera um `batch.json` corrompido. Não há Base64, payload completo, chave ou caminho absoluto em JSON/API. `storage/` segue ignorado pelo Git.

Resultados concluídos permanecem no formato da Fase 4 em `storage/results/<generation-id>/`; o metadata recebe apenas `batchId` e `batchItemId` adicionais.

## Estados e execução

- lote: `draft`, `ready`, `running`, `paused`, `completed`, `completed_with_errors`, `cancelled`, `interrupted`;
- item: `queued`, `preparing`, `generating`, `completed`, `failed`, `cancelled`, `interrupted`.

A fila persiste `preparing`, então `generating` e `attempts: 1` imediatamente antes da única chamada. Falha marca somente o item e segue os próximos. Pausa permite concluir o item ativo e detém o próximo; retomada é explícita e só processa `queued`. Cancelamento não corta HTTP ativa, cancela pendentes e preserva resultados concluídos. Ao iniciar, lotes `running` e itens `preparing/generating` tornam-se `interrupted`; não há retomada automática nem repetição de `completed`, `failed` ou `interrupted`.

## Endpoints

- `GET/POST /api/batches`
- `GET /api/batches/:id`
- `POST /api/batches/:id/start|pause|resume|cancel`
- `GET /api/batches/:id/items/:itemId/garment`

## Interface

A view **Produção em Lotes** permite selecionar template local válido, arrastar ou escolher várias roupas, remover itens antes de criar, revisar formato/tamanho, confirmar créditos, ver estimativa e acompanhar itens por polling moderado. Mostra ações iniciar/pausar/retomar/cancelar e links para resultados concluídos.

## Correções pós-implementação

Depois da validação real, dois pontos de UX foram corrigidos e já estão incluídos no encerramento desta fase:

- **Botão "Abrir resultado"**: o clique navegava para a tela Resultados mas descartava o `resultId` do item, deixando a lista aberta sem selecionar nada. Corrigido para abrir diretamente o `ResultDetailModal` do resultado correspondente, tanto entrando pela tela Resultados quanto pelo botão do item de lote.
- **Aprovar/Reprovar com avanço automático**: ao aprovar ou reprovar um resultado, o modal agora localiza automaticamente o próximo resultado com `reviewStatus = pending` (seguindo a mesma ordem da lista, do mais recente para o mais antigo) e o abre no lugar. Quando não há mais pendentes, o modal fecha e uma mensagem discreta é exibida ("Revisão concluída. Não há mais resultados pendentes."). Erro de persistência mantém o modal atual, sem avanço nem atualização otimista incorreta.
- **Download em lote das aprovadas**: a tela Resultados, com o filtro Aprovados ativo, oferece "Baixar todas as aprovadas", que gera um único ZIP no backend (`GET /api/results/download/approved`) com os arquivos finais já persistidos, bytes e extensões originais, sem Base64, sem template/roupa/metadata, com nomes únicos e sem exposição de caminho físico. O download individual por resultado continua disponível.

## Validação real do lote

Lote executado com 8 roupas reais sobre o template `model-01`:

- **8/8 itens concluídos** (`status: completed`, sem falhas, cancelamentos ou interrupções);
- processamento estritamente sequencial, concorrência global igual a 1;
- **uma chamada por item**, **zero retry automático**;
- custo estimado: **US$ 0,272**; custo real: **US$ 0,27618** (≈ US$ 0,28);
- todos os resultados persistidos em `storage/results/<generation-id>/`, com `resultId`, `batchId` e `batchItemId` corretos em cada item de `batch.json`;
- botão "Abrir resultado" validado para os 8 itens, abrindo o modal correto em cada caso;
- fluxo de aprovação/reprovação com avanço automático validado com dados reais até o fechamento do modal e a mensagem de conclusão;
- download do ZIP de aprovadas validado com os arquivos reais, bytes idênticos aos originais.

## Testes e build

- **124 testes aprovados** em 28 arquivos (`npm test`);
- **build aprovado** (`npm run build`);
- nenhuma geração real, chamada ao OpenRouter ou consumo de créditos durante os testes, o build ou as correções de UX.

## Limitações intencionais

Não há processamento paralelo, retry, banco, agendamento, WebSocket, remoção pós-criação ou recuperação automática.

## Fase 5.1 — UX Enterprise da Produção em Lotes

Estado: **implementada em 17 de julho de 2026**. Melhoria exclusivamente visual, sem alteração de regra de negócio, endpoint, estado, transição, concorrência, retry ou custo.

Escopo implementado:

- cabeçalho com contagem total de lotes e indicador discreto de lote(s) em execução;
- formulário "Novo lote" convertido em painel colapsável, priorizando visualmente a consulta aos lotes existentes;
- lista de lotes reestilizada com badge de status semântico, contagem de itens, custo real (ou estimado quando ainda não houver custo real) e barra de progresso compacta por lote;
- cards de resumo do lote selecionado — Total, Concluídos, Processando, Aguardando, Erros — calculados exclusivamente a partir dos estados reais dos itens (`item.status`), sem nenhum valor fictício;
- barra de progresso do lote selecionado com rótulo `concluídos/total` real, sem animação ou percentual inventado;
- lista de itens com thumbnail da roupa (via `GET /api/batches/:id/items/:itemId/garment`, endpoint já existente), nome, dimensões, MIME, badge de status semântico, duração, custo e erro seguro quando houver;
- botão "Abrir resultado" com ícone, preservando exatamente `onOpenResult?.(item.resultId)`;
- ações Iniciar/Pausar/Retomar/Cancelar com ícone + texto, estado de carregamento local por ação e confirmação inline antes de cancelar (sem alterar o endpoint ou o payload da ação);
- estados visuais dedicados para carregamento, lista vazia, erro de carregamento e "nenhum lote selecionado";
- responsividade validada em desktop e mobile, sem overflow horizontal, com os cards de resumo em grade adaptável e os itens empilhados em telas estreitas; todas as imagens usam `object-contain`.

Novos componentes de apresentação, sem nova arquitetura: `BatchSummaryCards.jsx` e `BatchItemRow.jsx`, em `src/features/batches/components/`.

Validação: 12 novos testes de frontend (`tests/frontend/batchesManagement.test.jsx`), cobrindo cards de resumo, ausência de progresso fictício, preservação do `resultId` no botão "Abrir resultado", chamadas inalteradas às ações existentes, confirmação de cancelamento e estados vazio/loading/erro. Validação manual feita com o lote real de 8 itens já existente, sem nova geração.

## Refinamento visual adicional — tabela operacional da Produção em Lotes

Estado: **implementado em 17 de julho de 2026, aguardando validação final do usuário**. Não conclui oficialmente esta fase. Melhoria exclusivamente visual sobre o que a Fase 5.1 já entregou — nenhum endpoint, schema, service, hook, `GenerationExecutor`, fila ou regra de concorrência/retry foi alterado.

Escopo implementado, em três etapas sucessivas (auditoria → aprovação → implementação, com validação visual a cada etapa):

- **Resumo compacto**: os cards de resumo (Total, Concluídos, Processando, Aguardando, Erros) viraram uma faixa horizontal com separadores finos, no lugar de cinco cards grandes — mesmos cinco números, mesmos `data-testid`, mesmo cálculo a partir de `item.status`.
- **Lista de lotes**: hover e seleção refinados (barra lateral indicando o lote selecionado, elevação sutil no hover, transições de 200ms), sem alterar `onClick`/`aria-pressed`.
- **Tabela operacional de itens**: a lista de itens virou uma tabela real com 7 colunas alinhadas — Produto, Status, Progresso, Tempo, Custo, Resultado, Ações — com cabeçalho fixo por coluna. Nenhuma coluna "Tentativas" (o PRIME STUDIO usa zero retry automático; esse dado nunca existiu e não foi inventado).
- **Progresso visual por etapa**: uma função pura de apresentação (`getVisualProgress`, em `BatchItemRow.jsx`) mapeia o `status` real do item para um percentual visual — `queued=0%`, `preparing=25%`, `generating=70%`, `completed=100%`, `failed=100%` (com cor de erro, não de sucesso) — e `cancelled`/`interrupted` mostram um traço, nunca um percentual inventado. Um ícone de informação ao lado do cabeçalho "Progresso" explica isso por tooltip acessível (mouse e teclado): *"Progresso calculado com base na etapa atual do processamento."* Nada disso é persistido nem depende de um novo dado do backend.
- **Miniatura de resultado por item**: reaproveita o endpoint já existente `GET /api/results/:id/assets/result` a partir do `resultId` do item — nenhum endpoint novo.
- **Responsividade em 3 camadas**: desktop/notebook mostra a tabela completa sem scroll; tablet (1024px e 768px) mantém as mesmas 7 colunas com scroll horizontal restrito à própria tabela (`overflow-x-auto` num wrapper dedicado, cabeçalho e linhas compartilhando o mesmo `min-w-[840px]`); mobile continua com os itens em cards empilhados. Nenhuma rolagem horizontal da página em nenhum tamanho — validado por medição direta (`scrollWidth === clientWidth` do documento) em 1280×800/900, 1024×768/900, 768×1024/1300 e 375px.
- **Polimento final**: formulário "Novo lote" com labels, bordas e foco consistentes com o resto do app; radius unificado nos estados vazios; `motion-reduce:animate-none` nas barras/indicadores com pulso, respeitando `prefers-reduced-motion`; nenhuma cor nova fora da paleta slate/emerald/amber/rose/blue já usada no projeto.

Validação: `tests/frontend/batchesManagement.test.jsx` cresceu de 12 para 22 testes (cobrindo percentual por estágio, traço em cancelled/interrupted, tooltip com o texto exato e acessível por foco, wrapper com scroll horizontal restrito à tabela, ausência de ações de retry/exclusão por item, e os 7 cabeçalhos de coluna sempre presentes). Suíte completa: 261 testes em 38 arquivos, build aprovado, `git diff --check` limpo, em execuções repetidas. Validação manual feita com o lote real de 8 itens já existente, sem nova geração e sem chamada ao OpenRouter.

## Próximas melhorias aprovadas, ainda não iniciadas

- **Branding/Logo**: upload e validação de logo transparente, aprovação explícita do usuário e aplicação automática por overlay tradicional (sem uso de IA para redesenhar a logo), mantendo sempre a versão original sem logo disponível;
- **download em massa das imagens finais** (ampliação do download em lote já validado na Fase 5).

Nenhuma dessas melhorias foi iniciada. A Fase 6 também não foi iniciada.
