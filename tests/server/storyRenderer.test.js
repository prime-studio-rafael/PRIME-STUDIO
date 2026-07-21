import sharp from 'sharp';
import { renderStory } from '../../server/services/storyRenderer.js';

async function image(width = 900, height = 1200) { return sharp({ create: { width, height, channels: 3, background: '#94a3b8' } }).jpeg().toBuffer(); }
async function logo() { return sharp({ create: { width: 300, height: 120, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 0.9 } } }).png().toBuffer(); }

describe('storyRenderer', () => {
  it.each(['product-highlight', 'minimal', 'offer'])('renders %s deterministically at 1080x1920 WebP', async (storyTemplateId) => {
    const sourceBuffer = await image();
    const original = Buffer.from(sourceBuffer);
    const output = await renderStory({ sourceBuffer, logoBuffer: await logo(), story: { storyTemplateId, productLabel: 'Camiseta Premium', priceText: 'R$ 99,90', headline: '10% no PIX', ctaText: 'Compre agora' } });
    const metadata = await sharp(output.buffer).metadata();
    expect(output.mimeType).toBe('image/webp');
    expect(metadata).toMatchObject({ format: 'webp', width: 1080, height: 1920 });
    expect(sourceBuffer.equals(original)).toBe(true);
  });

  it('escapes text content and refuses to render without an approved logo', async () => {
    await expect(renderStory({ sourceBuffer: await image(), logoBuffer: await logo(), story: { storyTemplateId: 'minimal', productLabel: '<script>& produto', headline: 'A&B' } })).resolves.toMatchObject({ mimeType: 'image/webp' });
    await expect(renderStory({ sourceBuffer: await image(), logoBuffer: null, story: { storyTemplateId: 'minimal', productLabel: 'Produto' } })).rejects.toMatchObject({ code: 'MARKETING_LOGO_REQUIRED' });
  });
});
