import { readFileSync } from 'node:fs';
import path from 'node:path';

export const jpegBytes = readFileSync(path.resolve(process.cwd(), 'public/templates/model-01.jpeg'));
export const webpBytes = readFileSync(path.resolve(process.cwd(), 'public/templates/00model-01.webp'));
export const tinyPngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

export function createJpegFile(name = 'camiseta.jpeg') {
  return new File([jpegBytes], name, { type: 'image/jpeg' });
}

export function createWebpFile(name = 'camiseta.webp') {
  return new File([webpBytes], name, { type: 'image/webp' });
}

export function createTinyPngFile(name = 'tiny.png') {
  return new File([tinyPngBytes], name, { type: 'image/png' });
}

export function mockImageBitmap(width = 773, height = 1024) {
  globalThis.createImageBitmap = vi.fn(async () => ({ width, height, close: vi.fn() }));
}
