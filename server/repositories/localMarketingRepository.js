import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';

const SAFE_ID = /^[a-zA-Z0-9-]+$/;

export function createLocalMarketingRepository({
  marketingDir = path.resolve(process.cwd(), 'storage/marketing'),
  fsImpl = { mkdir, readFile, readdir, rename, rm, unlink, writeFile },
  uuid = randomUUID,
} = {}) {
  const weeksDir = path.join(marketingDir, 'weeks');
  let mutation = Promise.resolve();

  async function ensureInitialized() { await fsImpl.mkdir(weeksDir, { recursive: true }); }

  async function list() {
    await ensureInitialized();
    const entries = await fsImpl.readdir(weeksDir, { withFileTypes: true });
    const weeks = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SAFE_ID.test(entry.name)) continue;
      const week = await readRecoverable(entry.name);
      if (week) weeks.push(week);
    }
    return weeks.sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
  }

  async function get(id) {
    assertId(id);
    const week = await readRecoverable(id);
    if (!week) throw new AppError('MARKETING_WEEK_NOT_FOUND', 'A semana solicitada não foi encontrada.', { status: 404 });
    return clone(week);
  }

  async function create(week) {
    return serialize(async () => {
      assertId(week.id);
      await ensureInitialized();
      const finalDir = weekDir(week.id);
      const temporaryDir = path.join(weeksDir, `.${week.id}.${uuid()}.tmp`);
      try {
        await fsImpl.mkdir(path.join(temporaryDir, 'assets', 'sources'), { recursive: true });
        await fsImpl.mkdir(path.join(temporaryDir, 'assets', 'stories'), { recursive: true });
        await fsImpl.writeFile(path.join(temporaryDir, 'week.json'), serializeJson(week));
        await fsImpl.writeFile(path.join(temporaryDir, 'week.json.bak'), serializeJson(week));
        await fsImpl.rename(temporaryDir, finalDir);
      } catch (error) {
        await safeRemove(temporaryDir);
        throw new AppError('MARKETING_SAVE_FAILED', 'Não foi possível criar a semana local.', { status: 500, cause: error });
      }
      return clone(week);
    });
  }

  async function update(id, updater) {
    return serialize(async () => {
      const current = await get(id);
      const next = await updater(clone(current));
      await persist(id, current, next);
      return clone(next);
    });
  }

  async function remove(id) {
    return serialize(async () => {
      await get(id);
      const original = weekDir(id);
      const tombstone = path.join(weeksDir, `.${id}.deleting-${uuid()}`);
      try { await fsImpl.rename(original, tombstone); await fsImpl.rm(tombstone, { recursive: true, force: true }); }
      catch (error) { throw new AppError('MARKETING_DELETE_FAILED', 'Não foi possível excluir a semana local.', { status: 500, cause: error }); }
      return { deleted: true, id };
    });
  }

  async function writeAsset(weekId, kind, fileName, buffer) {
    assertId(weekId); assertAsset(kind, fileName);
    const target = assetPath(weekId, kind, fileName);
    await fsImpl.mkdir(path.dirname(target), { recursive: true });
    await writeFileAtomically(target, buffer, { fsImpl, uuid, errorCode: 'MARKETING_ASSET_SAVE_FAILED', errorMessage: 'Não foi possível salvar o arquivo do Story.' });
    return fileName;
  }

  async function readAsset(weekId, kind, fileName) {
    assertId(weekId); assertAsset(kind, fileName);
    try { return await fsImpl.readFile(assetPath(weekId, kind, fileName)); }
    catch (error) { throw new AppError('MARKETING_ASSET_NOT_FOUND', 'O arquivo local do Story não foi encontrado.', { status: 404, cause: error }); }
  }

  async function deleteAsset(weekId, kind, fileName) {
    if (!fileName) return;
    assertId(weekId); assertAsset(kind, fileName);
    try { await fsImpl.unlink(assetPath(weekId, kind, fileName)); } catch { /* compensatório */ }
  }

  async function persist(id, previous, next) {
    const dir = weekDir(id);
    await writeFileAtomically(path.join(dir, 'week.json.bak'), serializeJson(previous), { fsImpl, uuid, errorCode: 'MARKETING_SAVE_FAILED', errorMessage: 'Não foi possível salvar o backup da semana.' });
    await writeFileAtomically(path.join(dir, 'week.json'), serializeJson(next), { fsImpl, uuid, errorCode: 'MARKETING_SAVE_FAILED', errorMessage: 'Não foi possível salvar a semana.' });
  }

  async function readRecoverable(id) {
    const dir = weekDir(id);
    const primary = await readJson(path.join(dir, 'week.json'));
    const backup = await readJson(path.join(dir, 'week.json.bak'));
    const valid = isValid(primary) ? primary : isValid(backup) ? backup : null;
    if (valid && valid !== primary) {
      await writeFileAtomically(path.join(dir, 'week.json'), serializeJson(valid), { fsImpl, uuid, errorCode: 'MARKETING_SAVE_FAILED', errorMessage: 'Não foi possível recuperar a semana local.' });
    }
    return valid ? clone(valid) : null;
  }

  function weekDir(id) {
    assertId(id);
    const resolved = path.resolve(weeksDir, id);
    if (!resolved.startsWith(`${path.resolve(weeksDir)}${path.sep}`)) throw new AppError('INVALID_MARKETING_PATH', 'Identificador de semana inválido.', { status: 400 });
    return resolved;
  }
  function assetPath(weekId, kind, fileName) { return path.join(weekDir(weekId), 'assets', kind, path.basename(fileName)); }
  function serialize(operation) { const next = mutation.then(operation, operation); mutation = next.catch(() => {}); return next; }
  async function safeRemove(target) { try { await fsImpl.rm(target, { recursive: true, force: true }); } catch { /* compensatório */ } }

  return Object.freeze({ ensureInitialized, list, get, create, update, delete: remove, writeAsset, readAsset, deleteAsset, paths: Object.freeze({ marketingDirectory: marketingDir }) });
}

function assertId(id) { if (!SAFE_ID.test(String(id))) throw new AppError('INVALID_MARKETING_ID', 'Identificador de Marketing inválido.', { status: 400 }); }
function assertAsset(kind, fileName) {
  if (!['sources', 'stories'].includes(kind) || path.basename(String(fileName)) !== fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
    throw new AppError('INVALID_MARKETING_ASSET', 'Arquivo de Marketing inválido.', { status: 400 });
  }
}
function isValid(week) { return Boolean(week && SAFE_ID.test(String(week.id)) && /^\d{4}-\d{2}-\d{2}$/.test(week.weekStart) && Array.isArray(week.stories)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
async function readJson(filePath) { try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return null; } }
