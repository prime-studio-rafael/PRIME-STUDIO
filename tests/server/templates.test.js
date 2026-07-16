// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { inspectTemplate, inspectTemplates } from '../../server/catalogs/templates.js';
import { startTestServer, validWebpBuffer } from './testServer.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('local template inspection', () => {
  it('confirms the two configured local templates are valid images with MIME and size', async () => {
    const templates = await inspectTemplates();

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.filename)).toEqual(['model-01.jpeg', 'model-02.jpeg']);
    for (const template of templates) {
      expect(template).toMatchObject({
        exists: true,
        valid: true,
        mimeType: expect.stringMatching(/^image\/(jpeg|png|webp)$/),
        width: expect.any(Number),
        height: expect.any(Number),
      });
      expect(template.sizeBytes).toBeGreaterThan(0);
      expect(template).toMatchObject({
        realFormat: 'jpeg',
        extensionMatches: true,
        mimeMatches: true,
        fourByFiveReady: false,
        quality: 'acceptable-with-warning',
      });
      expect(template.warnings).toContainEqual(expect.objectContaining({ code: 'TEMPLATE_RATIO_NOT_4_5' }));
      expect(template.filePath).toBeUndefined();
    }
  });

  it('reports a missing template with a friendly local error', async () => {
    const template = await inspectTemplate({
      id: 'missing',
      label: 'Modelo ausente',
      filename: 'missing.webp',
      filePath: join(tmpdir(), 'prime-studio-template-does-not-exist.webp'),
      publicUrl: '/templates/missing.webp',
    });

    expect(template).toMatchObject({ exists: false, valid: false, mimeType: null, sizeBytes: 0 });
    expect(template.validationError).toBe('Template não encontrado no caminho local.');
  });

  it('reports an invalid image signature without exposing a filesystem path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'prime-studio-template-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'invalid.webp');
    await writeFile(filePath, Buffer.from('not-an-image'));

    const template = await inspectTemplate({
      id: 'invalid',
      label: 'Modelo inválido',
      filename: 'invalid.webp',
      filePath,
      publicUrl: '/templates/invalid.webp',
    });

    expect(template).toMatchObject({ exists: true, valid: false, mimeType: null, sizeBytes: 12 });
    expect(template.validationError).toContain('Template inválido:');
    expect(template.validationError).not.toContain(directory);
  });

  it('accepts a valid local WebP supplied by a catalog entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'prime-studio-template-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'valid.webp');
    const buffer = validWebpBuffer();
    await writeFile(filePath, buffer);

    const template = await inspectTemplate({
      id: 'valid',
      label: 'Modelo válido',
      filename: 'valid.webp',
      filePath,
      publicUrl: '/templates/valid.webp',
    });

    expect(template).toMatchObject({ exists: true, valid: true, mimeType: 'image/webp', sizeBytes: buffer.length, fourByFiveReady: true });
  });

  it('rejects a template whose declared ratio disagrees with its real dimensions', async () => {
    const template = await inspectTemplate({
      id: 'declared-wrong',
      label: 'Modelo declarado incorretamente',
      filename: 'model-01.jpeg',
      filePath: new URL('../../public/templates/model-01.jpeg', import.meta.url).pathname,
      publicUrl: '/templates/model-01.jpeg',
      expectedMimeType: 'image/jpeg',
      declaredAspectRatio: '4:5',
    });

    expect(template.valid).toBe(false);
    expect(template.validationError).toContain('proporção declarada 4:5');
  });

  it('serves validation metadata through GET /api/templates without a filesystem path', async () => {
    const app = createApp({
      generateImage: vi.fn(),
      keyResolver: { getStatus: vi.fn(async () => ({ configured: false, source: 'none' })), getOpenRouterApiKey: vi.fn(async () => null) },
      templateService: {
        list: async () => [{
          id: 'model-01',
          label: 'Modelo base 01',
          filename: 'model-01.webp',
          publicUrl: '/templates/model-01.webp',
          exists: true,
          valid: true,
          mimeType: 'image/webp',
          sizeBytes: 1234,
        }],
      },
    });
    const server = await startTestServer(app);

    try {
      const response = await fetch(`${server.baseUrl}/api/templates`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.templates[0]).toMatchObject({ valid: true, mimeType: 'image/webp', sizeBytes: 1234 });
      expect(JSON.stringify(body)).not.toContain('/Users/');
    } finally {
      await server.close();
    }
  });
});
