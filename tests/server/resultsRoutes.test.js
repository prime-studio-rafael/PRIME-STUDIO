// @vitest-environment node
import { createApp } from '../../server/app.js';

describe('results HTTP API', () => {
  let server; let baseUrl; let service;
  beforeEach(async () => {
    service = { list: vi.fn(async () => [{ id: 'result-1' }]), get: vi.fn(async (id) => ({ id })), readAsset: vi.fn(async () => ({ buffer: Buffer.from('RIFFxxxxWEBPVP8 '), mimeType: 'image/webp', filename: 'result.webp' })), setReviewStatus: vi.fn(async (id, reviewStatus) => ({ id, reviewStatus })), delete: vi.fn(async (id) => ({ id, deleted: true })) };
    const app = createApp({ resultService: service, generationService: { generate: vi.fn(), isBusy: () => false }, templateService: { list: vi.fn(async () => []), isBusy: () => false } });
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

  it('lists, gets, updates and deletes results', async () => {
    expect(await (await fetch(`${baseUrl}/api/results`)).json()).toEqual([{ id: 'result-1' }]);
    expect(await (await fetch(`${baseUrl}/api/results/result-1`)).json()).toEqual({ id: 'result-1' });
    const patched = await fetch(`${baseUrl}/api/results/result-1/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewStatus: 'approved' }) });
    expect(await patched.json()).toEqual({ id: 'result-1', reviewStatus: 'approved' });
    expect(service.setReviewStatus).toHaveBeenCalledWith('result-1', 'approved');
    expect(await (await fetch(`${baseUrl}/api/results/result-1`, { method: 'DELETE' })).json()).toEqual({ id: 'result-1', deleted: true });
  });

  it('serves assets with MIME, length and nosniff', async () => {
    const response = await fetch(`${baseUrl}/api/results/result-1/assets/result`);
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('image/webp');
    expect(response.headers.get('content-length')).toBe('16'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
