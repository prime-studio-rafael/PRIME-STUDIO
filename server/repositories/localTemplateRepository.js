import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { getTemplateById, listTemplates } from '../catalogs/templates.js';
import { DEFAULT_TEMPLATE_CATEGORY_ID } from '../catalogs/templateCategories.js';
import { validateImageBuffer } from '../utils/fileValidation.js';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';

export const TEMPLATE_CATALOG_SCHEMA_VERSION = 2;
// Trava técnica de segurança contra crescimento patológico/acidental do catálogo — nunca um
// limite de produto. A biblioteca de templates (Fase 6) é projetada para centenas/milhares de
// registros via paginação e busca no backend (ver listPage), não para um teto de negócio.
export const DEFAULT_TEMPLATE_SAFETY_LIMIT = 5000;
export const DEFAULT_TEMPLATE_PAGE_SIZE = 60;
export const MAX_TEMPLATE_PAGE_SIZE = 200;

const EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const STORAGE_KEY_PATTERN = /^[a-z0-9-]+\.(?:jpeg|png|webp)$/;

// Fase 6 — correção obrigatória: os dois templates seed nasceram com nomes e categoria
// genéricos ("Modelo base 01/02", "Sem categoria") porque a primeira leva da Fase 6 só
// preparou o schema, sem migrar o conteúdo. Estes valores substituem os genéricos, mas
// apenas enquanto o registro ainda estiver intocado desde o bootstrap — uma edição manual
// do usuário (label, categoria, tags ou hoverDescription diferentes do genérico original)
// nunca é sobrescrita.
const PROFESSIONAL_SEED_METADATA = Object.freeze({
  'model-01': Object.freeze({
    label: 'Masculino Frontal — Clássico',
    category: 'moda-masculina',
    tags: Object.freeze(['masculino', 'frontal', 'camiseta', 'classico']),
    hoverDescription: 'Modelo masculino em pose frontal e enquadramento clássico, ideal para camisetas e moda casual.',
  }),
  'model-02': Object.freeze({
    label: 'Masculino Frontal — Logo Central',
    category: 'moda-masculina',
    tags: Object.freeze(['masculino', 'frontal', 'camiseta', 'estampa']),
    hoverDescription: 'Modelo masculino em pose frontal, indicado para camisetas com logos ou estampas centrais.',
  }),
});

export function createLocalTemplateRepository({
  templatesDirectory = path.resolve(process.cwd(), 'storage/templates'),
  seedCatalog = { listTemplates, getTemplateById },
  limit = DEFAULT_TEMPLATE_SAFETY_LIMIT,
  uuid = randomUUID,
  now = () => new Date(),
} = {}) {
  const imagesDirectory = path.join(templatesDirectory, 'images');
  const catalogPath = path.join(templatesDirectory, 'catalog.json');
  const backupPath = path.join(templatesDirectory, 'catalog.json.bak');
  let initializationPromise = null;
  let catalogCache = null;
  let mutationTail = Promise.resolve();

  async function ensureInitialized() {
    if (!initializationPromise) {
      initializationPromise = initialize().catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    await initializationPromise;
  }

  async function initialize() {
    await mkdir(imagesDirectory, { recursive: true });
    const primary = await readCatalog(catalogPath);

    if (primary.status === 'valid') {
      catalogCache = primary.catalog;
      if (primary.needsRewrite) await persistMigratedCatalog(catalogCache);
      await cleanupOrphanImages(catalogCache);
      return;
    }

    const backup = await readCatalog(backupPath);
    if (backup.status === 'valid') {
      await writeFileAtomically(catalogPath, serializeJson(backup.catalog));
      catalogCache = backup.catalog;
      if (backup.needsRewrite) await persistMigratedCatalog(catalogCache);
      await cleanupOrphanImages(catalogCache);
      return;
    }

    if (primary.status === 'invalid' || backup.status === 'invalid') {
      throw new AppError('TEMPLATE_CATALOG_CORRUPT', 'O catálogo local de templates está corrompido e não possui backup válido.', { status: 500 });
    }

    await bootstrapFromSeeds();
  }

  async function bootstrapFromSeeds() {
    const createdImagePaths = [];
    const createdAt = now().toISOString();

    try {
      const records = [];
      for (const seed of seedCatalog.listTemplates()) {
        const resolvedSeed = seedCatalog.getTemplateById(seed.id);
        if (!resolvedSeed?.filePath) {
          throw new AppError('TEMPLATE_SEED_MISSING', 'Um template inicial não pôde ser localizado.', { status: 500 });
        }
        const buffer = await readFile(resolvedSeed.filePath);
        const validated = validateImageBuffer(buffer, {
          maxBytes: generationConfig.maxFileSizeBytes,
          fieldLabel: seed.label,
          fileName: seed.filename,
          expectedMimeType: seed.expectedMimeType,
          role: 'template',
          policy: generationConfig.imagePolicy,
        });
        const storageKey = createStorageKey(seed.id, validated.mimeType, uuid);
        const imagePath = resolveStoragePath(storageKey);
        await writeFileAtomically(imagePath, buffer);
        createdImagePaths.push(imagePath);
        records.push(createRecord({
          id: seed.id,
          label: seed.label,
          description: seed.description || '',
          storageKey,
          image: imageData(validated),
          active: true,
          createdAt,
          updatedAt: createdAt,
          ...PROFESSIONAL_SEED_METADATA[seed.id],
        }));
      }

      const catalog = freezeCatalog({
        schemaVersion: TEMPLATE_CATALOG_SCHEMA_VERSION,
        initialized: true,
        templates: records,
      }, limit);
      await writeFileAtomically(catalogPath, serializeJson(catalog));
      await writeFileAtomically(backupPath, serializeJson(catalog));
      catalogCache = catalog;
    } catch (error) {
      await Promise.all(createdImagePaths.map((imagePath) => safeUnlink(imagePath)));
      throw error;
    }
  }

  function withMutation(operation) {
    const run = mutationTail.then(async () => {
      await ensureInitialized();
      return operation();
    }, async () => {
      await ensureInitialized();
      return operation();
    });
    mutationTail = run.catch(() => {});
    return run;
  }

  async function list() {
    await ensureInitialized();
    return catalogCache.templates.map(cloneRecord);
  }

  async function listPage({ page = 1, pageSize = DEFAULT_TEMPLATE_PAGE_SIZE, search = '', category } = {}) {
    await ensureInitialized();
    const normalizedPage = Math.max(1, Math.trunc(Number(page)) || 1);
    const normalizedPageSize = Math.min(MAX_TEMPLATE_PAGE_SIZE, Math.max(1, Math.trunc(Number(pageSize)) || DEFAULT_TEMPLATE_PAGE_SIZE));
    const normalizedSearch = String(search || '').trim().toLocaleLowerCase('pt-BR');
    const normalizedCategory = category ? String(category) : null;

    let filtered = catalogCache.templates;
    if (normalizedCategory) filtered = filtered.filter((template) => template.category === normalizedCategory);
    if (normalizedSearch) {
      filtered = filtered.filter((template) => template.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        || template.tags.some((tag) => tag.toLocaleLowerCase('pt-BR').includes(normalizedSearch)));
    }

    const total = filtered.length;
    const start = (normalizedPage - 1) * normalizedPageSize;
    const templates = filtered.slice(start, start + normalizedPageSize).map(cloneRecord);
    return { templates, page: normalizedPage, pageSize: normalizedPageSize, total };
  }

  async function getById(id) {
    await ensureInitialized();
    const record = catalogCache.templates.find((template) => template.id === id);
    return record ? cloneRecord(record) : null;
  }

  async function readImage(id) {
    const record = await getById(id);
    if (!record) throw templateNotFound();
    const buffer = await readFile(resolveStoragePath(record.storageKey)).catch((error) => {
      throw new AppError('TEMPLATE_IMAGE_MISSING', 'A imagem local deste template não foi encontrada.', { status: 404, cause: error });
    });
    return { buffer, record };
  }

  async function create(data, image) {
    return withMutation(async () => {
      assertCapacity(catalogCache, limit);
      const timestamp = now().toISOString();
      const id = uuid();
      const storageKey = createStorageKey(id, image.mimeType, uuid);
      const imagePath = resolveStoragePath(storageKey);
      const record = createRecord({ ...data, id, storageKey, image, active: data.active !== false, createdAt: timestamp, updatedAt: timestamp });

      await writeFileAtomically(imagePath, image.buffer);
      try {
        await persistCatalog({ ...catalogCache, templates: [...catalogCache.templates, record] });
      } catch (error) {
        await safeUnlink(imagePath);
        throw error;
      }
      return cloneRecord(record);
    });
  }

  async function update(id, data) {
    return withMutation(async () => {
      const index = findRecordIndex(id);
      const record = { ...catalogCache.templates[index], ...data, updatedAt: now().toISOString() };
      const templates = catalogCache.templates.map((template, templateIndex) => templateIndex === index ? record : template);
      await persistCatalog({ ...catalogCache, templates });
      return cloneRecord(record);
    });
  }

  async function replaceImage(id, image) {
    return withMutation(async () => {
      const index = findRecordIndex(id);
      const current = catalogCache.templates[index];
      const storageKey = createStorageKey(id, image.mimeType, uuid);
      const nextImagePath = resolveStoragePath(storageKey);
      const next = createRecord({
        ...current,
        storageKey,
        image,
        updatedAt: now().toISOString(),
      });

      await writeFileAtomically(nextImagePath, image.buffer);
      try {
        const templates = catalogCache.templates.map((template, templateIndex) => templateIndex === index ? next : template);
        await persistCatalog({ ...catalogCache, templates });
      } catch (error) {
        await safeUnlink(nextImagePath);
        throw error;
      }
      await safeUnlink(resolveStoragePath(current.storageKey));
      return cloneRecord(next);
    });
  }

  async function duplicate(id) {
    return withMutation(async () => {
      assertCapacity(catalogCache, limit);
      const current = catalogCache.templates[findRecordIndex(id)];
      const source = await readFile(resolveStoragePath(current.storageKey));
      const timestamp = now().toISOString();
      const duplicateId = uuid();
      const storageKey = createStorageKey(duplicateId, current.mimeType, uuid);
      const imagePath = resolveStoragePath(storageKey);
      const record = createRecord({
        ...current,
        id: duplicateId,
        label: duplicateLabel(current.label, catalogCache.templates),
        storageKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      await writeFileAtomically(imagePath, source);
      try {
        await persistCatalog({ ...catalogCache, templates: [...catalogCache.templates, record] });
      } catch (error) {
        await safeUnlink(imagePath);
        throw error;
      }
      return cloneRecord(record);
    });
  }

  async function setActive(id, active) {
    return update(id, { active: Boolean(active) });
  }

  async function remove(id) {
    return withMutation(async () => {
      const index = findRecordIndex(id);
      const current = catalogCache.templates[index];
      const templates = catalogCache.templates.filter((template) => template.id !== id);
      await persistCatalog({ ...catalogCache, templates });
      await safeUnlink(resolveStoragePath(current.storageKey));
      return cloneRecord(current);
    });
  }

  async function persistCatalog(nextCatalog) {
    const validatedNext = freezeCatalog(nextCatalog, limit);
    await writeFileAtomically(backupPath, serializeJson(catalogCache));
    await writeFileAtomically(catalogPath, serializeJson(validatedNext));
    catalogCache = validatedNext;
    try {
      await writeFileAtomically(backupPath, serializeJson(validatedNext));
    } catch {
      // O backup anterior permanece válido; a operação principal já foi concluída.
    }
  }

  async function cleanupOrphanImages(catalog) {
    const referenced = new Set(catalog.templates.map((template) => template.storageKey));
    const entries = await readdir(imagesDirectory, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile() && !referenced.has(entry.name))
      .map((entry) => safeUnlink(path.join(imagesDirectory, entry.name))));
  }

  async function readCatalog(filePath) {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      const migratedShape = migrateCatalogShape(parsed);
      const { catalog: withProfessionalNames, changed: professionalNamesApplied } = applyProfessionalSeedMetadata(migratedShape, seedCatalog);
      const catalog = freezeCatalog(withProfessionalNames, limit);
      return {
        status: 'valid',
        catalog,
        needsRewrite: parsed.schemaVersion !== TEMPLATE_CATALOG_SCHEMA_VERSION || professionalNamesApplied,
      };
    } catch (error) {
      return error?.code === 'ENOENT' ? { status: 'missing' } : { status: 'invalid' };
    }
  }

  async function persistMigratedCatalog(catalog) {
    const serialized = serializeJson(catalog);
    await writeFileAtomically(catalogPath, serialized);
    await writeFileAtomically(backupPath, serialized);
  }

  function resolveStoragePath(storageKey) {
    if (!STORAGE_KEY_PATTERN.test(storageKey) || path.basename(storageKey) !== storageKey) {
      throw new AppError('INVALID_TEMPLATE_STORAGE_KEY', 'O identificador interno da imagem é inválido.', { status: 500 });
    }
    const resolved = path.resolve(imagesDirectory, storageKey);
    if (path.dirname(resolved) !== path.resolve(imagesDirectory)) {
      throw new AppError('INVALID_TEMPLATE_STORAGE_KEY', 'O identificador interno da imagem é inválido.', { status: 500 });
    }
    return resolved;
  }

  function findRecordIndex(id) {
    const index = catalogCache.templates.findIndex((template) => template.id === id);
    if (index < 0) throw templateNotFound();
    return index;
  }

  async function safeUnlink(filePath) {
    try {
      await unlink(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') return false;
    }
    return true;
  }

  return Object.freeze({
    list,
    listPage,
    getById,
    readImage,
    create,
    update,
    replaceImage,
    duplicate,
    delete: remove,
    setActive,
    ensureInitialized,
    paths: Object.freeze({ templatesDirectory, imagesDirectory, catalogPath, backupPath }),
  });
}

function createRecord({
  id, label, description = '', storageKey, image, active = true, createdAt, updatedAt,
  category = DEFAULT_TEMPLATE_CATEGORY_ID, tags = [], hoverDescription = null, usageMetrics = null,
  ...existing
}) {
  const imageFields = image ? {
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    aspectRatio: image.aspectRatio,
    sizeBytes: image.sizeBytes,
    valid: image.valid,
    warnings: sanitizeWarnings(image.warnings),
  } : {
    mimeType: existing.mimeType,
    width: existing.width,
    height: existing.height,
    aspectRatio: existing.aspectRatio,
    sizeBytes: existing.sizeBytes,
    valid: existing.valid,
    warnings: sanitizeWarnings(existing.warnings),
  };

  return Object.freeze({
    id,
    label,
    description,
    storageKey,
    ...imageFields,
    active: Boolean(active),
    category: category || DEFAULT_TEMPLATE_CATEGORY_ID,
    tags: Object.freeze(Array.isArray(tags) ? tags.map((tag) => String(tag)) : []),
    hoverDescription: hoverDescription == null ? null : String(hoverDescription),
    usageMetrics: usageMetrics ?? null,
    createdAt,
    updatedAt,
  });
}

function imageData(validated) {
  return {
    buffer: validated.buffer,
    mimeType: validated.mimeType,
    width: validated.dimensions.width,
    height: validated.dimensions.height,
    aspectRatio: validated.aspectRatio,
    sizeBytes: validated.buffer.length,
    valid: validated.validation.valid,
    warnings: validated.validation.warnings,
  };
}

function createStorageKey(prefix, mimeType, uuid) {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) throw new AppError('UNSUPPORTED_MIME', 'Use uma imagem JPEG, PNG ou WebP.', { status: 400 });
  const safePrefix = String(prefix).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || 'template';
  return `${safePrefix}-${uuid().toLowerCase().replace(/[^a-z0-9-]/g, '')}.${extension}`;
}

// Migração v1 → v2 (Fase 6): torna category/tags/hoverDescription/usageMetrics aditivos e
// idempotentes. Um catálogo já em v2 passa direto; um v1 reconhecido ganha os defaults;
// qualquer outra forma é devolvida como está para freezeCatalog rejeitar explicitamente.
function migrateCatalogShape(raw) {
  if (raw?.schemaVersion === TEMPLATE_CATALOG_SCHEMA_VERSION) return raw;
  if (raw?.schemaVersion === 1 && raw.initialized === true && Array.isArray(raw.templates)) {
    return {
      ...raw,
      schemaVersion: TEMPLATE_CATALOG_SCHEMA_VERSION,
      templates: raw.templates.map((record) => ({
        ...record,
        category: record.category ?? DEFAULT_TEMPLATE_CATEGORY_ID,
        tags: Array.isArray(record.tags) ? record.tags : [],
        hoverDescription: record.hoverDescription ?? null,
        usageMetrics: record.usageMetrics ?? null,
      })),
    };
  }
  return raw;
}

// Fase 6 — aplica os nomes/categoria/tags profissionais de PROFESSIONAL_SEED_METADATA a um
// registro seed apenas se ele ainda estiver exatamente como o bootstrap o criou (mesmo label,
// description e defaults de categoria/tags/hoverDescription do seed original). Idempotente:
// depois de aplicado, o registro deixa de bater com o teste "ainda genérico" e não é mais
// alterado; uma personalização do usuário também deixa de bater e é preservada.
function applyProfessionalSeedMetadata(catalog, seedCatalog) {
  let changed = false;
  const templates = catalog.templates.map((record) => {
    const professional = PROFESSIONAL_SEED_METADATA[record.id];
    if (!professional) return record;
    const seed = seedCatalog.getTemplateById(record.id);
    const stillGeneric = Boolean(seed)
      && record.label === seed.label
      && record.description === (seed.description || '')
      && record.category === DEFAULT_TEMPLATE_CATEGORY_ID
      && Array.isArray(record.tags) && record.tags.length === 0
      && record.hoverDescription == null;
    if (!stillGeneric) return record;
    changed = true;
    return { ...record, ...professional };
  });
  return changed ? { catalog: { ...catalog, templates }, changed: true } : { catalog, changed: false };
}

function freezeCatalog(value, limit) {
  if (!value || value.schemaVersion !== TEMPLATE_CATALOG_SCHEMA_VERSION || value.initialized !== true || !Array.isArray(value.templates)) {
    throw new Error('Invalid template catalog schema.');
  }
  if (value.templates.length > limit) throw new Error('Template catalog exceeds its limit.');

  const ids = new Set();
  const storageKeys = new Set();
  const templates = value.templates.map((record) => {
    assertRecord(record);
    if (ids.has(record.id) || storageKeys.has(record.storageKey)) throw new Error('Duplicate template catalog entry.');
    ids.add(record.id);
    storageKeys.add(record.storageKey);
    return createRecord(record);
  });

  return Object.freeze({ schemaVersion: TEMPLATE_CATALOG_SCHEMA_VERSION, initialized: true, templates: Object.freeze(templates) });
}

function assertRecord(record) {
  const strings = ['id', 'label', 'description', 'storageKey', 'mimeType', 'createdAt', 'updatedAt'];
  if (!record || strings.some((field) => typeof record[field] !== 'string')) throw new Error('Invalid template record.');
  if (!STORAGE_KEY_PATTERN.test(record.storageKey) || path.basename(record.storageKey) !== record.storageKey) throw new Error('Invalid storage key.');
  if (!EXTENSION_BY_MIME[record.mimeType]) throw new Error('Invalid template MIME.');
  if (![record.width, record.height, record.aspectRatio, record.sizeBytes].every(Number.isFinite)) throw new Error('Invalid template dimensions.');
  if (typeof record.valid !== 'boolean' || typeof record.active !== 'boolean' || !Array.isArray(record.warnings)) throw new Error('Invalid template state.');
  if (typeof record.category !== 'string' || !record.category) throw new Error('Invalid template category.');
  if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === 'string')) throw new Error('Invalid template tags.');
  if (record.hoverDescription !== null && typeof record.hoverDescription !== 'string') throw new Error('Invalid template hover description.');
}

function assertCapacity(catalog, limit) {
  if (catalog.templates.length >= limit) {
    throw new AppError('TEMPLATE_LIMIT_REACHED', `O limite local de ${limit} templates foi atingido.`, { status: 409 });
  }
}

function cloneRecord(record) {
  return { ...record, warnings: sanitizeWarnings(record.warnings) };
}

function sanitizeWarnings(warnings = []) {
  return warnings.map(({ code, message }) => ({ code: String(code), message: String(message) }));
}

function duplicateLabel(label, templates) {
  const labels = new Set(templates.map((template) => template.label.toLocaleLowerCase('pt-BR')));
  let candidate = `${label} — cópia`;
  let suffix = 2;
  while (labels.has(candidate.toLocaleLowerCase('pt-BR'))) candidate = `${label} — cópia ${suffix++}`;
  return candidate;
}

function templateNotFound() {
  return new AppError('TEMPLATE_NOT_FOUND', 'O template selecionado não existe.', { status: 404 });
}
