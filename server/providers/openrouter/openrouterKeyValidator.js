import { AppError } from '../../utils/errors.js';

export function createOpenRouterKeyValidator({
  getOpenRouterApiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://openrouter.ai/api/v1',
  timeoutMs = 15_000,
} = {}) {
  return {
    async validate() {
      let apiKey = await getOpenRouterApiKey();
      if (!apiKey) {
        return { valid: false, message: 'Configure uma chave antes de testar a conexão.' };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/key`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-OpenRouter-Title': 'PRIME IA STUDIO LOCAL',
          },
          signal: controller.signal,
        });

        if (response.ok) return { valid: true, message: 'Chave válida. A conexão com o OpenRouter foi confirmada.' };
        if (response.status === 401) return { valid: false, message: 'A chave do OpenRouter não foi aceita.' };
        return { valid: false, message: 'Não foi possível validar a chave agora. Tente novamente manualmente.' };
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new AppError('OPENROUTER_KEY_TEST_TIMEOUT', 'A validação da chave demorou mais que o esperado.', { status: 504 });
        }
        throw new AppError('OPENROUTER_KEY_TEST_FAILED', 'Não foi possível validar a chave agora. Tente novamente manualmente.', { status: 503, cause: error });
      } finally {
        apiKey = null;
        clearTimeout(timeout);
      }
    },
  };
}
