import path from 'node:path';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';

const EXTENSIONS = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
});

function timestampPart(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-');
}

export function createLocalResultStorage({
  resultsDir = path.resolve(process.cwd(), 'storage/results'),
  resultsDirectory,
  fsImpl = { mkdir, rename, writeFile },
  uuid = randomUUID,
  now = () => new Date(),
} = {}) {
  async function save({ generationId = uuid(), buffer, mimeType, metadata, fileName, imageBuffer }) {
      const actualBuffer = buffer || imageBuffer;
      const actualMimeType = mimeType || (fileName?.endsWith('.webp') ? 'image/webp' : fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
      const targetDirectory = resultsDirectory || resultsDir;
      if (!actualBuffer || !EXTENSIONS[actualMimeType]) {
        throw new AppError('UNSUPPORTED_OUTPUT_MIME', 'O formato da imagem gerada não é suportado para salvamento.', { status: 500 });
      }

      await fsImpl.mkdir(targetDirectory, { recursive: true });
      const baseName = fileName ? fileName.replace(/\.[^.]+$/, '') : `prime-ia-studio-${timestampPart(now())}-${String(generationId).slice(0, 8)}`;
      const imageFilename = fileName || `${baseName}.${EXTENSIONS[actualMimeType]}`;
      const metadataFilename = `${baseName}.json`;
      const imagePath = path.join(targetDirectory, imageFilename);
      const metadataPath = path.join(targetDirectory, metadataFilename);

      await writeAtomically(fsImpl, imagePath, actualBuffer, uuid);

      let metadataSaved = true;
      try {
        await writeAtomically(fsImpl, metadataPath, JSON.stringify(metadata, null, 2), uuid);
      } catch {
        metadataSaved = false;
      }

      return {
        saved: true,
        metadataSaved,
        imageFilename,
        metadataFilename: metadataSaved ? metadataFilename : null,
      };
  }

  save.save = save;
  return save;
}

async function writeAtomically(fsImpl, targetPath, data, uuid) {
  const temporaryPath = `${targetPath}.${uuid()}.tmp`;
  try {
    await fsImpl.writeFile(temporaryPath, data);
    await fsImpl.rename(temporaryPath, targetPath);
  } catch (error) {
    throw new AppError('LOCAL_SAVE_FAILED', 'A imagem não pôde ser salva no computador.', { status: 500, cause: error });
  }
}
