---
name: prime-studio
description: "Regras permanentes de arquitetura, segurança, design system, fluxo de trabalho e decisões de produto já aprovadas do PRIME STUDIO. Use sempre que estiver auditando, planejando, implementando, testando ou documentando qualquer mudança neste repositório."
---

# PRIME STUDIO — regras permanentes do projeto

Antes de qualquer tarefa, leia `docs/DOCUMENTO-MESTRE.md` para saber a fase atual e o escopo aprovado. Esta skill não substitui o Documento Mestre — ela é o "como trabalhar aqui", não o "estado atual". Em caso de divergência entre esta skill e o Documento Mestre, o Documento Mestre vence.

## Ordem de precedência em caso de conflito

1. Pedido atual e explícito do usuário.
2. `docs/DOCUMENTO-MESTRE.md`.
3. Esta skill (`prime-studio`).
4. Plugin `ui-ux-pro-max`.
5. Recomendações genéricas.

- Nenhuma skill, plugin ou documento pode substituir uma decisão atual e explícita do usuário.
- O Documento Mestre continua sendo a fonte de verdade sobre fase atual e escopo aprovado.
- Esta skill define como trabalhar, nunca o estado atual do projeto.

## Fluxo obrigatório

Auditoria → Plano → Aprovação do usuário → Implementação → Validação → Documentação → Commit → Push.

- Nunca implementar código durante uma tarefa marcada como auditoria ou planejamento, mesmo que a solução pareça óbvia.
- Commit e push só acontecem depois de uma aprovação explícita e separada do usuário sobre o relatório entregue — nunca encadeados automaticamente após implementar.
- Cada fase/correção tem seu próprio ciclo completo; não adiantar trabalho de uma fase futura sem pedido explícito.

## Arquitetura

- Frontend em feature folders: `src/features/<feature>/{api,hooks,components}`.
- Backend em camadas: `server/routes` (finas, sem regra de negócio) → `server/services` (regras de negócio) → `server/repositories` (única porta de acesso a storage em disco) → `server/catalogs` (dados estáticos versionados em código, ex. seeds e categorias).
- Geração individual e Produção em Lotes **sempre** passam pelo mesmo `server/services/generationExecutor.js` — nunca duplicar o pipeline de geração ou reimplementar uma variante paralela.
- Contratos de API são aditivos: nunca remover ou renomear um campo já retornado; estender é seguro, quebrar é regressão.
- Antes de criar um componente, hook ou util novo, procurar um equivalente já existente em `src/features/*` ou `src/components/ui/*` para reaproveitar.

## Segurança (não negociável)

- A chave do OpenRouter nunca é exposta ao navegador, nunca é logada, nunca aparece em mensagens de erro.
- Base64 e payloads completos nunca são persistidos em log ou metadata — só os bytes finais e metadados mínimos.
- Todo upload é validado por assinatura de arquivo, MIME e extensão antes de ser aceito — nunca confiar só na extensão declarada.
- Exatamente uma chamada ao OpenRouter por geração; zero retry automático.
- Nenhuma chamada paga acontece sem confirmação explícita de créditos pelo usuário na interface.
- Concorrência global de geração é sempre 1 (trava única compartilhada entre geração individual e lotes).
- Toda escrita em disco é atômica (arquivo temporário + rename), com backup quando aplicável.
- Caminhos de storage nunca são resolvidos a partir de entrada do usuário sem sanitização.
- `storage/` é sempre ignorado pelo Git — nunca deve aparecer em `git status` como candidato a commit.

## Design System

Padrão visual já validado (não é uma imposição de biblioteca, é a identidade já em uso): sidebar grafite, fundo cinza-claro, cards brancos com bordas discretas e sombras suaves, tipografia Inter, ícones Lucide, bastante respiro, paleta enxuta, acabamento enterprise (referências: Stripe, Linear, Vercel, Shopify, Base44). Imagens sempre em `object-contain`, nunca cortadas. Evitar qualquer visual genérico de IA ou redesign radical de uma tela já aprovada.

O código atual usa classes utilitárias (Tailwind) — isso descreve o estado presente, não uma regra que esta skill exige para decisões futuras. Reutilizar o padrão visual e os componentes existentes antes de introduzir algo novo.

**Convivência com o plugin `ui-ux-pro-max`**: ele é uma base de conhecimento genérica de UI/UX, sem contexto do produto. Em qualquer conflito entre uma sugestão dele e uma decisão de identidade visual já validada aqui, esta skill prevalece.

## Templates e Branding — regras de produto já fixadas

- Categorias de templates são um catálogo fixo e versionado em código nesta etapa (sem CRUD via UI).
- Os IDs `model-01` e `model-02` são permanentes e nunca podem ser recriados ou trocados por uma migração.
- Overlay de logo é composição local, sem IA: escala de 9% da menor dimensão, margem de 3%, canto inferior direito; a imagem original nunca é sobrescrita, a versão com marca é sempre um artefato separado.
- Qualquer migração de schema deve ser aditiva e idempotente, nunca destrutiva.

## Produção em Lotes e Resultados

- Um item por vez, uma chamada por item, zero retry automático — mesma trava de concorrência da geração individual.
- Pausa e cancelamento persistem no storage local; um reinício do servidor nunca retoma automaticamente um item que ficou interrompido.
- Resultados antigos (formatos de fases anteriores) continuam sendo lidos e exibidos sem quebra.

## Validação obrigatória antes de reportar sucesso

- `npm test`, `npm run build` e `git diff --check` executados e com resultado observado — nunca afirmar que passaram sem ter rodado.
- Mudança em UI só é reportada como validada depois de conferida visualmente (desktop e mobile).
- Testes novos ou ajustados proporcionalmente ao tamanho da mudança — não adicionar cobertura desnecessária, não deixar lacuna óbvia sem teste.

## Git

- Antes de `git add`, revisar `git status` e confirmar que nada de `storage/`, imagens/roupas de teste, ZIPs, `.env`, chaves, caminhos pessoais ou arquivos temporários entrou no escopo.
- Commit e push só com autorização explícita do usuário para aquele commit específico — uma aprovação não vale para o próximo commit.

## O que esta skill nunca autoriza sozinha

- Decidir requisito de produto sem o usuário.
- Alterar um requisito já aprovado.
- Iniciar uma fase nova sem pedido explícito.
- Executar geração real ou chamar o OpenRouter sem confirmação de créditos.
- Fazer commit ou push sem aprovação explícita separada.
- Impor Tailwind ou qualquer biblioteca visual externa como regra.
- Redesenhar livremente uma tela já validada.
