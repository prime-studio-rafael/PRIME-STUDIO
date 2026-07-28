# Fase 8.0 — Recomendação Inteligente de Estilo Visual

Estado: **encerrada localmente; push aguarda autorização explícita**.

## Objetivo

Oferecer uma sugestão opcional de Estilo Visual para o Story Composer sem criar estilo, contrato visual ou campo persistido novo.

## Arquitetura híbrida

- O ranking local determinístico sempre calcula uma recomendação válida usando categoria, objetivo, tom, prioridade e presença de preço informado.
- DeepSeek é opcional e só pode ordenar e justificar os três estilos elegíveis calculados localmente.
- Sem chave, modelo, rede, timeout ou resposta válida da IA, a API devolve a **Sugestão local**.
- Cancelamento explícito interrompe a chamada e não aplica fallback automaticamente.
- Não há retry, chamada em segundo plano, envio de imagem ou persistência da resposta.

## Catálogo e aplicação

`shared/storyVisualStyleSpec.js` permanece como fonte única dos estilos PRIME Store, Luxury, Minimal, Offer e Editorial. O catálogo preserva `recommendedFor` como texto de interface e adiciona sinais normalizados para ranking: categorias, objetivos, tons, preferência de prioridade e ênfase de preço.

Ao aplicar qualquer recomendação, o Composer reutiliza `applyStoryVisualStyle()` para preencher somente `storyTemplateId`, `typographyPreset`, `logoMode` e `logoSize`. Preview atualiza localmente, um render anterior fica desatualizado e os controles continuam editáveis. `visualStyleId`, motivo, origem e recomendação completa não são persistidos.

## Segurança e compatibilidade

- A rota explícita `POST /api/marketing/style-recommendation` aceita somente contexto textual sanitizado.
- Não aceita imagem, Base64, caminhos, chave, token ou catálogo vindo do frontend.
- IDs retornados são validados contra o catálogo oficial; JSON inválido, IDs repetidos ou estilos desconhecidos usam fallback local.
- O renderer Sharp permanece sem lógica de recomendação e recebe somente os quatro campos visuais existentes.
- Stories antigos, Branding, tipografia, layouts, WebP/JPEG, Assistente textual, Templates, Resultados e Lotes permanecem compatíveis.

## Validação

- cenários locais premium, oferta, comunicação geral e dados incompletos aprovados, com desempate estável;
- DeepSeek simulado: resposta válida, ausência de chave, rede, timeout, cancelamento, JSON inválido, ID desconhecido e repetições aprovados;
- interface validada com botão explícito, loading, cancelamento, alternativas, aplicação manual e aviso de recomendação desatualizada;
- inspeção visual desktop, tablet e mobile aprovada pelo usuário;
- suíte completa: **57 arquivos e 409 testes aprovados**;
- build de produção, `git diff --check` e links locais: **aprovados**;
- zero chamadas reais ao DeepSeek/OpenRouter e zero créditos externos.
