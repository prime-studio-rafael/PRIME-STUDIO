# PRIME STUDIO — Documento Mestre

Versão: 1.1  
Estado: referência oficial do projeto  
Última consolidação: 16 de julho de 2026 — encerramento oficial da Fase 2

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
- uma única tela operacional;
- estado mantido em memória durante a sessão.

### Backend local

- Node.js;
- Express;
- upload multipart em memória;
- serviço de geração separado do cliente OpenRouter;
- catálogo local de templates;
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
- roupa somente em memória;
- template lido do catálogo local.

### Infraestrutura deliberadamente ausente

- banco de dados;
- Supabase;
- Firebase;
- autenticação;
- usuários;
- Docker;
- fila;
- processamento em lote;
- infraestrutura em nuvem;
- histórico navegável;
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

### Fase 3

Estado: planejamento autorizado; implementação não autorizada.

Esta versão do Documento Mestre ainda não atribui funcionalidades definitivas à Fase 3. A auditoria, o escopo proposto, as prioridades e o cronograma devem ser submetidos à aprovação antes de qualquer alteração de código. A Fase 3 não pode ser implementada enquanto seu plano não for aprovado e incorporado a este documento.

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

Em caso de conflito de escopo, este Documento Mestre prevalece.
