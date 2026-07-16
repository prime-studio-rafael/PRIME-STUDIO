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
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchOpenRouterKeyStatus() {
  return requestJson('/api/secrets/openrouter/status');
}

export function saveOpenRouterKey(apiKey) {
  return requestJson('/api/secrets/openrouter', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
}

export function deleteOpenRouterKey() {
  return requestJson('/api/secrets/openrouter', { method: 'DELETE' });
}

export function testOpenRouterKey() {
  return requestJson('/api/secrets/openrouter/test', { method: 'POST' });
}
