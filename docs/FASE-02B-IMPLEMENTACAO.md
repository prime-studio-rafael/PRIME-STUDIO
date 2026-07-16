# PRIME IA STUDIO — Fase 02B

Documento subordinado ao [Documento Mestre do PRIME STUDIO](./DOCUMENTO-MESTRE.md). O encerramento consolidado da fase está registrado em [FASE-02-ENCERRAMENTO.md](./FASE-02-ENCERRAMENTO.md).

## Resumo

A Fase 02B normalizou os templates locais, centralizou a política técnica de imagens e passou a validar integridade, formato real, MIME, extensão, dimensões, proporção e orientação antes de permitir uma geração. A roupa continua somente em memória, o modelo e o prompt não foram alterados e a proporção efetiva permanece `1:1`.

Nenhuma chamada ao OpenRouter integra a validação. Toda inspeção desta fase é local e determinística.

## Diagnóstico e normalização dos templates

Situação encontrada:

| Arquivo anterior | Bytes reais | Dimensões | Tamanho | Problema |
|---|---:|---:|---:|---|
| `model-01.webp` | JPEG progressivo, qualidade estimada 70 | 773×1024 | 59.331 bytes | extensão `.webp`, proporção declarada 4:5 incorreta e compressão mais forte |
| `model-02.webp` | JPEG progressivo, qualidade estimada 70 | 773×1024 | 55.971 bytes | mesma inconsistência |

Foram encontradas fontes JPEG locais visualmente equivalentes e menos comprimidas. Elas foram promovidas sem conversão, crop, resize ou recompressão:

| Template canônico | Formato real | Dimensões | Razão real | Tamanho | Orientação | Estado |
|---|---|---:|---:|---:|---|---|
| `public/templates/model-01.jpeg` | JPEG progressivo, qualidade estimada 94 | 773×1024 | 0,755 | 77.966 bytes | sem transformação EXIF | válido, com aviso de proporção |
| `public/templates/model-02.jpeg` | JPEG progressivo, qualidade estimada 94 | 773×1024 | 0,755 | 73.714 bytes | sem transformação EXIF | válido, com aviso de proporção |

As versões anteriores foram preservadas como `model-01-legacy-q70.jpeg` e `model-02-legacy-q70.jpeg`. Os arquivos `00model-01.webp` e `00model-02.webp` são 800×1000 e tecnicamente 4:5, mas são placeholders gráficos quase vazios; não são fotografias utilizáveis e não foram adotados.

## Política oficial de imagens

A única fonte de requisitos é `shared/imagePolicy.js`, usada pelo backend e pelo frontend. O parser compartilhado está em `shared/imageInspection.js`.

Regras comuns:

- formatos: JPEG, PNG e WebP;
- tamanho máximo: 10 MB;
- bytes devem formar uma estrutura completa do formato identificado;
- MIME informado e extensão devem corresponder aos bytes reais;
- orientação EXIF 2–8 bloqueia o arquivo, pois exigiria transformação; orientação 1 ou ausência de orientação não altera os bytes;
- nenhum arquivo é redimensionado, recortado, convertido ou recomprimido.

Templates:

- mínimo 768×960;
- mínimo 0,75 MP;
- orientação vertical obrigatória;
- alvo 4:5, valor 0,8;
- tolerância absoluta de ±0,015;
- aviso de possível compressão forte abaixo de 0,08 byte por pixel.

Roupa:

- mínimo 512×512;
- mínimo 0,35 MP;
- faixa recomendada de proporção entre 0,68 e 1,05;
- proporção fora da faixa gera aviso, não bloqueio;
- aviso de possível compressão forte abaixo de 0,06 byte por pixel.

Os limites evitam entradas extremamente pequenas sem exigir arquivos excessivamente grandes para uma saída 1K.

## Integridade e decodificação

O inspetor valida:

- PNG: assinatura, ordem e limites dos chunks, CRC de cada chunk, `IHDR`, `IDAT` e `IEND`;
- JPEG: marcadores, segmentos, SOF, dimensões, fluxo de scan, marcador EOI, dados posteriores e EXIF Orientation;
- WebP: RIFF, tamanho declarado, limites e padding dos chunks, VP8/VP8L/VP8X, dimensões e EXIF quando presente.

No navegador, `createImageBitmap` confirma a decodificação completa e confronta as dimensões quando a API está disponível. O evento de erro do preview é a proteção de fallback. No backend, a validação estrutural é novamente executada como autoridade antes da chamada ao provedor.

## Erros, avisos e informações

- Erro técnico: arquivo vazio ou grande demais, assinatura/integridade inválida, truncamento, dimensões insuficientes, MIME ou extensão incoerente, template não vertical ou orientação EXIF pendente. Bloqueia a geração.
- Aviso de qualidade: proporção da roupa pouco favorável, template fora de 4:5 ou possível compressão forte. Orienta o usuário, mas não bloqueia o fluxo 1:1.
- Informação técnica: dimensões, proporção numérica, formato real, tamanho, orientação e classificação.

Nitidez, legibilidade de logos e qualidade de costuras continuam sendo avaliação visual humana; a interface não promete análise automática desses aspectos.

## UX adicionada

Na mesma tela existente, a área da roupa passou a mostrar:

- orientação para fotografia frontal, peça inteira, gola e mangas visíveis, fundo neutro e boa luz;
- alerta para evitar compressão por WhatsApp;
- dimensões, proporção real, formato real, tamanho e orientação;
- classificação `Adequada`, `Aceitável com aviso` ou `Inadequada`;
- mensagens separadas para erros e avisos.

O botão depende de uma validação técnica concluída e válida. Avisos não bloqueiam. Troca e remoção limpam o estado anterior e as Object URLs continuam sendo revogadas.

## Preparação visual para 4:5

Cards de template e comparação recebem a proporção efetiva da configuração. As imagens usam `object-contain`, sem crop ou distorção. O preview da roupa usa as dimensões reais conhecidas. O grid continua responsivo em larguras menores.

Nenhum payload foi alterado para 4:5. A configuração registra separadamente:

- `requestedAspectRatio: 4:5`;
- `effectiveAspectRatio: 1:1`;
- status da ativação;
- motivo do bloqueio.

## Decisão sobre 4:5

**4:5 mantido bloqueado.**

Motivos objetivos:

1. os dois templates fotográficos canônicos têm razão 0,755, fora da faixa aceita de 0,785 a 0,815;
2. os únicos arquivos locais exatamente 4:5 são placeholders gráficos inadequados;
3. a capacidade do endpoint para esta configuração ainda não está confirmada sem custo.

4:5 é uma melhoria futura e não bloqueia o encerramento da Fase 2. Se uma fase futura autorizar sua ativação, deverão ser fornecidas duas fotografias reais 4:5 válidas, a capacidade do endpoint deverá estar confirmada e todos os testes locais deverão continuar aprovados. Somente então `effectiveAspectRatio` poderá mudar para `4:5`.

## Metadados

Cada sucesso futuro registrará, sem salvar bytes ou nome completo da roupa:

- status e classificação da validação;
- avisos emitidos;
- dimensões e proporção real;
- orientação;
- tamanho em bytes;
- extensão original;
- formato e MIME reais;
- coerência de extensão e MIME;
- integridade;
- status e motivo da ativação 4:5.

Continuam proibidos nos metadados: arquivo da roupa, Base64, Object URL, payload e resposta completa do provedor.

## Validação local

Testes cobrem JPEG, PNG, WebP, MIME e extensão incompatíveis, arquivo pequeno, dimensões, proporção, EXIF, truncamento, declaração incorreta de template, metadados, política 4:5, requisitos e feedback da interface, erro versus aviso, preview, troca, limpeza de Object URL e bloqueios durante geração.

Comandos previstos:

```bash
npm test
npm run build
```

Não existe script de lint no `package.json`.

Resultado final:

- `npm test`: 17 arquivos e 63 testes aprovados;
- `npm run build`: build Vite aprovado, 1.795 módulos transformados;
- verificação visual local em 1280×720: sem overflow horizontal, templates carregados e `object-fit: contain`;
- verificação visual local em 390×844: sem overflow horizontal após ajustar o shell para coluna no mobile;
- console do navegador: nenhum erro ou aviso;
- somente requisições GET locais de configuração, templates e assets; nenhum POST de geração.

## Confirmações de escopo

- modelo mantido: `google/gemini-3.1-flash-lite-image`;
- resolução mantida: `1K`;
- proporção efetiva mantida: `1:1`;
- prompt mantido: `upper-garment-v2`;
- zero geração real;
- zero chamada ao OpenRouter;
- zero crédito consumido;
- nenhum commit;
- nenhum push.
