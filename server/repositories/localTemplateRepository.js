import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { getTemplateById, listTemplates } from '../catalogs/templates.js';
import { validateImageBuffer } from '../utils/fileValidation.js';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';

export const TEMPLATE_CATALOG_SCHEMA_VERSION = 1;
export const DEFAULT_TEMPLATE_LIMIT = 50;

const EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const STORAGE_KEY_PATTERN = /^[a-z0-9-]+\.(?:jpeg|png|webp)$/;

export function createLocalTemplateRepository({
  templatesDirectory = path.resolve(process.cwd(), 'storage/templates'),
  seedCatalog = { listTemplates, getTemplateById },
  limit = DEFAULT_TEMPLATE_LIMIT,
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
      await cleanupOrphanImages(catalogCache);
      return;
    }

    const backup = await readCatalog(backupPath);
    if (backup.status === 'valid') {
      await writeFileAtomically(catalogPath, serializeJson(backup.catalog));
      catalogCache = backup.catalog;
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
      return { status: 'valid', catalog: freezeCatalog(parsed, limit) };
    } catch (error) {
      return error?.code === 'ENOENT' ? { status: 'missing' } : { status: 'invalid' };
    }
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

function createRecord({ id, label, description = '', storageKey, image, active = true, createdAt, updatedAt, ...existing }) {
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
