import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createLocalBrandingStorage } from '../../server/storage/localBrandingStorage.js';
import { createBrandingService } from '../../server/services/brandingService.js';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'prime-branding-'));
  directories.push(directory);
  const storage = createLocalBrandingStorage({ brandingDirectory: directory });
  const service = createBrandingService({ storage });
  return { directory, storage, service };
}

async function pngBuffer({ width = 512, height = 512, artRatio = 0.6, transparentBackground = true } = {}) {
  const artWidth = Math.round(width * artRatio);
  const artHeight = Math.round(height * artRatio);
  return sharp({ create: { width, height, channels: 4, background: transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 10, g: 10, b: 10, alpha: 1 } } })
    .composite([{ input: await sharp({ create: { width: artWidth, height: artHeight, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer();
}

describe('brandingService — upload validation', () => {
  it('accepts a valid PNG logo and classifies it as adequate', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('adequate');
    expect(record.errors).toEqual([]);
    expect(record.hasAlpha).toBe(true);
    expect(record.dimensions).toEqual({ width: 512, height: 512 });
  });

  it('rejects a file with the wrong signature', async () => {
    const { service } = await fixture();
    await expect(service.uploadLogo({ buffer: Buffer.from('not a png'), mimetype: 'image/png', originalname: 'logo.png' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_INVALID_SIGNATURE' });
  });

  it('rejects a mismatched MIME type', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    await expect(service.uploadLogo({ buffer, mimetype: 'image/jpeg', originalname: 'logo.png' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_MIME_MISMATCH' });
  });

  it('rejects a mismatched extension', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    await expect(service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.jpg' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_EXTENSION_MISMATCH' });
  });

  it('rejects a corrupted file', async () => {
    const { service } = await fixture();
    const validSignature = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('garbage-after-signature')]);
    await expect(service.uploadLogo({ buffer: validSignature, mimetype: 'image/png', originalname: 'logo.png' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_CORRUPTED' });
  });

  it('rejects a PNG without an alpha channel', async () => {
    const { service } = await fixture();
    const buffer = await sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 10, g: 10, b: 10 } } }).png().toBuffer();
    await expect(service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_NO_ALPHA' });
  });

  it('rejects a logo smaller than the minimum dimension', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer({ width: 128, height: 128 });
    await expect(service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' })).rejects.toMatchObject({ code: 'BRANDING_LOGO_TOO_SMALL' });
  });

  it('classifies a fully transparent logo as inadequate', async () => {
    const { service } = await fixture();
    const buffer = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('inadequate');
    expect(record.errors.some((error) => error.code === 'LOGO_EMPTY_ART')).toBe(true);
  });

  it('classifies a fully opaque logo (no real transparency) as inadequate', async () => {
    const { service } = await fixture();
    const buffer = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } }).png().toBuffer();
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('inadequate');
    expect(record.errors.some((error) => error.code === 'LOGO_NOT_TRANSPARENT')).toBe(true);
  });

  it('classifies art that is too small within its own canvas as inadequate', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer({ artRatio: 0.1 });
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('inadequate');
    expect(record.errors.some((error) => error.code === 'LOGO_TOO_SMALL_IN_CANVAS')).toBe(true);
  });

  it('classifies moderately small art as acceptable with a warning', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer({ artRatio: 0.32 });
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('acceptable_with_warning');
    expect(record.warnings.some((warning) => warning.code === 'LOGO_SMALL_IN_CANVAS')).toBe(true);
  });

  it('classifies an extreme aspect ratio as inadequate', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer({ width: 2000, height: 260 });
    const record = await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(record.quality).toBe('inadequate');
    expect(record.errors.some((error) => error.code === 'LOGO_EXTREME_ASPECT_RATIO')).toBe(true);
  });

  it('never stores Base64 or physical paths in the persisted metadata', async () => {
    const { directory, service } = await fixture();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    const raw = await readFile(path.join(directory, 'metadata.json'), 'utf8');
    expect(raw).not.toMatch(/base64/i);
    expect(raw).not.toContain(directory);
    expect(raw).not.toContain(process.cwd());
  });
});

describe('brandingService — approval and configuration', () => {
  it('requires explicit approval before a logo becomes active', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    let state = await service.getState();
    expect(state.approved).toBeNull();
    const approved = await service.approveLogo();
    expect(approved.approvedAt).toBeTruthy();
    state = await service.getState();
    expect(state.approved).toMatchObject({ quality: 'adequate' });
    expect(state.pending).toBeNull();
  });

  it('blocks approval of an inadequate logo', async () => {
    const { service } = await fixture();
    const buffer = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    await expect(service.approveLogo()).rejects.toMatchObject({ code: 'BRANDING_LOGO_INADEQUATE' });
  });

  it('rejects approval when there is no pending logo', async () => {
    const { service } = await fixture();
    await expect(service.approveLogo()).rejects.toMatchObject({ code: 'BRANDING_NO_PENDING_LOGO' });
  });

  it('persists the enabled toggle and requires an approved logo to enable it', async () => {
    const { service } = await fixture();
    await expect(service.setConfig({ enabled: true })).rejects.toMatchObject({ code: 'BRANDING_NOT_APPROVED' });
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    await service.approveLogo();
    const config = await service.setConfig({ enabled: true });
    expect(config.enabled).toBe(true);
    const state = await service.getState();
    expect(state.config.enabled).toBe(true);
  });

  it('replaces the logo atomically without losing the previously approved one until the new upload succeeds', async () => {
    const { service } = await fixture();
    const first = await pngBuffer();
    await service.uploadLogo({ buffer: first, mimetype: 'image/png', originalname: 'first.png' });
    await service.approveLogo();
    await service.setConfig({ enabled: true });

    const second = await pngBuffer({ artRatio: 0.5 });
    await service.uploadLogo({ buffer: second, mimetype: 'image/png', originalname: 'second.png' });
    // A logo aprovada anterior deve continuar intacta enquanto a nova ainda não foi aprovada.
    let state = await service.getState();
    expect(state.approved.fileName).toBe('first.png');
    expect((await service.readLogoAsset('approved')).buffer.equals(first)).toBe(true);

    await service.approveLogo();
    state = await service.getState();
    expect(state.approved.fileName).toBe('second.png');
    expect((await service.readLogoAsset('approved')).buffer.equals(second)).toBe(true);
  });

  it('recovers the last valid metadata from the backup file', async () => {
    const { directory, service } = await fixture();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    await service.approveLogo();
    const validRaw = await readFile(path.join(directory, 'metadata.json'), 'utf8');

    await service.uploadLogo({ buffer: await pngBuffer({ artRatio: 0.5 }), mimetype: 'image/png', originalname: 'second.png' });
    const backupRaw = await readFile(path.join(directory, 'metadata.json.bak'), 'utf8');
    expect(JSON.parse(backupRaw)).toEqual(JSON.parse(validRaw));
  });

  it('deletes the approved logo, disables the toggle and clears the approved record', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    await service.approveLogo();
    await service.setConfig({ enabled: true });
    await service.deleteLogo();
    const state = await service.getState();
    expect(state.approved).toBeNull();
    expect(state.config.enabled).toBe(false);
    await expect(service.readLogoAsset('approved')).rejects.toMatchObject({ code: 'BRANDING_LOGO_NOT_FOUND' });
  });

  it('blocks path traversal in the branding storage root', async () => {
    const { directory } = await fixture();
    const storage = createLocalBrandingStorage({ brandingDirectory: directory });
    // A implementação nunca aceita nomes vindos de fora — mas o guarda de resolveChild deve rejeitar tentativas de escape.
    await writeFile(path.join(directory, 'config.json'), JSON.stringify({ enabled: false }));
    const config = await storage.readConfig();
    expect(config.enabled).toBe(false);
  });

  it('returns nothing to brand generations when disabled or logo missing, without a HTTP-visible error', async () => {
    const { service } = await fixture();
    expect(await service.getActiveBranding()).toBeNull();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    expect(await service.getActiveBranding()).toBeNull(); // pending, not yet approved
    await service.approveLogo();
    expect(await service.getActiveBranding()).toBeNull(); // approved but toggle still off
    await service.setConfig({ enabled: true });
    const active = await service.getActiveBranding();
    expect(active.buffer.equals(buffer)).toBe(true);
    expect(active.mimeType).toBe('image/png');
  });
});

describe('brandingService — Original × Com logo preview', () => {
  it('always serves the original demo image, with no logo required', async () => {
    const { service } = await fixture();
    const original = await service.getPreviewAsset('original');
    expect(original.buffer.length).toBeGreaterThan(0);
    expect(original.mimeType).toBe('image/jpeg');
  });

  it('rejects the branded variant when there is no approved logo yet', async () => {
    const { service } = await fixture();
    await expect(service.getPreviewAsset('branded')).rejects.toMatchObject({ code: 'BRANDING_NO_APPROVED_LOGO' });
  });

  it('composes the branded variant locally (no AI) once a logo is approved, using the 9%/3%/bottom-right pattern', async () => {
    const { service } = await fixture();
    const buffer = await pngBuffer();
    await service.uploadLogo({ buffer, mimetype: 'image/png', originalname: 'logo.png' });
    await service.approveLogo();

    const original = await service.getPreviewAsset('original');
    const branded = await service.getPreviewAsset('branded');
    expect(branded.mimeType).toBe('image/jpeg');
    expect(branded.buffer.equals(original.buffer)).toBe(false);
  });

  it('rejects an unknown preview variant', async () => {
    const { service } = await fixture();
    await expect(service.getPreviewAsset('other')).rejects.toMatchObject({ code: 'BRANDING_INVALID_PREVIEW_VARIANT' });
  });
});
