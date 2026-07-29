import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { STORY_TYPOGRAPHY_IDS } from '../../shared/storyTypographySpec.js';
import { storyTypographyFontFaces } from './storyTypographyFonts.js';

const STORAGE_DIRECTORIES = ['results', 'batches', 'templates', 'marketing', 'branding', 'settings'];

export function createLocalHealthService({ storageRoot = path.resolve(process.cwd(), 'storage'), fsImpl = { access, readdir }, sharpImpl = sharp, readFonts = storyTypographyFontFaces } = {}) {
  async function getStatus() {
    const [storage, renderer] = await Promise.all([checkStorage(), checkRenderer()]);
    return { storage, renderer };
  }
  async function checkStorage() {
    try {
      for (const directory of STORAGE_DIRECTORIES) {
        const target = path.join(storageRoot, directory);
        await fsImpl.access(target, constants.R_OK); await fsImpl.readdir(target);
      }
      return { status: 'available' };
    } catch (error) { return { status: error?.code === 'ENOENT' || error?.code === 'EACCES' ? 'unavailable' : 'unknown' }; }
  }
  async function checkRenderer() {
    try {
      if (!sharpImpl?.versions) return { status: 'unavailable' };
      STORY_TYPOGRAPHY_IDS.forEach((preset) => readFonts(preset));
      return { status: 'available' };
    } catch { return { status: 'unavailable' }; }
  }
  return Object.freeze({ getStatus });
}
