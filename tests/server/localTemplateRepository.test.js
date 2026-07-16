// @vitest-environment node
import { access, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalTemplateRepository } from '../../server/repositories/localTemplateRepository.js';
import { generationConfig } from '../../server/config/generationConfig.js';
import { validateImageBuffer } from '../../server/utils/fileValidation.js';

const templateSource = new URL('../../public/templates/model-01.jpeg', import.meta.url);
const directories = [];

async function makeRepository(options = {}) {
  const templatesDirectory = options.templatesDirectory || await mkdtemp(path.join(tmpdir(), 'prime-templates-repository-'));
  if (!directories.includes(templatesDirectory)) directories.push(templatesDirectory);
  let sequence = 0;
  return {
    templatesDirectory,
    repository: createLocalTemplateRepository({
      templatesDirectory,
      uuid: () => `test-${++sequence}`,
      ...options,
    }),
  };
}

async function validImage() {
  const buffer = await readFile(templateSource);
  const validated = validateImageBuffer(buffer, {
    expectedMimeType: 'image/jpeg',
    maxBytes: generationConfig.maxFileSizeBytes,
    fieldLabel: 'Template de teste',
    fileName: 'template.jpeg',
    role: 'template',
    policy: generationConfig.imagePolicy,
  });
  return {
    buffer,
    mimeType: validated.mimeType,
    width: validated.dimensions.width,
    height: validated.dimensions.height,
    aspectRatio: validated.aspectRatio,
    sizeBytes: buffer.length,
    valid: true,
    warnings: validated.validation.warnings,
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('LocalTemplateRepository', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await makeRepository();
  });

  it('bootstraps the versioned templates atomically and preserves their IDs', async () => {
    const templates = await fixture.repository.list();
    const catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    const backup = JSON.parse(await readFile(fixture.repository.paths.backupPath, 'utf8'));
    const imageFiles = await readdir(fixture.repository.paths.imagesDirectory);

    expect(templates.map(({ id }) => id)).toEqual(['model-01', 'model-02']);
    expect(catalog).toEqual(backup);
    expect(catalog).toMatchObject({ schemaVersion: 1, initialized: true });
    expect(imageFiles).toHaveLength(2);
    expect(JSON.stringify(catalog)).not.toContain('/Users/');
    expect(JSON.stringify(catalog)).not.toContain('base64');
  });

  it('persists CRUD, replacement, duplication and status across a repository restart', async () => {
    const image = await validImage();
    await fixture.repository.list();
    const created = await fixture.repository.create({ label: 'Editorial', description: 'Luz suave' }, image);
    const edited = await fixture.repository.update(created.id, { label: 'Editorial atualizado', description: 'Fundo claro' });
    const replaced = await fixture.repository.replaceImage(created.id, image);
    const duplicated = await fixture.repository.duplicate(created.id);
    await fixture.repository.setActive(duplicated.id, false);
    await fixture.repository.delete('model-02');

    expect(edited.label).toBe('Editorial atualizado');
    expect(replaced.storageKey).not.toBe(created.storageKey);
    expect(duplicated.id).not.toBe(created.id);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const templates = await restarted.list();
    expect(templates.find(({ id }) => id === created.id)).toMatchObject({ label: 'Editorial atualizado', description: 'Fundo claro', active: true });
    expect(templates.find(({ id }) => id === duplicated.id)).toMatchObject({ active: false });
    expect(templates.some(({ id }) => id === 'model-02')).toBe(false);
  });

  it('serializes simultaneous writes without losing entries', async () => {
    const image = await validImage();
    await fixture.repository.list();
    await Promise.all([
      fixture.repository.create({ label: 'Concorrente A', description: '' }, image),
      fixture.repository.create({ label: 'Concorrente B', description: '' }, image),
    ]);

    const templates = await fixture.repository.list();
    expect(templates.map(({ label }) => label)).toEqual(expect.arrayContaining(['Concorrente A', 'Concorrente B']));
    expect(new Set(templates.map(({ id }) => id)).size).toBe(templates.length);
  });

  it('recovers a corrupt primary catalog from its last valid backup', async () => {
    await fixture.repository.list();
    await writeFile(fixture.repository.paths.catalogPath, '{broken-json');

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    expect((await restarted.list()).map(({ id }) => id)).toEqual(['model-01', 'model-02']);
    expect(JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8')).initialized).toBe(true);
  });

  it('recovers a missing primary catalog from backup instead of importing seeds again', async () => {
    const image = await validImage();
    await fixture.repository.list();
    const created = await fixture.repository.create({ label: 'Persistido no backup', description: '' }, image);
    await unlink(fixture.repository.paths.catalogPath);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    expect((await restarted.list()).some(({ id }) => id === created.id)).toBe(true);
    expect(JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8')).templates).toHaveLength(3);
  });

  it('fails safely when both catalogs are corrupt', async () => {
    await fixture.repository.list();
    await writeFile(fixture.repository.paths.catalogPath, '{broken-primary');
    await writeFile(fixture.repository.paths.backupPath, '{broken-backup');

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    await expect(restarted.list()).rejects.toMatchObject({ code: 'TEMPLATE_CATALOG_CORRUPT' });
  });

  it('removes orphan images during initialization', async () => {
    await fixture.repository.list();
    const orphanPath = path.join(fixture.repository.paths.imagesDirectory, 'orphan.jpeg');
    await writeFile(orphanPath, await readFile(templateSource));

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    await restarted.list();
    await expect(access(orphanPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects path traversal stored in both catalogs without reading outside images/', async () => {
    await fixture.repository.list();
    const catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    catalog.templates[0].storageKey = '../outside.jpeg';
    const tampered = JSON.stringify(catalog);
    await writeFile(fixture.repository.paths.catalogPath, tampered);
    await writeFile(fixture.repository.paths.backupPath, tampered);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    await expect(restarted.list()).rejects.toMatchObject({ code: 'TEMPLATE_CATALOG_CORRUPT' });
  });
});
