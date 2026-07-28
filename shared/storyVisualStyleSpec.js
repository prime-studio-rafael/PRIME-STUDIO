import { STORY_LAYOUT_CATALOG, STORY_LOGO_SIZES } from './storyLayoutSpec.js';
import { STORY_TYPOGRAPHY_PRESETS } from './storyTypographySpec.js';

export const STORY_LOGO_MODES = Object.freeze(['auto', 'primary', 'white']);

const logoLabels = Object.freeze({ primary: 'Logo principal', white: 'Logo branca', auto: 'Logo automática' });

export const STORY_RECOMMENDATION_GOALS = Object.freeze(['novidade', 'oferta', 'desejo', 'qualidade', 'look', 'presente', 'ultimas-unidades', 'whatsapp']);
export const STORY_RECOMMENDATION_TONES = Object.freeze(['premium', 'direto', 'elegante', 'urgente', 'descontraído']);
export const STORY_RECOMMENDATION_PRIORITY_PREFERENCES = Object.freeze(['neutral', 'prefer']);
export const STORY_RECOMMENDATION_PRICE_EMPHASES = Object.freeze(['neutral', 'prefer-present']);

export const STORY_VISUAL_STYLE_CATALOG = Object.freeze({
  'prime-store': style({
    id: 'prime-store',
    label: 'PRIME Store',
    description: 'Equilíbrio premium para a identidade da loja.',
    recommendedFor: ['moda premium', 'uso geral', 'coleções'],
    recommendation: { categories: [], marketingGoals: ['novidade', 'qualidade', 'look', 'presente', 'whatsapp'], tones: ['premium', 'elegante', 'direto'], priorityPreference: 'neutral', priceEmphasis: 'neutral' },
    apply: { storyTemplateId: 'premium', typographyPreset: 'premium', logoMode: 'primary', logoSize: 'medium' },
  }),
  luxury: style({
    id: 'luxury',
    label: 'Luxury',
    description: 'Contraste elegante para produtos de maior valor percebido.',
    recommendedFor: ['luxo', 'lançamentos', 'coleções especiais'],
    recommendation: { categories: ['moda-masculina', 'moda-feminina', 'acessorios', 'bolsas'], marketingGoals: ['novidade', 'desejo'], tones: ['premium', 'elegante'], priorityPreference: 'prefer', priceEmphasis: 'neutral' },
    apply: { storyTemplateId: 'luxury', typographyPreset: 'elegante', logoMode: 'white', logoSize: 'small' },
  }),
  minimal: style({
    id: 'minimal',
    label: 'Minimal',
    description: 'Composição limpa com foco no produto.',
    recommendedFor: ['uso geral', 'catálogo', 'produtos essenciais'],
    recommendation: { categories: [], marketingGoals: ['qualidade', 'look', 'presente'], tones: ['premium', 'direto', 'descontraído'], priorityPreference: 'neutral', priceEmphasis: 'neutral' },
    apply: { storyTemplateId: 'minimal', typographyPreset: 'moderno', logoMode: 'primary', logoSize: 'small' },
  }),
  offer: style({
    id: 'offer',
    label: 'Offer',
    description: 'Leitura direta para preço, condição e chamada.',
    recommendedFor: ['ofertas', 'condições', 'conversão'],
    recommendation: { categories: [], marketingGoals: ['oferta', 'ultimas-unidades', 'whatsapp'], tones: ['direto', 'urgente'], priorityPreference: 'prefer', priceEmphasis: 'prefer-present' },
    apply: { storyTemplateId: 'offer', typographyPreset: 'impacto', logoMode: 'white', logoSize: 'medium' },
  }),
  editorial: style({
    id: 'editorial',
    label: 'Editorial',
    description: 'Narrativa visual para coleções e destaques.',
    recommendedFor: ['coleções', 'novidades', 'conteúdo editorial'],
    recommendation: { categories: ['moda-masculina', 'moda-feminina', 'acessorios', 'bolsas'], marketingGoals: ['novidade', 'desejo', 'look'], tones: ['premium', 'elegante'], priorityPreference: 'neutral', priceEmphasis: 'neutral' },
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
    const recommendation = visualStyle.recommendation;
    if (!recommendation || !Array.isArray(recommendation.categories) || !Array.isArray(recommendation.marketingGoals) || !Array.isArray(recommendation.tones)) throw new Error(`Sinais de recomendação inválidos no estilo visual ${visualStyle.id}.`);
    if (recommendation.marketingGoals.some((goal) => !STORY_RECOMMENDATION_GOALS.includes(goal))) throw new Error(`Objetivo inválido no estilo visual ${visualStyle.id}.`);
    if (recommendation.tones.some((tone) => !STORY_RECOMMENDATION_TONES.includes(tone))) throw new Error(`Tom inválido no estilo visual ${visualStyle.id}.`);
    if (!STORY_RECOMMENDATION_PRIORITY_PREFERENCES.includes(recommendation.priorityPreference)) throw new Error(`Prioridade inválida no estilo visual ${visualStyle.id}.`);
    if (!STORY_RECOMMENDATION_PRICE_EMPHASES.includes(recommendation.priceEmphasis)) throw new Error(`Ênfase de preço inválida no estilo visual ${visualStyle.id}.`);
  }
  return true;
}

function style(value) {
  return Object.freeze({
    ...value,
    recommendedFor: Object.freeze([...value.recommendedFor]),
    recommendation: Object.freeze({ ...value.recommendation, categories: Object.freeze([...value.recommendation.categories]), marketingGoals: Object.freeze([...value.recommendation.marketingGoals]), tones: Object.freeze([...value.recommendation.tones]) }),
    apply: Object.freeze({ ...value.apply }),
  });
}
