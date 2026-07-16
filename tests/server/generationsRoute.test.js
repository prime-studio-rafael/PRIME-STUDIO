import { createApp } from '../../server/app.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('generation route', () => {
  let server;
  let baseUrl;
  let generate;

  beforeEach(async () => {
    generate = vi.fn(async () => ({
      generationId: 'route-test',
      image: { dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png', downloadFilename: 'result.png' },
      metrics: { costUsd: null, durationMs: 10 },
      localSave: { saved: true },
    }));
    const app = createApp({
      env: { apiKey: 'test-key' },
      generationService: { generate },
      keyResolver: { getStatus: vi.fn(async () => ({ configured: true, source: 'env' })), getOpenRouterApiKey: vi.fn(async () => 'test-key') },
    });
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('passes one multipart request to the service', async () => {
    const form = new FormData();
    form.append('templateId', 'model-01');
    form.append('modelId', 'nano-banana-lite');
    form.append('confirmPaid', 'true');
    form.append('garmentImage', new Blob([png], { type: 'image/png' }), 'garment.png');

    const response = await fetch(`${baseUrl}/api/generations`, { method: 'POST', body: form });
    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].garmentFile.buffer.length).toBe(png.length);
  });

  it('translates oversized multipart payloads before the service', async () => {
    const form = new FormData();
    form.append('templateId', 'model-01');
    form.append('modelId', 'nano-banana-lite');
    form.append('confirmPaid', 'true');
    form.append('garmentImage', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');

    const response = await fetch(`${baseUrl}/api/generations`, { method: 'POST', body: form });
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe('FILE_TOO_LARGE');
    expect(generate).not.toHaveBeenCalled();
  });
});
