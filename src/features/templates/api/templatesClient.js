const REQUEST_TIMEOUT_MS = 15_000;

async function requestJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Não foi possível concluir a operação com templates.');
      error.code = body?.error?.code || 'API_ERROR';
      error.retryable = body?.error?.retryable || false;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('A API local demorou mais que 15 segundos para responder.');
      timeoutError.code = 'LOCAL_API_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTemplates() {
  const body = await requestJson('/api/templates');
  return body.templates || [];
}

export async function fetchTemplatesPage({ page, pageSize, search, category } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', page);
  if (pageSize !== undefined) params.set('pageSize', pageSize);
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const query = params.toString();
  const body = await requestJson(`/api/templates${query ? `?${query}` : ''}`);
  return { templates: body.templates || [], page: body.page, pageSize: body.pageSize, total: body.total };
}

export async function fetchTemplateCategories() {
  const body = await requestJson('/api/templates/categories');
  return body.categories || [];
}

const GENERATION_PROFILE_FIELDS = ['prompt', 'negativePrompt', 'provider', 'modelId', 'generationAspectRatio', 'resolution'];

export async function createTemplate({ label, description, category, tags, hoverDescription, file, ...generationProfile }) {
  const formData = new FormData();
  formData.append('label', label);
  formData.append('description', description || '');
  if (category !== undefined) formData.append('category', category);
  if (tags !== undefined) formData.append('tags', JSON.stringify(tags));
  if (hoverDescription !== undefined) formData.append('hoverDescription', hoverDescription || '');
  formData.append('templateImage', file);
  for (const field of GENERATION_PROFILE_FIELDS) {
    if (generationProfile[field] !== undefined) formData.append(field, generationProfile[field] || '');
  }
  return (await requestJson('/api/templates', { method: 'POST', body: formData })).template;
}

export async function updateTemplate(id, { label, description, category, tags, hoverDescription, ...generationProfile }) {
  const body = { label, description, category, tags, hoverDescription };
  for (const field of GENERATION_PROFILE_FIELDS) {
    if (generationProfile[field] !== undefined) body[field] = generationProfile[field];
  }
  return (await requestJson(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).template;
}

export async function replaceTemplateImage(id, file) {
  const formData = new FormData();
  formData.append('templateImage', file);
  return (await requestJson(`/api/templates/${encodeURIComponent(id)}/image`, { method: 'PUT', body: formData })).template;
}

export async function duplicateTemplate(id) {
  return (await requestJson(`/api/templates/${encodeURIComponent(id)}/duplicate`, { method: 'POST' })).template;
}

export async function setTemplateActive(id, active) {
  return (await requestJson(`/api/templates/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  })).template;
}

export function deleteTemplate(id) {
  return requestJson(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
