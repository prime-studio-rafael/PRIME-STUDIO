# PRIME STUDIO — PHASE CONTEXT

Documento vivo e compacto do estado atual do projeto. Não substitui `AGENTS.md` (regras), `DOCUMENTO-MESTRE.md` (escopo) ou `DATA_CONTRACT.md` (contratos), e não contém histórico narrativo.

## Estado atual

- Versão: MVP local evoluído até a Fase 7.7 — Sistema Tipográfico Premium.
- Fase atual: Fase 7.7 validada tecnicamente; aguardando commit e autorização explícita de push.
- Última fase concluída tecnicamente: Fase 7.7 — Sistema Tipográfico Premium.
- Último estado funcional publicado: commit `6a76d1d` (Fase 7.6).
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

## Principais contratos

- Template, Lote e Resultado: `docs/DATA_CONTRACT.md`.
- Semana e Story: `server/services/marketingService.js` e `server/repositories/localMarketingRepository.js`.
- Contrato visual de Stories: `shared/storyLayoutSpec.js`, `shared/storyTextLayout.js` e `shared/storyTypographySpec.js`.
- WebP interno e JPEG 1080×1920 são derivados da mesma composição Sharp.
- Story: `logoMode` (`auto`/`primary`/`white`) e `logoSize` (`small`/`medium`/`large`) são aditivos; Stories legados usam `auto` + `medium` na leitura.
- Story: `typographyPreset` é aditivo; valores permitidos são `premium`, `moderno`, `elegante` e `impacto`; Stories legados usam `premium` na leitura. As fontes TTF locais são compartilhadas por preview React/CSS e Sharp; Bebas Neue é restrita a headline e preço no preset Impacto.
- Branding: logos `primary` e `white` são independentes; `offer` em modo automático prioriza a branca e faz fallback honesto para a principal quando ela não existe.
- Sugestões textuais: `server/services/storySuggestionsService.js` e `POST /api/marketing/suggestions`.
- Contratos existentes são aditivos e compatíveis com registros antigos.

## Principais endpoints

- Geração: `/api/config`, `/api/templates`, `/api/generations`.
- Resultados: `/api/results`.
- Lotes: `/api/batches`.
- Branding: `/api/branding`.
- Marketing: `/api/marketing`.
- IA: `/api/secrets/openrouter` e `/api/ai/providers`.

## Dependências críticas

React, Vite, Tailwind CSS, Node.js, Express, `sharp`, `multer`, Keychain do macOS e Vitest. As fontes do Story são TTFs locais em `src/assets/fonts/`. Não adicionar banco, autenticação, Docker, nuvem ou provedor externo fora do escopo aprovado.

## Arquivos principais

- SPA: `src/app/App.jsx`.
- Geração: `server/services/generationExecutor.js` e `generateImage.js`.
- Templates: `src/features/templates/` e `server/services/templateService.js`.
- Resultados: `src/features/results/` e `server/services/resultService.js`.
- Lotes: `src/features/batches/`, `batchService.js` e `batchQueue.js`.
- Marketing: `src/features/marketing/`, `marketingService.js`, `storyRenderer.js`, `storyTypographyFonts.js` e os contratos `shared/story*`.
- IA: `src/features/settings/` e `server/services/aiSettingsService.js`.
- Persistência: `server/repositories/` e `storage/` (ignorado pelo Git).

## Pendências aprovadas

Nenhuma pendência de produto aprovada para implementação neste momento. A Fase 7.7 aguarda somente commit e publicação explícita.

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

28 de julho de 2026. Fase 7.7 validada localmente; atualizar este arquivo ao concluir fase, alterar arquitetura, contrato, módulo ativo ou pendência aprovada.
