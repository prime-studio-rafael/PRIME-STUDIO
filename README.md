# PRIME IA STUDIO — MVP local

Protótipo local para validar a troca de peças de vestuário e produtos em fotografias de modelo usando o OpenRouter.

## Referência oficial e estado do projeto

O escopo e a ordem das fases são definidos pelo [Documento Mestre](docs/DOCUMENTO-MESTRE.md).

- Fase 1: concluída;
- Fase 02A: concluída;
- Fase 02B: concluída;
- Fase 2: **concluída oficialmente em 16 de julho de 2026**;
- Fase 3: **concluída oficialmente e publicada em 16 de julho de 2026**.
- Fase 4: **concluída oficialmente em 16 de julho de 2026**.
- Fase 5: **concluída oficialmente em 17 de julho de 2026**.
- Branding/Logo: **concluído oficialmente (MVP) em 17 de julho de 2026** — ver [FASE-BRANDING-IMPLEMENTACAO.md](docs/FASE-BRANDING-IMPLEMENTACAO.md).
- Fase 6 — Biblioteca de Templates: **concluída oficialmente em 17 de julho de 2026** — ver [FASE-6-IMPLEMENTACAO.md](docs/FASE-6-IMPLEMENTACAO.md).
- Perfil Completo de Geração por Template (5 fases): **concluído e publicado entre 17 e 21 de julho de 2026** — ver [FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md](docs/FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md).
- Fase 7.1 — Fundação do Marketing Studio: **aprovada tecnicamente em 21 de julho de 2026** — ver [FASE-07-IMPLEMENTACAO.md](docs/FASE-07-IMPLEMENTACAO.md).
- Fase 7.2 — Inteligência Operacional: **concluída e aprovada em 21 de julho de 2026** — ver [FASE-07-2-IMPLEMENTACAO.md](docs/FASE-07-2-IMPLEMENTACAO.md).
- Fase 7.3 — Configurações de IA e DeepSeek: **implementada e validada tecnicamente em 21 de julho de 2026** — ver [FASE-07-3-CONFIGURACOES-IA.md](docs/FASE-07-3-CONFIGURACOES-IA.md).
- Fase 7.4 — Preview Visual e Compositor de Story: **concluída tecnicamente em 27 de julho de 2026** — ver [FASE-07-4-IMPLEMENTACAO.md](docs/FASE-07-4-IMPLEMENTACAO.md).
- Fase 7.5 — Assistente IA para textos de Stories: **concluída e publicada em 27 de julho de 2026** — ver [FASE-07-5-IMPLEMENTACAO.md](docs/FASE-07-5-IMPLEMENTACAO.md).
- Fase 7.6 — Branding Inteligente: **concluída e publicada em 27 de julho de 2026** — ver [FASE-07-6-IMPLEMENTACAO.md](docs/FASE-07-6-IMPLEMENTACAO.md).
- Fase 7.7 — Sistema Tipográfico Premium: **implementada e validada tecnicamente em 28 de julho de 2026; commit e publicação aguardam autorização explícita** — ver [FASE-07-7-IMPLEMENTACAO.md](docs/FASE-07-7-IMPLEMENTACAO.md).

O encerramento está registrado em [FASE-02-ENCERRAMENTO.md](docs/FASE-02-ENCERRAMENTO.md) e a evolução consolidada do projeto em [HISTORICO.md](docs/HISTORICO.md).

**Para uma IA que nunca viu este projeto**: comece por [docs/START_HERE.md](docs/START_HERE.md), que explica a ordem de leitura de toda a documentação.

## Requisitos

- Node.js 20.19+;
- uma chave do OpenRouter com créditos, somente quando o teste real for autorizado.

## Instalação

Entre na pasta do projeto:

```bash
cd PRIME-STUDIO
```

```bash
npm install
```

## Iniciar

```bash
npm run dev
```

- Frontend: http://127.0.0.1:5173
- API local: http://127.0.0.1:3001

O MVP não executa nenhuma chamada externa ao abrir a tela. A chamada ao OpenRouter ocorre somente depois da confirmação explícita de créditos e do clique em “Gerar imagem”.

## Configurar a chave pela interface

Na sidebar, abra **Configurações** → **Inteligência Artificial**. A Visão geral mostra OpenRouter e DeepSeek; use a aba **OpenRouter** para a chave de geração de imagens.

A chave é guardada somente no Chaves do macOS, como uma senha genérica com:

- service: `PRIME_IA_STUDIO_OPENROUTER`
- account: `local-user`

Depois de salvar, o campo é limpo e a chave nunca é devolvida ao navegador. Use **Testar conexão** para fazer apenas uma consulta `GET /api/v1/key` ao OpenRouter: ela não gera imagem. **Remover chave** exclui somente a entrada do Chaves do macOS, após confirmação.

### Fallback opcional por `.env`

Para desenvolvimento local, o backend ainda aceita a chave no `.env` da raiz do projeto:

```text
PRIME-STUDIO/.env
```

Use a linha abaixo, sem o prefixo `VITE_`:

```text
OPENROUTER_API_KEY=COLE_SUA_CHAVE_AQUI
```

O Keychain tem prioridade. Se uma chave estiver salva no Chaves do macOS, ela será usada no lugar do `.env`. O `.env` é lido na inicialização; a chave salva pela interface passa a valer imediatamente, sem reiniciar o servidor.

### DeepSeek

Na aba **DeepSeek**, a chave é guardada exclusivamente no Chaves do macOS com service `PRIME_IA_STUDIO_DEEPSEEK` e account `local-user`. O modelo disponível nesta instalação é `deepseek-v4-flash`. O teste de conexão faz somente uma consulta à listagem de modelos, com timeout e zero retry. O Marketing Studio usa essa configuração somente por ação explícita: **Gerar 3 sugestões** ou **Recomendar estilo**. Sem chave, a recomendação de estilo continua disponível como Sugestão local.

## Templates locais

Abra **Templates** na sidebar para criar, editar, substituir, duplicar, ativar, desativar ou excluir modelos-base sem editar arquivos manualmente.

No primeiro uso, o sistema importa automaticamente os dois templates versionados:

- `public/templates/model-01.jpeg`
- `public/templates/model-02.jpeg`

Os IDs `model-01` e `model-02` são preservados e os bytes são copiados para:

```text
storage/templates/
├── catalog.json
├── catalog.json.bak
└── images/
```

Depois do bootstrap, o catálogo persistido é a autoridade: templates excluídos não reaparecem ao reiniciar. Se `storage/templates/` for apagado por completo, os dois arquivos versionados são importados novamente como sementes.

Novos templates aceitam JPEG, PNG ou WebP, até 10 MB, com mínimo de 768×960 e 0,75 MP, em orientação vertical e sem rotação EXIF pendente. A interface mostra preview, formato real, dimensões, proporção, tamanho, erros e avisos antes de salvar. Nenhuma imagem é convertida, recortada, redimensionada ou recomprimida.

O catálogo e as imagens são locais e ignorados pelo Git. A arquitetura, os endpoints e as regras de recuperação estão registrados em [FASE-03-IMPLEMENTACAO.md](docs/FASE-03-IMPLEMENTACAO.md).

Cada template pode ter uma **categoria** (👕 Moda Masculina, 👩 Moda Feminina, 👟 Tênis Masculino, 👟 Tênis Feminino, ⌚ Acessórios, 👜 Bolsas ou Sem categoria), **tags** e um texto de **tooltip** exibido ao passar o mouse ou navegar por teclado. A tela Templates e o seletor de modelo-base na Nova geração mostram uma barra de busca, filtro por categoria e paginação real (busca/categoria são enviadas ao backend; um botão **"Carregar mais"** busca a próxima página, sem baixar o catálogo inteiro para filtrar no navegador). Sem limite máximo de templates codificado. Os dois templates iniciais (`model-01`, `model-02`) têm nomes profissionais e categoria `Moda Masculina` desde a instalação; catálogos já existentes recebem essa correção automaticamente, sem sobrescrever uma personalização já feita pelo usuário. Consulte [FASE-6-IMPLEMENTACAO.md](docs/FASE-6-IMPLEMENTACAO.md) para o schema, a migração e as limitações desta fase.

### Perfil de geração de cada Template

Cada Template pode ter um **prompt principal** (o que muda nessa categoria de produto, ex. "trocar o calçado" para tênis), um **prompt negativo** opcional e uma **proporção de geração**, editáveis diretamente no formulário de Template. Um Template sem prompt configurado mostra o badge **"Perfil de geração pendente"** na tela Templates, na Nova geração e na Produção em Lotes, e fica bloqueado para gerar até ser configurado — evita que um Template de uma categoria (ex. tênis) receba silenciosamente o prompt de outra (ex. camisetas). Tanto a geração individual quanto os itens de lote usam exatamente o mesmo compositor de prompt (`templatePrompt` + regras universais + prompt negativo + instrução adicional, nessa ordem).

### Instrução adicional desta geração

Um campo de texto opcional (até 500 caracteres), disponível tanto na Nova Geração quanto na criação de um lote, para uma instrução pontual que vale só para aquela execução — nunca altera o Template. Fica registrada na metadata do Resultado gerado.

Consulte [FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md](docs/FASE-TEMPLATE-PROFILE-IMPLEMENTACAO.md) para o histórico completo desta iniciativa (5 fases) e [DATA_CONTRACT.md](docs/DATA_CONTRACT.md) para o contrato de dados atual do Template, do lote e do Resultado.

## Salvamento

Imagens concluídas e metadata mínimo são salvos automaticamente em:

```text
storage/results/
```

Base64, payloads e respostas completas não são salvos. Até a Fase 3, os inputs permaneciam somente em memória.

A partir da Fase 4, novas gerações preservam também os bytes validados do template e da roupa, exclusivamente para comparação histórica local:

```text
storage/results/<generation-id>/
├── result.<ext>
├── template.<ext>
├── garment.<ext>
└── metadata.json
```

Resultados anteriores no formato imagem + JSON continuam compatíveis. Abra **Resultados** na sidebar para filtrar, comparar, aprovar, reprovar, baixar ou excluir gerações locais. Referências históricas que nunca foram salvas aparecem como indisponíveis.

Ao aprovar ou reprovar um resultado, o modal avança automaticamente para o próximo resultado com revisão pendente, na mesma ordem da lista (mais recente para o mais antigo). Quando não há mais pendentes, o modal fecha e uma mensagem discreta confirma o fim da revisão. Com o filtro **Aprovados** ativo, o botão **Baixar todas as aprovadas** gera um único ZIP local com os arquivos finais já persistidos, bytes e extensões originais.

O detalhe de cada resultado mostra também, quando existirem, a **categoria** do Template usado, a **origem** (Individual ou Lote, com o identificador do lote) e a **instrução adicional** daquela execução — ver [DATA_CONTRACT.md](docs/DATA_CONTRACT.md) para o contrato completo da metadata.

O diretório ainda não existe enquanto nenhuma geração for concluída; ele será criado automaticamente no primeiro sucesso.

## Produção em Lotes

Abra **Produção em Lotes** na sidebar para criar um lote com um template local válido e várias roupas. Os arquivos são validados e copiados para `storage/batches/`; o lote não inicia automaticamente. Depois da confirmação explícita de créditos, a fila processa estritamente um item por vez e compartilha a mesma trava global da geração individual. Pausa, retomada explícita e cancelamento preservam o estado local. O botão "Abrir resultado" de cada item leva diretamente ao resultado correspondente na tela Resultados.

A tela mostra a contagem de lotes e um indicador discreto quando há lote em execução; o formulário "Novo lote" é um painel colapsável, priorizando a consulta aos lotes existentes. O lote selecionado exibe cards de resumo (Total, Concluídos, Processando, Aguardando, Erros) e uma barra de progresso, sempre calculados a partir dos estados reais dos itens — nunca fictícios. Cada item mostra a thumbnail da roupa, badge de status, duração e custo; cancelar um lote exige confirmação inline. Consulte [FASE-05-IMPLEMENTACAO.md](docs/FASE-05-IMPLEMENTACAO.md) para os estados, a validação real, a Fase 5.1 e as limitações.

## Branding/Logo

Na view **Branding** da sidebar, é possível enviar e aprovar, de forma independente, a **logo principal** e a **logo branca**, ambas PNGs com transparência real. A mesma tela mostra uma prévia **Original × Com logo** lado a lado, usando composição local sem IA. A logo principal continua sendo a referência da geração individual e dos lotes; no Marketing Studio, cada Story permite selecionar logo **Automática**, **Principal** ou **Branca**, e tamanho **Pequeno**, **Médio** ou **Grande**. O modo automático usa a principal em layouts claros e a branca no layout Oferta; se a branca ainda não existir, há fallback explícito para a principal. Selecionar Branca manualmente sem asset aprovado bloqueia a renderização com mensagem clara. A posição continua fixa e a proporção é preservada. Consulte [FASE-07-6-IMPLEMENTACAO.md](docs/FASE-07-6-IMPLEMENTACAO.md) para o contrato e a validação.

## Marketing Studio

Abra **Marketing Studio** na sidebar para planejar semanas locais usando somente Resultados aprovados. É possível adicionar conteúdos manualmente ou selecionar produtos para uma proposta determinística, marcar prioridades e distribuir categorias pela semana. Cada Story mantém categoria, agenda e estado editorial (`Planejado`, `Pronto` ou `Publicado`).

A aba **Stories** reúne formulário e preview instantâneo local em um compositor responsivo. Os cinco layouts — Premium, Luxury, Minimal, Offer e Editorial — compartilham regras canônicas de área segura do Instagram, tipografia, limites e quebras de texto. O seletor **Estilo tipográfico** oferece apenas Premium/Manrope, Moderno/Inter, Elegante/Plus Jakarta Sans e Impacto/Bebas Neue; no Impacto, Bebas é limitada a headline e preço. As fontes são locais, a troca não renderiza automaticamente e o Sharp continua sendo a fonte final de verdade.

No início do compositor, **Estilo Visual** oferece combinações prontas de layout, tipografia, variante e tamanho de logo: PRIME Store, Luxury, Minimal, Offer e Editorial. Aplicar um estilo nunca bloqueia a edição individual; se a combinação for alterada manualmente, a interface mostra **Personalizado**. O estilo é apenas uma camada de conveniência: nenhum `visualStyleId` é salvo e o renderer continua usando os quatro campos já existentes. **Recomendar estilo** cria uma sugestão manual a partir de ranking local e, quando o DeepSeek está disponível, de uma justificativa opcional; a sugestão nunca é aplicada, salva ou renderizada automaticamente.

Ao gerar explicitamente, o aplicativo cria a partir da mesma composição um WebP interno e um JPEG 1080×1920 para upload manual em Buffer/Instagram. A renderização usa a variante e o tamanho de logo selecionados, preserva a proporção da fonte com `contain`, não corta nem deforma a imagem e permite download seguro dos dois derivados. Editar fonte, variante, layout, textos, modo ou tamanho da logo invalida ambos os arquivos e exige nova renderização. Planejamento, fontes e arquivos finais ficam em:

```text
storage/marketing/weeks/<week-id>/
```

Sem logo aprovada, a renderização é bloqueada com mensagem clara. Aprovar uma semana exige todos os Stories prontos; qualquer edição posterior retorna a semana para rascunho. Uma semana aprovada pode ser encerrada e passa a ser somente leitura. O Assistente IA gera três sugestões textuais somente após clique explícito, sem enviar imagens e sem aplicar automaticamente uma sugestão. Não existe publicação automática, editor livre ou integração externa no módulo. Consulte [FASE-07-IMPLEMENTACAO.md](docs/FASE-07-IMPLEMENTACAO.md), [FASE-07-2-IMPLEMENTACAO.md](docs/FASE-07-2-IMPLEMENTACAO.md), [FASE-07-4-IMPLEMENTACAO.md](docs/FASE-07-4-IMPLEMENTACAO.md) e [FASE-07-5-IMPLEMENTACAO.md](docs/FASE-07-5-IMPLEMENTACAO.md).

## Parar os servidores

No terminal onde `npm run dev` estiver rodando, pressione:

```text
Ctrl+C
```

## Resultado oficial da Fase 2

- geração final aprovada pelo usuário;
- nota técnica: 92/100;
- modelo: `google/gemini-3.1-flash-lite-image`;
- resolução: `1K`;
- proporção efetiva: `1:1`;
- prompt: `upper-garment-v2`;
- exatamente uma chamada ao OpenRouter;
- zero retries;
- custo: US$ 0,034351;
- duração da geração: 7,077 segundos;
- imagem e metadata salvos localmente;
- 63 testes simulados aprovados e build concluído.

## Testes locais sem custo

```bash
npm test
npm run build
```

Os testes automatizados usam respostas simuladas e não acessam OpenRouter ou DeepSeek. Estado atual: 55 arquivos e 377 testes aprovados. A validação funcional da Fase 7.5 executou uma chamada real de conexão e uma geração controlada de sugestões, sem OpenRouter.

## Limitações intencionais

- uma aplicação local com as views Nova geração, Templates, Resultados, Produção em Lotes, Branding e Marketing Studio, sem React Router;
- somente Nano Banana 2 Lite;
- categorias atuais: moda masculina, moda feminina, tênis, acessórios e bolsas, conforme o perfil configurado em cada Template;
- proporção efetiva validada em 1:1 na Fase 2; 4:5 é melhoria futura;
- resolução fixa 1K;
- sem banco, autenticação, fila remota ou infraestrutura em nuvem; a fila de lotes é exclusivamente local;
- sem retry automático;
- templates atuais são fotografias locais JPEG válidas para a geração 1:1; a futura adoção de 4:5 exigirá templates compatíveis;
- chave persistida apenas no Chaves do macOS; o `.env` é somente fallback local.
- Marketing Studio sem publicação automática, notificações com o app fechado, editor livre, drag-and-drop, analytics ou entidade completa de Produto.
