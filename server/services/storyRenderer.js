import sharp from 'sharp';
import { AppError } from '../utils/errors.js';
import { getStoryLayout } from '../catalogs/storyTemplates.js';
import { INSTAGRAM_SAFE_AREA, STORY_CANVAS, STORY_HANDLE, getStoryLogoBox } from '../../shared/storyLayoutSpec.js';
import { layoutStoryText } from '../../shared/storyTextLayout.js';
import { getStoryTypographyField, getStoryTypographyPreset } from '../../shared/storyTypographySpec.js';
import { storyTypographyFontFaces } from './storyTypographyFonts.js';

export async function renderStory({ sourceBuffer, logoBuffer, story }) {
  const layout = getStoryLayout(story.storyTemplateId);
  if (!layout) throw new AppError('INVALID_STORY_TEMPLATE', 'Selecione um layout de Story válido.', { status: 400 });
  if (!sourceBuffer?.length) throw new AppError('MARKETING_SOURCE_MISSING', 'A imagem fonte deste Story não está disponível.', { status: 404 });
  if (!logoBuffer?.length) throw new AppError('MARKETING_LOGO_REQUIRED', 'Aprove uma logo na tela Branding antes de renderizar Stories.', { status: 422 });

  try {
    const source = await sharp(sourceBuffer).rotate().resize({ width: layout.regions.image.width, height: layout.regions.image.height, fit: layout.behavior.imageFit, withoutEnlargement: false }).toBuffer();
    const sourceMeta = await sharp(source).metadata();
    const logoBox = getStoryLogoBox(layout, story.logoSize || 'medium');
    const logo = await sharp(logoBuffer).resize({ width: logoBox.width, height: logoBox.height, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const logoMeta = await sharp(logo).metadata();
    const composed = await sharp({ create: { width: STORY_CANVAS.width, height: STORY_CANVAS.height, channels: 4, background: layout.palette.background } })
      .composite([
        { input: source, left: layout.regions.image.left + Math.floor((layout.regions.image.width - sourceMeta.width) / 2), top: layout.regions.image.top + Math.floor((layout.regions.image.height - sourceMeta.height) / 2) },
        { input: Buffer.from(textSvg(story, layout)), left: 0, top: 0 },
        { input: logo, left: logoBox.left + Math.floor((logoBox.width - logoMeta.width) / 2), top: logoBox.top + Math.floor((logoBox.height - logoMeta.height) / 2) },
      ])
      .png()
      .toBuffer();
    const [buffer, jpegBuffer] = await Promise.all([
      sharp(composed).webp({ quality: 92, effort: 5 }).toBuffer(),
      sharp(composed).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer(),
    ]);
    const metadata = await sharp(buffer).metadata();
    return { buffer, jpegBuffer, mimeType: 'image/webp', jpegMimeType: 'image/jpeg', dimensions: { width: metadata.width, height: metadata.height } };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('STORY_RENDER_FAILED', 'Não foi possível renderizar o Story local.', { status: 500, cause: error });
  }
}

function textSvg(story, layout) {
  const colors = layout.palette;
  const typography = getStoryTypographyPreset(story.typographyPreset);
  const product = layoutStoryText(story.productLabel, 'productLabel', typography.id, layout.id);
  const callout = layoutStoryText(story.calloutText, 'calloutText', typography.id, layout.id);
  const headline = layoutStoryText(story.headline, 'headline', typography.id, layout.id);
  const subheadline = layoutStoryText(story.subheadline, 'subheadline', typography.id, layout.id);
  const price = layoutStoryText(story.priceText, 'priceText', typography.id, layout.id);
  const cta = layoutStoryText(story.ctaText, 'ctaText', typography.id, layout.id);
  const parts = [
    textElement(product, layout.regions.text.productLabel, colors.primary, getStoryTypographyField(typography.id, 'productLabel')),
    textElement(callout, layout.regions.text.calloutText, colors.muted, getStoryTypographyField(typography.id, 'calloutText')),
    textElement(headline, layout.regions.text.headline, colors.primary, getStoryTypographyField(typography.id, 'headline')),
    textElement(subheadline, layout.regions.text.subheadline, colors.muted, getStoryTypographyField(typography.id, 'subheadline')),
    textElement(price, layout.regions.text.priceText, colors.price, getStoryTypographyField(typography.id, 'priceText')),
  ];
  if (layout.regions.cta && cta.lines.length) {
    parts.push(`<rect x="${layout.regions.cta.left}" y="${layout.regions.cta.top}" width="${layout.regions.cta.width}" height="${layout.regions.cta.height}" rx="${layout.regions.cta.radius}" fill="${colors.accent}"/>`);
    parts.push(textElement(cta, layout.regions.text.ctaText, colors.accentText, getStoryTypographyField(typography.id, 'ctaText')));
  }
  const handle = layout.regions.handle;
  const handleType = getStoryTypographyField(typography.id, 'handle');
  parts.push(`<text x="${handle.x}" y="${handle.y}" font-family="${handleType.family}" font-size="${scaledFontSize(handle, handleType)}" font-weight="${handleType.weight}" letter-spacing="${handleType.letterSpacing}" fill="${colors.muted}">${escapeXml(STORY_HANDLE)}</text>`);
  return `<svg width="${STORY_CANVAS.width}" height="${STORY_CANVAS.height}" viewBox="0 0 ${STORY_CANVAS.width} ${STORY_CANVAS.height}" xmlns="http://www.w3.org/2000/svg"><style>${storyTypographyFontFaces(typography.id)}</style><rect x="${INSTAGRAM_SAFE_AREA.left}" y="${INSTAGRAM_SAFE_AREA.top}" width="${STORY_CANVAS.width - INSTAGRAM_SAFE_AREA.left - INSTAGRAM_SAFE_AREA.right}" height="${STORY_CANVAS.height - INSTAGRAM_SAFE_AREA.top - INSTAGRAM_SAFE_AREA.bottom}" fill="none"/>${parts.join('')}</svg>`;
}

function textElement(layoutResult, position, color, type) {
  if (!layoutResult.lines.length) return '';
  const x = position.x;
  const anchor = position.align === 'center' ? 'middle' : 'start';
  return `<text x="${x}" y="${position.y}" text-anchor="${anchor}" font-family="${type.family}" font-size="${scaledFontSize(position, type)}" font-weight="${type.weight}" letter-spacing="${type.letterSpacing}" fill="${color}">${layoutResult.lines.map((line, index) => `<tspan x="${x}" dy="${index ? Math.round(position.lineHeight * type.lineHeightMultiplier) : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}

function scaledFontSize(position, type) { return Math.round(position.fontSize * type.scale); }

function escapeXml(value) { return String(value || '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char])); }
