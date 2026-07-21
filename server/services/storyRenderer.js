import sharp from 'sharp';
import { AppError } from '../utils/errors.js';
import { getStoryTemplate } from '../catalogs/storyTemplates.js';

const WIDTH = 1080;
const HEIGHT = 1920;

export async function renderStory({ sourceBuffer, logoBuffer, story }) {
  const template = getStoryTemplate(story.storyTemplateId);
  if (!template) throw new AppError('INVALID_STORY_TEMPLATE', 'Selecione um layout de Story válido.', { status: 400 });
  if (!sourceBuffer?.length) throw new AppError('MARKETING_SOURCE_MISSING', 'A imagem fonte deste Story não está disponível.', { status: 404 });
  if (!logoBuffer?.length) throw new AppError('MARKETING_LOGO_REQUIRED', 'Aprove uma logo na tela Branding antes de renderizar Stories.', { status: 422 });

  try {
    const layout = layoutFor(template.id);
    const source = await sharp(sourceBuffer).rotate().resize({ width: layout.image.width, height: layout.image.height, fit: 'contain', withoutEnlargement: false }).toBuffer();
    const sourceMeta = await sharp(source).metadata();
    const logo = await sharp(logoBuffer).resize({ width: layout.logoWidth, height: layout.logoHeight, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const logoMeta = await sharp(logo).metadata();
    const overlays = [
      { input: source, left: layout.image.left + Math.floor((layout.image.width - sourceMeta.width) / 2), top: layout.image.top + Math.floor((layout.image.height - sourceMeta.height) / 2) },
      { input: Buffer.from(textSvg(story, template.id)), left: 0, top: 0 },
      { input: logo, left: layout.logoLeft(logoMeta.width), top: layout.logoTop },
    ];
    const buffer = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: template.background } })
      .composite(overlays)
      .webp({ quality: 92, effort: 5 })
      .toBuffer();
    const metadata = await sharp(buffer).metadata();
    return { buffer, mimeType: 'image/webp', dimensions: { width: metadata.width, height: metadata.height } };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('STORY_RENDER_FAILED', 'Não foi possível renderizar o Story local.', { status: 500, cause: error });
  }
}

function layoutFor(id) {
  if (id === 'minimal') return { image: { left: 70, top: 90, width: 940, height: 1370 }, logoWidth: 150, logoHeight: 90, logoLeft: (width) => 930 - width, logoTop: 1760 };
  if (id === 'offer') return { image: { left: 100, top: 160, width: 880, height: 1050 }, logoWidth: 190, logoHeight: 100, logoLeft: (width) => 540 - Math.floor(width / 2), logoTop: 90 };
  return { image: { left: 90, top: 120, width: 900, height: 1120 }, logoWidth: 180, logoHeight: 96, logoLeft: (width) => 900 - width, logoTop: 1740 };
}

function textSvg(story, templateId) {
  const name = escapeXml(fitText(story.productLabel, 32));
  const price = escapeXml(fitText(story.priceText, 20));
  const headline = escapeXml(fitText(story.headline, 48));
  const cta = escapeXml(fitText(story.ctaText, 28));
  const dark = templateId === 'offer';
  const color = dark ? '#ffffff' : '#0f172a';
  const muted = dark ? '#cbd5e1' : '#64748b';
  if (templateId === 'minimal') return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><style>.t{font-family:Inter,Arial,sans-serif}</style><text class="t" x="70" y="1560" font-size="64" font-weight="700" fill="${color}">${name}</text>${headline ? `<text class="t" x="70" y="1640" font-size="34" fill="${muted}">${headline}</text>` : ''}</svg>`;
  if (templateId === 'offer') return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><style>.t{font-family:Inter,Arial,sans-serif}</style><text class="t" x="100" y="1325" font-size="54" font-weight="700" fill="${color}">${name}</text>${price ? `<text class="t" x="100" y="1450" font-size="100" font-weight="800" fill="#fbbf24">${price}</text>` : ''}${headline ? `<text class="t" x="100" y="1535" font-size="34" fill="${muted}">${headline}</text>` : ''}${cta ? `<rect x="100" y="1625" width="880" height="112" rx="28" fill="#ffffff"/><text class="t" x="540" y="1697" text-anchor="middle" font-size="34" font-weight="700" fill="#111827">${cta}</text>` : ''}</svg>`;
  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><style>.t{font-family:Inter,Arial,sans-serif}</style><text class="t" x="90" y="1370" font-size="58" font-weight="700" fill="${color}">${name}</text>${headline ? `<text class="t" x="90" y="1448" font-size="32" fill="${muted}">${headline}</text>` : ''}${price ? `<text class="t" x="90" y="1565" font-size="78" font-weight="800" fill="${color}">${price}</text>` : ''}${cta ? `<rect x="90" y="1635" width="560" height="104" rx="26" fill="#0f172a"/><text class="t" x="370" y="1702" text-anchor="middle" font-size="31" font-weight="700" fill="#ffffff">${cta}</text>` : ''}</svg>`;
}

function escapeXml(value) { return String(value || '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char])); }
function fitText(value, limit) { const text = String(value || '').trim(); return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text; }
