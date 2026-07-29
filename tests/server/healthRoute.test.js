// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { startTestServer } from './testServer.js';

describe('GET /api/health', () => {
  it('expõe somente estados seguros de health local', async () => {
    const app = createApp({
      generateImage: vi.fn(),
      keyResolver: { getStatus: vi.fn(async () => ({ configured: true })) },
      localHealthService: { getStatus: vi.fn(async () => ({ storage: { status: 'available' }, renderer: { status: 'unavailable' } })) },
    });
    const server = await startTestServer(app);
    try {
      const response = await fetch(`${server.baseUrl}/api/health`); const body = await response.json();
      expect(body).toEqual({ status: 'ok', keyConfigured: true, storage: { status: 'available' }, renderer: { status: 'unavailable' } });
      expect(JSON.stringify(body)).not.toMatch(/storage\/|\/Users|stack/i);
    } finally { await server.close(); }
  });
});
