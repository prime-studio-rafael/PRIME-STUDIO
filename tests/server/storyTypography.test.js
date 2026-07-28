import { STORY_DEFAULT_TYPOGRAPHY, STORY_TYPOGRAPHY_IDS, getStoryTypographyField, getStoryTypographyPreset } from '../../shared/storyTypographySpec.js';
import { storyTypographyFontFaces } from '../../server/services/storyTypographyFonts.js';

describe('Story typography presets', () => {
  it('defines only the four approved presets and defaults legacy Stories to Premium', () => {
    expect(STORY_DEFAULT_TYPOGRAPHY).toBe('premium');
    expect(STORY_TYPOGRAPHY_IDS).toEqual(['premium', 'moderno', 'elegante', 'impacto']);
    expect(getStoryTypographyPreset().label).toBe('Premium');
    expect(getStoryTypographyPreset('unknown').id).toBe('premium');
  });

  it('uses Bebas Neue only for Impact headline and price fields', () => {
    expect(getStoryTypographyField('impacto', 'headline').family).toBe('Bebas Neue');
    expect(getStoryTypographyField('impacto', 'priceText').family).toBe('Bebas Neue');
    for (const field of ['productLabel', 'calloutText', 'subheadline', 'ctaText', 'handle']) {
      expect(getStoryTypographyField('impacto', field).family).toBe('Inter');
    }
  });

  it.each(STORY_TYPOGRAPHY_IDS)('embeds local renderer font faces for %s without a generic fallback', (preset) => {
    const css = storyTypographyFontFaces(preset);
    expect(css).toContain('data:font/ttf;base64,');
    expect(css).not.toContain('Arial');
  });
});
