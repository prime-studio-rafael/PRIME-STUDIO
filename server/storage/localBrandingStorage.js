import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { AppError } from '../utils/errors.js';
import { serializeJson, writeFileAtomically } from '../utils/atomicJsonStorage.js';

const DEFAULT_METADATA = Object.freeze({ pending: null, approved: null });
const DEFAULT_CONFIG = Object.freeze({ enabled: false });

export function createLocalBrandingStorage({
  brandingDir = path.resolve(process.cwd(), 'storage/branding'), brandingDirectory,
  fsImpl = { mkdir, readFile, rename, unlink, writeFile }, uuid = randomUUID,
} = {}) {
  const root = brandingDirectory || brandingDir;
  const paths = Object.freeze({
    approvedLogo: () => resolveChild('logo.png'),
    pendingLogo: () => resolveChild('pending-logo.png'),
    metadata: () => resolveChild('metadata.json'),
    metadataBackup: () => resolveChild('metadata.json.bak'),
    config: () => resolveChild('config.json'),
  });

  async function ensureDir() {
    await fsImpl.mkdir(root, { recursive: true });
  }

  async function readConfig() {
    await ensureDir();
    const parsed = await readJson(paths.config());
    return { ...DEFAULT_CONFIG, ...(parsed || {}) };
  }

  async function writeConfig(config) {
    await ensureDir();
    await writeAtomic(paths.config(), serializeJson(config), 'Não foi possível salvar a configuração de branding.', 'BRANDING_CONFIG_SAVE_FAILED');
  }

  async function readMetadata() {
    await ensureDir();
    const parsed = await readJson(paths.metadata());
    return { ...DEFAULT_METADATA, ...(parsed || {}) };
  }

  async function writeMetadata(metadata) {
    await ensureDir();
    const existingRaw = await readRaw(paths.metadata());
    if (existingRaw !== null) {
      await writeAtomic(paths.metadataBackup(), existingRaw, 'Não foi possível preservar o backup do branding.', 'BRANDING_METADATA_BACKUP_FAILED');
    }
    await writeAtomic(paths.metadata(), serializeJson(metadata), 'Não foi possível salvar o metadata do branding.', 'BRANDING_METADATA_SAVE_FAILED');
  }

  async function readPendingLogo() {
    return readOptionalBuffer(paths.pendingLogo());
  }

  async function readApprovedLogo() {
    return readOptionalBuffer(paths.approvedLogo());
  }

  async function savePendingLogo(buffer) {
    await ensureDir();
    await writeAtomic(paths.pendingLogo(), buffer, 'Não foi possível salvar a logo enviada.', 'BRANDING_LOGO_SAVE_FAILED');
  }

  async function promotePendingToApproved() {
    await ensureDir();
    const pendingPath = paths.pendingLogo();
    const approvedPath = paths.approvedLogo();
    const temporaryPath = `${approvedPath}.${uuid()}.tmp`;
    try {
      await fsImpl.readFile(pendingPath);
    } catch (error) {
      throw new AppError('BRANDING_NO_PENDING_LOGO', 'Nenhuma logo pendente para aprovar.', { status: 400, cause: error });
    }
    try {
      const pendingBuffer = await fsImpl.readFile(pendingPath);
      await fsImpl.writeFile(temporaryPath, pendingBuffer);
      await fsImpl.rename(temporaryPath, approvedPath);
    } catch (error) {
      await safeUnlink(temporaryPath);
      throw new AppError('BRANDING_APPROVE_FAILED', 'Não foi possível aprovar a logo.', { status: 500, cause: error });
    }
    // A logo aprovada já está persistida com sucesso (rename acima) — o candidato pendente pode ser limpo com segurança.
    await safeUnlink(pendingPath);
  }

  async function deleteApprovedLogo() {
    await safeUnlink(paths.approvedLogo());
  }

  async function readOptionalBuffer(filePath) {
    try {
      return await fsImpl.readFile(filePath);
    } catch {
      return null;
    }
  }

  async function readRaw(filePath) {
    try {
      return await fsImpl.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  async function readJson(filePath) {
    const raw = await readRaw(filePath);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function writeAtomic(targetPath, data, errorMessage, errorCode) {
    await writeFileAtomically(targetPath, data, { fsImpl, uuid, errorCode, errorMessage });
  }

  async function safeUnlink(filePath) {
    try {
      await fsImpl.unlink(filePath);
    } catch {
      /* já removido ou nunca existiu — compensatório */
    }
  }

  function resolveChild(name) {
    const resolved = path.resolve(root, name);
    if (resolved !== path.resolve(root, path.basename(name)) || !resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new AppError('INVALID_BRANDING_PATH', 'Caminho de branding inválido.', { status: 400 });
    }
    return resolved;
  }

  return Object.freeze({
    readConfig,
    writeConfig,
    readMetadata,
    writeMetadata,
    readPendingLogo,
    readApprovedLogo,
    savePendingLogo,
    promotePendingToApproved,
    deleteApprovedLogo,
    paths: Object.freeze({ brandingDirectory: root }),
  });
}
