# PRIME STUDIO — Comece por aqui

Este documento existe para uma única finalidade: dizer a qualquer IA (Claude Code, Codex, ChatGPT ou qualquer IA futura) exatamente em qual ordem ler a documentação deste projeto antes de escrever a primeira linha de código, e onde estão as regras oficiais.

Se você é uma IA e está lendo isto pela primeira vez: **não implemente nada ainda**. Leia na ordem abaixo primeiro.

---

## Ordem de leitura

### 1. [`../AGENTS.md`](../AGENTS.md) — regras permanentes, leia primeiro

Filosofia do projeto, fluxo obrigatório de trabalho, regras não-negociáveis de segurança, arquitetura e precedência entre documentos. É genérico — não assume nenhuma ferramenta específica. Leia isto antes de qualquer outra coisa, porque ele define **como** você deve trabalhar neste repositório, independente do que for pedido.

### 2. [`DOCUMENTO-MESTRE.md`](./DOCUMENTO-MESTRE.md) — a autoridade oficial

Fonte oficial de escopo, arquitetura e ordem das fases. **Em caso de conflito entre qualquer documento e este, o Documento Mestre vence.** Diz o que é oficialmente verdade sobre o produto: o que foi decidido, o que está concluído, o que ainda não foi aprovado.

### 3. [`PROJECT_MASTER_CONTEXT.md`](./PROJECT_MASTER_CONTEXT.md) — o resumo executivo

Visão geral condensada: tecnologias, estrutura de diretórios, fluxo completo, componentes principais, decisões importantes e por quê, riscos conhecidos, pendências reais. Pense nele como "o que um engenheiro sênior te contaria em 15 minutos antes de você abrir o editor".

### 4. [`DATA_CONTRACT.md`](./DATA_CONTRACT.md) — o contrato de dados atual

Campo por campo: o que é um Template, um Lote (`batch.json`) e um Resultado (`metadata.json`) hoje, com tipos, defaults e onde cada campo é escrito/lido no código. Leia antes de tocar em qualquer um desses três contratos — eles evoluíram em várias fases e o código é a fonte de verdade, não a memória.

### 5. `../README.md` — como rodar o projeto

Instalação, comandos (`npm run dev`, `npm test`, `npm run build`), como configurar a chave do OpenRouter, e uma descrição funcional de cada tela.

### 6. Os documentos de fase, na ordem em que as funcionalidades foram construídas

Só leia estes se precisar entender o histórico ou o raciocínio detalhado por trás de uma decisão específica — o essencial já está em `PROJECT_MASTER_CONTEXT.md` e `DATA_CONTRACT.md`.

1. [`FASE-02A-IMPLEMENTACAO.md`](./FASE-02A-IMPLEMENTACAO.md) → [`FASE-02B-IMPLEMENTACAO.md`](./FASE-02B-IMPLEMENTACAO.md) → [`FASE-02-ENCERRAMENTO.md`](./FASE-02-ENCERRAMENTO.md)
2. [`FASE-03-IMPLEMENTACAO.md`](./FASE-03-IMPLEMENTACAO.md) — Templates Locais
3. [`FASE-04-IMPLEMENTACAO.md`](./FASE-04-IMPLEMENTACAO.md) — Resultados e Histórico Local
4. [`FASE-05-IMPLEMENTACAO.md`](./FASE-05-IMPLEMENTACAO.md) — Produção em Lotes (+ Fase 5.1, UX)
5. [`FASE-BRANDING-IMPLEMENTACAO.md`](./FASE-BRANDING-IMPLEMENTACAO.md) — Branding/Logo
6. [`FASE-6-IMPLEMENTACAO.md`](./FASE-6-IMPLEMENTACAO.md) — Biblioteca Profissional de Templates
7. [`FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md`](./FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md) — Perfil Completo de Geração por Template (5 fases)

**Atenção**: os itens 6 e 7 acima são **iniciativas diferentes**, apesar de nomes parecidos ("Fase 6" ≠ "Fases 1-5 do Perfil de Templates"). Até 21 de julho de 2026, o conteúdo do item 7 estava incorretamente registrado dentro do arquivo do item 6 — já foi separado, mas fique atento se encontrar referências antigas a essa mistura.

### 7. [`HISTORICO.md`](./HISTORICO.md) — linha do tempo consolidada

Útil como índice cronológico rápido, mas não é a fonte de detalhes técnicos — para isso, use os documentos de fase (item 6) ou `DATA_CONTRACT.md`.

---

## Onde estão as regras oficiais

| Preciso saber... | Consulte |
|---|---|
| Como devo me comportar/trabalhar neste repositório | [`../AGENTS.md`](../AGENTS.md) |
| Se uma funcionalidade já foi decidida/aprovada | [`DOCUMENTO-MESTRE.md`](./DOCUMENTO-MESTRE.md) |
| O que já existe hoje, resumido | [`PROJECT_MASTER_CONTEXT.md`](./PROJECT_MASTER_CONTEXT.md) |
| O formato exato de um dado (Template/Lote/Resultado) | [`DATA_CONTRACT.md`](./DATA_CONTRACT.md) |
| Como rodar/testar o projeto | `../README.md` |
| O raciocínio histórico de uma decisão específica | O documento de fase correspondente |

## Como iniciar uma tarefa neste projeto

1. Leia os documentos 1-4 acima (nessa ordem), mesmo que a tarefa pareça pequena.
2. Se a tarefa tocar um dos três contratos de dados (Template, Lote, Resultado), confirme contra o código atual — nunca contra a memória do que um documento disse, caso o próprio documento avise que pode estar desatualizado.
3. Siga o fluxo obrigatório descrito em `AGENTS.md` (Auditoria → Plano → Aprovação → Implementação → Validação → Documentação → Commit → Push) — não pule etapas mesmo que a tarefa pareça óbvia.
4. Ao concluir uma fase relevante, **atualize a documentação afetada antes do commit final** — isso é uma regra permanente do projeto (ver Documento Mestre e `AGENTS.md`). Uma fase não é considerada encerrada enquanto a documentação não refletir o estado real do código.
