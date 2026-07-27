# Fase 7.3 — Configurações de IA e DeepSeek

Estado: **implementada e validada tecnicamente em 21 de julho de 2026; aguardando aprovação para commit e push**.

## Entrega

- Configurações reorganizadas em Inteligência Artificial → Visão geral, OpenRouter e DeepSeek, preservando o acesso existente a Branding.
- Visão geral segura com finalidade, configuração, modelo e último teste bem-sucedido.
- OpenRouter preservado com os mesmos endpoints, Keychain prioritário e `.env` como fallback.
- DeepSeek preparado exclusivamente para futuros textos criativos de Stories, sem geração de texto nesta fase.
- Único modelo permitido: `deepseek-v4-flash`, conforme o modelo disponível na conta DeepSeek da PRIME STORE.
- Chave DeepSeek guardada somente no Keychain (`PRIME_IA_STUDIO_DEEPSEEK` / `local-user`), sem fallback `.env`.
- Teste manual executará uma única consulta `GET /models`, com timeout, zero retry e sem geração de conteúdo.
- Metadados não sensíveis em `storage/settings/ai-providers.json`, com backup e escrita atômica; `configured` é sempre derivado do Keychain.

## Segurança

Nenhuma chave é devolvida ao frontend, persistida em JSON, enviada ao `localStorage`, registrada em logs, incluída em `week.json` ou versionada. O catálogo de provedores de IA configuráveis é separado do catálogo de providers dos Templates, portanto DeepSeek não se torna provedor de geração de imagens.

## Validação

- 51 arquivos e 341 testes simulados aprovados.
- Build Vite aprovado com 1.830 módulos transformados.
- Visão geral, OpenRouter, DeepSeek e Branding preservado validados pela interface.
- Desktop 1440×900 e mobile 390×844 aprovados, sem overflow horizontal; modal com rolagem interna no mobile.
- Nenhuma chave real testada, nenhuma chamada ao DeepSeek/OpenRouter e nenhum crédito consumido.

## Fora do escopo

- geração de textos;
- integração do DeepSeek ao Marketing Studio;
- Gemini, Claude ou modelos locais;
- fallback e roteamento automático;
- orçamento complexo;
- alteração do pipeline de geração de imagens.
