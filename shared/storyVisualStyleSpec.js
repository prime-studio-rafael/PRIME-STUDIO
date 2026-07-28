import { STORY_LAYOUT_CATALOG, STORY_LOGO_SIZES } from './storyLayoutSpec.js';
import { STORY_TYPOGRAPHY_PRESETS } from './storyTypographySpec.js';

export const STORY_LOGO_MODES = Object.freeze(['auto', 'primary', 'white']);

const logoLabels = Object.freeze({ primary: 'Logo principal', white: 'Logo branca', auto: 'Logo automática' });

export const STORY_VISUAL_STYLE_CATALOG = Object.freeze({
  'prime-store': style({
    id: 'prime-store',
    label: 'PRIME Store',
    description: 'Equilíbrio premium para a identidade da loja.',
    recommendedFor: ['moda premium', 'uso geral', 'coleções'],
    apply: { storyTemplateId: 'premium', typographyPreset: 'premium', logoMode: 'primary', logoSize: 'medium' },
  }),
  luxury: style({
    id: 'luxury',
    label: 'Luxury',
    description: 'Contraste elegante para produtos de maior valor percebido.',
    recommendedFor: ['luxo', 'lançamentos', 'coleções especiais'],
    apply: { storyTemplateId: 'luxury', typographyPreset: 'elegante', logoMode: 'white', logoSize: 'small' },
  }),
  minimal: style({
    id: 'minimal',
    label: 'Minimal',
    description: 'Composição limpa com foco no produto.',
    recommendedFor: ['uso geral', 'catálogo', 'produtos essenciais'],
    apply: { storyTemplateId: 'minimal', typographyPreset: 'moderno', logoMode: 'primary', logoSize: 'small' },
  }),
  offer: style({
    id: 'offer',
    label: 'Offer',
    description: 'Leitura direta para preço, condição e chamada.',
    recommendedFor: ['ofertas', 'condições', 'conversão'],
    apply: { storyTemplateId: 'offer', typographyPreset: 'impacto', logoMode: 'white', logoSize: 'medium' },
  }),
  editorial: style({
    id: 'editorial',
    label: 'Editorial',
    description: 'Narrativa visual para coleções e destaques.',
    recommendedFor: ['coleções', 'novidades', 'conteúdo editorial'],
    apply: { storyTemplateId: 'editorial', typographyPreset: 'elegante', logoMode: 'primary', logoSize: 'small' },
  }),
});

validateStoryVisualStyleCatalog();

export function listStoryVisualStyles() {
  return Object.freeze(Object.values(STORY_VISUAL_STYLE_CATALOG));
}

export function getStoryVisualStyle(id) {
  return STORY_VISUAL_STYLE_CATALOG[id] || null;
}

export function applyStoryVisualStyle(id) {
  const visualStyle = getStoryVisualStyle(id);
  if (!visualStyle) throw new Error(`Estilo visual inválido: ${id}`);
  return visualStyle.apply;
}

export function resolveStoryVisualStyle(formValues = {}) {
  return listStoryVisualStyles().find((visualStyle) => Object.entries(visualStyle.apply).every(([field, value]) => formValues[field] === value)) || null;
}

export function getStoryVisualStyleSummary(visualStyle) {
  if (!visualStyle) return 'Personalizado';
  const layout = STORY_LAYOUT_CATALOG[visualStyle.apply.storyTemplateId];
  const typography = STORY_TYPOGRAPHY_PRESETS[visualStyle.apply.typographyPreset];
  const logoSize = STORY_LOGO_SIZES[visualStyle.apply.logoSize];
  return `${layout.label} · ${typography.display} · ${logoLabels[visualStyle.apply.logoMode]} ${logoSize.label.toLowerCase()}`;
}

export function validateStoryVisualStyleCatalog(catalog = STORY_VISUAL_STYLE_CATALOG) {
  const ids = new Set();
  for (const visualStyle of Object.values(catalog)) {
    if (!visualStyle?.id || ids.has(visualStyle.id)) throw new Error('O catálogo de Estilos Visuais possui um ID ausente ou duplicado.');
    ids.add(visualStyle.id);
    const { storyTemplateId, typographyPreset, logoMode, logoSize } = visualStyle.apply || {};
    if (!STORY_LAYOUT_CATALOG[storyTemplateId]) throw new Error(`Layout inválido no estilo visual ${visualStyle.id}: ${storyTemplateId}`);
    if (!STORY_TYPOGRAPHY_PRESETS[typographyPreset]) throw new Error(`Tipografia inválida no estilo visual ${visualStyle.id}: ${typographyPreset}`);
    if (!STORY_LOGO_MODES.includes(logoMode)) throw new Error(`Modo de logo inválido no estilo visual ${visualStyle.id}: ${logoMode}`);
    if (!STORY_LOGO_SIZES[logoSize]) throw new Error(`Tamanho de logo inválido no estilo visual ${visualStyle.id}: ${logoSize}`);
  }
  return true;
}

function style(value) {
  return Object.freeze({
    ...value,
    recommendedFor: Object.freeze([...value.recommendedFor]),
    apply: Object.freeze({ ...value.apply }),
  });
}
