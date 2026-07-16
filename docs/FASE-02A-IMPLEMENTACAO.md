# PRIME IA STUDIO — Fase 02A

Documento subordinado ao [Documento Mestre do PRIME STUDIO](./DOCUMENTO-MESTRE.md). O encerramento consolidado da fase está registrado em [FASE-02-ENCERRAMENTO.md](./FASE-02-ENCERRAMENTO.md).

## Diagnóstico resumido

O fluxo da Fase 01 já realizava uma única chamada, validava as imagens e salvava o resultado sem persistir a roupa. A Fase 02 identificou três riscos imediatos que podiam ser corrigidos sem trocar modelo ou arquitetura:

- prompt amplo demais sobre regiões que precisam mudar fisicamente;
- possibilidade de alterar template ou roupa durante uma geração;
- comparação baseada no estado atual da tela, e não nas referências efetivamente enviadas.

Também faltavam versão do prompt, dimensões e um identificador de configuração nos metadados.

## Escopo implementado

- prompt `upper-garment-v2` centralizado;
- bloqueio funcional e visual dos controles de referência durante a geração;
- snapshot efêmero das referências utilizadas;
- comparação vinculada ao snapshot;
- liberação explícita de Object URLs;
- metadados técnicos ampliados;
- extração leve e sem dependências de dimensões PNG, JPEG e WebP;
- rubrica oficial de 100 pontos;
- testes simulados sem chamada externa.

## Arquivos alterados

- `server/prompts/upperGarmentPrompt.js`
- `server/services/generateImage.js`
- `server/utils/fileValidation.js`
- `server/utils/imageEncoding.js`
- `server/catalogs/templates.js`
- `src/app/App.jsx`
- `src/features/generation/hooks/useGeneration.js`
- `src/features/generation/components/TemplatePicker.jsx`
- `src/features/generation/components/GarmentUploader.jsx`
- testes relacionados em `tests/server/` e `tests/frontend/`

## Arquivos criados

- `server/utils/generationMetadata.js`
- `tests/server/upperGarmentPrompt.test.js`
- `tests/frontend/generationReferences.test.jsx`
- `docs/FASE-02-RUBRICA-QUALIDADE.md`
- `docs/FASE-02A-IMPLEMENTACAO.md`

## Prompt v2

O prompt continua em português do Brasil e contém uma versão exportada: `upper-garment-v2`.

Sua estrutura é:

1. objetivo único;
2. papel das duas imagens;
3. elementos imutáveis da Imagem 1;
4. região editável;
5. fidelidade da roupa;
6. marcas, logos e textos;
7. oclusões e integração física;
8. regra de incerteza;
9. proibições finais.

O texto completo permanece somente em `server/prompts/upperGarmentPrompt.js`.

## Snapshot das referências

No início da geração, o hook captura um objeto imutável com:

- horário de início;
- ID, rótulo, URL pública, MIME e dimensões conhecidas do template;
- nome, MIME, tamanho e Object URL efêmera da roupa.

O snapshot não contém o arquivo binário da roupa e não é enviado ao backend. A chamada continua recebendo o mesmo `File` selecionado, sem cópia adicional. O resultado é renderizado contra o template e a Object URL do snapshot.

A URL é revogada quando:

- ocorre erro;
- o fluxo é resetado;
- começa uma nova geração;
- o componente é desmontado.

## Bloqueio durante geração

Enquanto o estado real é `preparing` ou `generating`, ficam desabilitados:

- ambos os templates;
- input de arquivo;
- área de upload;
- remoção da roupa;
- substituição da roupa;
- checkbox de créditos;
- botão de geração.

Os controles continuam presentes e utilizam o atributo HTML `disabled`, preservando comportamento de teclado e acessibilidade.

## Metadados adicionados

Cada sucesso passa a registrar:

- `promptVersion`;
- `model` e `modelId`;
- `requestedAspectRatio`;
- `effectiveAspectRatio`;
- `resolution`;
- `inputTemplateId`;
- MIME e dimensões do template;
- MIME e dimensões da roupa;
- MIME e dimensões da saída;
- `durationMs`;
- `costUsd`;
- `createdAt`;
- `providerRequestId`;
- `configurationId`, hash SHA-256 truncado da configuração efetiva;
- status.

Não são persistidos Base64, arquivo da roupa, caminho da roupa, payload ou resposta completa do provedor.

## Decisões mantidas

- modelo: `google/gemini-3.1-flash-lite-image`;
- proporção efetiva: `1:1`;
- proporção solicitada futura: `4:5` apenas como metadado/configuração pendente;
- resolução: `1K`;
- exatamente uma imagem por fluxo;
- nenhum retry automático;
- roupa somente em memória durante a sessão;
- sem banco, histórico, nova tela ou mudança de arquitetura.

## Fase 02B

Ficaram deliberadamente fora desta fase:

- normalização real dos templates para 4:5;
- ativação de 4:5;
- validação de resolução mínima, nitidez, orientação EXIF e perfil de cor;
- seleção ou comparação de outros modelos;
- referências adicionais da roupa;
- formato PNG de saída;
- remoção de componentes antigos;
- composição determinística de logos.

## Validação manual futura

Quando houver autorização para uma nova geração real:

1. usar as mesmas referências da linha de base sempre que possível;
2. confirmar modelo, 1K e 1:1 na interface;
3. confirmar que os controles ficam desabilitados durante a chamada;
4. verificar que a comparação usa as referências capturadas;
5. abrir o JSON salvo e conferir `promptVersion` e `configurationId`;
6. avaliar o resultado com `FASE-02-RUBRICA-QUALIDADE.md`;
7. registrar custo, duração e nota sem iniciar outra chamada automaticamente.

Nenhuma geração real foi executada durante a implementação e validação da Fase 02A.

> Atualização: os itens de normalização e validação listados para a Fase 02B foram implementados posteriormente. Consulte `docs/FASE-02B-IMPLEMENTACAO.md`; este arquivo permanece como registro histórico da Fase 02A.

## Resultado da validação local

- `npm test`: 16 arquivos de teste aprovados; 49 testes aprovados; nenhuma chamada real ao OpenRouter.
- `npm run build`: build Vite concluído com sucesso; 1.792 módulos transformados.
- lint: não existe script de lint configurado no `package.json`; sintaxe e importações foram validadas pela suíte e pelo build.
- modelo confirmado: `google/gemini-3.1-flash-lite-image`.
- resolução confirmada: `1K`.
- proporção efetiva confirmada: `1:1`.
