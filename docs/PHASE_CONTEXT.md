# PRIME STUDIO — PHASE CONTEXT

Documento vivo e compacto do estado atual do projeto. Não substitui `AGENTS.md` (regras), `DOCUMENTO-MESTRE.md` (escopo) ou `DATA_CONTRACT.md` (contratos), e não contém histórico narrativo.

## Estado atual

- Versão: MVP local evoluído até a Fase 8.1A — Dashboard Premium Mock Visual.
- Fase atual: Fase 8.1A — Dashboard Premium Mock Visual, encerrada localmente; publicação remota aguarda autorização explícita.
- Última fase concluída tecnicamente: Fase 8.1A — Dashboard Premium Mock Visual.
- Último estado funcional publicado: commit `b4187c8` (Fase 8.0).
- Próxima fase: não há fase de produto aprovada para início.

## Git

- Diretório esperado: `/Users/macbook/Projetos/PRIME-STUDIO`.
- Branch principal: `main`.
- Repositório esperado: `prime-studio-rafael/PRIME-STUDIO`.
- Conta GitHub esperada: `prime-studio-rafael`.
- Última sincronização conhecida: 28 de julho de 2026.
- Operações Git seguem o checklist de `AGENTS.md`; divergências bloqueiam commit e push.

## Módulos ativos

- Nova geração individual via OpenRouter.
- Templates, Resultados, Produção em Lotes e Branding locais.
- Marketing Studio: semanas, Stories, calendário, histórico, compositor visual, Assistente IA textual e Branding Inteligente.
- Configurações de IA: OpenRouter preservado e DeepSeek configurável; o Assistente usa o modelo selecionado pela configuração.
- Dashboard premium local: métricas, gráfico, timeline, donuts, saúde, fila e insights são mockados; a cotação USD→BRL é local e manual.

## Principais contratos

- Template, Lote e Resultado: `docs/DATA_CONTRACT.md`.
- Semana e Story: `server/services/marketingService.js` e `server/repositories/localMarketingRepository.js`.
- Contrato visual de Stories: `shared/storyLayoutSpec.js`, `shared/storyTextLayout.js`, `shared/storyTypographySpec.js` e `shared/storyVisualStyleSpec.js`.
- WebP interno e JPEG 1080×1920 são derivados da mesma composição Sharp.
- Story: `logoMode` (`auto`/`primary`/`white`) e `logoSize` (`small`/`medium`/`large`) são aditivos; Stories legados usam `auto` + `medium` na leitura.
- Story: `typographyPreset` é aditivo; valores permitidos são `premium`, `moderno`, `elegante` e `impacto`; Stories legados usam `premium` na leitura. As fontes TTF locais são compartilhadas por preview React/CSS e Sharp; Bebas Neue é restrita a headline e preço no preset Impacto.
- Estilos Visuais: `shared/storyVisualStyleSpec.js` orquestra cinco combinações oficiais de layout, tipografia, variante e tamanho de logo. O estilo ativo é derivado exclusivamente dos quatro campos persistidos; `visualStyleId` e `recommendedFor` não são persistidos.
- Recomendação de estilo: `server/services/storyStyleRecommendationService.js` combina ranking local obrigatório e DeepSeek opcional; `POST /api/marketing/style-recommendation` não persiste a recomendação e nunca envia imagem.
- Cotação do Dashboard: `usdToBrlRate` é uma preferência local em `storage/settings/ai-providers.json`; não altera custos USD, não integra câmbio e não sai do computador.
- Branding: logos `primary` e `white` são independentes; `offer` em modo automático prioriza a branca e faz fallback honesto para a principal quando ela não existe.
- Sugestões textuais: `server/services/storySuggestionsService.js` e `POST /api/marketing/suggestions`.
- Contratos existentes são aditivos e compatíveis com registros antigos.

## Principais endpoints

- Geração: `/api/config`, `/api/templates`, `/api/generations`.
- Resultados: `/api/results`.
- Lotes: `/api/batches`.
- Branding: `/api/branding`.
- Marketing: `/api/marketing`.
- IA e configuração local: `/api/secrets/openrouter` e `/api/ai/providers` (inclui cotação manual do Dashboard).

## Dependências críticas

React, Vite, Tailwind CSS, Node.js, Express, `sharp`, `multer`, Keychain do macOS e Vitest. As fontes do Story são TTFs locais em `src/assets/fonts/`. Não adicionar banco, autenticação, Docker, nuvem ou provedor externo fora do escopo aprovado.

## Arquivos principais

- SPA: `src/app/App.jsx`.
- Dashboard: `src/features/dashboard/` e `src/features/settings/components/DashboardSettingsPanel.jsx`.
- Geração: `server/services/generationExecutor.js` e `generateImage.js`.
- Templates: `src/features/templates/` e `server/services/templateService.js`.
- Resultados: `src/features/results/` e `server/services/resultService.js`.
- Lotes: `src/features/batches/`, `batchService.js` e `batchQueue.js`.
- Marketing: `src/features/marketing/`, `marketingService.js`, `storyRenderer.js`, `storyTypographyFonts.js`, `storyStyleRecommendationService.js` e os contratos `shared/story*`.
- IA: `src/features/settings/` e `server/services/aiSettingsService.js`.
- Persistência: `server/repositories/` e `storage/` (ignorado pelo Git).

## Pendências aprovadas

- Backlog visual futuro do Marketing Studio: evoluir o layout Luxury para uma percepção de luxo mais marcante; evoluir Editorial para linguagem de revista; ampliar Estilos Visuais com novos presets somente após aprovação explícita, preservando edição manual posterior.

## Fora do escopo

Publicação automática, Buffer, banco, Supabase, autenticação, nuvem, editor livre, drag-and-drop, roteamento automático entre provedores e novas telas sem aprovação.

## Documentos adicionais por tarefa

- Geração: `docs/DATA_CONTRACT.md` e serviços atuais de geração.
- Templates, Resultados ou Batch: contrato de dados e arquivos atuais do módulo.
- Branding: documento da fase e `src/features/branding/`.
- Marketing: documento da fase aplicável e arquivos atuais do Marketing.
- IA/Settings: documento da Fase 7.3 e arquivos atuais de Settings.

## Documentos históricos

`docs/HISTORICO.md` e `docs/FASE-*` não devem ser relidos automaticamente. Consulte-os apenas para regressão, decisão antiga, migração ou solicitação explícita.

## Última sincronização

28 de julho de 2026. Fase 8.1A encerrada localmente; atualizar este arquivo ao concluir fase, alterar arquitetura, contrato, módulo ativo ou pendência aprovada.
