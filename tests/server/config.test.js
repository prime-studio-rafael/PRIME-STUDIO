// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { startTestServer } from './testServer.js';

const originalKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalKey;
  }
});

describe('GET /api/config', () => {
  it('reports a missing key without exposing any secret field', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const app = createApp({
      generateImage: vi.fn(),
      keyResolver: { getStatus: vi.fn(async () => ({ configured: false, source: 'none' })), getOpenRouterApiKey: vi.fn(async () => null) },
    });
    const server = await startTestServer(app);

    try {
      const response = await fetch(`${server.baseUrl}/api/config`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.keyConfigured).toBe(false);
      expect(JSON.stringify(body)).not.toMatch(/OPENROUTER_API_KEY|sk-or-/);
      expect(body.model.technicalId).toBe('google/gemini-3.1-flash-lite-image');
      expect(body.image).toMatchObject({ resolution: '1K', aspectRatio: '1:1' });
      expect(body.fixedGeneration).toMatchObject({
        requestedAspectRatio: '4:5',
        effectiveAspectRatio: '1:1',
        aspectRatioActivation: { status: 'blocked' },
      });
      expect(body.imagePolicy).toMatchObject({
        maxFileSizeBytes: 10 * 1024 * 1024,
        garment: { minWidth: 512, minHeight: 512 },
        template: { targetAspectRatio: '4:5' },
      });
    } finally {
      await server.close();
    }
  });

  it('reports a configured key as a boolean without returning the secret', async () => {
    const app = createApp({
      env: { apiKey: 'test-only-secret', port: 3001 },
      generateImage: vi.fn(),
      keyResolver: { getStatus: vi.fn(async () => ({ configured: true, source: 'keychain' })), getOpenRouterApiKey: vi.fn(async () => 'test-only-secret') },
    });
    const server = await startTestServer(app);

    try {
      const response = await fetch(`${server.baseUrl}/api/config`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ keyConfigured: true });
      expect(JSON.stringify(body)).not.toContain('test-only-secret');
      expect(body).not.toHaveProperty('apiKey');
    } finally {
      await server.close();
    }
  });
});
