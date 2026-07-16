import { AppError } from '../../utils/errors.js';
import { mapOpenRouterStatus } from './openrouterErrors.js';

export function createOpenRouterClient({ getOpenRouterApiKey = async () => null, fetchImpl = globalThis.fetch, baseUrl = 'https://openrouter.ai/api/v1', timeoutMs = 120_000 } = {}) {
  async function generate({ model, prompt, inputReferences, references, resolution, aspectRatio, timeoutMs: requestTimeoutMs }) {
      let effectiveApiKey = await getOpenRouterApiKey();
      if (!effectiveApiKey) {
        throw new AppError('OPENROUTER_KEY_MISSING', 'Configure a chave do OpenRouter antes de gerar.', { status: 503 });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs || timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost',
            'X-OpenRouter-Title': 'PRIME IA STUDIO LOCAL',
          },
          body: JSON.stringify({
            model,
            prompt,
            resolution,
            aspect_ratio: aspectRatio,
            input_references: (inputReferences || references || []).map((url) => ({
              type: 'image_url',
              image_url: { url },
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw mapOpenRouterStatus(response.status);
        }

        let body;
        try {
          body = await response.json();
        } catch (error) {
          throw new AppError('OPENROUTER_INVALID_RESPONSE', 'O OpenRouter devolveu uma resposta inválida.', { status: 502, cause: error });
        }

        return {
          body,
          requestId: response.headers?.get?.('x-request-id') || response.headers?.get?.('request-id') || null,
        };
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new AppError('OPENROUTER_TIMEOUT', 'A geração demorou mais que o esperado.', { status: 504 });
        }
        throw error;
      } finally {
        effectiveApiKey = null;
        clearTimeout(timeout);
      }
  }

  const callableClient = (request) => generate(request);
  callableClient.generate = generate;
  return callableClient;
}
