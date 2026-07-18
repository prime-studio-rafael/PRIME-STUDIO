import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';
import { detectImageMime } from '../utils/fileValidation.js';

const SAFE_ID = /^[a-zA-Z0-9-]+$/;
const EXT = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });

/** Local, atomic persistence boundary for batches. It never exposes disk paths. */
export function createLocalBatchRepository({ batchesDir = path.resolve(process.cwd(), 'storage/batches'), fsImpl = { mkdir, readFile, readdir, rename, rm, writeFile }, uuid = randomUUID } = {}) {
  const cache = new Map();
  let initialized;
  let mutation = Promise.resolve();

  async function ensureInitialized() {
    if (!initialized) initialized = initialize();
    return initialized;
  }
  async function initialize() {
    await fsImpl.mkdir(batchesDir, { recursive: true });
    const entries = await fsImpl.readdir(batchesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || !SAFE_ID.test(entry.name)) continue;
      const batch = await readRecoverable(entry.name);
      if (!batch) continue;
      let changed = false;
      if (batch.status === 'running') { batch.status = 'interrupted'; changed = true; }
      for (const item of batch.items || []) {
        if (item.status === 'preparing' || item.status === 'generating') { item.status = 'interrupted'; item.updatedAt = new Date().toISOString(); changed = true; }
      }
      if (changed) { summarize(batch); batch.updatedAt = new Date().toISOString(); await persist(batch); }
      cache.set(batch.id, batch);
    }
  }
  async function create({ batch, template, items }) {
    await ensureInitialized();
    assertId(batch.id);
    return serialize(async () => {
      const finalDir = child(batch.id); const tmp = child(`.${batch.id}.${uuid()}.tmp`);
      try {
        await fsImpl.mkdir(path.join(tmp, 'items'), { recursive: true });
        await fsImpl.writeFile(path.join(tmp, `template.${extension(template.mimeType)}`), template.buffer);
        batch.templateStorageKey = `template.${extension(template.mimeType)}`;
        batch.items = items;
        summarize(batch);
        for (const item of items) {
          assertId(item.id); item.garmentStorageKey = `garment.${extension(item.garmentMime)}`;
          const dir = path.join(tmp, 'items', item.id); await fsImpl.mkdir(dir, { recursive: true });
          await fsImpl.writeFile(path.join(dir, item.garmentStorageKey), item.buffer);
          const stored = { ...item }; delete stored.buffer;
          await fsImpl.writeFile(path.join(dir, 'item.json'), serializeJson(stored));
          delete item.buffer;
        }
        await fsImpl.writeFile(path.join(tmp, 'batch.json'), serializeJson(batch));
        await fsImpl.writeFile(path.join(tmp, 'batch.json.bak'), serializeJson(batch));
        await fsImpl.rename(tmp, finalDir);
        cache.set(batch.id, batch); return clone(batch);
      } catch (error) { await fsImpl.rm(tmp, { recursive: true, force: true }).catch(() => {}); throw new AppError('BATCH_SAVE_FAILED', 'Não foi possível salvar o lote local.', { status: 500, cause: error }); }
    });
  }
  async function list() { await ensureInitialized(); return [...cache.values()].map(clone).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }
  async function get(id) { await ensureInitialized(); assertId(id); const value = cache.get(id); if (!value) throw new AppError('BATCH_NOT_FOUND', 'O lote solicitado não foi encontrado.', { status: 404 }); return clone(value); }
  async function update(id, updater) {
    await ensureInitialized(); assertId(id);
    return serialize(async () => {
      const current = cache.get(id); if (!current) throw new AppError('BATCH_NOT_FOUND', 'O lote solicitado não foi encontrado.', { status: 404 });
      const next = await updater(clone(current)); summarize(next); next.updatedAt = new Date().toISOString(); await persist(next); cache.set(id, next); return clone(next);
    });
  }
  async function readGarment(batchId, itemId) {
    const batch = await get(batchId); assertId(itemId); const item = batch.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new AppError('BATCH_ITEM_NOT_FOUND', 'O item do lote não foi encontrado.', { status: 404 });
    const buffer = await fsImpl.readFile(path.join(child(batch.id), 'items', item.id, item.garmentStorageKey)); const mimeType = detectImageMime(buffer);
    if (!mimeType) throw new AppError('BATCH_GARMENT_INVALID', 'A imagem local da roupa está inválida.', { status: 422 });
    return { buffer, mimeType, originalname: item.originalFileName, size: buffer.length };
  }
  async function readTemplate(batchId) {
    const batch = await get(batchId); const buffer = await fsImpl.readFile(path.join(child(batch.id), batch.templateStorageKey)); const mimeType = detectImageMime(buffer);
    if (!mimeType) throw new AppError('BATCH_TEMPLATE_INVALID', 'O snapshot local do template está inválido.', { status: 422 });
    return {
      id: batch.templateId, label: batch.templateLabel, category: batch.templateCategory ?? null, buffer, mimeType, fileName: batch.templateStorageKey,
      prompt: batch.templatePrompt ?? null, negativePrompt: batch.templateNegativePrompt ?? null,
      provider: batch.templateProvider ?? null, modelId: batch.templateModelId ?? null,
      generationAspectRatio: batch.templateGenerationAspectRatio ?? null, resolution: batch.templateResolution ?? null,
      promptVersion: batch.templatePromptVersion ?? null,
    };
  }
  async function readRecoverable(id) {
    const dir = child(id); const primary = await readJson(path.join(dir, 'batch.json')); const backup = await readJson(path.join(dir, 'batch.json.bak'));
    const valid = isValid(primary) ? primary : isValid(backup) ? backup : null;
    if (valid && valid !== primary) await writeFileAtomically(path.join(dir, 'batch.json'), serializeJson(valid), { fsImpl, uuid, errorCode: 'BATCH_SAVE_FAILED', errorMessage: 'Não foi possível recuperar o lote local.' });
    return valid;
  }
  async function persist(batch) {
    const dir = child(batch.id); const current = cache.get(batch.id);
    if (current) await writeFileAtomically(path.join(dir, 'batch.json.bak'), serializeJson(current), { fsImpl, uuid, errorCode: 'BATCH_SAVE_FAILED', errorMessage: 'Não foi possível salvar o backup do lote.' });
    for (const item of batch.items || []) { const stored = { ...item }; delete stored.buffer; await writeFileAtomically(path.join(dir, 'items', item.id, 'item.json'), serializeJson(stored), { fsImpl, uuid, errorCode: 'BATCH_SAVE_FAILED', errorMessage: 'Não foi possível salvar o item do lote.' }); }
    await writeFileAtomically(path.join(dir, 'batch.json'), serializeJson(batch), { fsImpl, uuid, errorCode: 'BATCH_SAVE_FAILED', errorMessage: 'Não foi possível salvar o lote.' });
    await writeFileAtomically(path.join(dir, 'batch.json.bak'), serializeJson(batch), { fsImpl, uuid, errorCode: 'BATCH_SAVE_FAILED', errorMessage: 'Não foi possível salvar o backup do lote.' });
  }
  function child(name) { const resolved = path.resolve(batchesDir, name); if (!resolved.startsWith(`${path.resolve(batchesDir)}${path.sep}`)) throw new AppError('INVALID_BATCH_PATH', 'Identificador de lote inválido.', { status: 400 }); return resolved; }
  function serialize(operation) { const next = mutation.then(operation, operation); mutation = next.catch(() => {}); return next; }
  return Object.freeze({ ensureInitialized, create, list, get, update, readGarment, readTemplate, paths: Object.freeze({ batchesDirectory: batchesDir }) });
}
function extension(mime) { if (!EXT[mime]) throw new AppError('UNSUPPORTED_MIME', 'Use uma imagem JPG, PNG ou WebP.', { status: 400 }); return EXT[mime]; }
function assertId(id) { if (!SAFE_ID.test(String(id))) throw new AppError('INVALID_BATCH_ID', 'Identificador de lote inválido.', { status: 400 }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function isValid(batch) { return Boolean(batch && SAFE_ID.test(String(batch.id)) && Array.isArray(batch.items) && typeof batch.status === 'string'); }
function readJson(file) { return readFile(file, 'utf8').then(JSON.parse).catch(() => null); }
export function summarize(batch) {
  const items = batch.items || []; batch.totalItems = items.length;
  batch.completedItems = items.filter((item) => item.status === 'completed').length;
  batch.failedItems = items.filter((item) => item.status === 'failed').length;
  batch.cancelledItems = items.filter((item) => item.status === 'cancelled').length;
  batch.interruptedItems = items.filter((item) => item.status === 'interrupted').length;
  batch.actualCostUsd = items.reduce((sum, item) => sum + (Number.isFinite(item.costUsd) ? item.costUsd : 0), 0) || null;
}
