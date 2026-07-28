# PRIME STUDIO — Histórico do projeto

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

## Fase 1 — MVP local funcional

Estado: concluída.

O projeto estabeleceu a aplicação React + Vite, o backend Node + Express, a integração local com OpenRouter, a proteção da chave no Chaves do macOS, o fluxo de geração de uma roupa superior, o salvamento local e os testes simulados. Uma primeira geração real confirmou o funcionamento da infraestrutura antes das melhorias de qualidade.

## Fase 02A — Prompt, referências e metadados

Estado: concluída.

Foram consolidados o prompt `upper-garment-v2`, o snapshot imutável das referências, os bloqueios durante a geração, os metadados técnicos ampliados e a rubrica oficial de qualidade.

## Fase 02B — Templates e validação de imagens

Estado: concluída.

Foram consolidados os templates canônicos locais, a política compartilhada de imagens, as validações de integridade, MIME, formato, extensão, dimensões, proporção e orientação, além do feedback técnico do upload. A proporção 4:5 permaneceu bloqueada e registrada como melhoria futura.

## 16 de julho de 2026 — Encerramento oficial da Fase 2

Estado: **concluída e aprovada**.

- geração real controlada: sucesso;
- modelo: `google/gemini-3.1-flash-lite-image`;
- resolução: `1K`;
- proporção efetiva: `1:1`;
- prompt: `upper-garment-v2`;
- chamadas ao OpenRouter: 1;
- retries: 0;
- custo: US$ 0,034351;
- duração da geração: 7,077 segundos;
- nota da rubrica: 92/100;
- avaliação técnica: aprovada;
- avaliação visual do usuário: aprovada;
- testes finais: 63/63 aprovados;
- build final: aprovado.

Evidências detalhadas: [FASE-02-ENCERRAMENTO.md](./FASE-02-ENCERRAMENTO.md).

## Fase 3 — Templates Locais

Estado: **concluída, validada e publicada em 16 de julho de 2026**.

CRUD completo de templates locais (criar, editar, substituir imagem, duplicar, ativar/desativar, excluir com proteção do último template válido), armazenamento em `storage/templates/` com escrita atômica, backup e recuperação, bootstrap dos templates seed `model-01`/`model-02`. 95 testes aprovados em 23 arquivos. Detalhes: [FASE-03-IMPLEMENTACAO.md](./FASE-03-IMPLEMENTACAO.md).

## Fase 4 — Resultados e Histórico Local

Estado: **concluída oficialmente em 16 de julho de 2026**.

View Resultados com listagem, filtros (Todos/Aguardando aprovação/Aprovados/Reprovados), aprovação/reprovação persistente, exclusão, e preservação local de resultado + template + roupa para comparação histórica. 108 testes aprovados em 26 arquivos. Detalhes: [FASE-04-IMPLEMENTACAO.md](./FASE-04-IMPLEMENTACAO.md).

## Fase 5 — Produção em Lotes

Estado: **concluída oficialmente em 17 de julho de 2026**.

Criação de lotes com um template e várias roupas, fila sequencial com concorrência global 1 e zero retry, pausa/retomada/cancelamento, vínculo dos resultados por `batchId`/`batchItemId`. Validação real com lote de 8 roupas (8/8 concluídos, custo real ≈ US$ 0,28). 124 testes aprovados em 28 arquivos. Detalhes: [FASE-05-IMPLEMENTACAO.md](./FASE-05-IMPLEMENTACAO.md).

### Fase 5.1 — UX Enterprise da Produção em Lotes

Estado: **implementada em 17 de julho de 2026**.

Melhoria exclusivamente visual da tela Produção em Lotes (resumo compacto, tabela operacional de itens, progresso visual honesto por status, responsividade em 3 camadas), sem nenhuma alteração de regra de negócio. 136 testes aprovados em 29 arquivos. Detalhes: [FASE-05-IMPLEMENTACAO.md](./FASE-05-IMPLEMENTACAO.md).

## Branding/Logo — Aplicação Automática de Marca

Estado: **concluído oficialmente (MVP) em 17 de julho de 2026**.

Upload e aprovação explícita de logo PNG, aplicação por composição local (sem IA) em 9% da menor dimensão e 3% de margem no canto inferior direito, preview Original × Com logo, ZIP de aprovadas respeitando o Branding. 196 testes aprovados em 34 arquivos. Detalhes: [FASE-BRANDING-IMPLEMENTACAO.md](./FASE-BRANDING-IMPLEMENTACAO.md).

## Fase 6 — Biblioteca Profissional de Templates

Estado: **concluída oficialmente em 17 de julho de 2026**.

Categoria, tags e tooltip por template, schema v1→v2 migrado automaticamente, paginação/busca real consumida pela interface, nomes profissionais de `model-01`/`model-02`, preview Original × Com logo no Branding. 252 testes aprovados em 38 arquivos. Detalhes: [FASE-6-IMPLEMENTACAO.md](./FASE-6-IMPLEMENTACAO.md).

## Perfil Completo de Geração por Template (5 fases)

Estado: **as 5 fases concluídas e publicadas entre 17 e 21 de julho de 2026** — commits `ba361fd`, `d5d4e38`, `a63821b`, `47e0abd`, `91f6a0f`.

Iniciativa que deu a cada Template um perfil de geração completo (prompt, prompt negativo, provider, modelo, proporção, resolução), corrigindo a falha estrutural em que toda categoria de Template (inclusive tênis, bolsas etc.) usava o mesmo prompt fixo de "troca de camiseta". Cobriu, em ordem: schema do Template, compositor central de prompt, snapshot completo de lotes, interface de edição/badge/instrução adicional, e metadata completa e auditável no Resultado (com correção de um bug real de refresh na fila de aprovação). 309 testes aprovados em 41 arquivos ao final da quinta fase. Detalhes completos: [FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md](./FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md).

## Fase de Consolidação da Documentação

Estado: **concluída e publicada em 21 de julho de 2026** (`1791def`).

Reorganização e atualização de toda a documentação do projeto (sem nenhuma alteração de código, regra de negócio ou comportamento), para que o repositório seja autossuficiente para qualquer IA continuar o desenvolvimento sem depender de histórico de conversas. Criação de `docs/START_HERE.md`, `AGENTS.md`, `docs/PROJECT_MASTER_CONTEXT.md` e `docs/DATA_CONTRACT.md`; separação do conteúdo do Perfil Completo de Geração por Template para seu próprio documento; atualização de `README.md`, `DOCUMENTO-MESTRE.md` e deste `HISTORICO.md`.

## 21 de julho de 2026 — Encerramento documental definitivo da Fase 6

Estado: **concluído**.

Revisão final sem mudança funcional: alinhamento do escopo atual no README e no Documento Mestre, distinção entre uploads em memória e temporários em disco, atualização do estado da consolidação e identificação explícita de informações históricas superadas nos documentos das Fases 3, 4, 5 e Branding. O diretório gerado `graphify-out/` foi confirmado como artefato local de ferramenta e incluído no `.gitignore`.

## Fase 7 — Marketing Studio V1

Estado: **aprovada tecnicamente e renomeada Fase 7.1 — Fundação do Marketing Studio em 21 de julho de 2026; sem commit e push**.

Planejamento semanal local baseado somente em Resultados aprovados, com cópia preservada da fonte, identificação manual de produto, calendário, operação de Stories e histórico. Renderer determinístico com `sharp`, sem IA, gera WebP 1080×1920 em três layouts fixos, usando a logo aprovada e mantendo fonte/final separados. Persistência em `storage/marketing/` com JSON, backup, escrita atômica e proteção de caminhos. A fundação foi aprovada tecnicamente e preservada como base da evolução operacional. Nenhuma chamada ao OpenRouter e zero créditos. Detalhes: [FASE-07-IMPLEMENTACAO.md](./FASE-07-IMPLEMENTACAO.md).

## Fase 7.2 — Inteligência Operacional

Estado: **concluída e aprovada na validação final em 21 de julho de 2026**.

Extensão aditiva da fundação com proposta semanal determinística, prioridade, alternância de categorias, estados editoriais, próxima publicação, acesso ao Resultado, calendário e histórico enriquecidos e encerramento somente leitura. A validação final confirmou thumbnail, três layouts, persistência após reinício, remoção controlada da semana temporária, 330 testes aprovados em 46 arquivos, build e responsividade. Zero chamadas ao OpenRouter. Detalhes: [FASE-07-2-IMPLEMENTACAO.md](./FASE-07-2-IMPLEMENTACAO.md).

## Fase 7.3 — Configurações de IA e DeepSeek

Estado: **implementada e validada tecnicamente em 21 de julho de 2026; aguardando aprovação para commit e push**.

Configurações passou a reunir uma visão geral dos provedores, OpenRouter e DeepSeek. O OpenRouter foi preservado; o DeepSeek ganhou chave exclusiva no Keychain, modelo único `deepseek-v4-flash`, teste manual sem geração e metadata local sem segredos. A validação aprovou 341 testes em 51 arquivos, build e responsividade desktop/mobile. Nenhuma chave real foi testada, nenhuma chamada externa foi executada e nenhum crédito foi consumido. Detalhes: [FASE-07-3-CONFIGURACOES-IA.md](./FASE-07-3-CONFIGURACOES-IA.md).

## Fase 7.4 — Preview Visual e Compositor de Story

Estado: **implementada e validada tecnicamente em 27 de julho de 2026; aguardando aprovação para commit e push**.

O Marketing Studio ganhou um compositor local responsivo com preview React/CSS, layouts visuais, área segura do Instagram, contadores e avisos determinísticos de texto, além do modal de tamanho real. A especificação visual é compartilhada com o Sharp, que permanece autoritativo e gera WebP interno e JPEG 1080×1920 para upload manual a partir da mesma composição. Os novos campos são aditivos e Stories antigos continuam legíveis; qualquer edição estrutural invalida os dois derivados, e falhas parciais removem os artefatos recém-criados. Validação técnica: 347 testes em 53 arquivos e build aprovados, sem OpenRouter, DeepSeek ou crédito externo. Detalhes: [FASE-07-4-IMPLEMENTACAO.md](./FASE-07-4-IMPLEMENTACAO.md).

## Fase 7.5 — Assistente IA para textos de Stories

Estado: **concluída e publicada em 27 de julho de 2026**.

O Story Composer passou a oferecer três sugestões textuais por chamada explícita, com objetivo, tom e instrução adicional. O backend valida exatamente quatro campos por sugestão, limites de texto e proíbe condições comerciais inventadas. A validação real encontrou que `deepseek-chat` não estava disponível para a chave configurada; o serviço foi corrigido para consumir o modelo selecionado nas Configurações, `deepseek-v4-flash`, e uma nova conexão foi aprovada. Foi executada exatamente uma geração real de sugestões; nenhuma imagem foi enviada, nenhuma chamada ao OpenRouter foi feita e nenhum cenário temporário permaneceu no storage. Suíte final: 353 testes em 54 arquivos e build aprovados. Detalhes: [FASE-07-5-IMPLEMENTACAO.md](./FASE-07-5-IMPLEMENTACAO.md).

## Fase 7.6 — Branding Inteligente

Estado: **concluída tecnicamente em 27 de julho de 2026; publicação aguardando autorização explícita**.

Branding passou a manter logos principal e branca de forma independente. O compositor ganhou escolha de variante (`auto`, `primary`, `white`) e tamanho (`small`, `medium`, `large`), com seleção automática contextual, fallback seguro, bloqueio manual sem logo branca e compatibilidade completa com Stories e assets antigos. As quatro combinações de validação produziram WebP/JPEG 1080×1920, preservando proporção, posição fixa e área segura. Suíte final: 358 testes em 54 arquivos e build aprovados; zero OpenRouter, DeepSeek ou créditos externos. Detalhes: [FASE-07-6-IMPLEMENTACAO.md](./FASE-07-6-IMPLEMENTACAO.md).

## Fase 7.7 — Sistema Tipográfico Premium

Estado: **implementada e validada tecnicamente em 28 de julho de 2026; aguardando commit e push**.

O Story Composer recebeu quatro estilos tipográficos fechados: Premium/Manrope, Moderno/Inter, Elegante/Plus Jakarta Sans e Impacto/Bebas Neue. As fontes TTF são locais e o contrato é compartilhado pelo preview React/CSS, pelas regras de texto e pelo Sharp. Impacto utiliza Bebas Neue exclusivamente em headline e preço; CTA, subheadline e demais textos usam Inter. `typographyPreset` é aditivo, Stories legados assumem Premium e qualquer troca invalida WebP/JPEG até renderização explícita. A IA recebe somente o nome do preset e preserva suas quatro respostas. Validação final: 377 testes em 55 arquivos, build e `git diff --check` aprovados; zero chamadas ao OpenRouter ou DeepSeek e zero créditos externos. Detalhes: [FASE-07-7-IMPLEMENTACAO.md](./FASE-07-7-IMPLEMENTACAO.md).

## Fase 7.8 — Arquitetura dos Layouts Premium

Estado: **concluída e publicada em 28 de julho de 2026** (`c8e639c`).

A composição dos Stories passou a usar um catálogo compartilhado com Premium, Luxury, Minimal, Offer e Editorial. Preview React/CSS e Sharp consomem o mesmo contrato de regiões, paleta, limites de texto, miniaturas e comportamento de logo; `product-highlight` legado normaliza para Premium. A troca de layout mantém renderização explícita, invalida derivados e preserva WebP/JPEG 1080×1920. Detalhes: [FASE-07-8-IMPLEMENTACAO.md](./FASE-07-8-IMPLEMENTACAO.md).

## Fase 7.9 — Estilos Visuais

Estado: **concluída e publicada em 28 de julho de 2026** (`c8e639c`).

Foi incluída uma camada compartilhada de orquestração sobre a arquitetura da Fase 7.8, com cinco estilos: PRIME Store, Luxury, Minimal, Offer e Editorial. Cada estilo aplica apenas layout, tipografia, variante e tamanho de logo já existentes. O estado oficial é derivado por correspondência exata; ajustes manuais mostram `Personalizado`, sem persistir `visualStyleId` ou criar segunda fonte de verdade. `recommendedFor` é exclusivamente informativo. Preview e Sharp continuam usando os mesmos quatro campos, sem regra específica de estilo no renderer. A validação direcionada aprovou 61 testes; não houve chamadas ao OpenRouter, DeepSeek ou consumo de créditos. Detalhes: [FASE-07-9-IMPLEMENTACAO.md](./FASE-07-9-IMPLEMENTACAO.md).

## Fase 8.0 — Recomendação Inteligente de Estilo Visual

Estado: **encerrada localmente em 28 de julho de 2026; publicação remota aguarda autorização explícita**.

O Marketing Studio passou a recomendar estilos com ranking local obrigatório e DeepSeek opcional, sempre limitado ao catálogo oficial. A IA recebe apenas texto sanitizado e estilos elegíveis; respostas inválidas, ausência de chave, rede ou timeout retornam uma Sugestão local segura. A aplicação continua manual e somente preenche os quatro campos visuais já existentes, sem persistir `visualStyleId`, origem ou justificativa e sem alterar o Sharp. Validação final: 409 testes em 57 arquivos, build, links e `git diff --check` aprovados; zero chamadas reais ao DeepSeek/OpenRouter e zero créditos externos. Detalhes: [FASE-08-0-IMPLEMENTACAO.md](./FASE-08-0-IMPLEMENTACAO.md).

## Fase 8.1A — Dashboard Premium Mock Visual

Estado: **encerrada localmente em 28 de julho de 2026; publicação remota aguarda autorização explícita**.

Dashboard premium implementado como tela inicial, com KPIs, produção por dia, timeline, donuts, saúde, fila, insights e atalhos usando somente dados demonstrativos. A preferência local de cotação USD→BRL ganhou campo pt-BR em Configurações e persiste no mesmo armazenamento atômico de configurações, com backup. O custo USD permanece separado; o BRL é conversão local manual, sem API de câmbio, banco, OpenRouter ou DeepSeek. Validação direcionada: 26 testes em 8 arquivos e `git diff --check` aprovados. Detalhes: [FASE-08-1A-IMPLEMENTACAO.md](./FASE-08-1A-IMPLEMENTACAO.md).

## Fase 8.1B — Dashboard Premium com Dados Reais

Estado: **encerrada tecnicamente em 28 de julho de 2026; publicação remota depende de autorização explícita**.

O Dashboard passou a reutilizar Resultados e Lotes já carregados pela SPA, sem endpoint ou serviço novo. KPIs, tempo médio, IA principal, custos USD/BRL, lotes, fila e timeline agora são agregações locais reais; os insights são determinísticos. Custos aceitam apenas USD finito não negativo e a conversão BRL usa a cotação manual local, sem alterar o valor de origem. O gráfico, donuts, taxa consolidada e serviços sem fonte real mantêm estados honestos de demonstração, indisponibilidade ou monitoramento futuro. Desktop, tablet e mobile foram aprovados. Validação final: 430 testes em 59 arquivos, build, links e `git diff --check` aprovados; zero chamadas ao OpenRouter/DeepSeek e zero créditos externos. Detalhes: [FASE-08-1B-IMPLEMENTACAO.md](./FASE-08-1B-IMPLEMENTACAO.md).
