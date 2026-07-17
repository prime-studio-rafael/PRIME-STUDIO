# PRIME STUDIO — Documento Mestre

Versão: 1.4
Estado: referência oficial do projeto  
Última consolidação: 17 de julho de 2026 — Fase 5 concluída oficialmente; Fase 6 ainda não iniciada

## 1. Autoridade e controle de escopo

Este documento é a referência oficial para a arquitetura, as funcionalidades e a ordem das fases do PRIME STUDIO.

Regras de governança:

- nenhuma funcionalidade pode ser inferida ou implementada fora do escopo registrado aqui;
- uma nova fase só pode começar depois do encerramento explícito da fase anterior;
- mudanças de escopo exigem aprovação explícita e atualização deste documento;
- melhorias técnicas aprovadas nas Fases 02A e 02B são permanentes e não devem ser removidas ou simplificadas;
- documentos de implementação detalham decisões deste Documento Mestre, mas não podem ampliá-lo;
- planejamentos antigos que ampliem o escopo deixam de ser referência.

## 2. Objetivo do produto nesta etapa

O PRIME STUDIO é um aplicativo local para validar a troca de roupas superiores em fotografias de modelo por meio do OpenRouter.

O objetivo atual é provar, com baixo risco e custo controlado:

1. o funcionamento completo do fluxo local;
2. a fidelidade visual da troca de roupa;
3. a preservação da pessoa, pose, cenário e enquadramento;
4. a segurança da chave;
5. a confiabilidade das validações, do salvamento e dos metadados.

O projeto preserva a proposta visual e funcional aprovada no PRIME IA STUDIO do Base44, mas utiliza uma arquitetura local mais limpa e confiável. Base44 não integra a implementação atual.

## 3. Arquitetura oficial atual

### Frontend

- React;
- Vite;
- Tailwind CSS;
- JavaScript;
- uma SPA local com as views Nova geração, Templates, Resultados e Produção em Lotes, sem React Router;
- estado mantido em memória durante a sessão.

### Backend local

- Node.js;
- Express;
- upload multipart em memória;
- serviço de geração separado do cliente OpenRouter;
- serviço e repositório local de templates;
- catálogo versionado em JSON com escrita atômica e backup;
- validação compartilhada de imagens;
- salvamento em filesystem local.

### Integração externa autorizada

- OpenRouter, somente quando o usuário confirma créditos e aciona manualmente a geração;
- modelo fixo: `google/gemini-3.1-flash-lite-image`.

### Segurança da chave

- armazenamento principal no Chaves do macOS;
- `.env` local como fallback do backend;
- a chave nunca é devolvida ao frontend;
- a chave, Base64, payload completo e resposta completa não podem ser registrados em logs ou metadados.

### Persistência autorizada

- imagem final em `storage/results/`;
- metadata JSON da geração em `storage/results/`;
- roupa somente em memória até a Fase 3;
- a partir da Fase 4, template e roupa das novas gerações são preservados localmente para comparação histórica;
- template lido do catálogo local;
- catálogo e imagens de templates em `storage/templates/`.

### Infraestrutura deliberadamente ausente

- banco de dados;
- Supabase;
- Firebase;
- autenticação;
- usuários;
- Docker;
- fila remota, banco ou processamento paralelo;
- infraestrutura em nuvem;
- histórico remoto ou em banco;
- múltiplas gerações concorrentes.

## 4. Fluxo funcional oficial

1. selecionar manualmente um template local válido;
2. enviar uma imagem de roupa superior;
3. validar arquivo, bytes, formato, MIME, extensão, tamanho, dimensões, proporção e orientação;
4. confirmar o uso de créditos;
5. bloquear clique duplo e alterações das referências;
6. executar exatamente uma chamada, sem retry automático;
7. enviar ao OpenRouter o template como Imagem 1 e a roupa como Imagem 2;
8. validar a imagem recebida;
9. salvar imagem e metadata localmente;
10. devolver o resultado ao navegador;
11. comparar modelo, roupa e resultado;
12. exibir custo, duração e Request ID quando disponível;
13. permitir download manual.

## 5. Configuração oficial para o encerramento da Fase 2

- modelo: `google/gemini-3.1-flash-lite-image`;
- resolução: `1K`;
- proporção efetiva: `1:1`;
- escopo: somente roupas superiores;
- concorrência: uma geração;
- retry automático: desativado;
- chamadas por clique: exatamente uma.

A proporção 4:5 não é requisito para concluir a Fase 2. Ela permanece registrada como melhoria futura e não deve ser ativada durante o encerramento desta fase.

## 6. Ordem oficial das fases

### Fase 1 — MVP local funcional

Estado: concluída.

Entregas consolidadas:

- aplicação React + Vite;
- backend Node + Express;
- integração OpenRouter;
- chave protegida no backend e no Chaves do macOS;
- seleção de template local;
- upload de uma roupa superior;
- confirmação obrigatória de créditos;
- uma chamada por geração;
- bloqueio de concorrência e ausência de retry;
- comparação em três colunas;
- custo, duração e Request ID;
- salvamento local e download manual;
- testes simulados antes da primeira chamada real;
- primeira geração real da infraestrutura concluída antes das melhorias da Fase 2.

### Fase 2 — Qualidade e confiabilidade da geração

Estado: **concluída oficialmente em 16 de julho de 2026**.

#### Fase 02A — Prompt, referências e metadados

Estado: concluída.

- prompt `upper-garment-v2` centralizado;
- preservação explícita de identidade, pose, anatomia, cenário e enquadramento;
- fidelidade especializada para roupas superiores;
- regras conservadoras para logos, textos e detalhes ocultos;
- snapshot imutável das referências;
- controles bloqueados durante geração;
- limpeza de Object URLs;
- metadados técnicos ampliados;
- rubrica oficial de qualidade.

Detalhes: [FASE-02A-IMPLEMENTACAO.md](./FASE-02A-IMPLEMENTACAO.md).

#### Fase 02B — Templates e validação técnica das imagens

Estado: concluída.

- templates canônicos normalizados para JPEG real;
- política de imagens compartilhada entre frontend e backend;
- validação estrutural de JPEG, PNG e WebP;
- confronto de extensão, MIME e bytes;
- dimensões, proporção e orientação EXIF;
- erros bloqueantes e avisos de qualidade;
- UX técnica do upload;
- interface preparada para imagens verticais sem crop ou distorção;
- 4:5 documentado e mantido bloqueado.

Detalhes: [FASE-02B-IMPLEMENTACAO.md](./FASE-02B-IMPLEMENTACAO.md).

#### Encerramento da Fase 2

O encerramento foi realizado com uma única geração real autorizada, que validou:

- prompt v2;
- metadata;
- snapshot;
- bloqueios;
- custo;
- duração;
- Request ID;
- rubrica de qualidade.

Não houve nesta validação:

- teste A/B;
- comparação entre modelos;
- mudança para 4:5;
- retry;
- segunda chamada automática.

Resultado consolidado:

- modelo `google/gemini-3.1-flash-lite-image`;
- resolução `1K`;
- proporção efetiva `1:1`;
- prompt `upper-garment-v2`;
- custo de US$ 0,034351;
- duração de 7,077 segundos;
- Request ID não informado pelo provedor;
- nota da rubrica: 92/100;
- exatamente uma chamada e zero retries;
- aprovação técnica e visual concluídas.

O registro oficial está em [FASE-02-ENCERRAMENTO.md](./FASE-02-ENCERRAMENTO.md).

### Fase 3 — Templates Locais

Estado: **concluída, validada e publicada em 16 de julho de 2026**.

Escopo aprovado e implementado:

- view Templates acessível pela sidebar, sem React Router;
- listagem com imagem, nome, descrição, dados técnicos, validade, avisos e status;
- criação, edição e substituição de imagem;
- duplicação com novo ID e novo arquivo;
- ativação e desativação;
- exclusão com confirmação e proteção do último template válido e ativo;
- preview com `object-contain` e inspeção antes do upload;
- armazenamento local em `storage/templates/` por adaptador de repositório;
- `catalog.json`, `catalog.json.bak` e imagens com nomes gerados pelo backend;
- bootstrap dos templates `model-01` e `model-02` quando o catálogo ainda não existe;
- escrita atômica, mutex de mutações, recuperação por backup, compensação e limpeza de órfãos;
- proteção contra path traversal, schema versionado e limite operacional;
- bloqueio frontend e backend das mutações durante geração ativa;
- reconciliação da seleção quando um template deixa de ser válido e ativo;
- geração desacoplada de caminhos físicos e integrada ao `TemplateService`;
- compatibilidade integral com modelo, prompt, 1K, 1:1, snapshot, metadata, chamada única e zero retry da Fase 2.

Continuam fora do escopo:

- banco remoto, Supabase, autenticação ou sincronização;
- histórico de templates;
- busca, filtros ou paginação;
- campos avançados por template;
- ativação de 4:5;
- qualquer funcionalidade da Fase 4.

Detalhes e evidências: [FASE-03-IMPLEMENTACAO.md](./FASE-03-IMPLEMENTACAO.md).

Validação final aprovada:

- CRUD completo e proteção do último template válido e ativo;
- persistência de registros, IDs, estados e imagens após reinício;
- exclusões persistentes, sem reaparecimento de registros;
- catálogos principal e backup válidos, sem Base64 ou caminhos físicos;
- integração simulada com a geração preservando bytes, MIME, dimensões, `templateId` e metadata;
- interface validada em desktop e móvel, sem crop, distorção ou overflow horizontal;
- 23 arquivos e 95 testes aprovados;
- build aprovado com 1.801 módulos transformados;
- nenhuma geração real, chamada ao OpenRouter ou consumo de créditos;
- na conclusão da Fase 3, a Fase 4 ainda não havia sido iniciada.

### Fase 4 — Resultados e Histórico Local

Estado: **FASE 4 CONCLUÍDA OFICIALMENTE em 16 de julho de 2026**.

Escopo implementado:

- view Resultados na sidebar, sem React Router;
- listagem local ordenada do mais recente para o mais antigo;
- filtros Todos, Aguardando aprovação, Aprovados e Reprovados;
- cards com imagem, template, data, custo, duração, status e modelo;
- detalhe com comparação, metadata, custo, duração, Request ID e download local;
- `reviewStatus` independente do status técnico, com `pending`, `approved` e `rejected`;
- aprovação e reprovação persistentes por escrita atômica;
- exclusão confirmada por tombstone;
- suporte aos formatos legado e por diretório;
- novas gerações preservam resultado, template e roupa com bytes originais validados;
- referências históricas ausentes usam fallback honesto e nunca são reconstruídas;
- nenhum caminho físico ou Base64 na API ou metadata;
- nenhuma geração real, chamada ao OpenRouter ou crédito consumido na validação;
- 26 arquivos e 108 testes aprovados, com build concluído;
- Fase 5 não iniciada.

Validação final aprovada:

- duas gerações legadas, ordenação, filtros e detalhes conferidos;
- fallbacks históricos, campos ausentes e aviso sobre template atual confirmados;
- aprovação, reprovação e persistência após dois reinícios confirmadas com cópia controlada;
- download local e integridade dos assets aprovados;
- exclusão confirmada sem afetar resultados reais ou templates;
- desktop e móvel aprovados sem crop, distorção ou overflow;
- nenhuma geração real, chamada ao OpenRouter ou consumo de créditos;
- Fase 5 não iniciada.

Detalhes: [FASE-04-IMPLEMENTACAO.md](./FASE-04-IMPLEMENTACAO.md).

### Fase 5 — Produção em Lotes

Estado: **FASE 5 OFICIALMENTE CONCLUÍDA em 17 de julho de 2026**.

- lotes locais persistidos com snapshot de template e roupas;
- fila sequencial, concorrência global 1 com geração individual e zero retry;
- estados, pausa, retomada explícita, cancelamento e recuperação segura após reinício;
- resultados da Fase 4 vinculados por `batchId` e `batchItemId`;
- sem banco, autenticação, agendamento ou processamento paralelo;
- validação real com lote de 8 roupas: **8/8 itens concluídos**, custo estimado US$ 0,272 e custo real US$ 0,27618 (≈ US$ 0,28), processamento sequencial, uma chamada por item, zero retry automático, resultados persistidos corretamente;
- correção do botão "Abrir resultado", que agora abre diretamente o resultado correto vindo da fila de lotes;
- fluxo Aprovar/Reprovar com avanço automático para o próximo resultado pendente e fechamento com mensagem de conclusão quando a fila termina;
- download em lote (ZIP) dos resultados aprovados, preservando bytes e extensões originais;
- 124 testes aprovados em 28 arquivos e build aprovado;
- nenhuma geração real fora da validação autorizada, nenhuma chamada ao OpenRouter fora dela e nenhum crédito consumido além do registrado na validação.

Detalhes: [FASE-05-IMPLEMENTACAO.md](./FASE-05-IMPLEMENTACAO.md).

Fase 6 ainda não foi iniciada.

#### Próximas melhorias aprovadas, ainda não iniciadas

- **Fase 5.1 — UX Enterprise da Fila de Produção**, inspirada na referência visual Base44;
- **Branding/Logo**: upload e validação de logo transparente, aprovação explícita do usuário e aplicação automática por overlay tradicional, sem uso de IA para redesenhar a logo, mantendo sempre disponível a versão original sem logo;
- **download em massa das imagens finais**, ampliando o download em lote já validado na Fase 5.

Nenhuma dessas melhorias foi iniciada; permanecem fora do escopo até aprovação explícita de início.

## 7. Critérios cumpridos para passagem da Fase 2

A declaração `FASE 2 CONCLUÍDA` foi registrada depois da confirmação de todos os critérios:

- a única geração controlada tiver autorização explícita;
- exatamente uma chamada tiver sido executada;
- o modelo, resolução e proporção efetivos coincidirem com este documento;
- não tiver ocorrido retry;
- o resultado e o metadata tiverem sido salvos;
- o resultado tiver sido devolvido ao navegador;
- snapshot e bloqueios tiverem sido confirmados;
- custo, duração e Request ID tiverem sido registrados;
- o metadata contiver prompt e configuração da Fase 2;
- a rubrica tiver sido preenchida;
- o usuário tiver concluído a avaliação visual;
- testes simulados e build continuarem aprovados;
- o relatório de encerramento tiver sido completado.

## 8. Documentos subordinados

- [README operacional](../README.md)
- [Fase 02A](./FASE-02A-IMPLEMENTACAO.md)
- [Fase 02B](./FASE-02B-IMPLEMENTACAO.md)
- [Encerramento da Fase 2](./FASE-02-ENCERRAMENTO.md)
- [Rubrica oficial](./FASE-02-RUBRICA-QUALIDADE.md)
- [Histórico do projeto](./HISTORICO.md)
- [Fase 3 — Templates Locais](./FASE-03-IMPLEMENTACAO.md)
- [Fase 4 — Resultados e Histórico Local](./FASE-04-IMPLEMENTACAO.md)
- [Fase 5 — Produção em Lotes](./FASE-05-IMPLEMENTACAO.md)

Em caso de conflito de escopo, este Documento Mestre prevalece.
