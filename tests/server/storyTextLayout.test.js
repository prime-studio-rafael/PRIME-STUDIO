import { DEFAULT_STORY_LAYOUT_ID, STORY_CANVAS, STORY_LAYOUTS, getStoryLayout, getStoryLogoBox, normalizeStoryLayoutId, resolveStoryLogoVariant } from '../../shared/storyLayoutSpec.js';
import { layoutStoryText, storyTextWarnings } from '../../shared/storyTextLayout.js';
import { STORY_TYPOGRAPHY_IDS, getStoryTypographyField, getStoryTypographyLimits } from '../../shared/storyTypographySpec.js';

describe('shared Story visual contract', () => {
  it('keeps the five official catalog layouts inside the 1080x1920 canvas', () => {
    expect(STORY_CANVAS).toEqual({ width: 1080, height: 1920 });
    expect(STORY_LAYOUTS.map((layout) => layout.id)).toEqual(['premium', 'luxury', 'minimal', 'offer', 'editorial']);
    for (const layout of STORY_LAYOUTS) {
      expect(layout.palette.background).toMatch(/^#/);
      expect(layout.thumbnail.lines.length).toBeGreaterThan(0);
      expect(layout.regions.image.left + layout.regions.image.width).toBeLessThanOrEqual(STORY_CANVAS.width);
      expect(layout.regions.image.top + layout.regions.image.height).toBeLessThanOrEqual(STORY_CANVAS.height);
      expect(layout.regions.logo.left + layout.regions.logo.width).toBeLessThanOrEqual(STORY_CANVAS.width);
      expect(layout.regions.logo.top + layout.regions.logo.height).toBeLessThanOrEqual(STORY_CANVAS.height);
    }
  });

  it('uses predictable limits and warnings for headline, subheadline and CTA', () => {
    expect(layoutStoryText('Oferta especial hoje', 'headline')).toMatchObject({ blocked: false, lines: ['Oferta especial hoje'] });
    expect(layoutStoryText('uma headline com cinco palavras agora', 'headline')).toMatchObject({ blocked: true });
    expect(layoutStoryText('texto de subheadline com nove palavras para testar o limite', 'subheadline')).toMatchObject({ blocked: true });
    expect(layoutStoryText('compre agora mesmo', 'ctaText')).toMatchObject({ blocked: false });
    expect(layoutStoryText('compre agora mesmo hoje', 'ctaText')).toMatchObject({ blocked: true });
    expect(storyTextWarnings({ headline: 'uma headline com cinco palavras agora' })[0]).toMatchObject({ field: 'headline', blocked: true });
  });

  it('resolves logo variants and sizes deterministically inside each layout box', () => {
    const offer = STORY_LAYOUTS.find((layout) => layout.id === 'offer');
    const light = STORY_LAYOUTS.find((layout) => layout.id === 'minimal');
    expect(resolveStoryLogoVariant(light, 'auto', true)).toMatchObject({ variant: 'primary', fallback: false });
    expect(resolveStoryLogoVariant(offer, 'auto', true)).toMatchObject({ variant: 'white', fallback: false });
    expect(resolveStoryLogoVariant(offer, 'auto', false)).toMatchObject({ variant: 'primary', fallback: true });
    expect(resolveStoryLogoVariant(offer, 'white', false).variant).toBeNull();
    expect(getStoryLogoBox(offer, 'small').width).toBeLessThan(getStoryLogoBox(offer, 'medium').width);
    expect(getStoryLogoBox(offer, 'large').width).toBeGreaterThan(getStoryLogoBox(offer, 'medium').width);
  });

  it('uses Premium for absent layouts and keeps product-highlight as a legacy alias', () => {
    expect(DEFAULT_STORY_LAYOUT_ID).toBe('premium');
    expect(normalizeStoryLayoutId()).toBe('premium');
    expect(normalizeStoryLayoutId('product-highlight')).toBe('premium');
    expect(getStoryLayout('product-highlight')).toMatchObject({ id: 'premium', label: 'Premium' });
    expect(getStoryLayout('unknown')).toBeNull();
  });

  it('keeps typography roles and limits in one shared visual contract', () => {
    expect(STORY_TYPOGRAPHY_IDS).toEqual(['premium', 'moderno', 'elegante', 'impacto']);
    expect(getStoryTypographyField('impacto', 'headline').family).toBe('Bebas Neue');
    expect(getStoryTypographyField('impacto', 'priceText').family).toBe('Bebas Neue');
    expect(getStoryTypographyField('impacto', 'subheadline').family).toBe('Inter');
    expect(getStoryTypographyLimits('impacto', 'headline').maxChars).toBe(40);
    expect(layoutStoryText('uma headline com quatro palavras extras', 'headline', 'impacto')).toMatchObject({ blocked: true });
  });
});
