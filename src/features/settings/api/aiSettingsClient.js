const REQUEST_TIMEOUT_MS = 10_000;

async function requestJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Não foi possível concluir a operação local.');
      error.code = body?.error?.code || 'API_ERROR';
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('A API local demorou mais que 10 segundos para responder.');
      timeoutError.code = 'LOCAL_API_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export const fetchAiProviders = () => requestJson('/api/ai/providers');
export const saveDeepSeekKey = (apiKey) => requestJson('/api/ai/providers/deepseek/key', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) });
export const removeDeepSeekKey = () => requestJson('/api/ai/providers/deepseek/key', { method: 'DELETE' });
export const testDeepSeekKey = () => requestJson('/api/ai/providers/deepseek/test', { method: 'POST' });
export const updateDeepSeekSettings = (modelId) => requestJson('/api/ai/providers/deepseek/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modelId }) });
