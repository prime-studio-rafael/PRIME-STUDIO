// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { createOpenRouterKeyValidator } from '../../server/providers/openrouter/openrouterKeyValidator.js';
import { createOpenRouterKeyResolver } from '../../server/secrets/openrouterKeyResolver.js';
import { createOpenRouterKeyStore } from '../../server/secrets/openrouterKeyStore.js';
import { AppError } from '../../server/utils/errors.js';
import { startTestServer } from './testServer.js';

describe('OpenRouter keychain store', () => {
  it('saves the key through a spawn argument array and never uses a shell command', async () => {
    let capturedArgs;
    const runSecurity = vi.fn(async (args) => {
      capturedArgs = [...args];
    });
    const store = createOpenRouterKeyStore({ runSecurity });

    await store.saveKey('test-secret-key-that-is-long-enough');

    expect(runSecurity).toHaveBeenCalledTimes(1);
    expect(capturedArgs).toEqual(expect.arrayContaining(['add-generic-password', '-s', 'PRIME_IA_STUDIO_OPENROUTER', '-a', 'local-user', '-U']));
    expect(capturedArgs.at(-2)).toBe('-w');
    expect(capturedArgs.at(-1)).toBe('test-secret-key-that-is-long-enough');
    expect(runSecurity.mock.calls[0][0].at(-1)).toBe('');
  });

  it('loads and removes a key through the mocked Keychain command', async () => {
    const runSecurity = vi.fn()
      .mockResolvedValueOnce('test-secret-key-that-is-long-enough\n')
      .mockResolvedValueOnce(undefined);
    const store = createOpenRouterKeyStore({ runSecurity });

    await expect(store.getKey()).resolves.toBe('test-secret-key-that-is-long-enough');
    await expect(store.deleteKey()).resolves.toBe(true);
    expect(runSecurity.mock.calls[0][0]).toEqual(expect.arrayContaining(['find-generic-password', '-w']));
    expect(runSecurity.mock.calls[1][0]).toEqual(expect.arrayContaining(['delete-generic-password']));
  });

  it('treats a missing key as absent and propagates Keychain access errors safely', async () => {
    const missing = new AppError('KEYCHAIN_KEY_NOT_FOUND', 'not found', { status: 404 });
    const store = createOpenRouterKeyStore({ runSecurity: vi.fn(async () => { throw missing; }) });
    await expect(store.getKey()).resolves.toBeNull();
    await expect(store.deleteKey()).resolves.toBe(false);

    const denied = new AppError('KEYCHAIN_ACCESS_ERROR', 'denied', { status: 503 });
    const failingStore = createOpenRouterKeyStore({ runSecurity: vi.fn(async () => { throw denied; }) });
    await expect(failingStore.hasKey()).rejects.toMatchObject({ code: 'KEYCHAIN_ACCESS_ERROR' });
  });
});

describe('OpenRouter key resolver', () => {
  it('uses Keychain before the .env fallback', async () => {
    const keyStore = { getKey: vi.fn(async () => 'keychain-secret') };
    const resolver = createOpenRouterKeyResolver({ keyStore, getEnvKey: () => 'env-secret' });

    await expect(resolver.getStatus()).resolves.toEqual({ configured: true, source: 'keychain' });
    await expect(resolver.getOpenRouterApiKey()).resolves.toBe('keychain-secret');
  });

  it('uses .env only when Keychain has no key', async () => {
    const resolver = createOpenRouterKeyResolver({ keyStore: { getKey: vi.fn(async () => null) }, getEnvKey: () => 'env-secret' });
    await expect(resolver.resolve()).resolves.toEqual({ apiKey: 'env-secret', source: 'env' });
  });
});

describe('OpenRouter key validation', () => {
  it('uses GET /key exactly once and never calls /images', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const validator = createOpenRouterKeyValidator({ getOpenRouterApiKey: async () => 'test-secret', fetchImpl });

    await expect(validator.validate()).resolves.toMatchObject({ valid: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/key');
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
    expect(fetchImpl.mock.calls[0][0]).not.toContain('/images');
  });

  it('does not retry a failed key validation', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    const validator = createOpenRouterKeyValidator({ getOpenRouterApiKey: async () => 'test-secret', fetchImpl });
    await expect(validator.validate()).rejects.toMatchObject({ code: 'OPENROUTER_KEY_TEST_FAILED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('OpenRouter secret endpoints', () => {
  it('saves, reports status, tests and removes a key without returning it or logging it', async () => {
    let source = 'none';
    const keyStore = {
      saveKey: vi.fn(async () => { source = 'keychain'; }),
      deleteKey: vi.fn(async () => { source = 'none'; }),
      getKey: vi.fn(async () => null),
    };
    const keyResolver = {
      getStatus: vi.fn(async () => ({ configured: source !== 'none', source })),
      getOpenRouterApiKey: vi.fn(async () => (source === 'keychain' ? 'server-only-secret' : null)),
    };
    const keyValidator = { validate: vi.fn(async () => ({ valid: true, message: 'Chave válida.' })) };
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const app = createApp({ keyStore, keyResolver, keyValidator, generateImage: vi.fn() });
    const server = await startTestServer(app);

    try {
      const initial = await fetch(`${server.baseUrl}/api/secrets/openrouter/status`);
      expect(await initial.json()).toEqual({ configured: false, source: 'none' });

      const saved = await fetch(`${server.baseUrl}/api/secrets/openrouter`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '  server-only-secret-that-is-long-enough  ' }),
      });
      const savedBody = await saved.json();
      expect(saved.status).toBe(201);
      expect(keyStore.saveKey).toHaveBeenCalledWith('server-only-secret-that-is-long-enough');
      expect(JSON.stringify(savedBody)).not.toContain('server-only-secret');

      const tested = await fetch(`${server.baseUrl}/api/secrets/openrouter/test`, { method: 'POST' });
      expect(await tested.json()).toEqual({ valid: true, message: 'Chave válida.' });
      expect(keyValidator.validate).toHaveBeenCalledTimes(1);

      const removed = await fetch(`${server.baseUrl}/api/secrets/openrouter`, { method: 'DELETE' });
      expect((await removed.json()).configured).toBe(false);
      expect(keyStore.deleteKey).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls.flat().join(' ')).not.toContain('server-only-secret');
    } finally {
      logSpy.mockRestore();
      await server.close();
    }
  });

  it('rejects empty and implausibly short keys', async () => {
    const app = createApp({
      keyStore: { saveKey: vi.fn(), deleteKey: vi.fn(), getKey: vi.fn(async () => null) },
      keyResolver: { getStatus: vi.fn(async () => ({ configured: false, source: 'none' })), getOpenRouterApiKey: vi.fn(async () => null) },
      keyValidator: { validate: vi.fn() },
      generateImage: vi.fn(),
    });
    const server = await startTestServer(app);
    try {
      for (const apiKey of ['', 'short']) {
        const response = await fetch(`${server.baseUrl}/api/secrets/openrouter`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        });
        expect(response.status).toBe(400);
        const body = JSON.stringify(await response.json());
        expect(body).not.toContain('OPENROUTER_API_KEY');
        if (apiKey) expect(body).not.toContain(apiKey);
      }
    } finally {
      await server.close();
    }
  });
});
