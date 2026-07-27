import { AppError } from '../../utils/errors.js';

export function createDeepSeekKeyValidator({
  getApiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://api.deepseek.com',
  timeoutMs = 15_000,
} = {}) {
  return Object.freeze({
    async validate(modelId = 'deepseek-v4-flash') {
      let apiKey = await getApiKey();
      if (!apiKey) return { valid: false, message: 'Configure uma chave antes de testar a conexão.' };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/models`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return { valid: false, message: 'A chave do DeepSeek não foi aceita.' };
        if (!response.ok) return { valid: false, message: 'Não foi possível validar a chave agora. Tente novamente manualmente.' };
        const body = await response.json().catch(() => ({}));
        const available = Array.isArray(body?.data) && body.data.some((model) => model?.id === modelId);
        return available
          ? { valid: true, message: 'Chave válida. A conexão com o DeepSeek foi confirmada.' }
          : { valid: false, message: 'A conexão funcionou, mas o modelo selecionado não está disponível.' };
      } catch (error) {
        if (error?.name === 'AbortError') throw new AppError('DEEPSEEK_KEY_TEST_TIMEOUT', 'A validação da chave demorou mais que o esperado.', { status: 504 });
        throw new AppError('DEEPSEEK_KEY_TEST_FAILED', 'Não foi possível validar a chave agora. Tente novamente manualmente.', { status: 503, cause: error });
      } finally {
        apiKey = null;
        clearTimeout(timeout);
      }
    },
  });
}
