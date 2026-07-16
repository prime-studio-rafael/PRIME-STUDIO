// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app.js';
import { createLocalTemplateRepository } from '../../server/repositories/localTemplateRepository.js';
import { createTemplateService } from '../../server/services/templateService.js';
import { startTestServer } from './testServer.js';

const sourceUrl = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];

async function startFixture({ busy = false } = {}) {
  const templatesDirectory = await mkdtemp(path.join(tmpdir(), 'prime-template-routes-'));
  directories.push(templatesDirectory);
  const repository = createLocalTemplateRepository({ templatesDirectory });
  const templateService = createTemplateService({ repository, isGenerationActive: () => busy });
  const app = createApp({
    generateImage: vi.fn(),
    templateService,
    keyResolver: { getStatus: vi.fn(async () => ({ configured: false, source: 'none' })), getOpenRouterApiKey: vi.fn(async () => null) },
  });
  return { ...await startTestServer(app), repository };
}

async function templateForm(label = 'Novo modelo') {
  const buffer = await readFile(sourceUrl);
  const form = new FormData();
  form.set('label', label);
  form.set('description', 'Fotografia editorial local');
  form.set('templateImage', new Blob([buffer], { type: 'image/jpeg' }), 'modelo.jpeg');
  return form;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('template HTTP API', () => {
  it('keeps GET compatible and supports the complete local CRUD', async () => {
    const server = await startFixture();
    try {
      let response = await fetch(`${server.baseUrl}/api/templates`);
      let body = await response.json();
      expect(body.templates.map(({ id }) => id)).toEqual(['model-01', 'model-02']);
      expect(body.templates[0]).toMatchObject({ valid: true, active: true, mimeType: 'image/jpeg', publicUrl: expect.stringMatching(/^\/api\/templates\/model-01\/image\?v=/) });
      expect(JSON.stringify(body)).not.toContain('/Users/');

      response = await fetch(`${server.baseUrl}/api/templates`, { method: 'POST', body: await templateForm() });
      body = await response.json();
      expect(response.status).toBe(201);
      const created = body.template;

      response = await fetch(`${server.baseUrl}/api/templates/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Modelo atualizado', description: 'Nova descrição' }),
      });
      expect(await response.json()).toMatchObject({ template: { id: created.id, label: 'Modelo atualizado' } });

      const replacement = await templateForm();
      response = await fetch(`${server.baseUrl}/api/templates/${created.id}/image`, { method: 'PUT', body: replacement });
      expect((await response.json()).template.id).toBe(created.id);

      response = await fetch(`${server.baseUrl}/api/templates/${created.id}/duplicate`, { method: 'POST' });
      const duplicate = (await response.json()).template;
      expect(response.status).toBe(201);
      expect(duplicate.id).not.toBe(created.id);

      response = await fetch(`${server.baseUrl}/api/templates/${duplicate.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      expect((await response.json()).template.active).toBe(false);

      response = await fetch(`${server.baseUrl}/api/templates/${created.id}/image`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);

      response = await fetch(`${server.baseUrl}/api/templates/${duplicate.id}`, { method: 'DELETE' });
      expect(response.status).toBe(204);
      expect(await server.repository.getById(duplicate.id)).toBeNull();
    } finally {
      await server.close();
    }
  });

  it('responds 409 to mutations while generation is active', async () => {
    const server = await startFixture({ busy: true });
    try {
      const response = await fetch(`${server.baseUrl}/api/templates`, { method: 'POST', body: await templateForm('Bloqueado') });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: 'GENERATION_IN_PROGRESS', retryable: false } });
    } finally {
      await server.close();
    }
  });
});
