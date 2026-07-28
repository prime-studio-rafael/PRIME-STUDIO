export const STORY_TYPOGRAPHY_PRESETS = Object.freeze({
  premium: createPreset({ id: 'premium', label: 'Premium', preview: 'Aa', body: 'Manrope', display: 'Manrope', weights: { body: 500, emphasis: 700, display: 800 }, tracking: { body: '0em', display: '-0.025em' }, scale: { body: 1, display: 0.98 }, limits: { headline: 48, priceText: 20 } }),
  moderno: createPreset({ id: 'moderno', label: 'Moderno', preview: 'Aa', body: 'Inter', display: 'Inter', weights: { body: 500, emphasis: 700, display: 800 }, tracking: { body: '0em', display: '-0.02em' }, scale: { body: 1, display: 1 }, limits: { headline: 48, priceText: 20 } }),
  elegante: createPreset({ id: 'elegante', label: 'Elegante', preview: 'Aa', body: 'Plus Jakarta Sans', display: 'Plus Jakarta Sans', weights: { body: 500, emphasis: 700, display: 800 }, tracking: { body: '0.005em', display: '-0.018em' }, scale: { body: 0.98, display: 0.96 }, limits: { headline: 46, priceText: 20 } }),
  impacto: createPreset({ id: 'impacto', label: 'Impacto', preview: 'A!', body: 'Inter', display: 'Bebas Neue', weights: { body: 500, emphasis: 700, display: 400 }, tracking: { body: '0em', display: '0.035em' }, scale: { body: 1, display: 1.12 }, limits: { headline: 40, priceText: 18 } }),
});

const FIELD_ROLES = Object.freeze({
  productLabel: 'emphasis',
  calloutText: 'body',
  headline: 'display',
  subheadline: 'body',
  priceText: 'display',
  ctaText: 'emphasis',
  handle: 'body',
});

const BASE_LIMITS = Object.freeze({
  productLabel: Object.freeze({ maxChars: 32, maxLines: 2 }),
  calloutText: Object.freeze({ maxChars: 48, maxWords: 6, maxLines: 2 }),
  headline: Object.freeze({ maxChars: 48, maxWords: 4, maxLines: 2 }),
  subheadline: Object.freeze({ maxChars: 80, maxWords: 8, maxLines: 2 }),
  priceText: Object.freeze({ maxChars: 20, maxLines: 1 }),
  ctaText: Object.freeze({ maxChars: 28, maxWords: 3, maxLines: 1 }),
});

export const STORY_TYPOGRAPHY_IDS = Object.freeze(Object.keys(STORY_TYPOGRAPHY_PRESETS));
export const STORY_DEFAULT_TYPOGRAPHY = 'premium';

export function getStoryTypographyPreset(id = STORY_DEFAULT_TYPOGRAPHY) {
  return STORY_TYPOGRAPHY_PRESETS[id] || STORY_TYPOGRAPHY_PRESETS[STORY_DEFAULT_TYPOGRAPHY];
}

export function getStoryTypographyField(presetId, field) {
  const preset = getStoryTypographyPreset(presetId);
  const role = FIELD_ROLES[field] || 'body';
  const display = role === 'display';
  return Object.freeze({
    family: display ? preset.display : preset.body,
    weight: preset.weights[role] || preset.weights.body,
    letterSpacing: display ? preset.tracking.display : preset.tracking.body,
    scale: display ? preset.scale.display : preset.scale.body,
    lineHeightMultiplier: display ? 0.96 : 1,
  });
}

export function getStoryTypographyLimits(presetId, field) {
  const base = BASE_LIMITS[field];
  if (!base) return null;
  const preset = getStoryTypographyPreset(presetId);
  const maxChars = preset.limits[field] || base.maxChars;
  return Object.freeze({ ...base, maxChars });
}

function createPreset(preset) { return Object.freeze(preset); }
