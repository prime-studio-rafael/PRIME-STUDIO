// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterClient } from '../../server/providers/openrouter/openrouterClient.js';
import { parseOpenRouterImageResponse } from '../../server/providers/openrouter/openrouterResponse.js';
import { validWebpBuffer } from './testServer.js';

function requestInput() {
  return {
    model: 'google/gemini-3.1-flash-lite-image',
    prompt: 'test prompt',
    resolution: '1K',
    aspectRatio: '1:1',
    references: ['data:image/webp;base64,AAAA', 'data:image/webp;base64,BBBB'],
    timeoutMs: 1_000,
  };
}

describe('OpenRouter response parsing', () => {
  it('parses a valid simulated response and real usage cost', () => {
    const response = parseOpenRouterImageResponse(
      {
        data: [{ b64_json: validWebpBuffer().toString('base64') }],
        usage: { cost: 0.034 },
      },
      new Headers({ 'x-request-id': 'request-123' }),
    );

    expect(response.mimeType).toBe('image/webp');
    expect(response.costUsd).toBe(0.034);
    expect(response.requestId).toBe('request-123');
  });

  it('rejects a response without an image', () => {
    expect(() => parseOpenRouterImageResponse({ data: [] })).toThrowError(
      expect.objectContaining({ code: 'OPENROUTER_IMAGE_MISSING' }),
    );
  });

  it('rejects invalid base64', () => {
    expect(() =>
      parseOpenRouterImageResponse({ data: [{ b64_json: '%%%invalid%%%' }] }),
    ).toThrowError(expect.objectContaining({ code: 'OPENROUTER_INVALID_BASE64' }));
  });
});

describe('OpenRouter client call policy', () => {
  it('performs exactly one simulated request with the official title header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: validWebpBuffer().toString('base64') }],
          usage: { cost: 0.034 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const getOpenRouterApiKey = vi.fn(async () => 'fake-test-key');
    const client = createOpenRouterClient({ fetchImpl, getOpenRouterApiKey });

    await client(requestInput());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getOpenRouterApiKey).toHaveBeenCalledTimes(1);
    const [, options] = fetchImpl.mock.calls[0];
    expect(options.headers['X-OpenRouter-Title']).toBe('PRIME IA STUDIO LOCAL');
    const payload = JSON.parse(options.body);
    expect(payload.input_references).toHaveLength(2);
  });

  it('does not retry a simulated provider failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    const client = createOpenRouterClient({ fetchImpl, getOpenRouterApiKey: async () => 'fake-test-key' });

    await expect(client(requestInput())).rejects.toMatchObject({ code: 'OPENROUTER_UNAVAILABLE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
