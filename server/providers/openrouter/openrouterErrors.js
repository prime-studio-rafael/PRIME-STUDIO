import { AppError } from '../../utils/errors.js';

export function mapOpenRouterStatus(status) {
  const map = {
    400: ['OPENROUTER_BAD_REQUEST', 'O OpenRouter recusou os parâmetros da geração.', 400],
    401: ['OPENROUTER_AUTH_ERROR', 'A chave do OpenRouter não foi aceita.', 503],
    402: ['OPENROUTER_CREDITS_ERROR', 'Não há créditos suficientes no OpenRouter.', 402],
    408: ['OPENROUTER_TIMEOUT', 'A geração demorou mais que o esperado.', 504],
    429: ['OPENROUTER_RATE_LIMIT', 'O limite de requisições do OpenRouter foi atingido.', 429],
  };
  const [code, message, mappedStatus] = map[status] || ['OPENROUTER_UNAVAILABLE', 'O serviço de geração está temporariamente indisponível.', 502];
  return new AppError(code, message, { status: mappedStatus, retryable: false });
}
