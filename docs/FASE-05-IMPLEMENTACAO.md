# PRIME STUDIO — Fase 5: Produção em Lotes

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

Estado: **implementada e aguardando validação final do usuário**. Não conclui oficialmente a Fase 5.

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

## Limitações intencionais

Não há processamento paralelo, retry, banco, agendamento, WebSocket, remoção pós-criação ou recuperação automática. A validação final manual e testes completos ainda são necessários antes do encerramento e de qualquer commit/push.

Nenhuma chamada ao OpenRouter foi executada durante esta implementação.
