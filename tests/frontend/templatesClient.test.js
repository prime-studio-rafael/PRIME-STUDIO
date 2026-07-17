/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchTemplateCategories,
  fetchTemplates,
  fetchTemplatesPage,
  replaceTemplateImage,
  setTemplateActive,
  updateTemplate,
} from '../../src/features/templates/api/templatesClient.js';

function response(body = {}, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

beforeEach(() => {
  globalThis.fetch = vi.fn(() => response({ template: { id: 'template-id' }, templates: [] }));
});

afterEach(() => vi.restoreAllMocks());

describe('templates API client', () => {
  it('uses the approved endpoint and method for every operation', async () => {
    const file = new File(['bytes'], 'modelo.jpeg', { type: 'image/jpeg' });

    await fetchTemplates();
    await createTemplate({ label: 'Modelo', description: 'Descrição', file });
    await updateTemplate('template id', { label: 'Novo', description: '' });
    await replaceTemplateImage('template id', file);
    await duplicateTemplate('template id');
    await setTemplateActive('template id', false);
    globalThis.fetch.mockImplementationOnce(() => response({}, 204));
    await deleteTemplate('template id');

    expect(globalThis.fetch.mock.calls.map(([url, options = {}]) => [url, options.method || 'GET'])).toEqual([
      ['/api/templates', 'GET'],
      ['/api/templates', 'POST'],
      ['/api/templates/template%20id', 'PATCH'],
      ['/api/templates/template%20id/image', 'PUT'],
      ['/api/templates/template%20id/duplicate', 'POST'],
      ['/api/templates/template%20id/status', 'PATCH'],
      ['/api/templates/template%20id', 'DELETE'],
    ]);
    expect(globalThis.fetch.mock.calls[1][1].body).toBeInstanceOf(FormData);
    expect(globalThis.fetch.mock.calls[2][1].body).toBe(JSON.stringify({ label: 'Novo', description: '' }));
    expect(globalThis.fetch.mock.calls[5][1].body).toBe(JSON.stringify({ active: false }));
  });

  it('surfaces a friendly backend error', async () => {
    globalThis.fetch.mockImplementationOnce(() => response({ error: { code: 'LAST_ACTIVE_TEMPLATE', message: 'Mantenha pelo menos um template válido e ativo.' } }, 409));
    await expect(deleteTemplate('model-01')).rejects.toMatchObject({ code: 'LAST_ACTIVE_TEMPLATE', message: 'Mantenha pelo menos um template válido e ativo.' });
  });

  it('sends category, tags and hoverDescription when creating a template', async () => {
    const file = new File(['bytes'], 'modelo.jpeg', { type: 'image/jpeg' });
    await createTemplate({ label: 'Modelo', description: 'Descrição', category: 'moda-masculina', tags: ['casual'], hoverDescription: 'Tooltip', file });
    const formData = globalThis.fetch.mock.calls[0][1].body;
    expect(formData.get('category')).toBe('moda-masculina');
    expect(formData.get('tags')).toBe(JSON.stringify(['casual']));
    expect(formData.get('hoverDescription')).toBe('Tooltip');
  });

  it('builds the query string for fetchTemplatesPage and returns pagination metadata', async () => {
    globalThis.fetch.mockImplementationOnce(() => response({ templates: [{ id: 'a' }], page: 2, pageSize: 10, total: 25 }));
    const result = await fetchTemplatesPage({ page: 2, pageSize: 10, search: 'polo', category: 'moda-masculina' });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/templates?page=2&pageSize=10&search=polo&category=moda-masculina');
    expect(result).toEqual({ templates: [{ id: 'a' }], page: 2, pageSize: 10, total: 25 });
  });

  it('fetches template categories', async () => {
    globalThis.fetch.mockImplementationOnce(() => response({ categories: [{ id: 'bolsas', label: 'Bolsas' }] }));
    const categories = await fetchTemplateCategories();
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/templates/categories');
    expect(categories).toEqual([{ id: 'bolsas', label: 'Bolsas' }]);
  });
});
