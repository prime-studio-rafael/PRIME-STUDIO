# PRIME STUDIO — Fase 6: Biblioteca Profissional de Templates

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

> **Nota de reorganização (Fase de Consolidação da Documentação, 21 de julho de 2026)**: este arquivo documentava originalmente só a Biblioteca Profissional de Templates. Uma iniciativa posterior e maior — o **Perfil Completo de Geração por Template** (schema de prompt do Template, compositor de prompt, snapshot completo de lotes, interface e metadata de Resultados, em 5 fases) — havia sido registrada por engano como seções acrescentadas ao final deste mesmo arquivo. Todo esse conteúdo foi movido, sem perda de informação, para [FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md](./FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md). Este arquivo volta a tratar exclusivamente da Biblioteca Profissional de Templates.

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

