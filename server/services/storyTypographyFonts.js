import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getStoryTypographyPreset } from '../../shared/storyTypographySpec.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FONT_FILES = Object.freeze({
  Inter: 'Inter-Variable.ttf',
  Manrope: 'Manrope-Variable.ttf',
  'Plus Jakarta Sans': 'PlusJakartaSans-Variable.ttf',
  'Bebas Neue': 'BebasNeue-Regular.ttf',
});
const cache = new Map();

export function storyTypographyFontFaces(presetId) {
  const preset = getStoryTypographyPreset(presetId);
  return [...new Set([preset.body, preset.display])].map(fontFace).join('');
}

function fontFace(family) {
  if (cache.has(family)) return cache.get(family);
  const fileName = FONT_FILES[family];
  if (!fileName) throw new Error(`Fonte de Story não configurada: ${family}`);
  const buffer = readFileSync(path.join(projectRoot, 'src/assets/fonts', fileName));
  const css = `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64,${buffer.toString('base64')}) format('truetype')}`;
  cache.set(family, css);
  return css;
}
