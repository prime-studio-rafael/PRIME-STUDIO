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
