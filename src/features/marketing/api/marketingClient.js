const REQUEST_TIMEOUT_MS = 30_000;

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Não foi possível concluir a operação no Marketing Studio.');
      error.code = body?.error?.code || 'API_ERROR';
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API local demorou mais que 30 segundos para responder.');
    throw error;
  } finally { clearTimeout(timeout); }
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export function fetchMarketingBootstrap() { return Promise.all([requestJson('/api/marketing/layouts'), requestJson('/api/marketing/sources'), requestJson('/api/marketing/weeks')]); }
export function fetchMarketingWeek(id) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}`); }
export function createMarketingWeek(weekStart) { return requestJson('/api/marketing/weeks', json('POST', { weekStart })); }
export function updateMarketingWeek(id, changes) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}`, json('PATCH', changes)); }
export function approveMarketingWeek(id) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}/approve`, json('POST')); }
export function draftMarketingWeek(id) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}/draft`, json('POST')); }
export function closeMarketingWeek(id) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}/close`, json('POST')); }
export function proposeMarketingWeek(id, items) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}/proposal`, json('POST', { items })); }
export function deleteMarketingWeek(id) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export function createMarketingStory(weekId, story) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(weekId)}/stories`, json('POST', story)); }
export function updateMarketingStory(weekId, storyId, story) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(weekId)}/stories/${encodeURIComponent(storyId)}`, json('PATCH', story)); }
export function deleteMarketingStory(weekId, storyId) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(weekId)}/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE' }); }
export function renderMarketingStory(weekId, storyId) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(weekId)}/stories/${encodeURIComponent(storyId)}/render`, json('POST')); }
export function updateMarketingEditorialStatus(weekId, storyId, editorialStatus) { return requestJson(`/api/marketing/weeks/${encodeURIComponent(weekId)}/stories/${encodeURIComponent(storyId)}/editorial-status`, json('PATCH', { editorialStatus })); }
export function marketingAssetUrl(weekId, storyId, kind) { return `/api/marketing/weeks/${encodeURIComponent(weekId)}/stories/${encodeURIComponent(storyId)}/assets/${kind}`; }
