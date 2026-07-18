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
    expect(catalog).toMatchObject({ schemaVersion: 3, initialized: true });
    expect(imageFiles).toHaveLength(2);
    expect(JSON.stringify(catalog)).not.toContain('/Users/');
    expect(JSON.stringify(catalog)).not.toContain('base64');
  });

  it('bootstraps new templates with professional names, category and tags (never the generic Fase 6 defaults)', async () => {
    const templates = await fixture.repository.list();
    const byId = Object.fromEntries(templates.map((template) => [template.id, template]));
    expect(byId['model-01']).toMatchObject({
      label: 'Masculino Frontal — Clássico',
      category: 'moda-masculina',
      tags: ['masculino', 'frontal', 'camiseta', 'classico'],
      usageMetrics: null,
    });
    expect(byId['model-01'].hoverDescription).toBeTruthy();
    expect(byId['model-02']).toMatchObject({
      label: 'Masculino Frontal — Logo Central',
      category: 'moda-masculina',
      tags: ['masculino', 'frontal', 'camiseta', 'estampa'],
      usageMetrics: null,
    });
    expect(byId['model-02'].hoverDescription).toBeTruthy();
  });

  it('migrates a schemaVersion 1 catalog to 2 transparently, rewriting both files atomically', async () => {
    await fixture.repository.list();
    const v1Catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    v1Catalog.schemaVersion = 1;
    // Simula um catálogo v1 genuinamente antigo: nomes genéricos do seed original (uma
    // instalação real de antes desta correção), sem nenhum campo da Fase 6 ainda.
    const genericLabels = { 'model-01': 'Modelo base 01', 'model-02': 'Modelo base 02' };
    for (const template of v1Catalog.templates) {
      template.label = genericLabels[template.id];
      template.description = 'Fotografia local do modelo-base.';
      delete template.category;
      delete template.tags;
      delete template.hoverDescription;
      delete template.usageMetrics;
    }
    const v1Raw = JSON.stringify(v1Catalog);
    await writeFile(fixture.repository.paths.catalogPath, v1Raw);
    await writeFile(fixture.repository.paths.backupPath, v1Raw);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const templates = await restarted.list();
    expect(templates.map(({ id }) => id)).toEqual(['model-01', 'model-02']);
    for (const template of templates) {
      expect(template.usageMetrics).toBeNull();
      // Ainda genéricos após a migração de schema (v1→v2) — a correção de nomes profissionais
      // da Fase 6 também se aplica aqui, pois o registro nunca foi editado manualmente.
      expect(template.category).toBe('moda-masculina');
      expect(template.tags.length).toBeGreaterThan(0);
      expect(template.hoverDescription).toBeTruthy();
    }

    const migratedCatalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    const migratedBackup = JSON.parse(await readFile(fixture.repository.paths.backupPath, 'utf8'));
    expect(migratedCatalog.schemaVersion).toBe(3);
    expect(migratedBackup.schemaVersion).toBe(3);
  });

  it('preserves an already-migrated field (e.g. a real category) instead of overwriting it during migration', async () => {
    await fixture.repository.list();
    const v1Catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    v1Catalog.schemaVersion = 1;
    v1Catalog.templates[0].category = 'moda-masculina';
    v1Catalog.templates[0].tags = ['casual'];
    // model-02 simula um catálogo v1 genuinamente antigo, ainda com o nome genérico do seed.
    v1Catalog.templates[1].label = 'Modelo base 02';
    v1Catalog.templates[1].description = 'Fotografia local do modelo-base.';
    delete v1Catalog.templates[1].category;
    delete v1Catalog.templates[1].tags;
    delete v1Catalog.templates[1].hoverDescription;
    const v1Raw = JSON.stringify(v1Catalog);
    await writeFile(fixture.repository.paths.catalogPath, v1Raw);
    await writeFile(fixture.repository.paths.backupPath, v1Raw);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const templates = await restarted.list();
    expect(templates.find(({ id }) => id === 'model-01')).toMatchObject({ category: 'moda-masculina', tags: ['casual'] });
    // model-02 nunca foi personalizado pelo usuário (só perdeu category no v1 bruto), então a
    // correção de nomes profissionais da Fase 6 se aplica a ele normalmente.
    const model02 = templates.find(({ id }) => id === 'model-02');
    expect(model02.category).toBe('moda-masculina');
    expect(model02.label).toBe('Masculino Frontal — Logo Central');
  });

  it('never overwrites a template whose label/description was manually customized by the user, even if category/tags are still empty', async () => {
    await fixture.repository.list();
    const v1Catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
    v1Catalog.schemaVersion = 1;
    const custom = v1Catalog.templates.find((template) => template.id === 'model-01');
    custom.label = 'Nome escolhido pelo usuário';
    delete custom.category;
    delete custom.tags;
    delete custom.hoverDescription;
    const v1Raw = JSON.stringify(v1Catalog);
    await writeFile(fixture.repository.paths.catalogPath, v1Raw);
    await writeFile(fixture.repository.paths.backupPath, v1Raw);

    const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const templates = await restarted.list();
    const model01 = templates.find(({ id }) => id === 'model-01');
    expect(model01.label).toBe('Nome escolhido pelo usuário');
    expect(model01.category).toBe('sem-categoria');
    expect(model01.tags).toEqual([]);
  });

  it('is idempotent: applying the professional-names correction twice never changes an already-corrected record again', async () => {
    await fixture.repository.list();
    const restartedOnce = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const first = await restartedOnce.list();
    const restartedTwice = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
    const second = await restartedTwice.list();
    expect(second).toEqual(first);
  });

  it('lists templates with pagination, search and category filtering without a business cap', async () => {
    const image = await validImage();
    await fixture.repository.list();
    await fixture.repository.create({ label: 'Camisa polo', description: '', category: 'moda-masculina', tags: ['casual', 'verão'] }, image);
    await fixture.repository.create({ label: 'Vestido floral', description: '', category: 'moda-feminina', tags: ['festa'] }, image);

    const all = await fixture.repository.listPage({});
    expect(all.total).toBe(4);
    expect(all.templates).toHaveLength(4);

    const firstPage = await fixture.repository.listPage({ page: 1, pageSize: 2 });
    expect(firstPage.templates).toHaveLength(2);
    expect(firstPage.total).toBe(4);
    const secondPage = await fixture.repository.listPage({ page: 2, pageSize: 2 });
    expect(secondPage.templates).toHaveLength(2);
    expect(new Set([...firstPage.templates, ...secondPage.templates].map((t) => t.id)).size).toBe(4);

    const byCategory = await fixture.repository.listPage({ category: 'moda-feminina' });
    expect(byCategory.templates.map(({ label }) => label)).toEqual(['Vestido floral']);

    const bySearch = await fixture.repository.listPage({ search: 'polo' });
    expect(bySearch.templates.map(({ label }) => label)).toEqual(['Camisa polo']);

    const bySearchTag = await fixture.repository.listPage({ search: 'festa' });
    expect(bySearchTag.templates.map(({ label }) => label)).toEqual(['Vestido floral']);
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

  describe('generation profile (schemaVersion 3)', () => {
    it('bootstraps model-01/model-02 with the migrated generation profile (prompt, promptVersion and technical defaults)', async () => {
      const templates = await fixture.repository.list();
      const byId = Object.fromEntries(templates.map((template) => [template.id, template]));
      for (const id of ['model-01', 'model-02']) {
        expect(byId[id].prompt).toBe('Edite exclusivamente a roupa da parte superior do corpo da pessoa da Imagem 1, usando a roupa da Imagem 2 como referência visual.');
        expect(byId[id].promptVersion).toBe('upper-garment-v2');
        expect(byId[id].provider).toBe('openrouter');
        expect(byId[id].modelId).toBe(generationConfig.modelId);
        expect(byId[id].generationAspectRatio).toBe(generationConfig.effectiveAspectRatio);
        expect(byId[id].resolution).toBe(generationConfig.resolution);
        expect(byId[id].negativePrompt).toBeNull();
      }
    });

    it('creates a new template without a prompt by default — never inherits another category\'s prompt', async () => {
      const image = await validImage();
      await fixture.repository.list();
      const created = await fixture.repository.create({ label: 'Tenis 9060', description: '', category: 'tenis-masculino', tags: ['casual', 'esportivo'] }, image);
      expect(created.prompt).toBeNull();
      expect(created.promptVersion).toBeNull();
      expect(created.provider).toBeNull();
      expect(created.modelId).toBeNull();

      const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      const templates = await restarted.list();
      expect(templates.find(({ id }) => id === created.id)).toMatchObject({ prompt: null, promptVersion: null });
    });

    it('computes a deterministic hash-based promptVersion when a template is created with a prompt', async () => {
      const image = await validImage();
      await fixture.repository.list();
      const created = await fixture.repository.create({ label: 'Tenis 9060', description: '', category: 'tenis-masculino', prompt: 'Edite exclusivamente o calçado da pessoa da Imagem 1.' }, image);
      expect(created.promptVersion).toMatch(/^template-[0-9a-f]{8}$/);
      expect(created.promptVersion).not.toBe('upper-garment-v2');

      const again = await fixture.repository.create({ label: 'Tenis 9061', description: '', category: 'tenis-masculino', prompt: 'Edite exclusivamente o calçado da pessoa da Imagem 1.' }, image);
      expect(again.promptVersion).toBe(created.promptVersion);
    });

    it('recomputes promptVersion when prompt/negativePrompt change on update, but not on unrelated edits', async () => {
      const image = await validImage();
      await fixture.repository.list();
      const created = await fixture.repository.create({ label: 'Tenis 9060', description: '', category: 'tenis-masculino', prompt: 'Prompt original.' }, image);
      const firstVersion = created.promptVersion;

      const relabeled = await fixture.repository.update(created.id, { label: 'Tenis 9060 (v2)' });
      expect(relabeled.promptVersion).toBe(firstVersion);

      const edited = await fixture.repository.update(created.id, { prompt: 'Prompt revisado.' });
      expect(edited.promptVersion).not.toBe(firstVersion);
      expect(edited.promptVersion).toMatch(/^template-[0-9a-f]{8}$/);
    });

    it('migrates a schemaVersion 2 catalog to 3 with null generation-profile defaults for custom templates, without ever assigning them a prompt', async () => {
      await fixture.repository.list();
      const v2Catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
      v2Catalog.schemaVersion = 2;
      for (const template of v2Catalog.templates) {
        delete template.prompt; delete template.negativePrompt; delete template.provider;
        delete template.modelId; delete template.generationAspectRatio; delete template.resolution; delete template.promptVersion;
      }
      const v2Raw = JSON.stringify(v2Catalog);
      await writeFile(fixture.repository.paths.catalogPath, v2Raw);
      await writeFile(fixture.repository.paths.backupPath, v2Raw);

      const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      const templates = await restarted.list();
      const model01 = templates.find(({ id }) => id === 'model-01');
      expect(model01.prompt).toBe('Edite exclusivamente a roupa da parte superior do corpo da pessoa da Imagem 1, usando a roupa da Imagem 2 como referência visual.');
      expect(model01.promptVersion).toBe('upper-garment-v2');

      const migratedCatalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
      expect(migratedCatalog.schemaVersion).toBe(3);
    });

    it('never overwrites a manually configured prompt on model-01/model-02 during migration', async () => {
      await fixture.repository.list();
      await fixture.repository.update('model-01', { prompt: 'Prompt customizado pelo usuário.' });
      const customized = (await fixture.repository.list()).find(({ id }) => id === 'model-01');

      const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      const templates = await restarted.list();
      expect(templates.find(({ id }) => id === 'model-01').prompt).toBe(customized.prompt);
      expect(templates.find(({ id }) => id === 'model-01').promptVersion).toBe(customized.promptVersion);
    });

    it('is idempotent: restarting twice after the schemaVersion 3 migration never changes an already-migrated record again', async () => {
      await fixture.repository.list();
      const restartedOnce = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      const first = await restartedOnce.list();
      const restartedTwice = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      const second = await restartedTwice.list();
      expect(second).toEqual(first);
    });

    it('rejects an invalid generationAspectRatio/modelId/provider stored in the catalog', async () => {
      await fixture.repository.list();
      const catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
      catalog.templates[0].generationAspectRatio = '16:9';
      const tampered = JSON.stringify(catalog);
      await writeFile(fixture.repository.paths.catalogPath, tampered);
      await writeFile(fixture.repository.paths.backupPath, tampered);

      const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      await expect(restarted.list()).rejects.toMatchObject({ code: 'TEMPLATE_CATALOG_CORRUPT' });
    });

    it('rejects a template with a prompt but no promptVersion (would bypass version tracking)', async () => {
      await fixture.repository.list();
      const catalog = JSON.parse(await readFile(fixture.repository.paths.catalogPath, 'utf8'));
      catalog.templates[0].prompt = 'Prompt sem versão.';
      catalog.templates[0].promptVersion = null;
      const tampered = JSON.stringify(catalog);
      await writeFile(fixture.repository.paths.catalogPath, tampered);
      await writeFile(fixture.repository.paths.backupPath, tampered);

      const restarted = createLocalTemplateRepository({ templatesDirectory: fixture.templatesDirectory });
      await expect(restarted.list()).rejects.toMatchObject({ code: 'TEMPLATE_CATALOG_CORRUPT' });
    });
  });
});
