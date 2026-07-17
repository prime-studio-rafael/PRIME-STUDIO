import { useCallback, useEffect, useState } from 'react';
import { deleteResult, fetchResult, fetchResults, updateResultStatus } from '../api/resultsClient.js';
export default function useResults(enabled) {
  const [results, setResults] = useState([]); const [status, setStatus] = useState('idle'); const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); const [mutationPending, setMutationPending] = useState(false);
  const load = useCallback(async () => { setStatus('loading'); setError(''); try { setResults(await fetchResults()); setStatus('ready'); } catch (nextError) { setError(nextError.message || 'Não foi possível carregar os resultados locais.'); setStatus('error'); throw nextError; } }, []);
  useEffect(() => { if (enabled && status === 'idle') load().catch(() => {}); }, [enabled, load, status]);
  const open = useCallback(async (id) => { setError(''); try { const detail = await fetchResult(id); setSelected(detail); return detail; } catch (nextError) { setError(nextError.message); throw nextError; } }, []);
  const setReviewStatus = useCallback(async (id, reviewStatus) => { setMutationPending(true); setError(''); try { const updated = await updateResultStatus(id, reviewStatus); setResults((current) => current.map((result) => result.id === id ? updated : result)); setSelected((current) => current?.id === id ? updated : current); return updated; } catch (nextError) { setError(nextError.message); throw nextError; } finally { setMutationPending(false); } }, []);
  const remove = useCallback(async (id) => { setMutationPending(true); setError(''); try { await deleteResult(id); setResults((current) => current.filter((result) => result.id !== id)); setSelected(null); } catch (nextError) { setError(nextError.message); throw nextError; } finally { setMutationPending(false); } }, []);
  return { results, status, error, selected, mutationPending, load, open, close: () => setSelected(null), setReviewStatus, remove };
}
