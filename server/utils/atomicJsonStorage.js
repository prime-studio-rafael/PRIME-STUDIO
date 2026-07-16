import { randomUUID } from 'node:crypto';
import { rename, unlink, writeFile } from 'node:fs/promises';
import { AppError } from './errors.js';

export async function writeFileAtomically(targetPath, data, {
  fsImpl = { rename, unlink, writeFile },
  uuid = randomUUID,
  errorCode = 'LOCAL_TEMPLATE_STORAGE_FAILED',
  errorMessage = 'Não foi possível salvar os templates locais.',
} = {}) {
  const temporaryPath = `${targetPath}.${uuid()}.tmp`;

  try {
    await fsImpl.writeFile(temporaryPath, data);
    await fsImpl.rename(temporaryPath, targetPath);
  } catch (error) {
    try {
      await fsImpl.unlink?.(temporaryPath);
    } catch {
      // A limpeza é apenas compensatória; o erro original é o relevante.
    }
    throw new AppError(errorCode, errorMessage, { status: 500, cause: error });
  }
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
