const REQUEST_TIMEOUT_MS = 15_000;
async function requestJson(url, options) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal }); const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body?.error?.message || 'Não foi possível concluir a operação com resultados.'); error.code = body?.error?.code || 'API_ERROR'; throw error; }
    return body;
  } catch (error) { if (error?.name === 'AbortError') throw new Error('A API local demorou mais que 15 segundos para responder.'); throw error; }
  finally { clearTimeout(timeout); }
}
export function fetchResults() { return requestJson('/api/results'); }
export function fetchResult(id) { return requestJson(`/api/results/${encodeURIComponent(id)}`); }
export function updateResultStatus(id, reviewStatus) { return requestJson(`/api/results/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewStatus }) }); }
export function deleteResult(id) { return requestJson(`/api/results/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export const APPROVED_ZIP_DOWNLOAD_URL = '/api/results/download/approved';
