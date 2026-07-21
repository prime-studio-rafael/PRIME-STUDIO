# PRIME STUDIO — Regras permanentes para qualquer IA

Este documento é genérico: aplica-se a qualquer IA que trabalhe neste repositório (Claude Code, Codex, ChatGPT, ou qualquer IA futura), independente da ferramenta usada para executá-la. Não substitui o [Documento Mestre](docs/DOCUMENTO-MESTRE.md) — define **como** trabalhar aqui, nunca **o que** já foi decidido sobre o produto.

Se você é uma IA lendo isto pela primeira vez, comece por [docs/START_HERE.md](docs/START_HERE.md) para a ordem completa de leitura da documentação.

---

## 1. Filosofia do projeto

O PRIME STUDIO é um protótipo local de baixo risco: o objetivo é provar um fluxo funcional com custo e escopo controlados, não construir uma plataforma. Isso significa:

- Prefira soluções simples e explícitas a abstrações antecipadas para necessidades hipotéticas.
- Reutilize o que já existe (componentes, hooks, padrões de arquitetura) antes de criar algo novo.
- Mudanças são aditivas por padrão — estender é seguro, quebrar compatibilidade é uma regressão que exige justificativa explícita e aprovação.
- Nenhuma decisão de produto é tomada de forma autônoma; toda ambiguidade real deve ser levada ao usuário, não resolvida por suposição.

## 2. Fluxo obrigatório de trabalho

Toda tarefa não-trivial segue este ciclo, nesta ordem:

**Auditoria → Plano → Aprovação do usuário → Implementação → Validação → Documentação → Commit → Push.**

Regras deste fluxo:

- Nunca implementar código durante uma tarefa marcada como auditoria ou planejamento, mesmo que a solução pareça óbvia.
- Uma auditoria deve se basear no código e nos dados reais do projeto, nunca em memória de conversas anteriores ou suposição sobre o que "provavelmente" existe.
- Commit e push só acontecem depois de uma aprovação explícita e separada do usuário sobre o relatório entregue — nunca encadeados automaticamente após a implementação.
- Cada fase ou correção tem seu próprio ciclo completo; não adiantar trabalho de uma fase futura sem pedido explícito.
- Uma fase não é considerada encerrada enquanto a documentação oficial não refletir exatamente o estado atual do código (ver seção 9).

## 3. Ordem de precedência em caso de conflito

1. Pedido atual e explícito do usuário nesta conversa.
2. [`docs/DOCUMENTO-MESTRE.md`](docs/DOCUMENTO-MESTRE.md) — fonte oficial de escopo e arquitetura.
3. Este documento (`AGENTS.md`) e as regras permanentes equivalentes de qualquer ferramenta específica.
4. Bases de conhecimento genéricas de UI/UX ou de engenharia, sem contexto do produto.
5. Recomendações genéricas de boas práticas.

Nenhum documento, ferramenta ou recomendação genérica pode substituir uma decisão atual e explícita do usuário. Uma aprovação dada para uma ação específica não se estende a outra ação futura, mesmo que semelhante.

## 4. Arquitetura

- **Frontend**: feature folders — `src/features/<feature>/{api,hooks,components}`. Uma SPA sem router de rotas; a navegação entre views é feita por estado em `src/app/App.jsx`.
- **Backend**: em camadas — `server/routes` (finas, sem regra de negócio) → `server/services` (regras de negócio) → `server/repositories` (única porta de acesso a storage em disco) → `server/catalogs` (dados estáticos versionados em código: seeds, categorias, providers, modelos).
- **Pipeline de geração único**: geração individual e Produção em Lotes sempre passam pelo mesmo `server/services/generationExecutor.js` — nunca duplicar o pipeline de geração ou criar uma variante paralela.
- **Contratos de dados são aditivos**: nunca remover ou renomear um campo já persistido ou retornado por uma API; estender é seguro, quebrar é regressão. Ver [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) para o contrato atual de Template, Lote e Resultado.
- Antes de criar um componente, hook, util ou serviço novo, procure um equivalente já existente para reaproveitar.

## 5. Segurança (não negociável)

- A chave do provedor de geração (hoje o OpenRouter) nunca é exposta ao navegador, nunca é logada, nunca aparece em mensagens de erro.
- Base64, data URLs, imagens embutidas e payloads/respostas brutas de um provedor externo nunca são persistidos em log ou metadata — só os bytes finais e metadados mínimos.
- Todo upload é validado por assinatura de arquivo, MIME e extensão antes de ser aceito — nunca confiar só na extensão declarada.
- Exatamente uma chamada ao provedor por geração; zero retry automático.
- Nenhuma chamada paga acontece sem confirmação explícita de créditos pelo usuário na interface, e essa validação deve ocorrer antes de qualquer lock de concorrência ou I/O custoso.
- Concorrência global de geração é sempre 1 (trava única compartilhada entre geração individual e lotes).
- Toda escrita em disco é atômica (arquivo temporário + rename), com backup quando aplicável.
- Caminhos de storage nunca são resolvidos a partir de entrada do usuário sem sanitização (proteção contra path traversal).
- `storage/` é sempre ignorado pelo controle de versão — nunca deve aparecer como candidato a commit.

## 6. Compatibilidade

- Qualquer migração de schema deve ser aditiva e idempotente, nunca destrutiva — rodar a migração duas vezes deve produzir o mesmo resultado que rodar uma vez.
- Registros/dados antigos (Templates, Lotes, Resultados de fases anteriores) continuam sendo lidos e exibidos sem quebra — normalização tolerante na leitura, nunca reescrita obrigatória em disco.
- Nunca criar uma segunda fonte de verdade para um dado já derivável de outro campo existente (ex.: a origem de um Resultado nunca é gravada — é sempre calculada a partir da presença de um identificador de lote).
- Nunca aplicar um fallback "por suposição" quando um dado obrigatório estiver ausente — bloquear com uma mensagem clara é sempre preferível a inferir silenciosamente (esta foi a causa raiz de um bug estrutural real já corrigido no projeto: um Template sem prompt configurado recebendo, por suposição, o prompt de outra categoria).

## 7. Padrões de implementação

- Escreva testes proporcionais ao tamanho da mudança — não adicione cobertura desnecessária, não deixe uma lacuna óbvia sem teste.
- Prefira nomes de campo que descrevam o dado com precisão, mesmo que isso signifique não reutilizar um nome já usado para outro conceito (ex.: um campo de proporção de geração recebeu um nome diferente do campo de proporção real de uma imagem, porque os dois coexistem no mesmo registro).
- Documente decisões não óbvias perto de onde elas se aplicam (comentário no código) e, quando relevantes para o produto, também no documento de fase correspondente.
- Ao expandir um contrato de dados existente, sempre pergunte: "isso pode ser derivado de um campo já existente?" antes de adicionar um campo novo.

## 8. Boas práticas gerais

- Rode a suíte de testes e o build antes de reportar qualquer sucesso — nunca afirme que passaram sem observar o resultado.
- Uma mudança de interface só é reportada como validada depois de conferida visualmente (desktop e mobile), quando esse tipo de validação for aplicável.
- Antes de um commit, revise o escopo (`git status`) e confirme que nada de `storage/`, imagens/arquivos de teste, ZIPs, `.env`, chaves, caminhos pessoais ou arquivos temporários entrou no commit.
- Commit e push só com autorização explícita do usuário para aquele commit específico — uma aprovação não vale automaticamente para o próximo commit.

## 9. Regra permanente de sincronização da documentação

Sempre que uma fase importante for concluída, **antes do commit final**:

1. Atualize toda a documentação afetada pela mudança.
2. Atualize [`docs/PROJECT_MASTER_CONTEXT.md`](docs/PROJECT_MASTER_CONTEXT.md) se a mudança afetar a visão geral, arquitetura, componentes principais, decisões ou riscos.
3. Atualize [`docs/HISTORICO.md`](docs/HISTORICO.md) com a nova entrada na linha do tempo.
4. Atualize [`docs/DOCUMENTO-MESTRE.md`](docs/DOCUMENTO-MESTRE.md) se houver mudança de arquitetura, escopo ou roadmap.
5. Atualize `README.md` quando houver mudança no uso do aplicativo.
6. Atualize [`docs/DATA_CONTRACT.md`](docs/DATA_CONTRACT.md) se a mudança tocar o contrato de Template, Lote ou Resultado.

Nenhuma fase é considerada encerrada enquanto a documentação oficial não refletir exatamente o estado atual do código.

## 10. O que este documento nunca autoriza sozinho

- Decidir um requisito de produto sem o usuário.
- Alterar um requisito já aprovado no Documento Mestre.
- Iniciar uma fase nova sem pedido explícito.
- Executar geração real ou chamar um provedor de IA externo sem confirmação explícita de créditos.
- Fazer commit ou push sem aprovação explícita e separada para aquele commit específico.
- Impor uma biblioteca ou framework visual externo como regra do projeto.
- Redesenhar livremente uma tela já validada pelo usuário.
