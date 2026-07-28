// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { startTestServer } from './testServer.js';

function dependencies(aiSettingsService) {
  return {
    aiSettingsService,
    aiSettingsRepository: { ensureInitialized: vi.fn(async () => {}) },
    keyResolver: { getStatus: vi.fn(async () => ({ configured: false, source: 'none' })), getOpenRouterApiKey: vi.fn(async () => null) },
    keyStore: { getKey: vi.fn(async () => null), saveKey: vi.fn(), deleteKey: vi.fn() },
    keyValidator: { validate: vi.fn() },
    generateImage: vi.fn(),
  };
}

describe('AI settings routes', () => {
  it('lists providers and handles DeepSeek without returning a secret', async () => {
    const safeProvider = { provider: 'deepseek', configured: true, modelId: 'deepseek-v4-flash', lastTestedAt: null, lastTestStatus: 'never' };
    const service = {
      list: vi.fn(async () => [safeProvider]), getDeepSeek: vi.fn(async () => safeProvider),
      saveDeepSeekKey: vi.fn(async () => ({ ...safeProvider, message: 'Chave salva.' })),
      removeDeepSeekKey: vi.fn(async () => ({ ...safeProvider, configured: false })),
      testDeepSeek: vi.fn(async () => ({ valid: true, message: 'Conexão confirmada.', provider: safeProvider })),
      updateDeepSeekSettings: vi.fn(async () => safeProvider), recordOpenRouterTest: vi.fn(),
      getDashboardSettings: vi.fn(async () => ({ usdToBrlRate: 5.5 })), updateDashboardSettings: vi.fn(async (rate) => ({ usdToBrlRate: rate })),
    };
    const app = createApp(dependencies(service));
    const server = await startTestServer(app);
    try {
      const listed = await fetch(`${server.baseUrl}/api/ai/providers`);
      expect(await listed.json()).toEqual({ providers: [safeProvider] });
      const saved = await fetch(`${server.baseUrl}/api/ai/providers/deepseek/key`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'server-only-secret-that-is-long-enough' }) });
      const body = await saved.json();
      expect(saved.status).toBe(201);
      expect(service.saveDeepSeekKey).toHaveBeenCalledWith('server-only-secret-that-is-long-enough');
      expect(JSON.stringify(body)).not.toContain('server-only-secret');
      await fetch(`${server.baseUrl}/api/ai/providers/deepseek/test`, { method: 'POST' });
      expect(service.testDeepSeek).toHaveBeenCalledTimes(1);
      const dashboard = await fetch(`${server.baseUrl}/api/ai/providers/dashboard-settings`);
      expect(await dashboard.json()).toEqual({ usdToBrlRate: 5.5 });
      const updated = await fetch(`${server.baseUrl}/api/ai/providers/dashboard-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usdToBrlRate: 5.5 }) });
      expect(await updated.json()).toEqual({ usdToBrlRate: 5.5 });
      expect(service.updateDashboardSettings).toHaveBeenCalledWith(5.5);
    } finally { await server.close(); }
  });
});
