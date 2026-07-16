# PRIME IA STUDIO — MVP local

Protótipo local para validar a troca de roupas superiores em fotografias de modelo usando o OpenRouter.

## Referência oficial e estado do projeto

O escopo e a ordem das fases são definidos pelo [Documento Mestre](docs/DOCUMENTO-MESTRE.md).

- Fase 1: concluída;
- Fase 02A: concluída;
- Fase 02B: concluída;
- Fase 2: **concluída oficialmente em 16 de julho de 2026**;
- Fase 3: planejamento autorizado; implementação ainda não autorizada.

O encerramento está registrado em [FASE-02-ENCERRAMENTO.md](docs/FASE-02-ENCERRAMENTO.md) e a evolução consolidada do projeto em [HISTORICO.md](docs/HISTORICO.md).

## Requisitos

- Node.js 20.19+;
- uma chave do OpenRouter com créditos, somente quando o teste real for autorizado.

## Instalação

Entre na pasta do projeto:

```bash
cd /Users/macbook/Projetos/PRIME-STUDIO
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

Para desenvolvimento local, o backend ainda aceita a chave em `.env`. O arquivo carregado é exatamente:

```text
/Users/macbook/Projetos/PRIME-STUDIO/.env
```

Use a linha abaixo, sem o prefixo `VITE_`:

```text
OPENROUTER_API_KEY=COLE_SUA_CHAVE_AQUI
```

O Keychain tem prioridade. Se uma chave estiver salva no Chaves do macOS, ela será usada no lugar do `.env`. O `.env` é lido na inicialização; a chave salva pela interface passa a valer imediatamente, sem reiniciar o servidor.

## Templates locais

Os arquivos usados pelo catálogo são exatamente:

- `public/templates/model-01.jpeg`
- `public/templates/model-02.jpeg`

Substitua os dois arquivos pelas fotografias aprovadas, mantendo os mesmos nomes e bytes JPEG. A Fase 2 foi validada com os templates atuais e geração em 1:1. Fotografias verticais em 4:5 ficam como recomendação para uma melhoria futura. Cada template deve ter pelo menos 0,75 MP, sem rotação EXIF pendente, e pode ter até 10 MB.

O catálogo confere extensão, MIME, bytes, integridade, dimensões, proporção e orientação. Se quiser usar PNG ou WebP, altere também os nomes, `expectedMimeType` e URLs em `server/catalogs/templates.js`; não salve JPEG com extensão `.webp`.

Se você mantiver os nomes, não é necessário reiniciar o servidor Node: basta recarregar a página. Um hard refresh do navegador pode ser necessário por cache.

Se alterar nomes, extensões ou IDs, atualize `server/catalogs/templates.js` e reinicie `npm run dev`.

Os arquivos `model-01-legacy-q70.jpeg` e `model-02-legacy-q70.jpeg` preservam as versões JPEG anteriores de menor qualidade e não são usados pelo catálogo. Os SVGs e `00model-*.webp` são placeholders legados e também não são usados. Não há imagens remotas.

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

Os testes usam respostas simuladas e não acessam o OpenRouter.

## Limitações intencionais

- somente uma tela;
- somente Nano Banana 2 Lite;
- somente roupas superiores;
- proporção efetiva validada em 1:1 na Fase 2; 4:5 é melhoria futura;
- resolução fixa 1K;
- sem histórico navegável;
- sem banco, autenticação, fila ou infraestrutura em nuvem;
- sem retry automático;
- templates atuais são fotografias locais JPEG válidas para a geração 1:1; a futura adoção de 4:5 exigirá templates compatíveis.
- chave persistida apenas no Chaves do macOS; o `.env` é somente fallback local.
