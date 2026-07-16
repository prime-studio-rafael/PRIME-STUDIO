# PRIME IA STUDIO — MVP local

Protótipo local para validar a troca de roupas superiores em fotografias de modelo usando o OpenRouter.

## Referência oficial e estado do projeto

O escopo e a ordem das fases são definidos pelo [Documento Mestre](docs/DOCUMENTO-MESTRE.md).

- Fase 1: concluída;
- Fase 02A: concluída;
- Fase 02B: concluída;
- Fase 2: **concluída oficialmente em 16 de julho de 2026**;
- Fase 3: **tecnicamente concluída em 16 de julho de 2026**; aguardando somente autorização separada para commit e push.
- Fase 4: não iniciada.

O encerramento está registrado em [FASE-02-ENCERRAMENTO.md](docs/FASE-02-ENCERRAMENTO.md) e a evolução consolidada do projeto em [HISTORICO.md](docs/HISTORICO.md).

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

Na sidebar, abra **Configurações** → **OpenRouter**. Cole a chave no campo protegido e clique em **Salvar chave**.

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

## Salvamento

Imagens concluídas e metadata mínimo são salvos automaticamente em:

```text
storage/results/
```

Inputs, Base64, payloads e respostas completas não são salvos.

O diretório ainda não existe enquanto nenhuma geração for concluída; ele será criado automaticamente no primeiro sucesso.

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

Os testes usam respostas simuladas e não acessam o OpenRouter. Estado atual: 23 arquivos e 95 testes aprovados, incluindo os 63 testes anteriores.

## Limitações intencionais

- uma aplicação local com as views Nova geração e Templates, sem React Router;
- somente Nano Banana 2 Lite;
- somente roupas superiores;
- proporção efetiva validada em 1:1 na Fase 2; 4:5 é melhoria futura;
- resolução fixa 1K;
- sem histórico navegável;
- sem banco, autenticação, fila ou infraestrutura em nuvem;
- sem retry automático;
- templates atuais são fotografias locais JPEG válidas para a geração 1:1; a futura adoção de 4:5 exigirá templates compatíveis;
- chave persistida apenas no Chaves do macOS; o `.env` é somente fallback local.
