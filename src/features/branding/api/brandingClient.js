const REQUEST_TIMEOUT_MS = 15_000;

async function requestJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Não foi possível concluir a operação de branding.');
      error.code = body?.error?.code || 'API_ERROR';
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A API local demorou mais que 15 segundos para responder.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchBrandingState() { return requestJson('/api/branding'); }
export function uploadBrandingLogo(file, variant) { const data = new FormData(); data.append('logo', file); return requestJson(`/api/branding/logo?variant=${encodeURIComponent(variant)}`, { method: 'POST', body: data }); }
export function approveBrandingLogo(variant = 'primary') { return requestJson(`/api/branding/approve?variant=${encodeURIComponent(variant)}`, { method: 'POST' }); }
export function updateBrandingConfig(enabled) { return requestJson('/api/branding/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }); }
export function deleteBrandingLogo(variant = 'primary') { return requestJson(`/api/branding/logo?variant=${encodeURIComponent(variant)}`, { method: 'DELETE' }); }
export const BRANDING_PENDING_LOGO_URL = '/api/branding/logo?variant=pending';
export const BRANDING_APPROVED_LOGO_URL = '/api/branding/logo?variant=approved';
export const BRANDING_WHITE_LOGO_URL = '/api/branding/logo?variant=white';
export const BRANDING_PREVIEW_ORIGINAL_URL = '/api/branding/preview?variant=original';
export const BRANDING_PREVIEW_BRANDED_URL = '/api/branding/preview?variant=branded';
