# PRIME STUDIO — Fase 3: Templates Locais

Documento subordinado ao [Documento Mestre](./DOCUMENTO-MESTRE.md).

Estado: **FASE 3 TECNICAMENTE CONCLUÍDA em 16 de julho de 2026; aguardando somente autorização separada para commit e push**.

## 1. Objetivo entregue

A Fase 3 permite gerenciar pela interface as fotografias locais usadas como modelo-base, sem editar arquivos do projeto manualmente. A solução continua totalmente local, sem banco de dados, autenticação, React Router ou serviço externo de armazenamento.

Não foram alterados o modelo, o prompt, a resolução, a proporção efetiva ou o fluxo pago validado na Fase 2.

## 2. Arquitetura

O fluxo implementado é:

```text
Tela / API
    ↓
TemplateService
    ↓
contrato TemplateRepository
    ↓
LocalTemplateRepository
    ↓
storage/templates/
```

Responsabilidades:

- interface: lista, formulário, preview, feedback e comandos do usuário;
- rotas: contrato HTTP e upload multipart em memória;
- `TemplateService`: regras, validações, status, unicidade e guards;
- `LocalTemplateRepository`: persistência, serialização de mutações, backup e recuperação;
- política compartilhada: inspeção determinística de JPEG, PNG e WebP;
- geração: solicita ao serviço o registro público e os bytes já validados, sem acessar caminhos físicos.

O serviço depende do contrato do repositório. Uma futura troca de adaptador não exige reescrever a tela, as rotas ou a geração.

## 3. Estrutura local

```text
storage/templates/
├── catalog.json
├── catalog.json.bak
└── images/
    ├── <storage-key>.jpeg
    ├── <storage-key>.png
    └── <storage-key>.webp
```

O catálogo usa `schemaVersion: 1` e registra somente:

- `id`, `label` e `description`;
- `storageKey` gerada pelo backend;
- MIME, dimensões, proporção e tamanho;
- validade, avisos e status ativo;
- datas de criação e atualização.

Não são armazenados Base64, bytes no JSON, caminhos absolutos, chave OpenRouter, roupa, payload, resposta do provedor ou resultados gerados.

`storage/` permanece ignorado pelo Git.

## 4. Bootstrap e compatibilidade

Na primeira inicialização sem `catalog.json`:

1. o repositório cria `storage/templates/images/`;
2. lê os dois templates versionados da Fase 2;
3. valida bytes, formato, MIME, extensão, integridade, dimensões, proporção e orientação;
4. preserva os IDs `model-01` e `model-02`;
5. copia os bytes sem converter, recortar ou recomprimir;
6. cria `catalog.json` e `catalog.json.bak` por escrita temporária e rename;
7. marca o catálogo como inicializado.

Em reinicializações normais, o catálogo persistido é a autoridade. Um template excluído não reaparece. Se todo `storage/templates/` for removido deliberadamente, os dois arquivos versionados voltam a servir como sementes.

## 5. CRUD e status

A tela **Templates** oferece:

- listagem com imagem, nome, descrição e dados técnicos;
- preview completo com `object-contain`;
- criação com preview e inspeção antes do envio;
- edição de nome e descrição;
- substituição da imagem mantendo o ID;
- duplicação com novo ID e novo arquivo físico;
- ativação e desativação;
- exclusão com confirmação;
- validade, classificação e avisos técnicos;
- estados de carregamento, vazio e erro.

Templates inválidos ou inativos não podem ser selecionados para geração. Se o template selecionado for desativado ou excluído, a seleção é reconciliada para o primeiro template válido e ativo; se nenhum existir, a geração permanece bloqueada.

## 6. Endpoints

| Método | Endpoint | Função |
|---|---|---|
| `GET` | `/api/templates` | Lista pública compatível com o `TemplatePicker` |
| `POST` | `/api/templates` | Cria com `label`, `description` e `templateImage` |
| `PATCH` | `/api/templates/:id` | Altera somente nome e descrição |
| `PUT` | `/api/templates/:id/image` | Substitui a imagem mantendo o ID |
| `POST` | `/api/templates/:id/duplicate` | Duplica registro e bytes com novo ID |
| `PATCH` | `/api/templates/:id/status` | Ativa ou desativa |
| `DELETE` | `/api/templates/:id` | Exclui registro e imagem |
| `GET` | `/api/templates/:id/image` | Serve bytes com MIME real e `nosniff` |

A URL pública da imagem inclui `updatedAt` como versão. Nenhuma resposta contém caminho físico.

## 7. Integridade do armazenamento

- toda gravação usa arquivo temporário e rename atômico;
- mutações passam por um mutex local baseado em fila de Promises;
- o catálogo válido anterior é preservado em `catalog.json.bak`;
- um catálogo principal inválido é recuperado do último backup válido;
- se principal e backup estiverem inválidos, a inicialização falha de forma explícita e segura;
- criação e substituição removem o novo arquivo se a atualização do catálogo falhar;
- imagens não referenciadas são removidas na inicialização;
- nomes físicos são gerados no backend;
- `storageKey` aceita somente basename seguro e extensões autorizadas;
- o limite operacional é de 50 templates.

## 8. Validação de imagens

A política da Fase 2 foi reutilizada sem alteração:

- JPEG, PNG ou WebP;
- até 10 MB;
- MIME, extensão, assinatura, estrutura completa e dimensões reais;
- proporção, orientação EXIF e resolução mínima;
- arquivo truncado ou inconsistente bloqueia;
- avisos de proporção ou possível compressão não bloqueiam;
- nenhuma conversão, resize, crop ou recompressão.

Uma entrada inválida é rejeitada antes da mutação e não deixa registro ou arquivo parcial.

## 9. Guards durante geração

Durante uma geração ativa, a visualização e a navegação continuam disponíveis, mas ficam bloqueados:

- criar;
- editar;
- substituir imagem;
- duplicar;
- ativar ou desativar;
- excluir.

O frontend usa `disabled` real e mostra uma mensagem contextual. O backend aplica o mesmo guard e responde `409 GENERATION_IN_PROGRESS`, mesmo que uma requisição seja feita fora da interface.

A geração iniciada conserva o snapshot imutável da Fase 2.

## 10. Compatibilidade com a Fase 2

Foram preservados:

- `templateId` e `modelId`;
- modelo `google/gemini-3.1-flash-lite-image`;
- prompt `upper-garment-v2`;
- resolução `1K`;
- proporção efetiva `1:1`;
- confirmação paga;
- exatamente uma chamada e zero retry;
- lock de geração;
- snapshot e metadata;
- salvamento do resultado, custo, duração, Request ID e Keychain.

Os testes de regressão continuam confirmando uma única chamada simulada e ausência de retry.

## 11. Validação final executada

- `npm test`: 23 arquivos e 95 testes aprovados, incluindo os 63 testes anteriores;
- cobertura nova: bootstrap, IDs preservados, reinício, CRUD, entrada inválida sem resíduo, último ativo, corrupção, backup, concorrência, órfãos, path traversal, MIME/extensão, lock 409, MIME da imagem e contrato GET;
- frontend: sidebar, loading, vazio, cards, CRUD, confirmação de exclusão, avisos, preview, erro, bloqueios e reconciliação;
- CRUD final: criação, edição de nome e descrição, substituição mantendo o ID, duplicação com novo ID, desativação, reativação e exclusão confirmados;
- persistência real: IDs, estado, storage keys, imagens e dados permaneceram iguais após reiniciar `npm run dev`; registros excluídos não reapareceram;
- proteção do último template válido e ativo confirmada pela interface e pelo backend;
- template inválido confirmado como indisponível no `TemplatePicker` e bloqueado para geração;
- integração simulada: um template criado localmente entregou ao serviço de geração o `templateId`, bytes, MIME e dimensões corretos, preservando o contrato de metadata;
- integridade: `catalog.json` e `catalog.json.bak` válidos e idênticos, sem Base64, caminho físico ou arquivo parcial; imagem servida com MIME real e `nosniff`;
- desktop 1440×1000: grade responsiva sem overflow horizontal e previews com `object-fit: contain`;
- móvel 390×844: uma coluna, controles dentro da viewport e sem overflow horizontal;
- `npm run build`: aprovado, com 1.801 módulos transformados.

Toda a validação usou apenas dados locais e clientes simulados. Nenhum `POST /api/generations` foi executado.

Não foi encontrado defeito funcional de produção. A única alteração adicional desta validação foi um teste automatizado de integração simulada entre template criado e geração. A Fase 4 não foi iniciada.

## 12. Limitações deliberadas

- persistência somente local e adequada a uma única instância do processo;
- limite de 50 templates;
- sem busca, filtros, ordenação personalizada ou paginação;
- sem histórico de alterações;
- sem banco remoto, autenticação ou sincronização;
- 4:5 continua apenas como melhoria futura e não foi ativado;
- alterações manuais no JSON não são suportadas.

## 13. Confirmações de escopo

- nenhuma geração real;
- nenhuma chamada ao OpenRouter;
- zero créditos consumidos;
- nenhum commit criado nesta tarefa;
- nenhum push realizado nesta tarefa;
- Fase 3 tecnicamente concluída;
- Fase 4 não iniciada.
