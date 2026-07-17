import { DEFAULT_TEMPLATE_CATEGORY_ID, getTemplateCategoryById, isKnownTemplateCategory, listTemplateCategories } from '../../server/catalogs/templateCategories.js';

describe('template categories catalog', () => {
  it('lists categories ordered by their order field, including the default fallback', () => {
    const categories = listTemplateCategories();
    const orders = categories.map((category) => category.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(categories.map(({ id }) => id)).toContain(DEFAULT_TEMPLATE_CATEGORY_ID);
    expect(categories.every((category) => typeof category.id === 'string' && typeof category.label === 'string')).toBe(true);
  });

  it('resolves a known category by id and returns null for an unknown one', () => {
    expect(getTemplateCategoryById('moda-masculina')).toMatchObject({ label: 'Moda Masculina' });
    expect(getTemplateCategoryById('categoria-fantasma')).toBeNull();
  });

  it('reports whether a category id is known', () => {
    expect(isKnownTemplateCategory('bolsas')).toBe(true);
    expect(isKnownTemplateCategory('categoria-fantasma')).toBe(false);
  });

  it('never mutates the exported list (frozen catalog)', () => {
    const categories = listTemplateCategories();
    expect(() => { categories[0].label = 'Alterado'; }).toThrow();
  });
});
