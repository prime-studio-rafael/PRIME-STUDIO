async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'A API local devolveu um erro.');
    error.code = body?.error?.code || 'API_ERROR';
    error.retryable = body?.error?.retryable || false;
    throw error;
  }
  return body;
}

export async function fetchConfig() {
  return requestJson('/api/config');
}

export async function fetchTemplates() {
  const body = await requestJson('/api/templates');
  return body.templates || [];
}

export async function generateImage({ templateId, modelId, garmentFile, confirmPaid }) {
  const formData = new FormData();
  formData.append('templateId', templateId);
  formData.append('modelId', modelId);
  formData.append('confirmPaid', String(confirmPaid));
  formData.append('garmentImage', garmentFile);

  return requestJson('/api/generations', {
    method: 'POST',
    body: formData,
  });
}
