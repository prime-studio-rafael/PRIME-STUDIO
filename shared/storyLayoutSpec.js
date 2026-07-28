export const STORY_CANVAS = Object.freeze({ width: 1080, height: 1920 });
export const INSTAGRAM_SAFE_AREA = Object.freeze({ left: 60, right: 60, top: 250, bottom: 250 });
export const STORY_HANDLE = '@primestore.udi';
export const DEFAULT_STORY_LAYOUT_ID = 'premium';

export const STORY_LOGO_SIZES = Object.freeze({
  small: Object.freeze({ id: 'small', label: 'Pequena', scale: 0.75 }),
  medium: Object.freeze({ id: 'medium', label: 'Média', scale: 1 }),
  large: Object.freeze({ id: 'large', label: 'Grande', scale: 1.25 }),
});

const light = Object.freeze({ background: '#f4f1eb', primary: '#0f172a', muted: '#64748b', accent: '#0f172a', accentText: '#ffffff', price: '#0f172a', thumbnailImage: '#cbd5e1' });
const white = Object.freeze({ background: '#f8fafc', primary: '#0f172a', muted: '#64748b', accent: '#0f172a', accentText: '#ffffff', price: '#0f172a', thumbnailImage: '#cbd5e1' });
const dark = Object.freeze({ background: '#111827', primary: '#ffffff', muted: '#cbd5e1', accent: '#ffffff', accentText: '#111827', price: '#fbbf24', thumbnailImage: '#475569' });
const luxury = Object.freeze({ background: '#171411', primary: '#f8e7bd', muted: '#d6c5a3', accent: '#f8e7bd', accentText: '#171411', price: '#f8e7bd', thumbnailImage: '#5c4c38' });
const editorial = Object.freeze({ background: '#eef2ff', primary: '#172554', muted: '#475569', accent: '#172554', accentText: '#ffffff', price: '#172554', thumbnailImage: '#a5b4fc' });

function text(x, y, fontSize, options = {}) {
  return Object.freeze({ x, y, fontSize, minFontSize: options.minFontSize || Math.round(fontSize * 0.82), lineHeight: options.lineHeight || Math.round(fontSize * 1.18), maxWidth: options.maxWidth || 900, align: options.align || 'left' });
}

function limits(overrides = {}) {
  return Object.freeze({ productLabel: 2, calloutText: 2, headline: 2, subheadline: 2, priceText: 1, ctaText: 1, ...overrides });
}

function thumbnail({ image, logo, lines, cta }) {
  return Object.freeze({ image: Object.freeze(image), logo: Object.freeze(logo), lines: Object.freeze(lines.map((line) => Object.freeze(line))), cta: cta ? Object.freeze(cta) : null });
}

function layout({ id, name, description, palette, regions, logoAutoVariant, thumbnail: preview, textLimits }) {
  return Object.freeze({
    id,
    name,
    label: name,
    description,
    palette,
    regions: Object.freeze(regions),
    behavior: Object.freeze({ imageFit: 'contain', logoAutoVariant, typography: Object.freeze({ source: 'storyTypographySpec', textAlignment: 'region' }), cta: Object.freeze({ explicitRender: true }) }),
    thumbnail: preview,
    limits: Object.freeze({ text: textLimits }),
  });
}

export const STORY_LAYOUT_CATALOG = Object.freeze({
  premium: layout({
    id: 'premium', name: 'Premium', description: 'Produto sofisticado, preço e chamada de ação equilibrados.', palette: light,
    regions: Object.freeze({ image: Object.freeze({ left: 90, top: 270, width: 900, height: 820 }), logo: Object.freeze({ left: 830, top: 1530, width: 160, height: 82 }), text: Object.freeze({ productLabel: text(90, 1170, 52), calloutText: text(90, 1260, 30), headline: text(90, 1350, 46), subheadline: text(90, 1460, 30), priceText: text(90, 1510, 68), ctaText: text(370, 1590, 30, { align: 'center', maxWidth: 500 }) }), cta: Object.freeze({ left: 90, top: 1530, width: 560, height: 82, radius: 24 }), handle: text(90, 1650, 24) }),
    logoAutoVariant: 'primary', textLimits: limits(), thumbnail: thumbnail({ image: { left: 14, top: 14, width: 72, height: 43 }, logo: { left: 72, top: 79, width: 13, height: 5 }, lines: [{ left: 14, top: 62, width: 55, height: 5 }, { left: 14, top: 69, width: 38, height: 3 }, { left: 14, top: 74, width: 48, height: 4 }], cta: { left: 14, top: 83, width: 45, height: 6 } }),
  }),
  luxury: layout({
    id: 'luxury', name: 'Luxury', description: 'Composição escura com marca e preço em destaque.', palette: luxury,
    regions: Object.freeze({ image: Object.freeze({ left: 100, top: 355, width: 880, height: 700 }), logo: Object.freeze({ left: 450, top: 270, width: 180, height: 80 }), text: Object.freeze({ productLabel: text(100, 1160, 48), calloutText: text(100, 1240, 27), headline: text(100, 1335, 44), subheadline: text(100, 1435, 28), priceText: text(100, 1500, 76), ctaText: text(540, 1590, 29, { align: 'center', maxWidth: 840 }) }), cta: Object.freeze({ left: 100, top: 1535, width: 880, height: 80, radius: 24 }), handle: text(100, 1655, 23) }),
    logoAutoVariant: 'white', textLimits: limits(), thumbnail: thumbnail({ image: { left: 15, top: 22, width: 70, height: 40 }, logo: { left: 43, top: 12, width: 16, height: 5 }, lines: [{ left: 15, top: 67, width: 56, height: 4 }, { left: 15, top: 73, width: 47, height: 4 }, { left: 15, top: 79, width: 33, height: 5 }], cta: { left: 15, top: 87, width: 70, height: 5 } }),
  }),
  minimal: layout({
    id: 'minimal', name: 'Minimal', description: 'Imagem predominante, texto leve e marca discreta.', palette: white,
    regions: Object.freeze({ image: Object.freeze({ left: 70, top: 250, width: 940, height: 780 }), logo: Object.freeze({ left: 830, top: 1515, width: 160, height: 82 }), text: Object.freeze({ productLabel: text(70, 1120, 58), calloutText: text(70, 1205, 30), headline: text(70, 1290, 44), subheadline: text(70, 1395, 29), priceText: text(70, 1490, 52), ctaText: text(350, 1570, 29, { align: 'center', maxWidth: 500 }) }), cta: Object.freeze({ left: 70, top: 1505, width: 560, height: 86, radius: 22 }), handle: text(70, 1645, 24) }),
    logoAutoVariant: 'primary', textLimits: limits(), thumbnail: thumbnail({ image: { left: 10, top: 12, width: 80, height: 50 }, logo: { left: 74, top: 80, width: 13, height: 5 }, lines: [{ left: 10, top: 67, width: 58, height: 5 }, { left: 10, top: 74, width: 43, height: 3 }, { left: 10, top: 79, width: 35, height: 3 }], cta: { left: 10, top: 86, width: 47, height: 6 } }),
  }),
  offer: layout({
    id: 'offer', name: 'Offer', description: 'Oferta direta com preço e CTA de alto contraste.', palette: dark,
    regions: Object.freeze({ image: Object.freeze({ left: 100, top: 370, width: 880, height: 710 }), logo: Object.freeze({ left: 445, top: 260, width: 190, height: 84 }), text: Object.freeze({ productLabel: text(100, 1185, 48), calloutText: text(100, 1270, 28), headline: text(100, 1360, 40), subheadline: text(100, 1460, 28), priceText: text(100, 1490, 86), ctaText: text(540, 1590, 30, { align: 'center', maxWidth: 840 }) }), cta: Object.freeze({ left: 100, top: 1530, width: 880, height: 82, radius: 24 }), handle: text(100, 1650, 23) }),
    logoAutoVariant: 'white', textLimits: limits(), thumbnail: thumbnail({ image: { left: 14, top: 25, width: 72, height: 39 }, logo: { left: 43, top: 12, width: 16, height: 5 }, lines: [{ left: 14, top: 69, width: 58, height: 4 }, { left: 14, top: 75, width: 46, height: 4 }, { left: 14, top: 81, width: 36, height: 6 }], cta: { left: 14, top: 89, width: 72, height: 5 } }),
  }),
  editorial: layout({
    id: 'editorial', name: 'Editorial', description: 'Imagem vertical com narrativa e composição editorial.', palette: editorial,
    regions: Object.freeze({ image: Object.freeze({ left: 120, top: 270, width: 840, height: 760 }), logo: Object.freeze({ left: 120, top: 1080, width: 170, height: 76 }), text: Object.freeze({ productLabel: text(120, 1225, 50), calloutText: text(120, 1305, 28), headline: text(120, 1400, 48), subheadline: text(120, 1510, 29), priceText: text(120, 1570, 60), ctaText: text(750, 1630, 28, { align: 'center', maxWidth: 360 }) }), cta: Object.freeze({ left: 600, top: 1585, width: 360, height: 78, radius: 22 }), handle: text(120, 1660, 23) }),
    logoAutoVariant: 'primary', textLimits: limits({ headline: 2, subheadline: 2 }), thumbnail: thumbnail({ image: { left: 19, top: 14, width: 62, height: 47 }, logo: { left: 19, top: 65, width: 15, height: 5 }, lines: [{ left: 19, top: 74, width: 56, height: 5 }, { left: 19, top: 81, width: 43, height: 3 }, { left: 19, top: 86, width: 28, height: 4 }], cta: { left: 57, top: 91, width: 24, height: 5 } }),
  }),
});

export const STORY_LAYOUT_ALIASES = Object.freeze({ 'product-highlight': DEFAULT_STORY_LAYOUT_ID });
export const STORY_LAYOUT_SPEC = STORY_LAYOUT_CATALOG;
export const STORY_LAYOUTS = Object.freeze(Object.values(STORY_LAYOUT_CATALOG));

export function normalizeStoryLayoutId(id) {
  const candidate = String(id || DEFAULT_STORY_LAYOUT_ID);
  const normalized = STORY_LAYOUT_ALIASES[candidate] || candidate;
  return STORY_LAYOUT_CATALOG[normalized] ? normalized : null;
}

export function getStoryLayout(id) {
  const normalized = normalizeStoryLayoutId(id);
  return normalized ? STORY_LAYOUT_CATALOG[normalized] : null;
}

export function getStoryLogoBox(layout, size = 'medium') {
  const logo = layout.regions.logo;
  const scale = STORY_LOGO_SIZES[size]?.scale || STORY_LOGO_SIZES.medium.scale;
  const width = Math.round(logo.width * scale);
  const height = Math.round(logo.height * scale);
  return Object.freeze({ left: Math.round(logo.left + (logo.width - width) / 2), top: Math.round(logo.top + (logo.height - height) / 2), width, height });
}

export function resolveStoryLogoVariant(layout, logoMode = 'auto', hasWhite = false) {
  if (logoMode === 'primary') return Object.freeze({ variant: 'primary', fallback: false });
  if (logoMode === 'white') return hasWhite ? Object.freeze({ variant: 'white', fallback: false }) : Object.freeze({ variant: null, fallback: false });
  const wantsWhite = layout.behavior.logoAutoVariant === 'white';
  return wantsWhite && hasWhite ? Object.freeze({ variant: 'white', fallback: false }) : Object.freeze({ variant: 'primary', fallback: wantsWhite });
}

export function getStoryLayoutTextLimit(layoutId, field) {
  return getStoryLayout(layoutId)?.limits.text[field] || null;
}
