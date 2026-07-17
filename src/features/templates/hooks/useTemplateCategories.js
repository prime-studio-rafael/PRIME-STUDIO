import { useCallback, useEffect, useState } from 'react';
import { fetchTemplateCategories } from '../api/templatesClient.js';

export default function useTemplateCategories() {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setCategories(await fetchTemplateCategories());
      setStatus('ready');
    } catch (nextError) {
      setError(nextError.message || 'Não foi possível carregar as categorias de templates.');
      setStatus('error');
    }
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  return { categories, status, error, load };
}
