# Fase 7.4 — Preview Visual e Compositor de Story

Estado: **implementada e validada tecnicamente em 27 de julho de 2026; aguardando aprovação para commit e push**.

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md). Esta fase estende a Fundação do Marketing Studio (7.1) e a Inteligência Operacional (7.2) sem alterar seus contratos de Semana, Resultado, Template ou Lote.

## Escopo entregue

- Compositor de Story com formulário e preview instantâneo local na mesma tela.
- Três layouts fixos: `product-highlight`, `minimal` e `offer`.
- Campos aditivos: chamada curta (`calloutText`) e subheadline (`subheadline`), preservando headline, produto, preço e CTA existentes.
- Área segura do Instagram, contadores, limites, avisos de conteúdo e modal “Ver tamanho real”.
- Duas colunas responsivas no desktop; uma coluna no mobile, sem informação essencial escondida.
- Renderização explícita, sem chamadas a cada tecla, com WebP 1080×1920 interno e JPEG 1080×1920 para upload manual.
- Controle visual desabilitado “Gerar sugestões com IA — Em breve”; ele não chama DeepSeek nem outro provedor.

## Contrato visual e renderização

`shared/storyLayoutSpec.js` é a fonte canônica para canvas, área segura, paleta, regiões de imagem, logo e textos dos três layouts. `shared/storyTextLayout.js` normaliza, limita e quebra linhas de maneira determinística. O preview React/CSS usa essa mesma especificação escalada; o Sharp usa os pixels canônicos.

O preview é uma aproximação honesta: diferenças pequenas de métrica de fonte, antialiasing e decodificação entre navegador e Sharp podem existir. Após a renderização, o WebP real é exibido como resultado autoritativo.

O Sharp preserva a imagem com `contain`, sem crop ou deformação, e exige uma logo aprovada. A mesma composição produz:

```text
assets/stories/<story-id>.webp
assets/stories/<story-id>-buffer.jpg
```

As escritas são atômicas. O metadata só passa a `ready` quando os dois derivados existem. Se a gravação do JPEG falhar depois do WebP, os dois artefatos recém-criados são removidos e o Story fica em `failed`, preservando planejamento e fonte.

## Compatibilidade e invalidação

`calloutText`, `subheadline` e `bufferAssetFileName` são campos aditivos. Stories anteriores os tratam como `null`; um Story antigo pronto continua acessível e informa com clareza que o JPEG só ficará disponível após nova renderização.

Alterar fonte, variante, textos, layout, agenda ou ordem invalida WebP e JPEG daquele Story. A fonte preservada nunca é sobrescrita. Os downloads passam pelo endpoint seguro de assets do Marketing, com MIME, `Content-Length`, `Content-Disposition` para JPEG e `X-Content-Type-Options: nosniff`.

## Validação técnica

- 53 arquivos de teste e 347 testes aprovados;
- build de produção aprovado;
- `git diff --check` aprovado;
- renderer validado nos três layouts, com WebP e JPEG de 1080×1920 e MIME correto;
- cobertura de preview, limites/avisos, modal, compatibilidade legada, download seguro, invalidação e limpeza compensatória;
- nenhuma chamada a OpenRouter, DeepSeek, Buffer ou qualquer serviço externo durante a implementação e os testes.

## Fora do escopo

Sem geração de texto por IA, API do Buffer, publicação automática, editor livre, drag-and-drop, fontes customizáveis, camadas ou animações. Nenhuma chave ou segredo foi tocado.
