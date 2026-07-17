// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalTemplateRepository } from '../../server/repositories/localTemplateRepository.js';
import { createTemplateService } from '../../server/services/templateService.js';

const sourceUrl = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];

async function createFixture({ busy = false } = {}) {
  const templatesDirectory = await mkdtemp(path.join(tmpdir(), 'prime-template-service-'));
  directories.push(templatesDirectory);
  const repository = createLocalTemplateRepository({ templatesDirectory });
  const service = createTemplateService({ repository, isGenerationActive: () => busy });
  await repository.ensureInitialized();
  return { repository, service };
}

async function upload(overrides = {}) {
  const buffer = await readFile(sourceUrl);
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/jpeg',
    originalname: 'modelo.jpeg',
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('TemplateService', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  it('creates, edits, duplicates, replaces and deletes valid local templates', async () => {
    const file = await upload();
    const created = await fixture.service.create({ label: 'Editorial vertical', description: 'Modelo da campanha', file });
    const edited = await fixture.service.update(created.id, { label: 'Editorial principal', description: 'Catálogo' });
    const replaced = await fixture.service.replaceImage(created.id, file);
    const duplicated = await fixture.service.duplicate(created.id);
    await fixture.service.setActive(duplicated.id, false);
    await fixture.service.delete(duplicated.id);

    expect(created).toMatchObject({ valid: true, active: true, mimeType: 'image/jpeg' });
    expect(edited).toMatchObject({ label: 'Editorial principal', description: 'Catálogo' });
    expect(replaced.id).toBe(created.id);
    expect((await fixture.service.list()).some(({ id }) => id === duplicated.id)).toBe(false);
  });

  it.each([
    ['extensão incompatível', { originalname: 'modelo.png' }, 'EXTENSION_SIGNATURE_MISMATCH'],
    ['MIME incompatível', { mimetype: 'image/png' }, 'MIME_SIGNATURE_MISMATCH'],
    ['assinatura inválida', { buffer: Buffer.from('not-an-image'), size: 12 }, 'INVALID_IMAGE_SIGNATURE'],
  ])('rejects %s without leaving an image or record', async (_label, overrides, code) => {
    const recordsBefore = await fixture.repository.list();
    const filesBefore = await readdir(fixture.repository.paths.imagesDirectory);

    await expect(fixture.service.create({ label: `Inválido ${code}`, description: '', file: await upload(overrides) })).rejects.toMatchObject({ code });

    expect(await fixture.repository.list()).toHaveLength(recordsBefore.length);
    expect(await readdir(fixture.repository.paths.imagesDirectory)).toEqual(filesBefore);
  });

  it('prevents duplicate labels ignoring case and surrounding spaces', async () => {
    await fixture.service.create({ label: 'Campanha verão', description: '', file: await upload() });
    await expect(fixture.service.create({ label: '  campanha VERÃO  ', description: '', file: await upload() })).rejects.toMatchObject({ code: 'TEMPLATE_LABEL_DUPLICATE', status: 409 });
  });

  it('prevents deactivating or deleting the last valid active template', async () => {
    await fixture.service.setActive('model-02', false);
    await expect(fixture.service.setActive('model-01', false)).rejects.toMatchObject({ code: 'LAST_ACTIVE_TEMPLATE', status: 409 });
    await expect(fixture.service.delete('model-01')).rejects.toMatchObject({ code: 'LAST_ACTIVE_TEMPLATE', status: 409 });
  });

  it('never returns an inactive template for generation', async () => {
    await fixture.service.setActive('model-01', false);
    await expect(fixture.service.getForGeneration('model-01')).rejects.toMatchObject({ code: 'INACTIVE_TEMPLATE' });
    const selected = await fixture.service.getForGeneration('model-02');
    expect(selected.publicTemplate).toMatchObject({ id: 'model-02', valid: true, active: true });
    expect(selected.image.buffer.length).toBeGreaterThan(0);
  });

  it('returns 409 semantics for every mutation while a generation is active', async () => {
    const locked = await createFixture({ busy: true });
    const file = await upload();
    const operations = [
      () => locked.service.create({ label: 'Bloqueado', description: '', file }),
      () => locked.service.update('model-01', { label: 'Bloqueado' }),
      () => locked.service.replaceImage('model-01', file),
      () => locked.service.duplicate('model-01'),
      () => locked.service.setActive('model-01', false),
      () => locked.service.delete('model-01'),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({ code: 'GENERATION_IN_PROGRESS', status: 409 });
    }
  });

  it('exposes the mutation lock until the local write finishes', async () => {
    const pending = fixture.service.update('model-01', { label: 'Modelo em atualização' });
    expect(fixture.service.isBusy()).toBe(true);
    await pending;
    expect(fixture.service.isBusy()).toBe(false);
  });

  it('creates a template with category, tags and hoverDescription, normalizing tags', async () => {
    const created = await fixture.service.create({
      label: 'Camisa social',
      description: 'Fotografia de catálogo',
      category: 'moda-masculina',
      tags: ['  Casual  ', 'CASUAL', 'verão'],
      hoverDescription: 'Ideal para looks de trabalho',
      file: await upload(),
    });
    expect(created).toMatchObject({ category: 'moda-masculina', tags: ['casual', 'verão'], hoverDescription: 'Ideal para looks de trabalho', usageMetrics: null });
  });

  it('defaults to "sem-categoria" and empty tags when not provided', async () => {
    const created = await fixture.service.create({ label: 'Sem detalhes', description: '', file: await upload() });
    expect(created).toMatchObject({ category: 'sem-categoria', tags: [], hoverDescription: null });
  });

  it('rejects an unknown category', async () => {
    await expect(fixture.service.create({ label: 'Categoria inválida', description: '', category: 'categoria-fantasma', file: await upload() }))
      .rejects.toMatchObject({ code: 'TEMPLATE_CATEGORY_INVALID', status: 400 });
  });

  it('rejects more than the maximum number of tags', async () => {
    const tooManyTags = Array.from({ length: 9 }, (_, index) => `tag-${index}`);
    await expect(fixture.service.create({ label: 'Muitas tags', description: '', tags: tooManyTags, file: await upload() }))
      .rejects.toMatchObject({ code: 'TEMPLATE_TAGS_TOO_MANY', status: 400 });
  });

  it('rejects a tag longer than the maximum length', async () => {
    await expect(fixture.service.create({ label: 'Tag longa', description: '', tags: ['a'.repeat(25)], file: await upload() }))
      .rejects.toMatchObject({ code: 'TEMPLATE_TAG_TOO_LONG', status: 400 });
  });

  it('rejects a hoverDescription longer than the maximum length', async () => {
    await expect(fixture.service.create({ label: 'Tooltip longo', description: '', hoverDescription: 'a'.repeat(200), file: await upload() }))
      .rejects.toMatchObject({ code: 'TEMPLATE_HOVER_DESCRIPTION_TOO_LONG', status: 400 });
  });

  it('keeps category and tags on update when not explicitly changed, and updates them when provided', async () => {
    const created = await fixture.service.create({ label: 'Editável', description: '', category: 'bolsas', tags: ['couro'], file: await upload() });
    const untouched = await fixture.service.update(created.id, { label: 'Editável renomeado' });
    expect(untouched).toMatchObject({ category: 'bolsas', tags: ['couro'] });
    const recategorized = await fixture.service.update(created.id, { category: 'acessorios', tags: ['relógio'] });
    expect(recategorized).toMatchObject({ category: 'acessorios', tags: ['relógio'] });
  });

  it('paginates, searches and filters templates by category through listPage', async () => {
    await fixture.service.create({ label: 'Tênis corrida', description: '', category: 'tenis-masculino', tags: ['esporte'], file: await upload() });
    await fixture.service.create({ label: 'Tênis casual', description: '', category: 'tenis-feminino', tags: ['casual'], file: await upload() });

    const page = await fixture.service.listPage({ page: 1, pageSize: 2 });
    expect(page.templates).toHaveLength(2);
    expect(page.total).toBe(4);

    const filtered = await fixture.service.listPage({ category: 'tenis-masculino' });
    expect(filtered.templates.map(({ label }) => label)).toEqual(['Tênis corrida']);

    const searched = await fixture.service.listPage({ search: 'esporte' });
    expect(searched.templates.map(({ label }) => label)).toEqual(['Tênis corrida']);
  });
});
