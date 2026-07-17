import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';
import { detectImageMime } from '../utils/fileValidation.js';

const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });
const MIME_BY_EXTENSION = Object.freeze({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' });
const SAFE_ID = /^[a-zA-Z0-9-]+$/;

function timestampPart(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
    + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-');
}

export function createLocalResultStorage({
  resultsDir = path.resolve(process.cwd(), 'storage/results'), resultsDirectory,
  fsImpl = { mkdir, readFile, readdir, rename, rm, unlink, writeFile }, uuid = randomUUID, now = () => new Date(),
} = {}) {
  const root = resultsDirectory || resultsDir;

  async function save({ generationId = uuid(), buffer, mimeType, metadata, fileName, imageBuffer, template, garment, branded }) {
    const resultBuffer = buffer || imageBuffer;
    const resultMime = mimeType || mimeFromFilename(fileName);
    assertImage(resultBuffer, resultMime);
    await fsImpl.mkdir(root, { recursive: true });
    if (!template && !garment) return saveLegacy({ generationId, buffer: resultBuffer, mimeType: resultMime, metadata, fileName });

    assertSafeId(generationId);
    assertReference(template, 'template');
    assertReference(garment, 'garment');
    if (branded) assertImage(branded.buffer, branded.mimeType);
    const directoryName = String(generationId);
    const finalDirectory = resolveChild(directoryName);
    const temporaryDirectory = resolveChild(`.${directoryName}.${uuid()}.tmp`);
    const resultFilename = `result.${EXTENSIONS[resultMime]}`;
    const templateFilename = `template.${EXTENSIONS[template.mimeType]}`;
    const garmentFilename = `garment.${EXTENSIONS[garment.mimeType]}`;
    const brandedFilename = branded ? `branded.${EXTENSIONS[branded.mimeType]}` : null;
    const persistedMetadata = { ...metadata, reviewStatus: metadata?.reviewStatus || 'pending', localAssets: { result: resultFilename, template: templateFilename, garment: garmentFilename, ...(brandedFilename ? { branded: brandedFilename } : {}) } };
    try {
      await fsImpl.mkdir(temporaryDirectory, { recursive: false });
      await fsImpl.writeFile(path.join(temporaryDirectory, resultFilename), resultBuffer);
      await fsImpl.writeFile(path.join(temporaryDirectory, templateFilename), template.buffer);
      await fsImpl.writeFile(path.join(temporaryDirectory, garmentFilename), garment.buffer);
      if (brandedFilename) await fsImpl.writeFile(path.join(temporaryDirectory, brandedFilename), branded.buffer);
      await fsImpl.writeFile(path.join(temporaryDirectory, 'metadata.json'), serializeJson(persistedMetadata));
      await fsImpl.rename(temporaryDirectory, finalDirectory);
    } catch (error) {
      await safeRemove(temporaryDirectory);
      throw new AppError('LOCAL_SAVE_FAILED', 'A imagem não pôde ser salva no computador.', { status: 500, cause: error });
    }
    return { saved: true, metadataSaved: true, imageFilename: `${directoryName}/${resultFilename}`, metadataFilename: `${directoryName}/metadata.json` };
  }

  async function saveLegacy({ generationId, buffer, mimeType, metadata, fileName }) {
    const baseName = fileName ? path.basename(fileName).replace(/\.[^.]+$/, '') : `prime-ia-studio-${timestampPart(now())}-${String(generationId).slice(0, 8)}`;
    const imageFilename = fileName ? path.basename(fileName) : `${baseName}.${EXTENSIONS[mimeType]}`;
    const metadataFilename = `${baseName}.json`;
    await writeAtomic(path.join(root, imageFilename), buffer, 'A imagem não pôde ser salva no computador.');
    let metadataSaved = true;
    try { await writeAtomic(path.join(root, metadataFilename), serializeJson(metadata), 'O metadata não pôde ser salvo no computador.'); } catch { metadataSaved = false; }
    return { saved: true, metadataSaved, imageFilename, metadataFilename: metadataSaved ? metadataFilename : null };
  }

  async function listEntries() {
    await fsImpl.mkdir(root, { recursive: true });
    const entries = await fsImpl.readdir(root, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.includes('.deleting-')) continue;
      try {
        const result = entry.isDirectory() && SAFE_ID.test(entry.name)
          ? await readDirectoryEntry(entry.name)
          : entry.isFile() && isImageFilename(entry.name) ? await readLegacyEntry(entry.name) : null;
        if (result) results.push(result);
      } catch { /* Uma entrada inválida não impede a leitura das demais. */ }
    }
    return results;
  }

  async function readDirectoryEntry(directoryName) {
    const directory = resolveChild(directoryName);
    const metadata = await readJson(path.join(directory, 'metadata.json'));
    if (!metadata?.id) return null;
    const files = await fsImpl.readdir(directory, { withFileTypes: true });
    const names = files.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const assets = { result: findAsset(names, 'result'), template: findAsset(names, 'template'), garment: findAsset(names, 'garment'), branded: findAsset(names, 'branded') };
    if (!assets.result) return null;
    return { format: 'directory', key: directoryName, metadata, metadataPath: path.join(directory, 'metadata.json'), assets };
  }

  async function readLegacyEntry(imageFilename) {
    const key = imageFilename.replace(/\.[^.]+$/, '');
    const metadataPath = resolveChild(`${key}.json`);
    const metadata = await readJson(metadataPath);
    if (!metadata?.id) return null;
    return { format: 'legacy', key, metadata, metadataPath, assets: { result: imageFilename, template: null, garment: null, branded: null } };
  }

  async function findById(id) {
    assertSafeId(id);
    const entry = (await listEntries()).find((candidate) => candidate.metadata.id === id);
    if (!entry) throw new AppError('RESULT_NOT_FOUND', 'O resultado solicitado não foi encontrado.', { status: 404 });
    return entry;
  }

  async function readAsset(id, type) {
    if (!['result', 'template', 'garment', 'branded'].includes(type)) throw new AppError('INVALID_RESULT_ASSET', 'O tipo de arquivo solicitado é inválido.', { status: 400 });
    const entry = await findById(id);
    const filename = entry.assets[type];
    if (!filename) throw new AppError('RESULT_ASSET_NOT_FOUND', 'Referência não disponível para esta geração anterior.', { status: 404 });
    const filePath = entry.format === 'directory' ? path.join(resolveChild(entry.key), filename) : resolveChild(filename);
    const buffer = await fsImpl.readFile(filePath).catch((error) => { throw new AppError('RESULT_ASSET_NOT_FOUND', 'O arquivo local deste resultado não foi encontrado.', { status: 404, cause: error }); });
    const realMimeType = detectImageMime(buffer);
    if (!realMimeType) throw new AppError('RESULT_ASSET_INVALID', 'O arquivo local deste resultado é inválido.', { status: 500 });
    const downloadFilename = type === 'result' ? `prime-studio-${entry.metadata.id}.${EXTENSIONS[realMimeType]}`
      : type === 'branded' ? `prime-studio-${entry.metadata.id}-com-logo.${EXTENSIONS[realMimeType]}`
        : filename;
    return { buffer, mimeType: realMimeType, filename: downloadFilename };
  }

  async function updateMetadata(id, updater) {
    const entry = await findById(id);
    const nextMetadata = updater({ ...entry.metadata });
    await writeAtomic(entry.metadataPath, serializeJson(nextMetadata), 'Não foi possível atualizar o resultado local.', 'RESULT_UPDATE_FAILED');
    return { ...entry, metadata: nextMetadata };
  }

  async function removeResult(id) {
    const entry = await findById(id);
    const tombstone = resolveChild(`.${entry.key}.deleting-${uuid()}`);
    if (entry.format === 'directory') {
      const source = resolveChild(entry.key);
      await fsImpl.rename(source, tombstone).catch((error) => { throw new AppError('RESULT_DELETE_FAILED', 'Não foi possível excluir o resultado local.', { status: 500, cause: error }); });
      try { await fsImpl.rm(tombstone, { recursive: true, force: true }); }
      catch (error) { await fsImpl.rename(tombstone, source).catch(() => {}); throw new AppError('RESULT_DELETE_FAILED', 'Não foi possível excluir o resultado local.', { status: 500, cause: error }); }
      return;
    }
    const imagePath = resolveChild(entry.assets.result);
    const imageTombstone = `${tombstone}.${path.extname(entry.assets.result).slice(1)}`;
    await fsImpl.rename(imagePath, imageTombstone).catch((error) => { throw new AppError('RESULT_DELETE_FAILED', 'Não foi possível excluir o resultado local.', { status: 500, cause: error }); });
    try { await fsImpl.rename(entry.metadataPath, tombstone); }
    catch (error) { await fsImpl.rename(imageTombstone, imagePath).catch(() => {}); throw new AppError('RESULT_DELETE_FAILED', 'Não foi possível excluir o resultado local.', { status: 500, cause: error }); }
    try { await fsImpl.unlink(imageTombstone); await fsImpl.unlink(tombstone); }
    catch (error) { throw new AppError('RESULT_DELETE_FAILED', 'Não foi possível concluir a exclusão do resultado local.', { status: 500, cause: error }); }
  }

  async function writeAtomic(targetPath, data, errorMessage, errorCode = 'LOCAL_SAVE_FAILED') {
    await writeFileAtomically(targetPath, data, { fsImpl, uuid, errorCode, errorMessage });
  }
  async function readJson(filePath) { try { return JSON.parse(await fsImpl.readFile(filePath, 'utf8')); } catch { return null; } }
  async function safeRemove(target) { try { await fsImpl.rm(target, { recursive: true, force: true }); } catch { /* compensatório */ } }
  function resolveChild(name) {
    const resolved = path.resolve(root, name);
    if (resolved === path.resolve(root) || !resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new AppError('INVALID_RESULT_PATH', 'O identificador do resultado é inválido.', { status: 400 });
    return resolved;
  }

  Object.assign(save, { save, listEntries, findById, readAsset, updateMetadata, delete: removeResult, paths: Object.freeze({ resultsDirectory: root }) });
  return save;
}

function assertImage(buffer, mimeType) { if (!buffer || !EXTENSIONS[mimeType]) throw new AppError('UNSUPPORTED_OUTPUT_MIME', 'O formato da imagem gerada não é suportado para salvamento.', { status: 500 }); }
function assertReference(reference, label) { if (!reference?.buffer || !EXTENSIONS[reference.mimeType]) throw new AppError('INVALID_RESULT_REFERENCE', `A referência ${label} não pôde ser preservada.`, { status: 500 }); }
function assertSafeId(id) { if (!SAFE_ID.test(String(id))) throw new AppError('INVALID_RESULT_ID', 'O identificador do resultado é inválido.', { status: 400 }); }
function mimeFromFilename(filename = '') { return MIME_BY_EXTENSION[path.extname(filename).slice(1).toLowerCase()] || null; }
function isImageFilename(filename) { return Boolean(mimeFromFilename(filename)); }
function findAsset(names, prefix) { return names.find((name) => name.startsWith(`${prefix}.`) && isImageFilename(name)) || null; }
