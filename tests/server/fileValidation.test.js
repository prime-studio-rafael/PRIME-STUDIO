import { readFile } from 'node:fs/promises';
import { validateImageBuffer, validateUploadedImage } from '../../server/utils/fileValidation.js';
import { generationConfig } from '../../server/config/generationConfig.js';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const fixture = (name) => readFile(new URL(`../../public/templates/${name}`, import.meta.url));

describe('file validation', () => {
  it.each([
    ['JPEG', 'model-01.jpeg', 'image/jpeg'],
    ['PNG', 'model-01 - cópia.png', 'image/png'],
    ['WebP', '00model-01.webp', 'image/webp'],
  ])('accepts a structurally valid %s', async (_label, filename, mimeType) => {
    const buffer = await fixture(filename);
    const result = validateImageBuffer(buffer, { fileName: filename, expectedMimeType: mimeType });

    expect(result).toMatchObject({ mimeType, dimensions: { width: expect.any(Number), height: expect.any(Number) } });
    expect(result.inspection.integrity.valid).toBe(true);
  });

  it('rejects an empty file', () => {
    expect(() => validateImageBuffer(Buffer.alloc(0))).toThrowError('está vazia');
  });

  it('rejects an incompatible binary signature', () => {
    expect(() => validateUploadedImage({ buffer: Buffer.from('not-an-image'), mimetype: 'image/png', originalname: 'garment.png' }, generationConfig)).toThrowError('assinatura');
  });

  it('rejects a MIME mismatch', async () => {
    const jpeg = await fixture('model-01.jpeg');
    expect(() => validateUploadedImage({ buffer: jpeg, mimetype: 'image/png', originalname: 'garment.png' }, generationConfig)).toThrowError('MIME informado');
  });

  it('rejects an extension mismatch', async () => {
    const jpeg = await fixture('model-01.jpeg');
    expect(() => validateUploadedImage({ buffer: jpeg, mimetype: 'image/jpeg', originalname: 'garment.webp' }, generationConfig)).toThrowError('extensão .webp');
  });

  it('rejects files above the configured limit', () => {
    expect(() => validateUploadedImage({ buffer: Buffer.alloc(generationConfig.maxFileSizeBytes + 1), mimetype: 'image/png', originalname: 'large.png' }, generationConfig)).toThrowError('no máximo 10 MB');
  });

  it('rejects dimensions below the garment minimum', () => {
    expect(() => validateUploadedImage({ buffer: tinyPng, mimetype: 'image/png', originalname: 'tiny.png' }, generationConfig)).toThrowError('Dimensões insuficientes');
  });

  it('emits a quality warning without blocking a suboptimal garment ratio', async () => {
    const webp = await fixture('00model-01.webp');
    const result = validateUploadedImage({ buffer: webp, mimetype: 'image/webp', originalname: 'garment.webp' }, generationConfig);

    expect(result.validation.valid).toBe(true);
    expect(result.validation.warnings).toContainEqual(expect.objectContaining({ code: 'POSSIBLE_STRONG_COMPRESSION' }));
  });

  it('reports a template ratio outside 4:5 as a warning, not an operational error', async () => {
    const jpeg = await fixture('model-01.jpeg');
    const result = validateImageBuffer(jpeg, { role: 'template', fileName: 'model-01.jpeg', expectedMimeType: 'image/jpeg' });

    expect(result.validation.valid).toBe(true);
    expect(result.validation.fourByFiveReady).toBe(false);
    expect(result.validation.warnings).toContainEqual(expect.objectContaining({ code: 'TEMPLATE_RATIO_NOT_4_5' }));
  });

  it('rejects a JPEG that requires EXIF rotation', async () => {
    const jpeg = await fixture('model-01.jpeg');
    const rotated = addExifOrientation(jpeg, 6);

    expect(() => validateImageBuffer(rotated, { fileName: 'rotated.jpeg', expectedMimeType: 'image/jpeg', role: 'garment' })).toThrowError('Rotacionada 90°');
  });

  it('rejects a truncated file', async () => {
    const jpeg = await fixture('model-01.jpeg');
    expect(() => validateImageBuffer(jpeg.subarray(0, jpeg.length - 2), { fileName: 'truncated.jpeg' })).toThrowError('fluxo de imagem completo');
  });
});

function addExifOrientation(jpeg, orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'ascii');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0112, 10);
  tiff.writeUInt16BE(3, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  const data = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const marker = Buffer.alloc(4);
  marker[0] = 0xff;
  marker[1] = 0xe1;
  marker.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, data, jpeg.subarray(2)]);
}
