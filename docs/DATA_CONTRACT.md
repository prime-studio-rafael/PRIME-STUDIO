# PRIME STUDIO — Contrato de Dados (Template, Lote, Resultado, Semana de Marketing)

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md). Baseado diretamente no código-fonte na data abaixo — não em memória de conversas.

Última verificação contra o código: 21 de julho de 2026.

Este documento existe porque o contrato real de dados do PRIME STUDIO evoluiu em várias fases e hoje está distribuído entre os repositórios e serviços de Templates, Lotes, Resultados e Marketing. Aqui está a visão consolidada.

---

## 1. Template

Fonte: `server/repositories/localTemplateRepository.js` (`createRecord()`, `assertRecord()`). Persistido em `storage/templates/catalog.json` (+ `.bak`), `schemaVersion` atual = **3**.

| Campo | Tipo | Obrigatório | Default | Validação |
|---|---|---|---|---|
| `id` | string | sim | — | único no catálogo |
| `label` | string | sim | — | — |
| `description` | string | não | `''` | — |
| `storageKey` | string | sim | — | nome de arquivo seguro, sem path traversal |
| `mimeType`, `width`, `height`, `aspectRatio`, `sizeBytes` | — | sim | — | dados técnicos da imagem-base, escritos na criação |
| `valid`, `warnings` | boolean / array | sim | — | resultado da validação de imagem |
| `active` | boolean | sim | `true` | — |
| `category` | string | sim | `"sem-categoria"` | uma das categorias de `server/catalogs/templateCategories.js` |
| `tags` | string[] | não | `[]` | até 8 tags, até 24 caracteres cada, normalizadas (trim, minúsculas, sem duplicata) |
| `hoverDescription` | string\|null | não | `null` | até 160 caracteres |
| `usageMetrics` | — | não | `null` | reservado para o futuro, nenhuma lógica de cálculo implementada |
| **`prompt`** | string\|null | não* | `null` | até 4000 caracteres; *sem `prompt`, o Template fica bloqueado para geração (ver §5) |
| **`negativePrompt`** | string\|null | não | `null` | até 2000 caracteres |
| **`provider`** | string\|null | não | `null` | deve existir em `server/catalogs/providers.js` (hoje só `'openrouter'`) |
| **`modelId`** | string\|null | não | `null` | deve existir em `server/catalogs/models.js` (hoje só `'nano-banana-lite'`) |
| **`generationAspectRatio`** | string\|null | não | `null` | `'1:1'` ou `'4:5'` |
| **`resolution`** | string\|null | não | `null` | hoje só `'1K'` |
| **`promptVersion`** | string\|null | condicional | `null` | obrigatório sempre que `prompt` estiver preenchido; hash SHA-256 truncado a 8 caracteres (`template-<hash>`) de `prompt`+`negativePrompt`+`GLOBAL_RULES_VERSION`, recalculado em `create()`/`update()` — exceto para `model-01`/`model-02` migrados, que preservam o valor histórico `'upper-garment-v2'` |

**Nota de nomenclatura**: o campo `generationAspectRatio` (proporção da geração) é intencionalmente diferente de `aspectRatio` (proporção real da imagem, calculada na validação de upload) — os dois coexistem no mesmo registro e não podem ser unificados sem quebrar a validação de dimensões da imagem.

**Campos em negrito** = adicionados pelas Fases 1-2 do Perfil Completo de Geração por Template. Todos opcionais e aditivos — um Template criado antes dessas fases lê como `null` em todos eles, sem migração manual (migração automática e idempotente já aplicada, `schemaVersion` 2→3).

**Onde é escrito**: `server/services/templateService.js` (`create()`/`update()`, campos passados via `pickGenerationProfile()`) → `server/routes/templates.js` (`parseGenerationProfile()`, converte `null` explicitamente sem `String(null)` → `"null"`, bug já corrigido) → `server/repositories/localTemplateRepository.js`.

**Onde é lido para geração**: `server/services/generationExecutor.js`, funções `resolveTemplate()` (geração individual, lê o Template vivo via `templateService.getForGeneration()`) e `validateSnapshot()` (lote, lê do snapshot congelado em `batch.json` — ver §2).

---

## 2. Lote (`batch.json`)

Fonte: `server/services/batchService.js` (`create()`), `server/repositories/localBatchRepository.js`. Persistido em `storage/batches/<batch-id>/batch.json` (+ `.bak`). **Sem `schemaVersion`** — leitura tolerante (`isValid()` só exige `id`/`items`/`status`), campos novos ausentes em lotes antigos são simplesmente `undefined`.

Campos do lote (nível `batch`, não do item):

| Campo | Origem | Congelado? |
|---|---|---|
| `id`, `name`, `status`, `totalItems`, `completedItems`, `failedItems`, `cancelledItems`, `interruptedItems`, `estimatedCostUsd`, `actualCostUsd`, `createdAt`, `updatedAt`, `startedAt`, `completedAt`, `pauseRequested`, `cancelRequested` | Gerados na criação/execução | Não (mutáveis pelo ciclo de vida do lote) |
| `templateId`, `templateLabel`, `templateMime`, `templateDimensions`, `templateStorageKey` | Snapshot do Template no momento da criação | **Sim, imutável** |
| **`templateCategory`** | `snapshot.publicTemplate.category` | **Sim** |
| **`templatePrompt`** | `snapshot.publicTemplate.prompt` | **Sim** |
| **`templateNegativePrompt`** | `snapshot.publicTemplate.negativePrompt` | **Sim** |
| **`templateProvider`** | `snapshot.publicTemplate.provider` | **Sim** |
| **`templateModelId`** | `snapshot.publicTemplate.modelId` | **Sim** |
| **`templateGenerationAspectRatio`** | `snapshot.publicTemplate.generationAspectRatio` | **Sim** |
| **`templateResolution`** | `snapshot.publicTemplate.resolution` | **Sim** |
| **`templatePromptVersion`** | `snapshot.publicTemplate.promptVersion` | **Sim** |
| **`additionalInstruction`** | Informada na criação do lote (nível do lote, não por item), normalizada por `server/utils/additionalInstruction.js` (máx. 500 caracteres) | **Sim** |

**Campos em negrito** = Fase 3 do Perfil Completo de Geração por Template. Nenhuma função de atualização do lote (`start`/`pause`/`cancel`/`prepareNext`/`complete`/`fail`) reescreve esses campos — o snapshot é imutável desde a criação, mesmo que o Template original seja editado depois.

**Bloqueio de perfil incompleto**:
- Na **criação**: `batchService.create()` rejeita com `BATCH_TEMPLATE_PROFILE_INCOMPLETE` (422) se `snapshot.publicTemplate.prompt` estiver ausente — antes de validar/copiar qualquer arquivo, antes de persistir, sem chamada ao provedor.
- No **`start`/`resume`**: `batchService.start()` rejeita com o mesmo código se `templatePrompt` estiver ausente no `batch.json` já persistido (cobre lotes criados antes da Fase 3, sem os campos acima) — antes do lock global, sem consultar o Template atual, sem tentar completar o snapshot.

**Item do lote** (dentro de `batch.items[]`): `id`, `originalFileName`, `garmentMime`, `garmentDimensions`, `sizeBytes`, `garmentStorageKey`, `status` (`queued`/`preparing`/`generating`/`completed`/`failed`/`cancelled`/`interrupted`), `resultId`, `costUsd`, `durationMs`, `providerRequestId`, `safeError`, `attempts`, `createdAt`/`updatedAt`/`startedAt`/`completedAt`. Sem alteração nesta iniciativa.

**Onde chega ao executor**: `server/services/batchService.js` (`executionInput()`) → `server/repositories/localBatchRepository.js` (`readTemplate()`, devolve `{ id, label, category, buffer, mimeType, prompt, negativePrompt, provider, modelId, generationAspectRatio, resolution, promptVersion }`, tudo lido do `batch.json` já carregado, sem I/O extra) → `generationExecutor.js` (`validateSnapshot()`).

---

## 3. Resultado (`metadata.json`)

Fonte: `server/services/generationExecutor.js` (montagem), `server/storage/localResultStorage.js` (persistência), `server/services/resultService.js` (`normalize()`, leitura). Persistido em `storage/results/<generation-id>/metadata.json` (formato atual, por diretório) ou `storage/results/<nome>.json` (formato legado, arquivo solto — ambos lidos pelo mesmo `resultService`).

| Campo | Tipo | Sempre presente? | Origem |
|---|---|---|---|
| `id`, `createdAt`, `status` | — | sim | Gerado no momento da geração |
| `promptVersion`, `model`, `requestedAspectRatio`, `effectiveAspectRatio`, `resolution`, `configurationId` | — | sim | `createGenerationProfile()`, a partir do perfil do Template (Fase 2) |
| `modelId` | string | sim | Modelo efetivamente usado |
| `inputTemplateId`, `inputTemplateLabel`, `inputTemplateMime`, `inputTemplateDimensions`, `inputTemplateValidation` | — | sim | Dados do Template usado (já existiam antes desta iniciativa) |
| **`templateCategory`** | string\|null | não | `template.category` — Fase 5 |
| **`inputTemplatePrompt`** | string\|null | não | `template.prompt` — Fase 5 |
| **`inputTemplateNegativePrompt`** | string\|null | não | `template.negativePrompt` — Fase 5 |
| **`additionalInstruction`** | string\|null | não | Informada na execução (individual ou congelada no lote) — Fase 5 |
| **`provider`** | string\|null | não | `template.provider` — Fase 5 |
| `inputGarmentMime`, `inputGarmentDimensions`, `inputGarmentValidation` | — | sim | Dados da roupa enviada |
| `outputMime`, `outputDimensions`, `durationMs`, `costUsd`, `providerRequestId` | — | sim | Resposta do provedor |
| `batchId`, `batchItemId` | string\|undefined | só quando a geração veio de um lote | `batchContext`, spread condicional em `generationExecutor.js` |
| `reviewStatus` | `'pending'`\|`'approved'`\|`'rejected'` | sim | Definido em `localResultStorage.save()` como `'pending'` por padrão, nunca outro valor na criação |
| Campos de Branding (`logoApplied`, `brandingStatus`, `logoFileName`, etc.) | — | sim | Já existiam antes desta iniciativa |

**`origin` — nunca persistido, sempre derivado na leitura** (`resultService.normalize()`):
```
origin = metadata.origin === 'batch' || metadata.origin === 'individual'
  ? metadata.origin
  : metadata.batchId ? 'batch' : 'individual'
```
Decisão deliberada: `origin` seria uma segunda fonte de verdade que poderia divergir de `batchId` por erro futuro — como já é 100% derivável, nunca é gravado como campo próprio (a checagem de `metadata.origin` explícito existe só como defesa, caso um Resultado futuro venha a gravá-lo por algum motivo).

**Nunca persistido, em nenhum Resultado, em nenhuma fase**: Base64, data URLs, imagem embutida, chave do OpenRouter, tokens, `Authorization`/headers do provedor, payload bruto de requisição/resposta. Confirmado por teste dedicado (`tests/server/generateImage.test.js`) que serializa a metadata gravada em disco e busca por esses padrões.

**Decisão de armazenamento do prompt**: só os componentes separados (`inputTemplatePrompt`, `inputTemplateNegativePrompt`, `additionalInstruction`, `promptVersion`) são persistidos — o texto final concatenado enviado ao provedor **nunca** é salvo, para não duplicar o texto fixo de `globalGenerationRules` em cada Resultado. O texto final é sempre reconstruível a partir desses componentes + a versão do código de `server/prompts/globalGenerationRules.js` (rastreável por `promptVersion`).

**Compatibilidade com Resultados antigos**: nenhuma migração em disco. `resultService.normalize()` aplica `?? null` em todo campo novo — um Resultado sem nenhum desses campos continua aparecendo, abrindo, permitindo download e aprovação/reprovação normalmente.

---

## 4. Relacionamentos

```
Template (catalog.json)
  │
  ├── geração individual: lido ao vivo a cada chamada (resolveTemplate)
  │     └── Resultado (metadata.json) — inputTemplateId, templateCategory, inputTemplatePrompt, ...
  │
  └── criação de um Lote: snapshot congelado em batch.json (imutável)
        └── cada item do lote, ao processar: validateSnapshot() lê o snapshot (nunca o Template atual)
              └── Resultado (metadata.json) — mesmos campos + batchId + batchItemId
```

Paridade garantida por teste (`tests/server/generationParity.test.js`): para o mesmo perfil de Template e a mesma `additionalInstruction`, a metadata persistida é idêntica entre o caminho individual e o de lote, exceto `origin`, `batchId`, `batchItemId`, `id`, `createdAt`, `durationMs`, `costUsd`, `providerRequestId` (que são legitimamente distintos por execução).

---

## 5. Semana de Marketing (`week.json`)

Fonte: `server/services/marketingService.js` (regras e montagem) e `server/repositories/localMarketingRepository.js` (persistência). Salvo em `storage/marketing/weeks/<week-id>/week.json`, com último estado válido anterior em `week.json.bak`.

| Campo | Tipo | Regra |
|---|---|---|
| `schemaVersion` | number | `1` na V1 |
| `id` | string | UUID gerado pelo backend |
| `weekStart` | `YYYY-MM-DD` | obrigatoriamente segunda-feira |
| `timezone` | string | sempre `America/Sao_Paulo` |
| `status` | `draft` \| `approved` \| `closed` | edição estrutural sempre volta para `draft`; `closed` bloqueia alterações de conteúdo, mas permite exclusão explícita da semana com confirmação |
| `createdAt`, `updatedAt` | ISO string | timestamps do backend |
| `approvedAt` | ISO string \| null | preenchido na aprovação |
| `closedAt` | ISO string \| null | preenchido no encerramento definitivo da semana |
| `stories` | array | ordenado por data, horário e `order` |

Cada Story contém: `id`, `sourceResultId`, `sourceAssetVariant` (`original`/`branded`), `sourceAssetFileName`, `productLabel`, `productKey`, `priority`, `category`, `categoryLabel`, `priceText`, `headline`, `ctaText`, `storyTemplateId`, `scheduledDate`, `scheduledTime`, `order`, `renderStatus` (`pending`/`ready`/`failed`), `editorialStatus` (`planned`/`ready`/`published`), `publishedAt`, `renderedAssetFileName`, `renderedAt`, `renderError`, `createdAt` e `updatedAt`. Após renderização válida, inclui `renderedDimensions: { width: 1080, height: 1920 }`.

`renderStatus` continua sendo o estado técnico do arquivo, enquanto `editorialStatus` representa a operação de publicação. Registros da Fase 7.1 sem os campos novos continuam compatíveis: a interface deriva `ready` quando o asset já está pronto e `planned` nos demais casos, sem reescrever obrigatoriamente o JSON antigo.

`sourceAssetFileName` aponta apenas para um nome interno relativo em `assets/sources/`; `renderedAssetFileName`, quando presente, aponta para `assets/stories/`. Nenhum caminho absoluto, Base64, data URL ou buffer é persistido no JSON.

O Marketing referencia `sourceResultId` para auditoria, mas usa a cópia local da fonte como autoridade visual histórica. Assim, excluir posteriormente o Resultado não quebra uma semana já criada e não altera o contrato do Resultado.

---

## 6. Onde validar este documento contra o código

Se este documento e o código divergirem, o código vence. Arquivos a conferir, nesta ordem:

1. `server/repositories/localTemplateRepository.js` — `createRecord()`, `assertRecord()` (Template).
2. `server/services/batchService.js` — `create()` (campos congelados no lote).
3. `server/repositories/localBatchRepository.js` — `readTemplate()` (o que chega ao executor).
4. `server/services/generationExecutor.js` — `execute()`, `resolveTemplate()`, `validateSnapshot()` (metadata do Resultado).
5. `server/services/resultService.js` — `normalize()` (o que a API/UI realmente expõe).
6. `server/services/marketingService.js` e `server/repositories/localMarketingRepository.js` — Semana e Story.
