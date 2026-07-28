import { applyStoryVisualStyle, getStoryVisualStyle, listStoryVisualStyles, resolveStoryVisualStyle, validateStoryVisualStyleCatalog } from '../../shared/storyVisualStyleSpec.js';

const expected = Object.freeze({
  'prime-store': { storyTemplateId: 'premium', typographyPreset: 'premium', logoMode: 'primary', logoSize: 'medium' },
  luxury: { storyTemplateId: 'luxury', typographyPreset: 'elegante', logoMode: 'white', logoSize: 'small' },
  minimal: { storyTemplateId: 'minimal', typographyPreset: 'moderno', logoMode: 'primary', logoSize: 'small' },
  offer: { storyTemplateId: 'offer', typographyPreset: 'impacto', logoMode: 'white', logoSize: 'medium' },
  editorial: { storyTemplateId: 'editorial', typographyPreset: 'elegante', logoMode: 'primary', logoSize: 'small' },
});

describe('storyVisualStyleSpec', () => {
  it('provides the five official styles with only valid existing references', () => {
    expect(listStoryVisualStyles().map(({ id }) => id)).toEqual(Object.keys(expected));
    expect(validateStoryVisualStyleCatalog()).toBe(true);
    for (const [id, apply] of Object.entries(expected)) {
      expect(getStoryVisualStyle(id)).toMatchObject({ id, apply });
      expect(getStoryVisualStyle(id).recommendedFor.length).toBeGreaterThan(0);
      expect(applyStoryVisualStyle(id)).toEqual(apply);
    }
  });

  it('derives an official style only from an exact persisted configuration', () => {
    for (const [id, apply] of Object.entries(expected)) expect(resolveStoryVisualStyle({ ...apply, unrelated: true })?.id).toBe(id);
    expect(resolveStoryVisualStyle({ ...expected.luxury, logoSize: 'medium' })).toBeNull();
    expect(resolveStoryVisualStyle({ storyTemplateId: 'product-highlight', typographyPreset: 'premium', logoMode: 'primary', logoSize: 'medium' })).toBeNull();
  });

  it('fails clearly when a style references an unavailable contract value', () => {
    const invalid = { broken: { id: 'broken', recommendedFor: [], apply: { ...expected['prime-store'], typographyPreset: 'missing' } } };
    expect(() => validateStoryVisualStyleCatalog(invalid)).toThrow('Tipografia inválida no estilo visual broken: missing');
  });
});
