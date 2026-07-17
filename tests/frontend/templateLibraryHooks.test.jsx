/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import useTemplateCategories from '../../src/features/templates/hooks/useTemplateCategories.js';
import useTemplateLibraryFilters from '../../src/features/templates/hooks/useTemplateLibraryFilters.js';
import * as api from '../../src/features/templates/api/templatesClient.js';

vi.mock('../../src/features/templates/api/templatesClient.js', () => ({ fetchTemplateCategories: vi.fn() }));

const templates = [
  { id: 'a', label: 'Camisa polo', category: 'moda-masculina', tags: ['casual', 'verão'] },
  { id: 'b', label: 'Vestido floral', category: 'moda-feminina', tags: ['festa'] },
  { id: 'c', label: 'Tênis corrida', category: 'tenis-masculino', tags: ['esporte'] },
];

describe('useTemplateCategories', () => {
  it('loads categories on mount and exposes loading/ready/error states', async () => {
    api.fetchTemplateCategories.mockResolvedValueOnce([{ id: 'bolsas', label: 'Bolsas' }]);
    const { result } = renderHook(() => useTemplateCategories());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.categories).toEqual([{ id: 'bolsas', label: 'Bolsas' }]);
  });

  it('surfaces a friendly error when the request fails', async () => {
    api.fetchTemplateCategories.mockRejectedValueOnce(new Error('Falha ao carregar categorias.'));
    const { result } = renderHook(() => useTemplateCategories());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Falha ao carregar categorias.');
  });
});

describe('useTemplateLibraryFilters', () => {
  it('returns all templates by default', () => {
    const { result } = renderHook(() => useTemplateLibraryFilters(templates));
    expect(result.current.filtered).toHaveLength(3);
  });

  it('filters by category', () => {
    const { result } = renderHook(() => useTemplateLibraryFilters(templates));
    act(() => result.current.setCategory('moda-feminina'));
    expect(result.current.filtered.map(({ id }) => id)).toEqual(['b']);
  });

  it('filters by search across label and tags', () => {
    const { result } = renderHook(() => useTemplateLibraryFilters(templates));
    act(() => result.current.setSearch('polo'));
    expect(result.current.filtered.map(({ id }) => id)).toEqual(['a']);
    act(() => result.current.setSearch('esporte'));
    expect(result.current.filtered.map(({ id }) => id)).toEqual(['c']);
  });

  it('combines category and search filters', () => {
    const { result } = renderHook(() => useTemplateLibraryFilters(templates));
    act(() => { result.current.setCategory('moda-masculina'); result.current.setSearch('verão'); });
    expect(result.current.filtered.map(({ id }) => id)).toEqual(['a']);
    act(() => result.current.setSearch('festa'));
    expect(result.current.filtered).toHaveLength(0);
  });
});
