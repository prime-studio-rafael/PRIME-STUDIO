# PRIME STUDIO — Comece por aqui

Este documento existe para uma única finalidade: dizer a qualquer IA (Claude Code, Codex, ChatGPT ou qualquer IA futura) exatamente em qual ordem ler a documentação deste projeto antes de escrever a primeira linha de código, e onde estão as regras oficiais.

Se você é uma IA e está lendo isto pela primeira vez: **não implemente nada ainda**. Leia na ordem abaixo primeiro.

---

## Roteador de leitura incremental

### 1. [`../AGENTS.md`](../AGENTS.md) — regras permanentes, leia primeiro

Filosofia do projeto, fluxo obrigatório de trabalho, regras não-negociáveis de segurança, arquitetura, precedência entre documentos e auditoria obrigatória antes de operações Git. É genérico — não assume nenhuma ferramenta específica. Leia isto antes de qualquer outra coisa, porque ele define **como** você deve trabalhar neste repositório, independente do que for pedido.

### 2. [`PHASE_CONTEXT.md`](./PHASE_CONTEXT.md) — estado vivo e compacto

Leia sempre depois do `AGENTS.md`. Ele informa fase, módulos, arquivos principais, contratos, pendências e o contexto adicional necessário para cada tipo de tarefa.

### 3. [`DOCUMENTO-MESTRE.md`](./DOCUMENTO-MESTRE.md) — a autoridade oficial

Fonte oficial de escopo, arquitetura e ordem das fases. **Em caso de conflito entre qualquer documento e este, o Documento Mestre vence.** Diz o que é oficialmente verdade sobre o produto: o que foi decidido, o que está concluído, o que ainda não foi aprovado.

### 4. [`PROJECT_MASTER_CONTEXT.md`](./PROJECT_MASTER_CONTEXT.md) — o resumo executivo

Visão geral condensada: tecnologias, estrutura de diretórios, fluxo completo, componentes principais, decisões importantes e por quê, riscos conhecidos, pendências reais. Pense nele como "o que um engenheiro sênior te contaria em 15 minutos antes de você abrir o editor".

### 5. [`DATA_CONTRACT.md`](./DATA_CONTRACT.md) — o contrato de dados atual

Campo por campo: o que é um Template, um Lote (`batch.json`) e um Resultado (`metadata.json`) hoje, com tipos, defaults e onde cada campo é escrito/lido no código. Leia antes de tocar em qualquer um desses três contratos — eles evoluíram em várias fases e o código é a fonte de verdade, não a memória.

### 6. `../README.md` — como rodar o projeto

Instalação, comandos (`npm run dev`, `npm test`, `npm run build`), como configurar a chave do OpenRouter, e uma descrição funcional de cada tela.

### 7. Documentos adicionais conforme o tipo da tarefa

Não leia todos os documentos de fase. Use somente o documento indicado pelo `PHASE_CONTEXT.md` para o módulo em questão. Consulte os documentos históricos apenas para regressão, migração, decisão antiga ou solicitação explícita.

1. Marketing: documento da fase aplicável e arquivos atuais do Marketing.
2. IA/Settings: `FASE-07-3-CONFIGURACOES-IA.md` e arquivos atuais de Settings.
3. Templates, Resultados ou Batch: contrato de dados e arquivos atuais do módulo.
4. Branding: documento de Branding e arquivos atuais de Branding.
5. Geração: contrato de dados e serviços atuais de geração.

### 8. [`HISTORICO.md`](./HISTORICO.md) — linha do tempo consolidada

Histórico cronológico. Não leia automaticamente; consulte somente quando necessário.

---

## Onde estão as regras oficiais

| Preciso saber... | Consulte |
|---|---|
| Como devo me comportar/trabalhar neste repositório | [`../AGENTS.md`](../AGENTS.md) |
| Qual é o estado vivo atual | [`PHASE_CONTEXT.md`](./PHASE_CONTEXT.md) |
| Se uma funcionalidade já foi decidida/aprovada | [`DOCUMENTO-MESTRE.md`](./DOCUMENTO-MESTRE.md) |
| O que já existe hoje, resumido | [`PROJECT_MASTER_CONTEXT.md`](./PROJECT_MASTER_CONTEXT.md) |
| O formato exato de um dado (Template/Lote/Resultado) | [`DATA_CONTRACT.md`](./DATA_CONTRACT.md) |
| Como rodar/testar o projeto | `../README.md` |
| O raciocínio histórico de uma decisão específica | O documento de fase correspondente |

## Como iniciar uma tarefa neste projeto

1. Leia `AGENTS.md` e `PHASE_CONTEXT.md`.
2. Escolha somente os documentos adicionais necessários para o tipo da tarefa.
3. Se a tarefa tocar um contrato, confirme contra o código atual e `DATA_CONTRACT.md`.
4. Siga o fluxo obrigatório descrito em `AGENTS.md`.
5. Ao concluir uma fase, atualize `PHASE_CONTEXT.md` e a documentação afetada antes de solicitar commit.
