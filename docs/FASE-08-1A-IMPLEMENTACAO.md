# Fase 8.1A — Dashboard Premium Mock Visual

Estado: **encerrada localmente; publicação remota ainda não autorizada**.

## Objetivo

Criar o Dashboard principal como uma camada de UX/UI premium, sem conectar analytics, banco, provedores de IA ou qualquer cotação externa.

## Entrega

- dashboard inicial com saudação, filtros Hoje/7 dias/30 dias, KPIs, gráfico mockado, timeline, donuts, saúde local, fila, insights e ações rápidas;
- KPIs de custo separados em USD e BRL: o custo USD continua mockado e imutável; BRL é calculado por `USD × cotação manual` e arredondado em duas casas;
- Configurações ganhou a aba Dashboard com campo `Cotação do dólar`, padrão `5,50`, entrada pt-BR e validação para valor positivo com até quatro casas;
- preferências persistem no mesmo repositório atômico já existente em `storage/settings/ai-providers.json`, com backup `.bak`; não há localStorage, banco ou nova arquitetura de persistência;
- UI cobre leitura local, cotação ausente/inválida e erro de leitura sem inventar conversão;
- nenhuma chamada ao OpenRouter, DeepSeek ou API de câmbio.

## Limites preservados

- produção, Resultados, Lotes, Templates, Stories, renderer e contratos de geração não foram alterados;
- `Sidebar.jsx` é alteração independente e permanece fora desta fase;
- os dados de produção, filas, saúde, timeline, donuts e insights são exclusivamente demonstrativos nesta etapa.

## Validação

- validação visual aprovada no navegador local do macOS;
- 8 arquivos de teste e 26 testes direcionados aprovados;
- `git diff --check` aprovado;
- suíte completa e build ficam para o encerramento posterior autorizado da fase.
