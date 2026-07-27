// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekKeyStore, DEEPSEEK_KEYCHAIN_SERVICE } from '../../server/secrets/deepseekKeyStore.js';
import { createDeepSeekKeyValidator } from '../../server/providers/deepseek/deepseekKeyValidator.js';
import { createAiSettingsService } from '../../server/services/aiSettingsService.js';

function createRepository() {
  const records = new Map([
    ['openrouter', { provider: 'openrouter', modelId: null, lastTestedAt: null, lastTestStatus: 'never' }],
    ['deepseek', { provider: 'deepseek', modelId: 'deepseek-v4-flash', lastTestedAt: null, lastTestStatus: 'never' }],
  ]);
  return {
    getAll: vi.fn(async () => ({ schemaVersion: 1, providers: [...records.values()] })),
    get: vi.fn(async (provider) => ({ ...records.get(provider) })),
    update: vi.fn(async (provider, updater) => {
      const next = await updater({ ...records.get(provider) }); records.set(provider, next); return { ...next };
    }),
  };
}

describe('DeepSeek Keychain', () => {
  it('uses its own service and clears the secret argument without shell', async () => {
    let captured;
    const runSecurity = vi.fn(async (args) => { captured = [...args]; });
    const store = createDeepSeekKeyStore({ runSecurity });
    await store.saveKey('deepseek-secret-that-is-long-enough');
    expect(captured).toContain(DEEPSEEK_KEYCHAIN_SERVICE);
    expect(captured.at(-1)).toBe('deepseek-secret-that-is-long-enough');
    expect(runSecurity.mock.calls[0][0].at(-1)).toBe('');
  });
});

describe('DeepSeek connection validator', () => {
  it('calls the models endpoint exactly once and confirms deepseek-v4-flash', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'deepseek-v4-flash' }] }), { status: 200 }));
    const validator = createDeepSeekKeyValidator({ getApiKey: async () => 'server-only-secret', fetchImpl });
    await expect(validator.validate()).resolves.toMatchObject({ valid: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.deepseek.com/models');
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
  });

  it('does not retry a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    const validator = createDeepSeekKeyValidator({ getApiKey: async () => 'server-only-secret', fetchImpl });
    await expect(validator.validate()).rejects.toMatchObject({ code: 'DEEPSEEK_KEY_TEST_FAILED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('AI settings service', () => {
  it('derives configured status and never returns a key', async () => {
    const service = createAiSettingsService({
      repository: createRepository(),
      openRouterKeyResolver: { getStatus: async () => ({ configured: true }) },
      deepSeekKeyStore: { hasKey: async () => true },
      deepSeekKeyValidator: { validate: vi.fn() },
    });
    const providers = await service.list();
    expect(providers).toHaveLength(2);
    expect(providers.find((item) => item.provider === 'openrouter').modelLabel).toBe('Definido por template');
    expect(providers.find((item) => item.provider === 'deepseek')).toMatchObject({ configured: true, modelId: 'deepseek-v4-flash' });
    expect(JSON.stringify(providers)).not.toContain('secret');
  });

  it('preserves the last successful date after a failed test', async () => {
    const repository = createRepository();
    const validator = { validate: vi.fn().mockResolvedValueOnce({ valid: true, message: 'ok' }).mockResolvedValueOnce({ valid: false, message: 'invalid' }) };
    const service = createAiSettingsService({
      repository,
      openRouterKeyResolver: { getStatus: async () => ({ configured: false }) },
      deepSeekKeyStore: { hasKey: async () => true }, deepSeekKeyValidator: validator,
      clock: () => new Date('2026-07-21T20:00:00.000Z'),
    });
    await service.testDeepSeek();
    await service.testDeepSeek();
    const saved = await repository.get('deepseek');
    expect(saved).toMatchObject({ lastTestedAt: '2026-07-21T20:00:00.000Z', lastTestStatus: 'failed' });
    expect(validator.validate).toHaveBeenCalledTimes(2);
  });
});
