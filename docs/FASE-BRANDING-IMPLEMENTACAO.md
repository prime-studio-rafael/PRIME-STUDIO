# PRIME STUDIO — Branding/Logo: Aplicação Automática de Marca

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

Estado: **BRANDING/LOGO OFICIALMENTE CONCLUÍDO (MVP) em 17 de julho de 2026**, validado visualmente pelo usuário com um resultado real e a logo aprovada da PRIME STORE.

## Objetivo

Permitir escolher uma logo da loja, validar tecnicamente o arquivo, exibir preview para aprovação explícita e aplicar essa logo automaticamente sobre as imagens finais por composição tradicional (overlay), sem uso de IA para interpretar, recriar ou redesenhar a logo.

## Arquitetura

```
BrandingPage → brandingClient → /api/branding → BrandingService → LocalBrandingStorage
GenerationExecutor → (se Branding ligado e logo aprovada) → logoOverlay → LocalResultStorage
```

`GenerationExecutor` continua sendo a pipeline única compartilhada entre geração individual e Produção em Lotes. O hook de Branding foi inserido **depois** que o resultado original já foi gerado e validado, e **antes** do salvamento local — sem duplicar pipeline entre os dois fluxos, sem alterar prompt, modelo, payload, número de chamadas, custo, timeout, concorrência, retry ou snapshots.

## Dependência: `sharp`

Adicionada como dependência de produção. É usada para:

- decodificar PNG e ler metadata (dimensões, canal alfa);
- varrer os pixels alpha da logo (presença real de transparência/opacidade, bounding box da arte, ocupação do canvas);
- redimensionar a logo proporcionalmente, sem distorcer e sem ampliar além da resolução original;
- compor (`composite`) a logo sobre o resultado gerado;
- recodificar a saída no mesmo formato do resultado (JPEG, PNG ou WebP).

Nenhuma chamada ao `sharp` ocorre quando Branding está desligado ou quando não há logo aprovada — o caminho de geração permanece idêntico ao anterior à esta fase.

## Validação da logo

Aceito nesta primeira versão: **PNG verdadeiro**, com assinatura binária, MIME (`image/png`) e extensão (`.png`) coerentes entre si, até 10 MB.

Rejeição imediata (HTTP 400, nada é persistido) quando:

- assinatura, MIME ou extensão não são PNG;
- o arquivo está corrompido ou sem dimensões legíveis;
- não há canal alfa (`hasAlpha` falso);
- dimensão menor que 256×256.

Quando o arquivo passa nesses critérios, ele é sempre salvo como **pendente** e recebe uma classificação técnica, calculada varrendo os pixels reais (não apenas o cabeçalho):

- `opaquePixelRatio` / `transparentPixelRatio` — fração de pixels opacos e transparentes;
- `boundingBox` e `canvasOccupancyRatio` — área útil da arte dentro do canvas;
- proporção largura:altura.

Classificação final:

| Critério | Erro (`inadequate`) | Aviso (`acceptable_with_warning`) |
| --- | --- | --- |
| Pixels opacos | < 0,5% do canvas | — |
| Pixels transparentes | < 0,5% do canvas | — |
| Ocupação do canvas pela arte | < 3% | 3%–15% |
| Proporção (lado maior / lado menor) | > 6:1 | 4:1–6:1 |

Esses valores são os iniciais recomendados e documentados aqui; podem ser ajustados no código (`server/services/brandingService.js`) caso a validação visual indique necessidade.

Uma logo `inadequate` **não pode ser aprovada** — o endpoint de aprovação recusa explicitamente (`BRANDING_LOGO_INADEQUATE`). Uma logo `acceptable_with_warning` pode ser aprovada conscientemente.

## Storage

```
storage/branding/
├── logo.png              # logo aprovada (ativa)
├── pending-logo.png      # candidato ainda não aprovado
├── metadata.json         # relatório técnico do pendente e do aprovado
├── metadata.json.bak     # backup do último metadata válido
└── config.json           # { enabled: boolean }
```

- Escrita atômica em todos os arquivos (arquivo temporário + rename).
- Ao aprovar, o candidato pendente só substitui a logo ativa depois de gravado com sucesso; a logo anterior nunca é removida antes disso.
- Nenhum Base64, nenhum caminho absoluto e nenhum segredo em `metadata.json`/`config.json`.
- `storage/` já é ignorado pelo Git (nenhuma mudança necessária no `.gitignore`).

## Fluxo de aprovação

1. Upload (`POST /api/branding/logo`, multipart) → validação → sempre vira "pendente", com o relatório técnico completo na resposta.
2. Preview do pendente via `GET /api/branding/logo?variant=pending`.
3. Aprovação explícita (`POST /api/branding/approve`) — bloqueada se a classificação for `inadequate`.
4. Toggle global (`PATCH /api/branding/config`, `{ enabled }`) — só pode ser ligado se houver logo aprovada.
5. `DELETE /api/branding/logo` remove a logo aprovada e desliga o toggle automaticamente.

## Overlay

`server/services/logoOverlay.js` — função determinística, sem estado, sem chamada externa.

### Padrão definitivo (decisão oficial do projeto, 17 de julho de 2026)

Depois da validação visual lado a lado (original vs. com logo) sobre um resultado real e a logo já aprovada da PRIME STORE, foram testadas as escalas 8%, 9%, 10% e 12%. A escala de **9%** foi escolhida como a menor que mantém a logo perfeitamente legível — inclusive em miniatura — sem competir visualmente com o produto, com acabamento equivalente ao de plataformas como Shopify e Canva Pro.

- posição fixa: **canto inferior direito** (`LOGO_POSITION = 'bottom-right'`);
- escala fixa: **9% da menor dimensão** da imagem final (`LOGO_SCALE_RATIO = 0.09`);
- margem fixa: **3% da menor dimensão** (`LOGO_MARGIN_RATIO = 0.03`, ~31px em uma imagem de 1024px — dentro da faixa de 24–32px recomendada);
- preserva a proporção da logo; nunca amplia além da resolução original enviada;
- nunca corta nem deforma; a imagem final mantém as mesmas dimensões do resultado original.

Nesta fase, **posição, escala e margem são fixas e não configuráveis pela interface** — não há editor visual, slider ou seleção de posição. Essas configurações só se tornarão ajustáveis pelo usuário na **Fase 6**.

## Qualidade JPEG/PNG/WebP

O formato de saída da variante `branded` **segue o formato do resultado original** — não há conversão para PNG só por a logo ter transparência, pois a composição já "achata" a transparência da logo contra a imagem de fundo antes da recodificação final:

- resultado JPEG → branded JPEG (qualidade 92, `mozjpeg`);
- resultado PNG → branded PNG;
- resultado WebP → branded WebP (qualidade 92).

A variante branded **não é byte-idêntica** ao original — ela passa por uma recodificação (decode → composite → encode) com parâmetros de qualidade alta e estáveis, documentados acima. O arquivo `result.<ext>` original nunca é reescrito nem recomprimido; ele é preservado exatamente como veio do provedor.

## Integração com a geração individual

`GenerationExecutor.execute()` ganhou um passo opcional, executado depois que `generated.buffer` já existe:

- **Branding desligado ou sem logo aprovada** → nenhuma chamada ao `sharp`; metadata registra `logoApplied: false`, `brandingStatus: 'disabled'`; comportamento idêntico ao anterior a esta fase.
- **Branding ligado com logo aprovada** → aplica o overlay; salva `branded.<ext>` ao lado de `result.<ext>`; metadata registra `logoApplied: true`, `brandingStatus: 'applied'`.
- **Falha no overlay** (ex.: logo corrompida após aprovação) → o resultado original já foi gerado e é salvo normalmente; a geração **nunca é perdida**; `brandingStatus: 'failed'` e `brandingError` (código e mensagem seguros, sem dado sensível) ficam registrados; nenhuma nova chamada ao OpenRouter é feita; zero retry.

## Integração com Produção em Lotes

`BatchQueue` chama o mesmo `GenerationExecutor` compartilhado — nenhuma lógica de Branding foi duplicada ou adicionada ao `BatchService`/`BatchQueue`. O toggle vale igualmente para geração individual e lotes porque ambos passam pelo mesmo executor.

## Metadata

Campos adicionados de forma compatível com resultados antigos:

`logoApplied`, `logoFileName`, `logoMime`, `logoDimensions`, `logoPosition`, `logoScale`, `logoMargin`, `brandingStatus`, `brandingError`, `originalResultAsset`, `brandedResultAsset`.

Resultados anteriores a esta fase (sem esses campos) são normalizados como `logoApplied: false`, `assets.branded: null`, `brandingError: null` — nunca quebram, nunca reconstroem dado que não existe.

## Resultados

- `assets.branded` exposto ao lado de `assets.result` quando existir.
- No detalhe do resultado, um seletor **Com logo / Original** aparece somente quando há variante branded; a versão com logo é a visualização inicial quando existe.
- Download individual oferece as duas versões separadamente (`Baixar original` / `Baixar com logo`), além do botão de download padrão (sempre o original).
- Aprovar/Reprovar e o avanço automático da fila de revisão **não foram alterados**.

## ZIP das aprovadas

`GET /api/results/download/approved`: para cada resultado aprovado, inclui a variante `branded` quando o Branding está ativo **e** o resultado possui essa variante; caso contrário, inclui `result` (original). O original nunca é excluído do storage. A tela Resultados mostra um aviso discreto informando esse comportamento quando o filtro Aprovados está ativo.

## Falhas e compensações

- Upload inválido → HTTP 400 com código de erro seguro, nada é persistido.
- Aprovação de logo inadequada → bloqueada explicitamente.
- Falha ao gravar a logo aprovada → a logo anterior permanece intacta (rename atômico só substitui após gravação bem-sucedida).
- Falha no overlay durante uma geração → resultado original preservado, erro seguro registrado, zero retry, zero nova chamada ao OpenRouter.

## Testes

196 testes aprovados (34 arquivos), incluindo os 136 anteriores a esta fase. Novos testes cobrem:

- validação da logo (assinatura, MIME, extensão, corrupção, canal alfa, dimensão mínima, transparência real, opacidade real, ocupação do canvas, proporção extrema, classificações adequate/acceptable_with_warning/inadequate);
- aprovação explícita, bloqueio de logo inadequada, toggle dependente de aprovação, substituição atômica preservando a logo anterior, recuperação por backup, endpoints HTTP (headers seguros, multipart, variantes pending/approved);
- overlay determinístico (posição, margem, escala, proporção preservada, sem corte, original inalterado, saída por formato, MIME não suportado, buffer corrompido);
- geração individual com Branding desligado/ligado, com Branding aplicado com sucesso e com falha simulada do overlay preservando o resultado original;
- Produção em Lotes com Branding ligado e desligado, usando o mesmo executor compartilhado;
- normalização de `assets.branded`, seletor original/com logo, downloads separados, fallback em resultados legados;
- seleção do asset no ZIP (branded quando ativo e disponível, original como fallback);
- interface de Branding (upload, preview, dados técnicos, erros, avisos, aprovação, toggle, substituição, remoção, estados de carregamento/vazio/erro).

## Validação manual realizada

- Overlay aplicado sobre um resultado real já existente (`storage/results/`), sem qualquer chamada ao OpenRouter: logo posicionada corretamente no canto inferior direito, com margem e escala proporcionais, sem distorção ou corte.
- Fluxo completo de upload → validação → aprovação → toggle validado via HTTP real (instância local isolada), incluindo os headers de segurança do endpoint de imagem (`X-Content-Type-Options: nosniff`) e a ausência de caminho físico nas respostas.
- Interface (aba Branding em Configurações) verificada em desktop e mobile, sem overflow horizontal.
- Nenhum artefato de validação foi deixado em `storage/branding/` real do projeto.

## Validação visual final (aprovada pelo usuário em 17 de julho de 2026)

Preview lado a lado (original vs. com logo) construído a partir de um resultado real já existente e da logo real aprovada da PRIME STORE, sem nenhuma geração nova e sem chamada ao OpenRouter. Análise técnica confirmada:

- ocupação da logo: 8,98% da largura da imagem (0,14% da área total);
- distância das bordas: 31px (~3,03% da largura);
- redimensionamento proporcional, sem distorção perceptível (diferença de arredondamento de 0,17px, inevitável em resoluções tão pequenas);
- recompressão JPEG esperada (mozjpeg qualidade 92): tamanho do arquivo menor, qualidade visual preservada e confirmada em zoom 3× sobre região de detalhe;
- resolução final idêntica à original (1024×1024), sem corte;
- adequação confirmada para Instagram, catálogo, marketplace e e-commerce;
- resultado original (`result.jpg`) preservado sem alteração; variante `branded.jpg` sempre um arquivo separado.

A escala de 9% e a margem de 3% foram aprovadas como **padrão definitivo do PRIME STUDIO** para todas as futuras gerações com Branding ativo.

## Limitações intencionais desta fase

- uma única logo global aprovada por vez (sem múltiplas logos ou perfis de marca);
- posição, escala e margem fixas em 9%/3%/canto inferior direito — sem editor visual, sem arrastar, sem slider, sem opacidade configurável e sem opção de configuração pela interface nesta fase (essas configurações só se tornarão ajustáveis na Fase 6);
- sem marca-d'água repetida, sem texto personalizado, sem SVG;
- sem IA para interpretar, recriar ou redesenhar a logo, e sem remoção de fundo por IA;
- sem aplicação diferente por template ou por lote — o toggle é global;
- sem banco de dados ou infraestrutura em nuvem.

Nenhuma geração real foi executada e nenhuma chamada ao OpenRouter ocorreu durante esta implementação e validação.
