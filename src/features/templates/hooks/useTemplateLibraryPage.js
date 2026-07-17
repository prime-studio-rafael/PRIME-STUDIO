import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTemplatesPage } from '../api/templatesClient.js';
import { ALL_CATEGORIES } from './useTemplateLibraryFilters.js';

const DEFAULT_PAGE_SIZE = 12;

// Paginação real (server-side) para a biblioteca de templates: busca e categoria são enviadas
// ao backend via fetchTemplatesPage, nunca filtradas em memória sobre a lista inteira. Trocar
// busca/categoria reinicia para a página 1 e descarta os itens acumulados; "carregar mais"
// soma a próxima página sem duplicar registros e sem apagar os já carregados em caso de erro.
export default function useTemplateLibraryPage({ pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const requestSeq = useRef(0);

  const fetchPage = useCallback(async (nextPage, { append }) => {
    const seq = (requestSeq.current += 1);
    if (append) { setLoadingMore(true); setLoadMoreError(''); } else { setInitialLoading(true); setError(''); }
    try {
      const effectiveCategory = category === ALL_CATEGORIES ? undefined : category;
      const result = await fetchTemplatesPage({ page: nextPage, pageSize, search: search || undefined, category: effectiveCategory });
      if (seq !== requestSeq.current) return;
      setItems((current) => {
        const nextItems = result.templates || [];
        if (!append) return nextItems;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !seen.has(item.id))];
      });
      setPage(result.page || nextPage);
      setTotal(Number.isFinite(result.total) ? result.total : 0);
    } catch (nextError) {
      if (seq !== requestSeq.current) return;
      const message = nextError.message || 'Não foi possível carregar os templates locais.';
      if (append) setLoadMoreError(message); else setError(message);
    } finally {
      if (seq !== requestSeq.current) return;
      if (append) setLoadingMore(false); else setInitialLoading(false);
    }
  }, [category, pageSize, search]);

  useEffect(() => {
    setItems([]);
    fetchPage(1, { append: false }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, pageSize]);

  const loadMore = useCallback(() => fetchPage(page + 1, { append: true }), [fetchPage, page]);
  const reload = useCallback(() => { setItems([]); return fetchPage(1, { append: false }); }, [fetchPage]);

  return {
    items,
    total,
    search,
    setSearch,
    category,
    setCategory,
    hasMore: items.length < total,
    initialLoading,
    loadingMore,
    error,
    loadMoreError,
    loadMore,
    reload,
  };
}
