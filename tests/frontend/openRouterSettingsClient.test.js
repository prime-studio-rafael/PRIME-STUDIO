/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveOpenRouterKey } from '../../src/features/settings/api/openRouterSettingsClient.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('OpenRouter settings client timeout', () => {
  it('stops waiting after 10 seconds when the local API never responds', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));

    const request = saveOpenRouterKey('test-secret-key-that-is-long-enough');
    const rejection = expect(request).rejects.toMatchObject({ code: 'LOCAL_API_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
  });
});
