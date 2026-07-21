# PRIME STUDIO — Contexto Mestre do Projeto

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md), que continua sendo a autoridade final em caso de conflito de escopo. Este documento existe para que uma IA (ou pessoa) que nunca viu o projeto entenda o estado atual sem precisar reconstruir meses de conversas ou ler todos os documentos de fase em ordem cronológica.

Última verificação contra o código: 21 de julho de 2026.

---

## 1. Visão geral

O **PRIME STUDIO** é um aplicativo **local** (sem servidor remoto, sem banco de dados, sem autenticação) que valida a troca de uma peça de vestuário/produto em uma fotografia de modelo, usando um provedor de geração de imagem por IA (hoje só o OpenRouter). É um protótipo de validação de produto, não um SaaS.

Objetivo declarado (ver Documento Mestre, seção 2): provar, com baixo risco e custo controlado, que o fluxo local funciona de ponta a ponta, com fidelidade visual, segurança da chave de API e confiabilidade das validações e do salvamento.

## 2. Tecnologias

| Camada | Tecnologia | Versão (`package.json`) |
|---|---|---|
| Frontend | React | `^19.2.7` |
| Build/dev server | Vite | `^8.1.5` |
| Estilo | Tailwind CSS (`@tailwindcss/vite`) | `^4.3.3` |
| Backend | Node.js + Express | `^5.2.1` |
| Upload | `multer` (memória) | `^2.2.0` |
| Imagem (overlay de logo) | `sharp` | `^0.35.3` |
| ZIP de download | `yazl` (gerar) / `yauzl` (dev) | `^3.3.1` / `^3.4.0` |
| Ícones | `lucide-react` | `^1.24.0` |
| Testes | Vitest + Testing Library + jsdom | `^4.1.10` |
| Fontes | `@fontsource/inter` | `^5.2.8` |

Sem banco de dados, sem ORM, sem autenticação, sem Docker, sem infraestrutura em nuvem — por decisão de arquitetura, não por limitação técnica (ver Documento Mestre, "Infraestrutura deliberadamente ausente").

## 3. Estrutura de diretórios

```
PRIME-STUDIO/
├── src/                          # Frontend (React)
│   ├── app/                      # App.jsx — orquestra as views, sem React Router
│   ├── components/{layout,ui}/   # Sidebar e componentes de UI genéricos
│   └── features/                 # Um diretório por feature de produto
│       ├── generation/           # Nova Geração (individual)
│       ├── templates/            # Templates (admin + seletor)
│       ├── results/              # Resultados
│       ├── batches/               # Produção em Lotes
│       ├── branding/             # Branding/Logo
│       └── settings/             # Configurações (chave OpenRouter)
├── server/                       # Backend (Node + Express)
│   ├── routes/                   # Rotas HTTP finas — nenhuma regra de negócio aqui
│   ├── services/                 # Regras de negócio (generationExecutor, batchService, etc.)
│   ├── repositories/             # Única porta de acesso a storage em disco
│   ├── catalogs/                 # Dados estáticos versionados em código (models, providers, categorias)
│   ├── prompts/                  # Compositor de prompt e regras globais
│   ├── storage/                  # Persistência de Resultados
│   ├── providers/openrouter/     # Cliente HTTP do OpenRouter
│   ├── secrets/                  # Integração com o Chaves do macOS
│   ├── config/                   # Configuração fixa de geração (modelo, resolução, proporção)
│   └── utils/                    # Validação de imagem, metadata, erros
├── shared/                       # Código compartilhado entre frontend e backend (políticas/constantes)
├── storage/                      # Dados locais em disco (Git-ignorado) — templates, batches, results
├── tests/{server,frontend}/      # 41 arquivos, 309 testes (Vitest)
├── docs/                         # Documentação (este diretório)
├── .claude/skills/prime-studio/  # Regras permanentes para o Claude Code (ver AGENTS.md para a versão genérica)
└── public/templates/             # Imagens seed dos templates model-01/model-02
```

Padrão de arquitetura: **feature folders** no frontend (`src/features/<feature>/{api,hooks,components}`), **camadas** no backend (`routes` finas → `services` com regra de negócio → `repositories` como única porta de disco → `catalogs` como dados estáticos).

## 4. Fases implementadas

Ver [HISTORICO.md](./HISTORICO.md) para a linha do tempo completa com datas e contagens de teste. Resumo do que existe hoje:

1. **Fase 1** — MVP local (React+Vite, Node+Express, OpenRouter, chave protegida).
2. **Fase 2** (02A+02B) — Qualidade da geração: prompt `upper-garment-v2` original (hoje substituído pelo compositor, ver item 6), snapshot imutável, validação técnica de imagens.
3. **Fase 3** — Templates Locais: CRUD completo, `storage/templates/`.
4. **Fase 4** — Resultados e Histórico Local: listagem, filtros, aprovação/reprovação.
5. **Fase 5** (+ 5.1) — Produção em Lotes: fila sequencial, concorrência global 1, zero retry, UX enterprise.
6. **Branding/Logo** — overlay de marca por composição local (sem IA), 9% de escala / 3% de margem / canto inferior direito.
7. **Fase 6** — Biblioteca Profissional de Templates: categoria, tags, tooltip, paginação real, busca.
8. **Perfil Completo de Geração por Template** (5 fases) — cada Template ganhou seu próprio prompt/negativePrompt/provider/modelo/proporção/resolução, com compositor central de prompt, snapshot completo em lotes, interface de edição e metadata auditável nos Resultados. Detalhes: [FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md](./FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md).
9. **Fase de Consolidação da Documentação** (esta fase) — sem código novo, só documentação.

## 5. Fluxo completo (geração individual)

1. Usuário seleciona um Template local válido **com perfil de geração configurado** (`prompt` preenchido — senão, bloqueado com o badge "Perfil de geração pendente").
2. Envia uma imagem de roupa/produto; validação técnica (formato, MIME, dimensões, proporção, orientação).
3. Opcionalmente escreve uma "Instrução adicional desta geração" (até 500 caracteres, vale só para esta execução).
4. Confirma explicitamente o uso de créditos.
5. `server/services/generateImage.js` bloqueia antes do lock global se o Template estiver incompleto (`TEMPLATE_PROFILE_INCOMPLETE`), sem consumir crédito.
6. `server/services/generationExecutor.js` (pipeline único, compartilhado com lotes) monta o prompt final via `buildGenerationPrompt()` (`templatePrompt` + regras globais + prompt negativo + instrução adicional), resolve modelo/proporção/resolução efetivos a partir do Template, e faz **exatamente uma chamada** ao OpenRouter — zero retry.
7. Resposta validada, imagem e metadata completa salvos em `storage/results/<generation-id>/` (`reviewStatus: 'pending'`).
8. Se Branding estiver ativo e houver logo aprovada, aplica overlay local (sem IA, sem chamada extra) e salva a variante `branded` separadamente, preservando sempre o `result` original.
9. Resultado devolvido ao navegador e a lista de Resultados é atualizada automaticamente (sem precisar de F5).

**Produção em Lotes** segue o mesmo pipeline (`generationExecutor.execute()`), mas com o perfil do Template **congelado no momento da criação do lote** (`batch.json`) — editar o Template depois nunca afeta um lote já criado. Lotes criados antes dessa garantia existir ("legados") são bloqueados com segurança em vez de usar um prompt genérico por suposição.

## 6. Componentes principais e onde encontrá-los

| Conceito | Arquivo(s) principal(is) |
|---|---|
| Compositor de prompt | `server/prompts/buildGenerationPrompt.js`, `server/prompts/globalGenerationRules.js` |
| Pipeline de geração (único, individual + lote) | `server/services/generationExecutor.js` |
| Adaptador da geração individual | `server/services/generateImage.js` |
| Fila de lotes | `server/services/batchService.js`, `server/services/batchQueue.js` |
| Repositório de Templates | `server/repositories/localTemplateRepository.js` |
| Repositório de Lotes | `server/repositories/localBatchRepository.js` |
| Persistência de Resultados | `server/storage/localResultStorage.js`, `server/services/resultService.js` |
| Cliente OpenRouter | `server/providers/openrouter/openrouterClient.js` |
| Chave do OpenRouter | `server/secrets/` (Chaves do macOS) + `.env` (fallback) |
| Overlay de Branding | `server/services/logoOverlay.js` (nome indicativo — conferir arquivo exato no código) |
| Tela Nova Geração | `src/app/App.jsx`, `src/features/generation/` |
| Tela Templates | `src/features/templates/` |
| Tela Resultados | `src/features/results/` |
| Tela Produção em Lotes | `src/features/batches/` |
| Tela Branding | `src/features/branding/` |

## 7. Decisões importantes (por que, não só o quê)

- **Um único `GenerationExecutor`** para geração individual e lote — nunca duplicar pipeline de geração.
- **Exatamente uma chamada por geração, zero retry automático** — regra não-negociável desde a Fase 1.
- **`origin` do Resultado nunca é persistido** — é sempre derivado de `batchId` na leitura, para não criar uma segunda fonte de verdade que possa divergir.
- **Prompt final nunca é persistido concatenado** — só os componentes separados (`inputTemplatePrompt`, `inputTemplateNegativePrompt`, `additionalInstruction`, `promptVersion`), para não duplicar o texto fixo das regras globais em todo Resultado.
- **`generationAspectRatio` ≠ `aspectRatio`** no Template — nomes diferentes porque já existia um campo `aspectRatio` (proporção real da imagem) antes do perfil de geração existir; unificar quebraria a validação de dimensões.
- **Nenhum fallback de prompt por suposição** — um Template ou snapshot de lote sem perfil configurado é sempre bloqueado, nunca recebe silenciosamente o prompt de outra categoria (esta foi a causa raiz do bug original que motivou toda a iniciativa do Perfil de Templates).
- **Categorias fixas, sem CRUD via UI** (Fase 6) — catálogo versionado em código, gestão de categorias fica para uma fase futura.
- **Branding é composição local, nunca IA** — escala/margem/posição fixas (9%/3%/inferior direita), validadas visualmente, não configuráveis nesta fase.

## 8. Regras do projeto (resumo — ver [AGENTS.md](../AGENTS.md) para a versão completa)

- Fluxo obrigatório: Auditoria → Plano → Aprovação do usuário → Implementação → Validação → Documentação → Commit → Push.
- Precedência em caso de conflito: pedido explícito do usuário > Documento Mestre > regras permanentes (`AGENTS.md`/skill) > recomendações genéricas.
- Nenhuma chamada real ao OpenRouter sem confirmação explícita de créditos pelo usuário.
- `storage/` nunca entra no Git.
- Documentação deve ser atualizada antes do commit final de qualquer fase relevante (regra permanente, ver Documento Mestre e `AGENTS.md`).

## 9. Riscos conhecidos

- **Colisão de nome `generationAspectRatio`/`aspectRatio`** — resolvido por design (nomes diferentes), mas é uma armadilha real para quem tentar "simplificar" renomeando sem entender o motivo.
- **Só um provider e um modelo reais existem hoje** (`openrouter`/`nano-banana-lite`) — os campos `provider`/`modelId` do Template estão prontos para múltiplas opções, mas não há roteamento real implementado; adicionar um segundo provider exigirá revisar `generationExecutor.js` (hoje rejeita qualquer `provider` diferente de `'openrouter'`).
- **`FASE-6-IMPLEMENTACAO.md` e `FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md` são iniciativas distintas** apesar de nomes parecidos — não confundir "Fase 6" (Biblioteca de Templates) com as "Fases 1-5" do Perfil de Templates.
- **Lotes e Resultados não têm `schemaVersion`** (diferente do Template, que tem) — decisão deliberada (leitura tolerante já é suficiente), mas significa que campos novos futuros precisam sempre ter um default seguro na leitura, nunca assumir presença.

## 10. Pendências reais (não implementadas, sem aprovação de início)

- Download em massa das imagens finais (ampliação do download em lote já existente).
- Roteamento real entre múltiplos providers/modelos, quando houver um segundo provider de fato.
- Possível renomeação de `generationAspectRatio`, hoje bloqueada pela colisão de nomes (ver seção 9).
- CRUD de categorias via UI (hoje fixas em código).
- Módulo de Marketing — **fora de escopo desta consolidação**; não confundir com nenhuma pendência real do produto atual.

## 11. Roadmap

Não há um roadmap formal além do que está registrado como "próximas melhorias aprovadas" no Documento Mestre e nas pendências da seção 10 acima. Qualquer nova fase deve seguir o fluxo obrigatório (seção 8) e começar por uma auditoria do estado real do código — nunca por suposição do que "provavelmente" já existe.

---

Para o contrato exato de dados (campos, tipos, defaults), ver [DATA_CONTRACT.md](./DATA_CONTRACT.md). Para a ordem de leitura recomendada, ver [START_HERE.md](./START_HERE.md).
