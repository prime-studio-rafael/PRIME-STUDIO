export const STORY_CANVAS = Object.freeze({ width: 1080, height: 1920 });
export const INSTAGRAM_SAFE_AREA = Object.freeze({ left: 60, right: 60, top: 250, bottom: 250 });
export const STORY_HANDLE = '@primestore.udi';

export const STORY_LOGO_SIZES = Object.freeze({
  small: Object.freeze({ id: 'small', label: 'Pequena', scale: 0.75 }),
  medium: Object.freeze({ id: 'medium', label: 'Média', scale: 1 }),
  large: Object.freeze({ id: 'large', label: 'Grande', scale: 1.25 }),
});

const light = Object.freeze({ primary: '#0f172a', muted: '#64748b', accent: '#0f172a', accentText: '#ffffff', price: '#0f172a' });
const dark = Object.freeze({ primary: '#ffffff', muted: '#cbd5e1', accent: '#ffffff', accentText: '#111827', price: '#fbbf24' });

function text(x, y, fontSize, options = {}) {
  return Object.freeze({ x, y, fontSize, minFontSize: options.minFontSize || Math.round(fontSize * 0.82), lineHeight: options.lineHeight || Math.round(fontSize * 1.18), maxWidth: options.maxWidth || 900, align: options.align || 'left' });
}

export const STORY_LAYOUT_SPEC = Object.freeze({
  'product-highlight': Object.freeze({
    id: 'product-highlight', label: 'Produto em destaque', description: 'Produto, nome, preço e chamada para ação.', background: '#f4f1eb', colors: light,
    image: Object.freeze({ left: 90, top: 270, width: 900, height: 820 }), logo: Object.freeze({ left: 830, top: 1530, width: 160, height: 82 }),
    text: Object.freeze({ productLabel: text(90, 1170, 52), calloutText: text(90, 1260, 30), headline: text(90, 1350, 46), subheadline: text(90, 1460, 30), priceText: text(90, 1510, 68), ctaText: text(370, 1590, 30, { align: 'center', maxWidth: 500 }) }),
    cta: Object.freeze({ left: 90, top: 1530, width: 560, height: 82, radius: 24 }), handle: text(90, 1650, 24),
  }),
  minimal: Object.freeze({
    id: 'minimal', label: 'Minimalista', description: 'Imagem predominante, chamada curta e marca discreta.', background: '#f8fafc', colors: light,
    image: Object.freeze({ left: 70, top: 250, width: 940, height: 780 }), logo: Object.freeze({ left: 830, top: 1515, width: 160, height: 82 }),
    text: Object.freeze({ productLabel: text(70, 1120, 58), calloutText: text(70, 1205, 30), headline: text(70, 1290, 44), subheadline: text(70, 1395, 29), priceText: text(70, 1490, 52), ctaText: text(350, 1570, 29, { align: 'center', maxWidth: 500 }) }),
    cta: Object.freeze({ left: 70, top: 1505, width: 560, height: 86, radius: 22 }), handle: text(70, 1645, 24),
  }),
  offer: Object.freeze({
    id: 'offer', label: 'Oferta', description: 'Preço em destaque e espaço para condição de pagamento.', background: '#111827', colors: dark,
    image: Object.freeze({ left: 100, top: 370, width: 880, height: 710 }), logo: Object.freeze({ left: 445, top: 260, width: 190, height: 84 }),
    text: Object.freeze({ productLabel: text(100, 1185, 48), calloutText: text(100, 1270, 28), headline: text(100, 1360, 40), subheadline: text(100, 1460, 28), priceText: text(100, 1490, 86), ctaText: text(540, 1590, 30, { align: 'center', maxWidth: 840 }) }),
    cta: Object.freeze({ left: 100, top: 1530, width: 880, height: 82, radius: 24 }), handle: text(100, 1650, 23),
  }),
});

export const STORY_LAYOUTS = Object.freeze(Object.values(STORY_LAYOUT_SPEC));
export function getStoryLayout(id) { return STORY_LAYOUT_SPEC[id] || null; }
export function getStoryLogoBox(layout, size = 'medium') {
  const scale = STORY_LOGO_SIZES[size]?.scale || STORY_LOGO_SIZES.medium.scale;
  const width = Math.round(layout.logo.width * scale);
  const height = Math.round(layout.logo.height * scale);
  return Object.freeze({
    left: Math.round(layout.logo.left + (layout.logo.width - width) / 2),
    top: Math.round(layout.logo.top + (layout.logo.height - height) / 2),
    width,
    height,
  });
}
export function resolveStoryLogoVariant(layout, logoMode = 'auto', hasWhite = false) {
  if (logoMode === 'primary') return Object.freeze({ variant: 'primary', fallback: false });
  if (logoMode === 'white') return hasWhite ? Object.freeze({ variant: 'white', fallback: false }) : Object.freeze({ variant: null, fallback: false });
  const wantsWhite = layout.id === 'offer';
  return wantsWhite && hasWhite
    ? Object.freeze({ variant: 'white', fallback: false })
    : Object.freeze({ variant: 'primary', fallback: wantsWhite });
}
