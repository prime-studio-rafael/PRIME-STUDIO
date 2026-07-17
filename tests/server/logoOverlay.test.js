import sharp from 'sharp';
import { applyLogoOverlay, LOGO_MARGIN_RATIO, LOGO_POSITION, LOGO_SCALE_RATIO } from '../../server/services/logoOverlay.js';

async function solidJpeg(width, height, color = { r: 10, g: 20, b: 30 }) {
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
}
async function solidPng(width, height, color = { r: 10, g: 20, b: 30, alpha: 1 }) {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}
async function transparentLogo(width, height) {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: Math.round(width * 0.6), height: Math.round(height * 0.6), channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer();
}

describe('logoOverlay', () => {
  it('positions the logo in the bottom-right corner with the documented margin and scale', async () => {
    const resultBuffer = await solidJpeg(1000, 1000);
    const logoBuffer = await transparentLogo(400, 400);
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });

    expect(overlay.position).toBe(LOGO_POSITION);
    expect(overlay.margin).toBe(Math.round(1000 * LOGO_MARGIN_RATIO));
    expect(overlay.logoDimensions.width).toBe(Math.round(1000 * LOGO_SCALE_RATIO));
    expect(overlay.scale).toBeCloseTo(LOGO_SCALE_RATIO, 2);

    const composedMeta = await sharp(overlay.buffer).metadata();
    expect(composedMeta.width).toBe(1000);
    expect(composedMeta.height).toBe(1000);
  });

  it('preserves the logo aspect ratio without distortion', async () => {
    const resultBuffer = await solidJpeg(1200, 800);
    const logoBuffer = await transparentLogo(600, 300); // 2:1
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });
    expect(overlay.logoDimensions.width / overlay.logoDimensions.height).toBeCloseTo(2, 1);
  });

  it('never crops the composed image and keeps the logo fully inside the margins', async () => {
    const resultBuffer = await solidJpeg(500, 500);
    const logoBuffer = await transparentLogo(500, 500); // logo canvas as large as the result
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });
    const meta = await sharp(overlay.buffer).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(500);
    expect(overlay.logoDimensions.width).toBeLessThanOrEqual(500);
  });

  it('never enlarges the logo beyond its original resolution', async () => {
    const resultBuffer = await solidJpeg(4000, 4000); // 12% of 4000 = 480px target
    const logoBuffer = await transparentLogo(100, 100); // much smaller than the target width
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });
    expect(overlay.logoDimensions.width).toBeLessThanOrEqual(100);
  });

  it('does not alter the original result buffer', async () => {
    const resultBuffer = await solidJpeg(600, 600);
    const original = Buffer.from(resultBuffer);
    const logoBuffer = await transparentLogo(300, 300);
    await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });
    expect(resultBuffer.equals(original)).toBe(true);
  });

  it('produces a JPEG output for a JPEG result', async () => {
    const resultBuffer = await solidJpeg(600, 600);
    const logoBuffer = await transparentLogo(300, 300);
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/jpeg', logoBuffer });
    expect(overlay.mimeType).toBe('image/jpeg');
    expect((await sharp(overlay.buffer).metadata()).format).toBe('jpeg');
  });

  it('produces a PNG output for a PNG result', async () => {
    const resultBuffer = await solidPng(600, 600);
    const logoBuffer = await transparentLogo(300, 300);
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/png', logoBuffer });
    expect(overlay.mimeType).toBe('image/png');
    expect((await sharp(overlay.buffer).metadata()).format).toBe('png');
  });

  it('produces a WebP output for a WebP result', async () => {
    const resultBuffer = await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 5, g: 5, b: 5 } } }).webp().toBuffer();
    const logoBuffer = await transparentLogo(300, 300);
    const overlay = await applyLogoOverlay({ resultBuffer, resultMimeType: 'image/webp', logoBuffer });
    expect(overlay.mimeType).toBe('image/webp');
    expect((await sharp(overlay.buffer).metadata()).format).toBe('webp');
  });

  it('rejects an unsupported output MIME type', async () => {
    const resultBuffer = await solidJpeg(400, 400);
    const logoBuffer = await transparentLogo(200, 200);
    await expect(applyLogoOverlay({ resultBuffer, resultMimeType: 'image/gif', logoBuffer })).rejects.toMatchObject({ code: 'BRANDING_OVERLAY_UNSUPPORTED_MIME' });
  });

  it('rejects a corrupted result buffer', async () => {
    const logoBuffer = await transparentLogo(200, 200);
    await expect(applyLogoOverlay({ resultBuffer: Buffer.from('not-an-image'), resultMimeType: 'image/jpeg', logoBuffer })).rejects.toMatchObject({ code: 'BRANDING_OVERLAY_INVALID_RESULT' });
  });
});
