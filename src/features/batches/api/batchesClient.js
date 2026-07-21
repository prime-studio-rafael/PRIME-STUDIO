async function request(url, options) {
  const response = await fetch(url, options); const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'Não foi possível concluir a operação do lote.'); return body;
}
export const fetchBatches = () => request('/api/batches');
export const fetchBatch = (id) => request(`/api/batches/${encodeURIComponent(id)}`);
export function createBatch({ name, templateId, files, additionalInstruction }) { const data = new FormData(); data.append('name', name); data.append('templateId', templateId); if (additionalInstruction) data.append('additionalInstruction', additionalInstruction); files.forEach((file) => data.append('garmentImages', file)); return request('/api/batches', { method: 'POST', body: data }); }
export const batchAction = (id, action, payload = {}) => request(`/api/batches/${encodeURIComponent(id)}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
