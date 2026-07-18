# PRIME STUDIO — Fase 6: Biblioteca Profissional de Templates

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

Estado: **concluída oficialmente em 17 de julho de 2026**.

> **Correção de aderência de 17 de julho de 2026**: a auditoria final apontou 4 pendências obrigatórias da entrega inicial desta fase (preview Original × Com logo ausente em Branding, model-01/model-02 ainda com nomes/categoria genéricos, paginação real não conectada às telas, `loading="lazy"` ausente em `TemplateCard`). Todas as quatro foram corrigidas nesta mesma fase, validadas visualmente (desktop e mobile) e aprovadas pelo usuário antes do encerramento — ver seções atualizadas abaixo.

## Objetivo

Transformar a feature de Templates num catálogo profissional organizado por categorias (👕 Moda Masculina, 👩 Moda Feminina, 👟 Tênis Masculino, 👟 Tênis Feminino, ⌚ Acessórios, 👜 Bolsas), com nomes profissionais, descrição, preview grande, tags, tooltip ao passar o mouse e arquitetura preparada para escalar a centenas ou milhares de templates — mantendo integralmente o Design System atual e sem quebrar nenhum ponto de integração existente (geração individual, Produção em Lotes, Resultados).

## Arquitetura

- **Categoria vive no schema do template** (`template.category`, uma FK string), não numa tabela separada de vínculos.
- **Catálogo de categorias fixo**: `server/catalogs/templateCategories.js`, arquivo estático versionado no código (mesmo padrão de `server/catalogs/templates.js`/`models.js`). Gestão de categorias via UI fica para uma fase futura.
- **`GET /api/templates/categories`** (novo endpoint, somente leitura) expõe essa lista para o frontend nunca hardcodar nomes/emojis.
- **Sem limite de negócio**: `TEMPLATE_LIMIT_REACHED` deixou de ser regra de produto. Existe apenas uma trava técnica de segurança bem alta (`DEFAULT_TEMPLATE_SAFETY_LIMIT = 5000`), documentada como proteção contra crescimento patológico, nunca como limite comunicado ao usuário.
- **Paginação/busca no contrato desde já**: `GET /api/templates` aceita `page`, `pageSize`, `search`, `category` opcionais. Sem parâmetros, o comportamento é idêntico ao anterior a esta fase (lista completa) — mantém compatibilidade total com `TemplatePicker`, o `<select>` de Produção em Lotes e a tela Templates.

## Schema (aditivo, migração automática)

`TEMPLATE_CATALOG_SCHEMA_VERSION` subiu de `1` para `2`. Um catálogo `v1` existente é migrado automaticamente e de forma idempotente na inicialização do servidor (escrita atômica, com backup), preenchendo os campos novos com defaults — nenhum registro é recriado, os IDs seed `model-01`/`model-02` permanecem estáveis.

Campos novos, sempre presentes no contrato de API (`publicTemplate()`), nunca removendo campos existentes:

- `category` (string, default `"sem-categoria"`);
- `tags` (`string[]`, normalizado: trim, minúsculas, sem duplicatas, até 8 tags de até 24 caracteres);
- `hoverDescription` (string curta opcional, até 160 caracteres — o texto do tooltip; cai no fallback de `description` quando ausente);
- `usageMetrics` (reservado para o futuro; sempre `null` nesta fase, nenhuma lógica de cálculo implementada).

## Interface

- **Templates (admin)**: nova barra de busca + chips de categoria (reaproveitando o padrão de pill já usado em `ResultCard`/`BatchItemRow`), badge de categoria e tags nos cards, ícone de "mais detalhes" (hover card) ao lado do nome, categoria/tags/tooltip editáveis no formulário de criação/edição.
- **Nova geração (`TemplatePicker`)**: mesma barra de busca/categoria quando há mais de um template; tags visíveis nos cards; tooltip nativo (`title`) com a descrição/hover description — sem aninhar elementos interativos dentro do card clicável.
- **Produção em Lotes**: o `<select>` de template agora agrupa as opções por categoria via `<optgroup>`.
- **Branding**: promovido de aba do modal de Configurações para uma view própria na sidebar (ver seção dedicada abaixo).

## Escalabilidade

A interface consome a paginação real do backend via `fetchTemplatesPage`: `TemplatesPage` e `TemplatePicker` carregam apenas a primeira página (`useTemplateLibraryPage`, 12 e 8 itens respectivamente) e usam um botão **"Carregar mais"** para buscar a próxima — nunca baixam o catálogo inteiro para filtrar no navegador. Busca e categoria são enviadas ao backend a cada mudança, que reinicia a paginação para a página 1 e descarta os itens acumulados; uma falha ao carregar uma página adicional preserva os itens já exibidos e mostra o erro junto ao botão, sem apagar nada. O botão desaparece quando não há mais páginas. A Produção em Lotes (`BatchesPage`) é a exceção deliberada e isolada: continua pedindo a lista completa de templates ativos, porque o `<select>` de criação de lote precisa de todas as opções de uma vez.

## model-01 e model-02 — nomes profissionais

Os dois templates seed nasciam com nomes e categoria genéricos (`"Modelo base 01/02"`, `sem-categoria`) — a primeira leva desta fase só preparou o schema, sem migrar o conteúdo. Uma correção dedicada (`server/repositories/localTemplateRepository.js`) resolve isso:

- **Instalações novas**: `bootstrapFromSeeds()` já grava `model-01` como *"Masculino Frontal — Clássico"* e `model-02` como *"Masculino Frontal — Logo Central"*, ambos em `moda-masculina`, com tags e `hoverDescription` reais.
- **Instalações já inicializadas** (como a deste ambiente de desenvolvimento): a cada `readCatalog()`, uma correção (`applyProfessionalSeedMetadata`) verifica se o registro ainda está **exatamente** como o bootstrap o criou (mesmo label, description e defaults de categoria/tags/hoverDescription do seed) — se sim, aplica os valores profissionais; caso contrário (usuário já editou manualmente qualquer um desses campos), o registro não é tocado. É idempotente: rodar de novo não altera nada, pois o registro corrigido deixa de bater com o teste "ainda genérico".
- Os IDs `model-01`/`model-02`, storage keys, bytes de imagem e todas as referências em resultados/lotes permanecem inalterados — só os metadados de catálogo mudam.

## Branding — promovido a view própria na sidebar

Decisão de UX incorporada a esta fase: Branding deixou de ficar escondido dentro do modal de Configurações.

- Novo item "Branding" na sidebar (`src/components/layout/Sidebar.jsx`), no mesmo nível de Nova geração/Templates/Resultados/Produção em Lotes.
- `BrandingPage.jsx` ganhou um `variant` (`'page'` para tela cheia, com cabeçalho consistente com as demais views; `'panel'`, o padrão anterior, mantido para compatibilidade). **Nenhuma lógica foi duplicada** — mesmo `useBranding`, mesmo `brandingClient`, mesmos endpoints `/api/branding/*`.
- O modal de Configurações mantém a aba "Branding" apenas como atalho de descoberta: um card com o botão "Ir para Branding", que fecha o modal e navega para a nova view.

## Branding — preview Original × Com logo

A view Branding mostra uma prévia real, lado a lado, com rótulos visíveis "Original" e "Com logo":

- **Original**: serve uma fotografia local já existente (o próprio template seed `model-01`) sem nenhum processamento.
- **Com logo**: reaproveita integralmente `applyLogoOverlay` (o mesmo módulo usado na geração real) para compor a logo aprovada sobre essa mesma fotografia — escala de 9%, margem de 3%, canto inferior direito, sempre local, sem IA.
- Um texto discreto explica o padrão: *"Prévia da aplicação: logo com escala de 9%, margem de 3% e posição inferior direita."*
- Novo endpoint somente leitura `GET /api/branding/preview?variant=original|branded` (`server/routes/branding.js`, `server/services/brandingService.js`); a variante `branded` responde `404 BRANDING_NO_APPROVED_LOGO` quando não há logo aprovada — a UI mostra, nesse caso, um estado vazio amigável no lugar do "Com logo".
- O preview funciona com Branding ligado ou desligado (independente do toggle) e sem logo aprovada; a imagem original nunca é alterada em disco. Nenhuma chamada ao OpenRouter, nenhuma geração, nenhum custo.

## Compatibilidade e testes

- 252 testes aprovados (38 arquivos), incluindo os 235 do fechamento inicial desta fase.
- Novos testes cobrem: migração de schema v1→v2 (idempotente, preserva campos já migrados), paginação/busca/filtro por categoria no repositório e no serviço, validação de categoria/tags/hoverDescription, endpoint de categorias, contrato de `GET /api/templates` com e sem query params, biblioteca de templates na tela admin (busca, filtro, categoria/tags no formulário, paginação real e "Carregar mais"), `TemplatePicker` com toolbar, filtro e paginação real, `<optgroup>` no `<select>` de lotes, a navegação de Branding pela sidebar e pelo atalho no modal, o preview Original × Com logo (com/sem logo, ligado/desligado), e a correção de nomes profissionais de model-01/model-02 (aplicação em instalação nova, em catálogo já inicializado, idempotência e preservação de personalização do usuário).
- Nenhum teste existente foi quebrado sem atualização intencional; os testes de contrato (`toEqual`/`toMatchObject` sobre o catálogo e a API) foram ajustados apenas onde o campo `schemaVersion` ou os nomes seed mudaram.

## Validação manual

- Templates (admin), Nova geração e Branding verificados visualmente em desktop e mobile, sem overflow horizontal, mantendo o Design System (slate/branco, `SectionCard`, ícones Lucide, badges no padrão já estabelecido).
- Fluxo de Branding confirmado com dados reais (logo aprovada da PRIME STORE): o preview "Com logo" mostra a marca real no canto inferior direito da fotografia de demonstração.
- `model-01`/`model-02` confirmados com os novos nomes profissionais no catálogo local já existente deste ambiente (correção aplicada a um catálogo real, não só a fixtures de teste).
- Nenhuma geração ou chamada ao OpenRouter durante a validação.

## Limitações intencionais desta fase

- categorias fixas, sem CRUD via UI (fica para fase futura);
- métricas de uso reais não implementadas (`usageMetrics` só reservado no schema);
- sem categorias aninhadas, sem reordenação por arrastar, sem virtualização de grid;
- sem importação/exportação em massa do catálogo;
- o preview de Branding usa uma única fotografia de demonstração fixa (`model-01`), não um seletor de imagem.

Nenhuma geração real foi executada e nenhuma chamada ao OpenRouter ocorreu durante esta implementação.

## Melhoria pós-encerramento — Perfil completo de geração por Template (Fase 1: schema, migração e validação)

Estado: **Fase 1 implementada em 17 de julho de 2026, aguardando aprovação do usuário para a Fase 2**. Não reabre nem reclassifica a Fase 6 acima, que permanece oficialmente concluída — esta é uma melhoria estrutural adicional, dividida em 5 fases, iniciada após uma auditoria real (com evidência de dados: `storage/templates/catalog.json`, `storage/results/`) ter confirmado que todo Template usava o mesmo prompt fixo de geração (`upper-garment-v2`), sem nenhum campo de prompt/negativePrompt/provider/modelo/proporção/resolução no schema do Template — inclusive um Template real da categoria "tenis-masculino" ("Tenis 9060"), que recebeu o prompt de troca de roupa da parte superior do corpo (moda masculina) por não haver diferenciação nenhuma por categoria.

Escopo desta Fase 1, restrito a schema + migração + validação (nenhuma alteração em `generationExecutor.js`, `batchService.js` ou no prompt efetivamente usado hoje pela geração real — isso é escopo das Fases 2 e 3, ainda não aprovadas):

- **Schema aditivo do Template** (`server/repositories/localTemplateRepository.js`): `prompt` (até 4000 caracteres), `negativePrompt` (até 2000), `provider` (validado contra `server/catalogs/providers.js`, novo catálogo com o único provider `openrouter`), `modelId` (validado contra `server/catalogs/models.js`), `generationAspectRatio` (`'1:1'`/`'4:5'`), `resolution` (`'1K'`) e `promptVersion` — todos opcionais e `null` por padrão, exceto `promptVersion`, que é obrigatório sempre que `prompt` estiver preenchido.
- **`promptVersion` determinístico**: calculado por hash SHA-256 truncado a 8 caracteres (`template-<hash>`) do conteúdo de `prompt` + `negativePrompt` + uma constante de versão das regras globais (`GLOBAL_RULES_VERSION`), usando `node:crypto` (sem dependência nova). Recalculado automaticamente em `create()`/`update()` sempre que `prompt`/`negativePrompt` mudam, exceto quando o chamador informa `promptVersion` explicitamente (usado apenas pela migração, para preservar o valor histórico `upper-garment-v2`).
- **Migração `schemaVersion` 2 → 3**: aditiva e idempotente, encadeada com a migração 1→2 já existente. Templates sem os novos campos ganham `null` em todos eles. `model-01`/`model-02` recebem, à parte (`TEMPLATE_GENERATION_PROFILE_MIGRATION`), o prompt histórico (a frase "Edite exclusivamente a roupa da parte superior do corpo..." — a única parte do prompt fixo atual que é específica de categoria; o restante do texto de `server/prompts/upperGarmentPrompt.js`, que descreve regras universais de fidelidade/identidade/segurança, permanece fora do Template e será tratado na Fase 2) e o `promptVersion` histórico `upper-garment-v2`, preservando compatibilidade com os Resultados já persistidos. Qualquer outra categoria (incluindo "Tenis 9060") migra sem nenhum prompt atribuído — nunca herda o prompt de outra categoria. A migração nunca sobrescreve um Template já configurado manualmente pelo usuário.
- **Validação de escrita** (`assertRecord`): rejeita `prompt`/`negativePrompt` vazios ou acima do limite, `provider`/`modelId`/`generationAspectRatio`/`resolution` fora dos valores válidos, e um `prompt` sem `promptVersion` correspondente.

Validação: 9 novos testes em `tests/server/localTemplateRepository.test.js` (perfil migrado de `model-01`/`model-02`, criação sem prompt nunca herdando outra categoria, hash determinístico e estável para o mesmo conteúdo, recomputo de `promptVersion` só quando `prompt`/`negativePrompt` mudam, migração 2→3 com defaults nulos, preservação de customização manual, idempotência em reinícios sucessivos, rejeição de valores inválidos e de `prompt` sem `promptVersion`). Suíte completa: **270 testes aprovados**, `npm run build` aprovado, `git diff --check` limpo. Nenhuma geração real ou chamada ao OpenRouter foi executada.

Próximas fases já planejadas, aguardando aprovação individual antes de cada implementação: Fase 2 (compositor central de prompt e integração no `GenerationExecutor`, com a separação definitiva `templatePrompt`×`globalRules`), Fase 3 (snapshot completo do perfil em lotes), Fase 4 (campos no formulário de Templates e "Instrução adicional desta geração"), Fase 5 (metadata do Resultado, testes de regressão da fila de aprovação, documentação e validação final).
