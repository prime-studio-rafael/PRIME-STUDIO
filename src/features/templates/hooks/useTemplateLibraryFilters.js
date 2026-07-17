import { useMemo, useState } from 'react';

export const ALL_CATEGORIES = 'all';
export const DEFAULT_TEMPLATE_CATEGORY_ID = 'sem-categoria';

// Filtro/busca client-side sobre uma lista de templates já carregada (mesmo padrão já usado em
// ResultsPage/BatchesPage). O backend também expõe paginação/busca via fetchTemplatesPage para
// quando o catálogo crescer o suficiente para exigir carregar sob demanda; esta fase mantém a
// UI simples, filtrando em memória a lista que useTemplates() já busca por completo.
export default function useTemplateLibraryFilters(templates = []) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return templates.filter((template) => {
      if (category !== ALL_CATEGORIES && template.category !== category) return false;
      if (!normalizedSearch) return true;
      const inLabel = (template.label || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch);
      const inTags = (template.tags || []).some((tag) => tag.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
      return inLabel || inTags;
    });
  }, [templates, search, category]);

  return { search, setSearch, category, setCategory, filtered };
}
